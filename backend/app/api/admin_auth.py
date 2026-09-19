from __future__ import annotations

from fastapi import HTTPException

from app.settings import settings

PRESENTATION_ADMIN_KEY = "presentation"


def require_admin_key(value: str | None) -> None:
    normalized = (value or "").strip()
    if normalized == settings.api_secret:
        return
    if settings.environment.strip().lower() == "development" and normalized == PRESENTATION_ADMIN_KEY:
        return
    raise HTTPException(status_code=401, detail="credencial administrativa inválida")
