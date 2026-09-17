from __future__ import annotations

from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text

from app.db import engine
from app.services.prescription_workflow import current_prescription_meal


def evaluate_plate(*, person_id: str, unit_id: str, service_date: date, meal_type: str, selections: list[dict]) -> dict:
    prescription = current_prescription_meal(person_id=person_id, meal_type=meal_type)
    if prescription is None:
        raise LookupError("nenhuma prescrição confirmada encontrada para esta refeição")
    if not selections:
        raise ValueError("selecione ao menos um item para montar o prato")

    selected_ids = [UUID(str(item["menu_item_id"])) for item in selections]
    quantities = {UUID(str(item["menu_item_id"])): Decimal(str(item.get("quantity", 1))) for item in selections}
    if any(value <= 0 for value in quantities.values()):
        raise ValueError("as quantidades precisam ser maiores que zero")

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
                  AND mi.id = ANY(:ids)
                GROUP BY mi.id
                ORDER BY mi.category, mi.name
                """
            ),
            {
                "unit_id": UUID(unit_id),
                "service_date": service_date,
                "meal_type": meal_type,
                "ids": selected_ids,
            },
        ).mappings().all()

    by_id = {row["id"]: row for row in rows}
    missing = [str(item_id) for item_id in selected_ids if item_id not in by_id]
    if missing:
        raise ValueError("há item(ns) que não pertencem ao cardápio publicado deste dia")

    unsafe: list[str] = []
    uncertain: list[str] = []
    missing_nutrition: list[str] = []
    totals = {"kcal": Decimal("0"), "protein_g": Decimal("0"), "carbs_g": Decimal("0"), "fat_g": Decimal("0")}
    items: list[dict] = []

    for item_id in selected_ids:
        row = by_id[item_id]
        allergen_pairs = list(zip(row["allergens"] or [], row["allergen_statuses"] or []))
        confirmed = {str(a).casefold() for a, status in allergen_pairs if status == "confirmed"}
        unknown_relevant = {str(a).casefold() for a, status in allergen_pairs if status != "confirmed" and str(a).casefold() in restrictions}
        if confirmed & restrictions:
            unsafe.append(row["name"])
        if unknown_relevant:
            uncertain.append(row["name"])
        if any(row[key] is None for key in totals):
            missing_nutrition.append(row["name"])
            continue

        factor = quantities[item_id]
        nutrient_values = {key: Decimal(row[key]) * factor for key in totals}
        for key, value in nutrient_values.items():
            totals[key] += value
        items.append({
            "menu_item_id": str(item_id),
            "name": row["name"],
            "category": row["category"],
            "portion": row["standard_portion"],
            "quantity": factor,
            **nutrient_values,
        })

    if unsafe or uncertain:
        return {
            "status": "blocked",
            "target": prescription["target"],
            "items": items,
            "estimated_totals": totals,
            "warnings": {"unsafe_items": unsafe, "uncertain_allergens": uncertain, "missing_nutrition": missing_nutrition},
            "message": "O prato contém item incompatível ou com informação de alergênico insuficiente para recomendar com segurança.",
        }

    target = prescription["target"]
    differences: dict[str, Decimal | None] = {}
    within_target = True
    for key in totals:
        desired = target.get(key)
        differences[key] = None if desired is None else totals[key] - Decimal(desired)
        if desired not in (None, 0):
            deviation = abs(totals[key] - Decimal(desired)) / Decimal(desired)
            if deviation > Decimal("0.15"):
                within_target = False

    status = "within_target" if within_target and not missing_nutrition else "outside_target"
    if missing_nutrition:
        status = "insufficient_data"

    return {
        "status": status,
        "target": target,
        "items": items,
        "estimated_totals": totals,
        "differences": differences,
        "warnings": {"unsafe_items": [], "uncertain_allergens": [], "missing_nutrition": missing_nutrition},
        "message": (
            "Seu prato está próximo da meta confirmada."
            if status == "within_target"
            else "Seu prato pode ser ajustado para ficar mais próximo da meta confirmada."
            if status == "outside_target"
            else "Há itens sem dados nutricionais suficientes para avaliar o prato com segurança."
        ),
    }
