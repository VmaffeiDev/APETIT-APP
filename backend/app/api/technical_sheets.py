from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.db import engine
from app.services.technical_sheet_import import preview_payload as import_preview_payload
from app.services.technical_sheet_import import publish_import, stage_import
from app.api.admin_auth import AdminPrincipal, require_admin, require_permission, require_unit_access

router = APIRouter()


class AllergenPayload(BaseModel):
    allergen: str = Field(min_length=1, max_length=120)
    status: str = Field(default="contains", pattern="^(contains|may_contain|free_from)$")


class TechnicalSheetPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=120)
    portion_quantity: Decimal | None = Field(default=None, gt=0)
    portion_unit: str | None = Field(default=None, max_length=40)
    kcal: Decimal | None = Field(default=None, ge=0)
    protein_g: Decimal | None = Field(default=None, ge=0)
    carbs_g: Decimal | None = Field(default=None, ge=0)
    fat_g: Decimal | None = Field(default=None, ge=0)
    ingredients: list[str] = Field(default_factory=list)
    allergens: list[AllergenPayload] = Field(default_factory=list)



def _sheet_payload(conn, code: str) -> dict | None:
    row = conn.execute(
        text(
            """
            SELECT code, name, category, portion_quantity, portion_unit,
                   kcal, protein_g, carbs_g, fat_g, updated_at
            FROM technical_sheets WHERE code = :code
            """
        ),
        {"code": code},
    ).mappings().one_or_none()
    if row is None:
        return None

    ingredients = conn.execute(
        text(
            "SELECT ingredient FROM technical_sheet_ingredients "
            "WHERE technical_sheet_code = :code ORDER BY position"
        ),
        {"code": code},
    ).scalars().all()
    allergens = conn.execute(
        text(
            "SELECT allergen, status FROM technical_sheet_allergens "
            "WHERE technical_sheet_code = :code ORDER BY allergen"
        ),
        {"code": code},
    ).mappings().all()

    return {
        **dict(row),
        "ingredients": list(ingredients),
        "allergens": [dict(item) for item in allergens],
    }


