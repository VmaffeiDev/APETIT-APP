from __future__ import annotations

import io
import re
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path

import fitz
from PIL import Image
from pillow_heif import register_heif_opener
from pypdf import PdfReader

from app.domain.prescription import NutritionTarget, PortionInstruction, PrescriptionMeal
from app.services.ocr import OcrError, extract_document_text
from app.settings import settings

register_heif_opener()

_MEAL_ALIASES = {
    "almoco": "almoco",
    "almoço": "almoco",
    "jantar": "jantar",
    "cafe": "cafe",
    "café": "cafe",
    "lanche": "lanche",
}

_NUMBER_PATTERNS = {
    "kcal": re.compile(r"(?:energia|kcal)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)", re.IGNORECASE),
    "protein_g": re.compile(r"prote[ií]na\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*g?", re.IGNORECASE),
    "carbs_g": re.compile(r"carbo(?:idrato)?s?\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*g?", re.IGNORECASE),
    "fat_g": re.compile(r"gordura(?:s)?\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*g?", re.IGNORECASE),
}

_PORTION_RE = re.compile(
    r"(?P<quantity>\d+(?:[.,]\d+)?)\s*(?P<unit>g|kg|ml|l|colher(?:es)?|concha(?:s)?|por[cç][aã]o(?:es)?)\s+(?:de\s+)?(?P<category>[\wÀ-ÿ][\wÀ-ÿ\s-]*)",
    re.IGNORECASE,
)


def _ocr_image(content: bytes) -> tuple[str | None, str]:
    try:
        text = extract_document_text(content).strip()
    except OcrError:
        return None, "needs_ocr"
    return (text, "ocr_text") if text else (None, "needs_ocr")


def _heic_to_png(content: bytes) -> bytes | None:
    try:
        with Image.open(io.BytesIO(content)) as image:
            converted = image.convert("RGB")
            output = io.BytesIO()
            converted.save(output, format="PNG")
            return output.getvalue()
    except (OSError, ValueError):
        return None


def _ocr_pdf(content: bytes) -> tuple[str | None, str]:
    try:
        document = fitz.open(stream=content, filetype="pdf")
    except Exception:
        return None, "needs_ocr"

    pages: list[str] = []
    try:
        page_count = min(len(document), max(1, settings.ocr_pdf_max_pages))
        for index in range(page_count):
            page = document[index]
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            image_bytes = pixmap.tobytes("png")
            try:
                page_text = extract_document_text(image_bytes).strip()
            except OcrError:
                return None, "needs_ocr"
            if page_text:
                pages.append(page_text)
    finally:
        document.close()

    text = "\n".join(pages).strip()
    return (text, "ocr_pdf") if text else (None, "needs_ocr")


def extract_text(file_name: str, content: bytes) -> tuple[str | None, str]:
    extension = Path(file_name).suffix.lower()
    if extension in {".txt", ".md"}:
        return content.decode("utf-8-sig", errors="replace"), "text"
    if extension == ".pdf":
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
        if text:
            return text, "pdf_text"
        return _ocr_pdf(content)
    if extension in {".png", ".jpg", ".jpeg", ".webp"}:
        return _ocr_image(content)
    if extension in {".heic", ".heif"}:
        converted = _heic_to_png(content)
        if not converted:
            return None, "needs_ocr"
        text, status = _ocr_image(converted)
        return text, "ocr_heic" if text else status
    return None, "unsupported"


def _to_decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    return Decimal(value.replace(",", "."))


def parse_prescription_text(text: str, default_meal_type: str = "almoco") -> PrescriptionMeal:
    normalized = text.strip()
    meal_type = default_meal_type
    lowered = normalized.casefold()
    for alias, canonical in _MEAL_ALIASES.items():
        if alias in lowered:
            meal_type = canonical
            break

    values: dict[str, Decimal | None] = {}
    for key, pattern in _NUMBER_PATTERNS.items():
        match = pattern.search(normalized)
        values[key] = _to_decimal(match.group(1)) if match else None

    portions: list[PortionInstruction] = []
    for line in normalized.splitlines():
        match = _PORTION_RE.search(line.strip())
        if not match:
            continue
        category = match.group("category").strip(" .,:;-").casefold()
        portions.append(
            PortionInstruction(
                category=category,
                quantity=_to_decimal(match.group("quantity")),
                unit=match.group("unit").casefold(),
            )
        )

    return PrescriptionMeal(
        meal_type=meal_type,
        target=NutritionTarget(
            kcal=values["kcal"],
            protein_g=values["protein_g"],
            carbs_g=values["carbs_g"],
            fat_g=values["fat_g"],
        ),
        portions=tuple(portions),
    )


def meal_to_payload(meal: PrescriptionMeal) -> dict:
    return {
        "meal_type": meal.meal_type,
        "target": asdict(meal.target),
        "portions": [asdict(portion) for portion in meal.portions],
    }
