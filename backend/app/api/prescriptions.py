from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.domain.prescription import NutritionTarget, PortionInstruction
from app.services.nutrition_engine import recommend_meal
from app.services.plate_evaluation import evaluate_plate
from app.services.prescription_document import extract_text, meal_to_payload, parse_prescription_text
from app.services.prescription_workflow import confirm_prescription, stage_prescription


router = APIRouter()


class TargetPayload(BaseModel):
    kcal: Decimal | None = Field(default=None, ge=0)
    protein_g: Decimal | None = Field(default=None, ge=0)
    carbs_g: Decimal | None = Field(default=None, ge=0)
    fat_g: Decimal | None = Field(default=None, ge=0)


class PortionPayload(BaseModel):
    category: str
    quantity: Decimal | None = Field(default=None, ge=0)
    unit: str | None = None
    notes: str | None = None


class ConfirmPrescriptionRequest(BaseModel):
    meal_type: str
    target: TargetPayload
    portions: list[PortionPayload] = []
    confirm: bool


class PlateSelectionPayload(BaseModel):
    menu_item_id: UUID
    quantity: Decimal = Field(default=Decimal("1"), gt=0, le=10)


class PlateEvaluationRequest(BaseModel):
    person_id: UUID
    unit_id: UUID
    service_date: date
    meal_type: str = "almoco"
    selections: list[PlateSelectionPayload] = Field(min_length=1, max_length=20)


@router.post("/api/prescriptions/preview", tags=["prescriptions"])
async def preview_prescription(
    person_id: UUID = Form(...),
    default_meal_type: str = Form("almoco"),
    file: UploadFile = File(...),
) -> dict:
    file_name = file.filename or "prescricao"
    content = await file.read()
    extracted_text, extraction_status = extract_text(file_name, content)

    if extraction_status == "unsupported":
        raise HTTPException(
            status_code=415,
            detail="formato não suportado; envie PDF, TXT ou imagem compatível",
        )

    meal = parse_prescription_text(extracted_text, default_meal_type) if extracted_text else None
    staged = stage_prescription(
        person_id=str(person_id),
        source_kind=Path(file_name).suffix.lower().lstrip(".") or "document",
        file_name=file_name,
        extraction_status=extraction_status,
        meal=meal,
        extracted_text=extracted_text,
    )

    return {
        "preview_id": staged.preview_id,
        "file_name": file_name,
        "extraction_status": extraction_status,
        "requires_ocr": extraction_status == "needs_ocr",
        "requires_confirmation": True,
        "meal": meal_to_payload(meal) if meal else None,
        "message": (
            "Documento lido. Confira os dados antes de confirmar."
            if meal
            else "Não foi possível extrair texto com segurança; este documento precisa de OCR antes da confirmação."
        ),
    }


@router.post("/api/prescriptions/{preview_id}/confirm", tags=["prescriptions"])
def confirm_prescription_preview(preview_id: str, payload: ConfirmPrescriptionRequest) -> dict:
    if not payload.confirm:
        raise HTTPException(status_code=409, detail="a prescrição precisa ser confirmada pelo funcionário")
    try:
        return confirm_prescription(
            preview_id=preview_id,
            meal_type=payload.meal_type.strip().lower(),
            target=NutritionTarget(
                kcal=payload.target.kcal,
                protein_g=payload.target.protein_g,
                carbs_g=payload.target.carbs_g,
                fat_g=payload.target.fat_g,
            ),
            portions=tuple(
                PortionInstruction(
                    category=portion.category.strip().lower(),
                    quantity=portion.quantity,
                    unit=portion.unit,
                    notes=portion.notes,
                )
                for portion in payload.portions
            ),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/api/nutrition/recommendation", tags=["nutrition"])
def get_nutrition_recommendation(
    person_id: UUID,
    unit_id: UUID,
    service_date: date,
    meal_type: str = "almoco",
) -> dict:
    try:
        return recommend_meal(
            person_id=str(person_id),
            unit_id=str(unit_id),
            service_date=service_date,
            meal_type=meal_type.strip().lower(),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/api/nutrition/plate-evaluate", tags=["nutrition"])
def evaluate_manual_plate(payload: PlateEvaluationRequest) -> dict:
    try:
        return evaluate_plate(
            person_id=str(payload.person_id),
            unit_id=str(payload.unit_id),
            service_date=payload.service_date,
            meal_type=payload.meal_type.strip().lower(),
            selections=[
                {"menu_item_id": str(item.menu_item_id), "quantity": item.quantity}
                for item in payload.selections
            ],
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
