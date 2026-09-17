from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.api.auth import current_person
from app.db import engine
from app.services.feedback_reporting import feedback_summary
from app.settings import settings

router = APIRouter()


class FeedbackCreate(BaseModel):
    person_id: UUID
    unit_id: UUID
    restaurant_id: UUID
    meal_date: date
    food_rating: int = Field(ge=1, le=5)
    service_rating: int = Field(ge=1, le=5)
    tags: list[str] = Field(default_factory=list, max_length=8)
    comment: str | None = Field(default=None, max_length=1000)


def _require_admin_key(value: str | None) -> None:
    if not value or value != settings.api_secret:
        raise HTTPException(status_code=401, detail="credencial administrativa inválida")


@router.post("/api/feedback", tags=["feedback"])
def create_feedback(payload: FeedbackCreate, authorization: str | None = Header(default=None)) -> dict:
    person = current_person(authorization)
    if person["id"] != payload.person_id:
        raise HTTPException(status_code=403, detail="você só pode enviar feedback em seu próprio nome")

    feedback_id = uuid4()
    cleaned_tags = sorted({tag.strip().lower() for tag in payload.tags if tag.strip()})
    with engine.begin() as conn:
        restaurant = conn.execute(
            text("SELECT 1 FROM restaurants WHERE id = :id AND unit_id = :unit_id"),
            {"id": payload.restaurant_id, "unit_id": payload.unit_id},
        ).scalar_one_or_none()
        if restaurant is None:
            raise HTTPException(status_code=422, detail="refeitório não pertence à unidade informada")

        existing = conn.execute(
            text(
                """
                SELECT id FROM feedback
                WHERE person_id = :person_id
                  AND restaurant_id = :restaurant_id
                  AND meal_date = :meal_date
                """
            ),
            {
                "person_id": payload.person_id,
                "restaurant_id": payload.restaurant_id,
                "meal_date": payload.meal_date,
            },
        ).scalar_one_or_none()

        if existing:
            feedback_id = existing
            conn.execute(
                text(
                    """
                    UPDATE feedback
                    SET food_rating = :food_rating,
                        service_rating = :service_rating,
                        comment = :comment,
                        created_at = now()
                    WHERE id = :id
                    """
                ),
                {
                    "id": feedback_id,
                    "food_rating": payload.food_rating,
                    "service_rating": payload.service_rating,
                    "comment": payload.comment,
                },
            )
            conn.execute(text("DELETE FROM feedback_tags WHERE feedback_id = :id"), {"id": feedback_id})
        else:
            conn.execute(
                text(
                    """
                    INSERT INTO feedback
                        (id, person_id, unit_id, restaurant_id, meal_date, food_rating, service_rating, comment)
                    VALUES
                        (:id, :person_id, :unit_id, :restaurant_id, :meal_date, :food_rating, :service_rating, :comment)
                    """
                ),
                {
                    "id": feedback_id,
                    "person_id": payload.person_id,
                    "unit_id": payload.unit_id,
                    "restaurant_id": payload.restaurant_id,
                    "meal_date": payload.meal_date,
                    "food_rating": payload.food_rating,
                    "service_rating": payload.service_rating,
                    "comment": payload.comment,
                },
            )

        for tag in cleaned_tags:
            conn.execute(
                text("INSERT INTO feedback_tags (feedback_id, tag) VALUES (:feedback_id, :tag)"),
                {"feedback_id": feedback_id, "tag": tag},
            )

    return {"status": "saved", "feedback_id": str(feedback_id)}


@router.get("/api/admin/feedback/summary", tags=["admin-feedback"])
def admin_feedback_summary(
    unit_id: UUID,
    start: date,
    end: date,
    restaurant_id: UUID | None = None,
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    _require_admin_key(x_apetit_admin_key)
    try:
        return feedback_summary(
            unit_id=str(unit_id),
            start=start,
            end=end,
            restaurant_id=str(restaurant_id) if restaurant_id else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
