from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.api.auth import current_person
from app.db import engine
from app.services.prescription_workflow import current_prescription_meal

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


def _require_self(person_id: UUID, authorization: str | None) -> dict:
    person = current_person(authorization)
    if person["id"] != person_id:
        raise HTTPException(status_code=403, detail="você só pode acessar seus próprios dados")
    return person


def _totals(rows: list[dict]) -> dict[str, Decimal]:
    keys = ("kcal", "protein_g", "carbs_g", "fat_g")
    return {
        key: sum((Decimal(row[key]) for row in rows if row[key] is not None), Decimal("0"))
        for key in keys
    }


def _target_ratio(value: Decimal, target: Decimal | None) -> float | None:
    if target is None or target == 0:
        return None
    return round(float(value / target), 3)


@router.post("/api/meals", tags=["meals"])
def register_meal(payload: MealCreate, authorization: str | None = Header(default=None)) -> dict:
    _require_self(payload.person_id, authorization)
    meal_type = payload.meal_type.strip().lower()
    meal_id = uuid4()

    with engine.begin() as conn:
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


@router.get("/api/meals/history", tags=["meals"])
def meal_history(person_id: UUID, limit: int = 30, authorization: str | None = Header(default=None)) -> dict:
    _require_self(person_id, authorization)
    limit = max(1, min(limit, 90))
    with engine.connect() as conn:
        meals = conn.execute(
            text(
                """
                SELECT id, meal_date, meal_type, created_at
                FROM meals
                WHERE person_id = :person_id
                ORDER BY meal_date DESC, created_at DESC
                LIMIT :limit
                """
            ),
            {"person_id": person_id, "limit": limit},
        ).mappings().all()

        payload = []
        for meal in meals:
            items = conn.execute(
                text(
                    """
                    SELECT item_name, category, quantity, unit, kcal, protein_g, carbs_g, fat_g
                    FROM meal_items
                    WHERE meal_id = :meal_id
                    ORDER BY category, item_name
                    """
                ),
                {"meal_id": meal["id"]},
            ).mappings().all()
            payload.append(
                {
                    "meal_id": str(meal["id"]),
                    "meal_date": meal["meal_date"].isoformat(),
                    "meal_type": meal["meal_type"],
                    "totals": _totals([dict(row) for row in items]),
                    "items": [dict(row) for row in items],
                }
            )

    return {"person_id": str(person_id), "meals": payload}


@router.get("/api/meals/progress", tags=["meals"])
def meal_progress(
    person_id: UUID,
    days: int = 7,
    meal_type: str = "almoco",
    authorization: str | None = Header(default=None),
) -> dict:
    _require_self(person_id, authorization)
    days = max(1, min(days, 31))
    meal_type = meal_type.strip().lower()
    end = date.today()
    start = end - timedelta(days=days - 1)
    prescription = current_prescription_meal(person_id=str(person_id), meal_type=meal_type)
    target = prescription["target"] if prescription else {
        "kcal": None,
        "protein_g": None,
        "carbs_g": None,
        "fat_g": None,
    }

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT m.id, m.meal_date,
                       SUM(mi.kcal) AS kcal,
                       SUM(mi.protein_g) AS protein_g,
                       SUM(mi.carbs_g) AS carbs_g,
                       SUM(mi.fat_g) AS fat_g
                FROM meals m
                JOIN meal_items mi ON mi.meal_id = m.id
                WHERE m.person_id = :person_id
                  AND m.meal_type = :meal_type
                  AND m.meal_date BETWEEN :start AND :end
                GROUP BY m.id, m.meal_date
                ORDER BY m.meal_date ASC
                """
            ),
            {
                "person_id": person_id,
                "meal_type": meal_type,
                "start": start,
                "end": end,
            },
        ).mappings().all()

    series = []
    adherent_days = 0
    for row in rows:
        totals = {
            key: (Decimal(row[key]) if row[key] is not None else Decimal("0"))
            for key in ("kcal", "protein_g", "carbs_g", "fat_g")
        }
        kcal_ratio = _target_ratio(totals["kcal"], target.get("kcal"))
        protein_ratio = _target_ratio(totals["protein_g"], target.get("protein_g"))
        considered = [ratio for ratio in (kcal_ratio, protein_ratio) if ratio is not None]
        within_target = bool(considered) and all(0.85 <= ratio <= 1.15 for ratio in considered)
        if within_target:
            adherent_days += 1
        series.append(
            {
                "date": row["meal_date"].isoformat(),
                "totals": totals,
                "ratios": {
                    "kcal": kcal_ratio,
                    "protein_g": protein_ratio,
                    "carbs_g": _target_ratio(totals["carbs_g"], target.get("carbs_g")),
                    "fat_g": _target_ratio(totals["fat_g"], target.get("fat_g")),
                },
                "within_target": within_target,
            }
        )

    return {
        "person_id": str(person_id),
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "meal_type": meal_type,
        "target": target,
        "meal_days": len(series),
        "adherent_days": adherent_days,
        "adherence_percent": round(adherent_days / len(series) * 100) if series else None,
        "series": series,
    }
