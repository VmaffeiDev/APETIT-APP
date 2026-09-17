from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.db import engine

router = APIRouter()


class MealItemCreate(BaseModel):
    menu_item_id: UUID
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    unit: str | None = None


class MealCreate(BaseModel):
    person_id: UUID
    meal_date: date
    meal_type: str = "almoco"
    items: list[MealItemCreate] = Field(min_length=1, max_length=20)


@router.post("/api/meals", tags=["meals"])
def register_meal(payload: MealCreate) -> dict:
    meal_type = payload.meal_type.strip().lower()
    meal_id = uuid4()

    with engine.begin() as conn:
        person_exists = conn.execute(
            text("SELECT 1 FROM people WHERE id = :id AND deleted_at IS NULL"),
            {"id": payload.person_id},
        ).scalar_one_or_none()
        if person_exists is None:
            raise HTTPException(status_code=404, detail="funcionário não encontrado")

        menu_ids = [item.menu_item_id for item in payload.items]
        rows = conn.execute(
            text(
                """
                SELECT id, name, category, standard_portion,
                       kcal, protein_g, carbs_g, fat_g
                FROM menu_items
                WHERE id = ANY(:ids)
                """
            ),
            {"ids": menu_ids},
        ).mappings().all()
        by_id = {row["id"]: row for row in rows}

        missing = [str(item.menu_item_id) for item in payload.items if item.menu_item_id not in by_id]
        if missing:
            raise HTTPException(status_code=422, detail=f"item(ns) de cardápio não encontrado(s): {', '.join(missing)}")

        existing = conn.execute(
            text(
                """
                SELECT id FROM meals
                WHERE person_id = :person_id
                  AND meal_date = :meal_date
                  AND meal_type = :meal_type
                """
            ),
            {
                "person_id": payload.person_id,
                "meal_date": payload.meal_date,
                "meal_type": meal_type,
            },
        ).scalar_one_or_none()

        if existing:
            meal_id = existing
            conn.execute(text("DELETE FROM meal_items WHERE meal_id = :meal_id"), {"meal_id": meal_id})
        else:
            conn.execute(
                text(
                    """
                    INSERT INTO meals (id, person_id, meal_date, meal_type)
                    VALUES (:id, :person_id, :meal_date, :meal_type)
                    """
                ),
                {
                    "id": meal_id,
                    "person_id": payload.person_id,
                    "meal_date": payload.meal_date,
                    "meal_type": meal_type,
                },
            )

        totals = {"kcal": Decimal("0"), "protein_g": Decimal("0"), "carbs_g": Decimal("0"), "fat_g": Decimal("0")}
        for selected in payload.items:
            row = by_id[selected.menu_item_id]
            factor = selected.quantity
            snapshot = {
                key: (Decimal(row[key]) * factor if row[key] is not None else None)
                for key in totals
            }
            for key, value in snapshot.items():
                if value is not None:
                    totals[key] += value

            conn.execute(
                text(
                    """
                    INSERT INTO meal_items
                        (meal_id, source_menu_item_id, item_name, category, quantity, unit,
                         kcal, protein_g, carbs_g, fat_g)
                    VALUES
                        (:meal_id, :source_menu_item_id, :item_name, :category, :quantity, :unit,
                         :kcal, :protein_g, :carbs_g, :fat_g)
                    """
                ),
                {
                    "meal_id": meal_id,
                    "source_menu_item_id": selected.menu_item_id,
                    "item_name": row["name"],
                    "category": row["category"],
                    "quantity": selected.quantity,
                    "unit": selected.unit or row["standard_portion"] or "porcao",
                    **snapshot,
                },
            )

    return {
        "status": "saved",
        "meal_id": str(meal_id),
        "meal_date": payload.meal_date.isoformat(),
        "meal_type": meal_type,
        "item_count": len(payload.items),
        "estimated_totals": totals,
    }
