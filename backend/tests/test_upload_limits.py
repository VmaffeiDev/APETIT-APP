import asyncio
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from fastapi import HTTPException, UploadFile

from app.services import upload_limits as limits


def test_upload_reads_only_limit_plus_one(monkeypatch):
    monkeypatch.setattr(limits, "MAX_UPLOAD_BYTES", 8)
    source = BytesIO(b"x" * 100)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(limits.read_limited_upload(UploadFile(file=source)))
    assert exc.value.status_code == 413
    assert source.tell() == 9


def test_upload_accepts_exact_limit(monkeypatch):
    monkeypatch.setattr(limits, "MAX_UPLOAD_BYTES", 8)
    assert asyncio.run(limits.read_limited_upload(UploadFile(file=BytesIO(b"x" * 8)))) == b"x" * 8


def test_empty_upload_is_rejected():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(limits.read_limited_upload(UploadFile(file=BytesIO())))
    assert exc.value.status_code == 422


def archive(entries):
    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as output:
        for name, content in entries:
            output.writestr(name, content)
    return buffer.getvalue()


def test_compressed_archive_is_checked_before_expansion(monkeypatch):
    monkeypatch.setattr(limits, "MAX_XLSX_EXPANDED_BYTES", 1024)
    content = archive([("xl/worksheets/sheet1.xml", b"x" * 2000)])
    assert len(content) < 1024
    with pytest.raises(HTTPException) as exc:
        limits.validate_xlsx_archive(content)
    assert exc.value.status_code == 413


def test_archive_entry_count_is_limited(monkeypatch):
    monkeypatch.setattr(limits, "MAX_XLSX_ENTRIES", 1)
    with pytest.raises(HTTPException) as exc:
        limits.validate_xlsx_archive(archive([("a", b"a"), ("b", b"b")]))
    assert exc.value.status_code == 413


def test_valid_small_archive_is_accepted():
    limits.validate_xlsx_archive(archive([("xl/workbook.xml", b"<workbook/>")]))


def test_invalid_archive_is_rejected():
    with pytest.raises(HTTPException) as exc:
        limits.validate_xlsx_archive(b"not an XLSX")
    assert exc.value.status_code == 422
