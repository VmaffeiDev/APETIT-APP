from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.db import engine
from app.settings import settings

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


def _require_admin_key(value: str | None) -> None:
    if not value or value != settings.api_secret:
        raise HTTPException(status_code=401, detail="credencial administrativa inválida")


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

    return {**dict(row), "ingredients": list(ingredients), "allergens": [dict(item) for item in allergens]}


@router.get("/api/admin/technical-sheets", tags=["admin-technical-sheets"])
def list_technical_sheets(
    search: str = Query(default="", max_length=120),
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin_key(x_apetit_admin_key)
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


@router.get("/api/admin/technical-sheets/{code}", tags=["admin-technical-sheets"])
def get_technical_sheet(
    code: str,
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin_key(x_apetit_admin_key)
    with engine.connect() as conn:
        payload = _sheet_payload(conn, code.strip())
    if payload is None:
        raise HTTPException(status_code=404, detail="ficha técnica não encontrada")
    return payload


@router.put("/api/admin/technical-sheets/{code}", tags=["admin-technical-sheets"])
def upsert_technical_sheet(
    code: str,
    payload: TechnicalSheetPayload,
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin_key(x_apetit_admin_key)
    normalized_code = code.strip()
    if not normalized_code:
        raise HTTPException(status_code=422, detail="código da ficha técnica é obrigatório")

    ingredients = [item.strip() for item in payload.ingredients if item.strip()]
    allergens = [(item.allergen.strip().casefold(), item.status) for item in payload.allergens if item.allergen.strip()]

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
        conn.execute(text("DELETE FROM technical_sheet_ingredients WHERE technical_sheet_code = :code"), {"code": normalized_code})
        conn.execute(text("DELETE FROM technical_sheet_allergens WHERE technical_sheet_code = :code"), {"code": normalized_code})

        for position, ingredient in enumerate(ingredients, start=1):
            conn.execute(
                text(
                    "INSERT INTO technical_sheet_ingredients "
                    "(technical_sheet_code, position, ingredient) VALUES (:code, :position, :ingredient)"
                ),
                {"code": normalized_code, "position": position, "ingredient": ingredient},
            )
        for allergen, status in allergens:
            conn.execute(
                text(
                    "INSERT INTO technical_sheet_allergens "
                    "(technical_sheet_code, allergen, status) VALUES (:code, :allergen, :status)"
                ),
                {"code": normalized_code, "allergen": allergen, "status": status},
            )

        result = _sheet_payload(conn, normalized_code)
    assert result is not None
    return result


@router.delete("/api/admin/technical-sheets/{code}", tags=["admin-technical-sheets"])
def delete_technical_sheet(
    code: str,
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin_key(x_apetit_admin_key)
    with engine.begin() as conn:
        result = conn.execute(text("DELETE FROM technical_sheets WHERE code = :code"), {"code": code.strip()})
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="ficha técnica não encontrada")
    return {"status": "deleted", "code": code.strip()}
