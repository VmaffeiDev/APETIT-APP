import io

import pytest
from PIL import Image
from pypdf import PdfWriter

from app.services import prescription_document as documents
from app.services import ocr
from app.settings import settings


def pdf(pages):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=100, height=100)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def test_pdf_over_limit_is_rejected_before_ocr(monkeypatch):
    monkeypatch.setattr(settings, "ocr_pdf_max_pages", 1)
    monkeypatch.setattr(documents, "_ocr_pdf", lambda _: pytest.fail("OCR must not run"))
    with pytest.raises(documents.DocumentLimitError, match="1 páginas"):
        documents.extract_text("test.pdf", pdf(2))


def test_pdf_at_limit_can_continue_to_ocr(monkeypatch):
    monkeypatch.setattr(settings, "ocr_pdf_max_pages", 1)
    monkeypatch.setattr(documents, "_ocr_pdf", lambda _: ("Almoço", "ocr_pdf"))
    assert documents.extract_text("test.pdf", pdf(1)) == ("Almoço", "ocr_pdf")


def test_image_over_pixel_limit_is_rejected_before_provider(monkeypatch):
    monkeypatch.setattr(documents, "MAX_IMAGE_PIXELS", 99)
    monkeypatch.setattr(documents, "_ocr_image", lambda _: pytest.fail("Provider must not run"))
    output = io.BytesIO()
    Image.new("RGB", (10, 10)).save(output, format="PNG")
    with pytest.raises(documents.DocumentLimitError):
        documents.extract_text("test.png", output.getvalue())


def test_image_at_pixel_limit_is_accepted(monkeypatch):
    monkeypatch.setattr(documents, "MAX_IMAGE_PIXELS", 100)
    monkeypatch.setattr(documents, "_ocr_image", lambda _: ("Almoço", "ocr_text"))
    output = io.BytesIO()
    Image.new("RGB", (10, 10)).save(output, format="PNG")
    assert documents.extract_text("test.png", output.getvalue()) == ("Almoço", "ocr_text")


def test_ocr_response_read_is_bounded(monkeypatch):
    monkeypatch.setattr(settings, "ocr_provider", "google_vision")
    monkeypatch.setattr(settings, "google_vision_api_key", "test-only")
    monkeypatch.setattr(ocr, "MAX_OCR_RESPONSE_BYTES", 8)
    response = io.BytesIO(b"x" * 100)
    monkeypatch.setattr(ocr.request, "urlopen", lambda *args, **kwargs: response)
    with pytest.raises(ocr.OcrError, match="excede"):
        ocr.extract_document_text(b"synthetic")


def test_pdf_render_is_rejected_before_allocating_large_bitmap(monkeypatch):
    writer = PdfWriter()
    writer.add_blank_page(width=10000, height=10000)
    output = io.BytesIO()
    writer.write(output)
    monkeypatch.setattr(documents, "extract_document_text", lambda _: pytest.fail("Provider must not run"))
    with pytest.raises(documents.DocumentLimitError):
        documents._ocr_pdf(output.getvalue())
