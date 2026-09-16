from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from itertools import combinations
from uuid import UUID

from sqlalchemy import text

from app.db import engine
from app.services.prescription_workflow import current_prescription_meal


@dataclass(frozen=True)
class CandidateItem:
    id: str
    name: str
    category: str
    standard_portion: str | None
    kcal: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


def _distance(total: dict[str, Decimal], target: dict[str, Decimal | None]) -> Decimal:
    score = Decimal("0")
    weights = {
        "kcal": Decimal("1"),
        "protein_g": Decimal("8"),
        "carbs_g": Decimal("4"),
        "fat_g": Decimal("6"),
    }
    for key, weight in weights.items():
        desired = target.get(key)
        if desired is None or desired == 0:
            continue
        score += abs(total[key] - desired) / desired * weight
    return score


def _total(items: tuple[CandidateItem, ...]) -> dict[str, Decimal]:
    return {
        "kcal": sum((item.kcal for item in items), Decimal("0")),
        "protein_g": sum((item.protein_g for item in items), Decimal("0")),
        "carbs_g": sum((item.carbs_g for item in items), Decimal("0")),
        "fat_g": sum((item.fat_g for item in items), Decimal("0")),
    }


def recommend_meal(
    *,
    person_id: str,
    unit_id: str,
    service_date: date,
    meal_type: str,
) -> dict:
    prescription = current_prescription_meal(person_id=person_id, meal_type=meal_type)
    if prescription is None:
        raise LookupError("nenhuma prescrição confirmada encontrada para esta refeição")

    with engine.connect() as conn:
        restrictions = {
            str(row["value"]).casefold()
            for row in conn.execute(
                text("SELECT value FROM dietary_restrictions WHERE person_id = :person_id"),
                {"person_id": UUID(person_id)},
            ).mappings().all()
        }

        rows = conn.execute(
            text(
                """
                SELECT mi.id, mi.name, mi.category, mi.standard_portion,
                       mi.kcal, mi.protein_g, mi.carbs_g, mi.fat_g,
                       COALESCE(array_agg(mia.allergen) FILTER (WHERE mia.allergen IS NOT NULL), '{}') AS allergens,
                       COALESCE(array_agg(mia.status) FILTER (WHERE mia.status IS NOT NULL), '{}') AS allergen_statuses
                FROM menu_days md
                JOIN menu_items mi ON mi.menu_day_id = md.id
                LEFT JOIN menu_item_allergens mia ON mia.menu_item_id = mi.id
                WHERE md.unit_id = :unit_id
                  AND md.service_date = :service_date
                  AND md.meal_type = :meal_type
                GROUP BY mi.id
                ORDER BY mi.category, mi.name
                """
            ),
            {
                "unit_id": UUID(unit_id),
                "service_date": service_date,
                "meal_type": meal_type,
            },
        ).mappings().all()

    candidates: list[CandidateItem] = []
    excluded_for_restriction: list[str] = []
    skipped_missing_nutrition: list[str] = []
    uncertain_allergens: list[str] = []

    for row in rows:
        allergen_pairs = list(zip(row["allergens"] or [], row["allergen_statuses"] or []))
        confirmed_allergens = {str(a).casefold() for a, status in allergen_pairs if status == "confirmed"}
        unknown_relevant = {str(a).casefold() for a, status in allergen_pairs if status != "confirmed" and str(a).casefold() in restrictions}
        if confirmed_allergens & restrictions:
            excluded_for_restriction.append(row["name"])
            continue
        if unknown_relevant:
            uncertain_allergens.append(row["name"])
            continue
        if any(row[key] is None for key in ("kcal", "protein_g", "carbs_g", "fat_g")):
            skipped_missing_nutrition.append(row["name"])
            continue
        candidates.append(
            CandidateItem(
                id=str(row["id"]),
                name=row["name"],
                category=row["category"],
                standard_portion=row["standard_portion"],
                kcal=Decimal(row["kcal"]),
                protein_g=Decimal(row["protein_g"]),
                carbs_g=Decimal(row["carbs_g"]),
                fat_g=Decimal(row["fat_g"]),
            )
        )

    if not candidates:
        return {
            "status": "insufficient_data",
            "message": "Não há itens com dados nutricionais suficientes e seguros para calcular uma sugestão.",
            "target": prescription["target"],
            "items": [],
            "warnings": {
                "excluded_for_restriction": excluded_for_restriction,
                "skipped_missing_nutrition": skipped_missing_nutrition,
                "uncertain_allergens": uncertain_allergens,
            },
        }

    target = prescription["target"]
    best: tuple[CandidateItem, ...] | None = None
    best_score: Decimal | None = None
    max_items = min(5, len(candidates))
    for size in range(1, max_items + 1):
        for combo in combinations(candidates, size):
            categories = [item.category for item in combo]
            if len(categories) != len(set(categories)):
                continue
            score = _distance(_total(combo), target)
            if best_score is None or score < best_score:
                best_score = score
                best = combo

    if best is None:
        best = (candidates[0],)
    totals = _total(best)

    return {
        "status": "recommended",
        "prescription_id": prescription["prescription_id"],
        "service_date": service_date.isoformat(),
        "meal_type": meal_type,
        "target": target,
        "estimated_totals": totals,
        "items": [
            {
                "menu_item_id": item.id,
                "name": item.name,
                "category": item.category,
                "portion": item.standard_portion,
                "kcal": item.kcal,
                "protein_g": item.protein_g,
                "carbs_g": item.carbs_g,
                "fat_g": item.fat_g,
            }
            for item in best
        ],
        "warnings": {
            "excluded_for_restriction": excluded_for_restriction,
            "skipped_missing_nutrition": skipped_missing_nutrition,
            "uncertain_allergens": uncertain_allergens,
        },
        "disclaimer": "Sugestão baseada na prescrição confirmada e nos dados disponíveis do cardápio; não substitui orientação do nutricionista.",
    }
