from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import text

from app.db import engine
from app.domain.prescription import NutritionTarget, PortionInstruction, PrescriptionMeal


@dataclass
class StagedPrescription:
    preview_id: str
    person_id: str
    source_kind: str
    file_name: str
    extraction_status: str
    meal: PrescriptionMeal | None
    extracted_text: str | None


_STAGED: dict[str, StagedPrescription] = {}


def stage_prescription(
    *,
    person_id: str,
    source_kind: str,
    file_name: str,
    extraction_status: str,
    meal: PrescriptionMeal | None,
    extracted_text: str | None,
) -> StagedPrescription:
    staged = StagedPrescription(
        preview_id=str(uuid4()),
        person_id=person_id,
        source_kind=source_kind,
        file_name=file_name,
        extraction_status=extraction_status,
        meal=meal,
        extracted_text=extracted_text,
    )
    _STAGED[staged.preview_id] = staged
    return staged


def get_staged(preview_id: str) -> StagedPrescription | None:
    return _STAGED.get(preview_id)


def confirm_prescription(
    *,
    preview_id: str,
    meal_type: str,
    target: NutritionTarget,
    portions: tuple[PortionInstruction, ...],
) -> dict:
    staged = get_staged(preview_id)
    if staged is None:
        raise LookupError("preview da prescrição não encontrado ou expirado")

    person_uuid = UUID(staged.person_id)
    prescription_id = uuid4()
    meal_id = uuid4()

    with engine.begin() as conn:
        person_exists = conn.execute(
            text("SELECT 1 FROM people WHERE id = :person_id AND deleted_at IS NULL"),
            {"person_id": person_uuid},
        ).scalar_one_or_none()
        if person_exists is None:
            raise LookupError("funcionário não encontrado")

        conn.execute(
            text("UPDATE prescriptions SET status = 'superseded' WHERE person_id = :person_id AND status = 'confirmed'"),
            {"person_id": person_uuid},
        )
        conn.execute(
            text(
                """
                INSERT INTO prescriptions (id, person_id, source_kind, status, confirmed_at)
                VALUES (:id, :person_id, :source_kind, 'confirmed', now())
                """
            ),
            {"id": prescription_id, "person_id": person_uuid, "source_kind": staged.source_kind},
        )
        conn.execute(
            text(
                """
                INSERT INTO prescription_meals
                    (id, prescription_id, meal_type, kcal, protein_g, carbs_g, fat_g)
                VALUES
                    (:id, :prescription_id, :meal_type, :kcal, :protein_g, :carbs_g, :fat_g)
                """
            ),
            {
                "id": meal_id,
                "prescription_id": prescription_id,
                "meal_type": meal_type,
                "kcal": target.kcal,
                "protein_g": target.protein_g,
                "carbs_g": target.carbs_g,
                "fat_g": target.fat_g,
            },
        )
        for portion in portions:
            conn.execute(
                text(
                    """
                    INSERT INTO prescription_portions
                        (id, prescription_meal_id, category, quantity, unit, notes)
                    VALUES
                        (:id, :prescription_meal_id, :category, :quantity, :unit, :notes)
                    """
                ),
                {
                    "id": uuid4(),
                    "prescription_meal_id": meal_id,
                    "category": portion.category,
                    "quantity": portion.quantity,
                    "unit": portion.unit,
                    "notes": portion.notes,
                },
            )

    _STAGED.pop(preview_id, None)
    return {
        "status": "confirmed",
        "prescription_id": str(prescription_id),
        "meal_type": meal_type,
    }


def current_prescription_meal(*, person_id: str, meal_type: str) -> dict | None:
    with engine.connect() as conn:
        meal = conn.execute(
            text(
                """
                SELECT p.id AS prescription_id, pm.id AS meal_id, pm.meal_type,
                       pm.kcal, pm.protein_g, pm.carbs_g, pm.fat_g
                FROM prescriptions p
                JOIN prescription_meals pm ON pm.prescription_id = p.id
                WHERE p.person_id = :person_id
                  AND p.status = 'confirmed'
                  AND pm.meal_type = :meal_type
                ORDER BY p.confirmed_at DESC
                LIMIT 1
                """
            ),
            {"person_id": UUID(person_id), "meal_type": meal_type},
        ).mappings().first()
        if meal is None:
            return None
        portions = conn.execute(
            text(
                """
                SELECT category, quantity, unit, notes
                FROM prescription_portions
                WHERE prescription_meal_id = :meal_id
                ORDER BY category
                """
            ),
            {"meal_id": meal["meal_id"]},
        ).mappings().all()

    return {
        "prescription_id": str(meal["prescription_id"]),
        "meal_type": meal["meal_type"],
        "target": {
            "kcal": meal["kcal"],
            "protein_g": meal["protein_g"],
            "carbs_g": meal["carbs_g"],
            "fat_g": meal["fat_g"],
        },
        "portions": [dict(row) for row in portions],
    }
