from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.db import engine

from app.services.menu_import import read_planning_csv, read_planning_xlsx_bytes
from app.services.menu_workflow import (
    preview_payload,
    publish_staged_menu,
    published_menu_for_day,
    stage_menu_import,
)
from app.api.admin_auth import require_admin_key


router = APIRouter()


class PublishMenuRequest(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2020, le=2100)
    confirm_period: bool



@router.post("/api/admin/menu-imports/preview", tags=["admin-menu"])
async def preview_menu_import(
    unit_id: UUID = Form(...),
    meal_type: str = Form("almoco"),
    file: UploadFile = File(...),
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    require_admin_key(x_apetit_admin_key)

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
    require_admin_key(x_apetit_admin_key)
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


@router.get("/api/admin/menus/week", tags=["admin-menu"])
def admin_menu_week(
    unit_id: UUID,
    week_start: date,
    meal_type: str = "almoco",
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    require_admin_key(x_apetit_admin_key)
    if week_start.weekday() != 0:
        raise HTTPException(status_code=422, detail="week_start deve ser uma segunda-feira")
    if meal_type not in {"almoco", "jantar", "cafe"}:
        raise HTTPException(status_code=422, detail="tipo de refeição inválido")
    week_end = week_start + timedelta(days=6)
    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM units WHERE id = :unit_id"),
            {"unit_id": unit_id},
        ).scalar_one_or_none()
        if exists is None:
            raise HTTPException(status_code=404, detail="unidade não encontrada")
        rows = conn.execute(
            text("""
                SELECT md.service_date, mi.id, mi.name, mi.category,
                       mi.standard_portion, mi.technical_sheet_code,
                       mi.kcal, mi.protein_g, mi.carbs_g, mi.fat_g,
                       ts.code AS sheet_found,
                       ts.kcal AS sheet_kcal, ts.protein_g AS sheet_protein,
                       ts.carbs_g AS sheet_carbs, ts.fat_g AS sheet_fat
                FROM menu_days md
                JOIN menu_items mi ON mi.menu_day_id = md.id
                LEFT JOIN technical_sheets ts ON ts.code = mi.technical_sheet_code
                WHERE md.unit_id = :unit_id
                  AND md.service_date BETWEEN :start AND :end
                  AND md.meal_type = :meal_type
                ORDER BY md.service_date, mi.category, mi.name, mi.id
            """),
            {"unit_id": unit_id, "start": week_start, "end": week_end,
             "meal_type": meal_type},
        ).mappings().all()

    days = [
        {"date": (week_start + timedelta(days=offset)).isoformat(), "items": []}
        for offset in range(7)
    ]
    for row in rows:
        if not row["technical_sheet_code"]:
            status = "no_code"
        elif row["sheet_found"] is None:
            status = "missing"
        elif all(row[key] is not None for key in
                 ("sheet_kcal", "sheet_protein", "sheet_carbs", "sheet_fat")):
            status = "complete"
        else:
            status = "incomplete"
        days[(row["service_date"] - week_start).days]["items"].append({
            "id": str(row["id"]),
            "name": row["name"],
            "category": row["category"],
            "portion": row["standard_portion"],
            "technical_sheet_code": row["technical_sheet_code"],
            "sheet_status": status,
            "kcal": float(row["kcal"]) if row["kcal"] is not None else None,
            "protein_g": float(row["protein_g"]) if row["protein_g"] is not None else None,
            "carbs_g": float(row["carbs_g"]) if row["carbs_g"] is not None else None,
            "fat_g": float(row["fat_g"]) if row["fat_g"] is not None else None,
        })
    all_items = [item for day in days for item in day["items"]]
    complete = sum(item["sheet_status"] == "complete" for item in all_items)
    return {
        "unit_id": str(unit_id),
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "meal_type": meal_type,
        "days": days,
        "summary": {
            "total_items": len(all_items),
            "days_with_menu": sum(bool(day["items"]) for day in days),
            "complete": complete,
            "incomplete": sum(item["sheet_status"] == "incomplete"
                              for item in all_items),
            "missing": sum(item["sheet_status"] in {"missing", "no_code"}
                           for item in all_items),
        },
    }
