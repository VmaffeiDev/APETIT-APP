from __future__ import annotations

import base64
import json
from urllib import error, parse, request

from app.settings import settings


class OcrError(RuntimeError):
    pass


def extract_document_text(image_bytes: bytes) -> str:
    provider = settings.ocr_provider.strip().lower()
    if provider in {"", "none", "disabled"}:
        raise OcrError("OCR não configurado")
    if provider != "google_vision":
        raise OcrError(f"provedor OCR não suportado: {settings.ocr_provider}")
    if not settings.google_vision_api_key:
        raise OcrError("Google Vision OCR não configurado")

    payload = {
        "requests": [
            {
                "image": {"content": base64.b64encode(image_bytes).decode("ascii")},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                "imageContext": {"languageHints": ["pt"]},
            }
        ]
    }
    endpoint = (
        "https://vision.googleapis.com/v1/images:annotate?key="
        + parse.quote(settings.google_vision_api_key, safe="")
    )
    http_request = request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with request.urlopen(http_request, timeout=settings.ocr_timeout_seconds) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (error.HTTPError, error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise OcrError("não foi possível processar o documento no serviço de OCR") from exc

    responses = body.get("responses") or []
    if not responses:
        raise OcrError("serviço de OCR retornou resposta vazia")
    first = responses[0]
    if first.get("error"):
        raise OcrError("serviço de OCR retornou erro ao analisar o documento")
    text = ((first.get("fullTextAnnotation") or {}).get("text") or "").strip()
    return text
