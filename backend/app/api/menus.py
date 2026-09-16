from __future__ import annotations

from datetime import date
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.services.menu_import import read_planning_csv, read_planning_xlsx_bytes
from app.services.menu_workflow import (
    preview_payload,
    publish_staged_menu,
    published_menu_for_day,
    stage_menu_import,
)
from app.settings import settings


router = APIRouter()


class PublishMenuRequest(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2020, le=2100)
    confirm_period: bool


def _require_admin_key(value: str | None) -> None:
    if not value or value != settings.api_secret:
        raise HTTPException(status_code=401, detail="credencial administrativa inválida")


@router.post("/api/admin/menu-imports/preview", tags=["admin-menu"])
async def preview_menu_import(
    unit_id: UUID = Form(...),
    meal_type: str = Form("almoco"),
    file: UploadFile = File(...),
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin_key(x_apetit_admin_key)

    file_name = file.filename or "cardapio"
    extension = Path(file_name).suffix.lower()
    content = await file.read()

    try:
        if extension == ".xlsx":
            items = read_planning_xlsx_bytes(content)
        elif extension == ".csv":
            items = read_planning_csv(content)
        else:
            raise HTTPException(
                status_code=415,
                detail="formato não suportado; envie .xlsx ou .csv",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"não foi possível ler o cardápio: {exc}") from exc

    staged = stage_menu_import(
        unit_id=str(unit_id),
        meal_type=meal_type.strip().lower(),
        file_name=file_name,
        items=items,
    )
    return preview_payload(staged)


@router.post("/api/admin/menu-imports/{preview_id}/publish", tags=["admin-menu"])
def publish_menu_import(
    preview_id: str,
    payload: PublishMenuRequest,
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin_key(x_apetit_admin_key)
    if not payload.confirm_period:
        raise HTTPException(
            status_code=409,
            detail="confirme explicitamente o período antes de publicar",
        )

    try:
        return publish_staged_menu(
            preview_id=preview_id,
            month=payload.month,
            year=payload.year,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/api/menu", tags=["menu"])
def get_published_menu(
    unit_id: UUID,
    service_date: date,
    meal_type: str = "almoco",
) -> dict:
    try:
        return published_menu_for_day(
            unit_id=str(unit_id),
            service_date=service_date,
            meal_type=meal_type.strip().lower(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
