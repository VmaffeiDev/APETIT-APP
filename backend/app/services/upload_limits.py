from io import BytesIO
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException, UploadFile

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_XLSX_EXPANDED_BYTES = 40 * 1024 * 1024
MAX_XLSX_ENTRIES = 1000


async def read_limited_upload(file: UploadFile) -> bytes:
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="arquivo excede o limite de 10 MB")
    if not content:
        raise HTTPException(status_code=422, detail="o arquivo enviado está vazio")
    return content


def validate_xlsx_archive(content: bytes) -> None:
    """Check ZIP metadata before openpyxl expands workbook XML into memory."""
    try:
        with ZipFile(BytesIO(content)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_XLSX_ENTRIES or sum(entry.file_size for entry in entries) > MAX_XLSX_EXPANDED_BYTES:
                raise HTTPException(status_code=413, detail="planilha excede o limite de processamento")
            if any(entry.flag_bits & 1 for entry in entries):
                raise HTTPException(status_code=422, detail="planilhas criptografadas não são suportadas")
    except BadZipFile as exc:
        raise HTTPException(status_code=422, detail="arquivo XLSX inválido") from exc