@router.post("/api/admin/technical-sheets/imports/preview", tags=["admin-technical-sheets"])
async def preview_technical_sheet_import(
    file: UploadFile = File(...),
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "manage_sheets")
    file_name = file.filename or "fichas-tecnicas"
    if Path(file_name).suffix.lower() not in {".xlsx", ".csv"}:
        raise HTTPException(status_code=415, detail="formato não suportado; envie .xlsx ou .csv")
    content = await file.read()
    try:
        staged = stage_import(file_name, content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return import_preview_payload(staged)


@router.post("/api/admin/technical-sheets/imports/{preview_id}/publish", tags=["admin-technical-sheets"])
def publish_technical_sheet_import(
    preview_id: str,
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "manage_sheets")
    try:
        return publish_import(preview_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/admin/technical-sheets", tags=["admin-technical-sheets"])
def list_technical_sheets(
    search: str = Query(default="", max_length=120),
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "read")
    term = search.strip()
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT code, name, category, portion_quantity, portion_unit,
                       kcal, protein_g, carbs_g, fat_g, updated_at
                FROM technical_sheets
                WHERE (:term = '' OR code ILIKE :pattern OR name ILIKE :pattern)
                ORDER BY name
                LIMIT 200
                """
            ),
            {"term": term, "pattern": f"%{term}%"},
        ).mappings().all()
    return {"items": [dict(row) for row in rows], "count": len(rows)}


@router.get("/api/admin/technical-sheets/coverage", tags=["admin-technical-sheets"])
def technical_sheet_coverage(
    unit_id: UUID,
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "read")
    require_unit_access(principal, unit_id)

    with engine.connect() as conn:
        target = conn.execute(
            text(
                """
                SELECT id, file_name, period_start, period_end, published_at
                FROM menu_imports
                WHERE unit_id = :unit_id AND status = 'published'
                ORDER BY
                    CASE WHEN file_name ILIKE 'demo-%' THEN 1 ELSE 0 END,
                    published_at DESC NULLS LAST,
                    created_at DESC,
                    id DESC
                LIMIT 1
                """
            ),
            {"unit_id": unit_id},
        ).mappings().one_or_none()

        rows = []
        if target is not None:
            rows = conn.execute(
                text(
                    """
                    SELECT
                        mi.technical_sheet_code AS code,
                        mi.name,
                        mi.category,
                        md.service_date,
                        ts.code AS sheet_found,
                        ts.kcal,
                        ts.protein_g,
                        ts.carbs_g,
                        ts.fat_g
                    FROM menu_items mi
                    JOIN menu_days md ON md.id = mi.menu_day_id
                    LEFT JOIN technical_sheets ts ON ts.code = mi.technical_sheet_code
                    WHERE md.unit_id = :unit_id
                      AND md.menu_import_id = :menu_import_id
                    ORDER BY md.service_date, mi.category, mi.name
                    """
                ),
                {"unit_id": unit_id, "menu_import_id": target["id"]},
            ).mappings().all()

    summary = {
        "total_items": len(rows),
        "with_code": 0,
        "matched": 0,
        "complete": 0,
        "incomplete": 0,
        "missing": 0,
        "no_code": 0,
    }
    pending: dict[tuple[str, str | None, str, str], dict] = {}

    for row in rows:
        code = row["code"]
        if code:
            summary["with_code"] += 1

        if not code:
            status = "no_code"
            summary["no_code"] += 1
        elif row["sheet_found"] is None:
            status = "missing"
            summary["missing"] += 1
        else:
            summary["matched"] += 1
            if all(row[key] is not None for key in ("kcal", "protein_g", "carbs_g", "fat_g")):
                status = "complete"
                summary["complete"] += 1
            else:
                status = "incomplete"
                summary["incomplete"] += 1

        if status == "complete":
            continue

        key = (status, code, row["name"], row["category"] or "")
        item = pending.setdefault(
            key,
            {
                "status": status,
                "code": code,
                "name": row["name"],
                "category": row["category"],
                "occurrences": 0,
                "first_date": row["service_date"].isoformat(),
                "last_date": row["service_date"].isoformat(),
            },
        )
        item["occurrences"] += 1
        service_date = row["service_date"].isoformat()
        if service_date < item["first_date"]:
            item["first_date"] = service_date
        if service_date > item["last_date"]:
            item["last_date"] = service_date

    total = summary["total_items"]
    summary["coverage_percent"] = round((summary["matched"] / total) * 100) if total else 0
    summary["complete_coverage_percent"] = round((summary["complete"] / total) * 100) if total else 0

    priority = {"missing": 0, "no_code": 1, "incomplete": 2}
    pending_items = sorted(
        pending.values(),
        key=lambda item: (
            priority.get(item["status"], 9),
            -item["occurrences"],
            item["name"].casefold(),
        ),
    )

    return {
        "unit_id": str(unit_id),
        "scope": {
            "menu_import_id": str(target["id"]) if target else None,
            "file_name": target["file_name"] if target else None,
            "period_start": target["period_start"].isoformat() if target and target["period_start"] else None,
            "period_end": target["period_end"].isoformat() if target and target["period_end"] else None,
            "published_at": target["published_at"].isoformat() if target and target["published_at"] else None,
        },
        "summary": summary,
        "pending": pending_items[:200],
        "pending_count": len(pending_items),
    }


@router.get("/api/admin/technical-sheets/{code}", tags=["admin-technical-sheets"])
def get_technical_sheet(
    code: str,
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "read")
    with engine.connect() as conn:
        payload = _sheet_payload(conn, code.strip())
    if payload is None:
        raise HTTPException(status_code=404, detail="ficha técnica não encontrada")
    return payload


@router.put("/api/admin/technical-sheets/{code}", tags=["admin-technical-sheets"])
def upsert_technical_sheet(
    code: str,
    payload: TechnicalSheetPayload,
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "manage_sheets")
    normalized_code = code.strip()
    if not normalized_code:
        raise HTTPException(status_code=422, detail="código da ficha técnica é obrigatório")

    ingredients = [item.strip() for item in payload.ingredients if item.strip()]
    allergens = [
        (item.allergen.strip().casefold(), item.status)
        for item in payload.allergens
        if item.allergen.strip()
    ]

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO technical_sheets
                    (code, name, category, portion_quantity, portion_unit,
                     kcal, protein_g, carbs_g, fat_g)
                VALUES
                    (:code, :name, :category, :portion_quantity, :portion_unit,
                     :kcal, :protein_g, :carbs_g, :fat_g)
                ON CONFLICT (code) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    portion_quantity = EXCLUDED.portion_quantity,
                    portion_unit = EXCLUDED.portion_unit,
                    kcal = EXCLUDED.kcal,
                    protein_g = EXCLUDED.protein_g,
                    carbs_g = EXCLUDED.carbs_g,
                    fat_g = EXCLUDED.fat_g,
                    updated_at = now()
                """
            ),
            {"code": normalized_code, **payload.model_dump(exclude={"ingredients", "allergens"})},
        )
        conn.execute(
            text("DELETE FROM technical_sheet_ingredients WHERE technical_sheet_code = :code"),
            {"code": normalized_code},
        )
        conn.execute(
            text("DELETE FROM technical_sheet_allergens WHERE technical_sheet_code = :code"),
            {"code": normalized_code},
        )

        for position, ingredient in enumerate(ingredients, start=1):
            conn.execute(
                text(
                    "INSERT INTO technical_sheet_ingredients "
                    "(technical_sheet_code, position, ingredient) "
                    "VALUES (:code, :position, :ingredient)"
                ),
                {"code": normalized_code, "position": position, "ingredient": ingredient},
            )
        for allergen, status in allergens:
            conn.execute(
                text(
                    "INSERT INTO technical_sheet_allergens "
                    "(technical_sheet_code, allergen, status) "
                    "VALUES (:code, :allergen, :status)"
                ),
                {"code": normalized_code, "allergen": allergen, "status": status},
            )

        result = _sheet_payload(conn, normalized_code)
    assert result is not None
    return result


@router.delete("/api/admin/technical-sheets/{code}", tags=["admin-technical-sheets"])
def delete_technical_sheet(
    code: str,
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "manage_sheets")
    with engine.begin() as conn:
        result = conn.execute(
            text("DELETE FROM technical_sheets WHERE code = :code"),
            {"code": code.strip()},
        )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="ficha técnica não encontrada")
    return {"status": "deleted", "code": code.strip()}
