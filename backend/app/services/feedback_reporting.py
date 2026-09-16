from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import text

from app.db import engine

MIN_REPORT_GROUP = 5


def _params(unit_id: str, start: date, end: date, restaurant_id: str | None = None) -> dict:
    params = {
        "unit_id": UUID(unit_id),
        "start": start,
        "end": end,
    }
    if restaurant_id:
        params["restaurant_id"] = UUID(restaurant_id)
    return params


def feedback_summary(
    *,
    unit_id: str,
    start: date,
    end: date,
    restaurant_id: str | None = None,
) -> dict:
    if end < start:
        raise ValueError("data final deve ser igual ou posterior à data inicial")

    restaurant_clause = "AND f.restaurant_id = :restaurant_id" if restaurant_id else ""
    params = _params(unit_id, start, end, restaurant_id)

    with engine.connect() as conn:
        totals = conn.execute(
            text(
                f"""
                SELECT COUNT(*) AS responses,
                       ROUND(AVG(food_rating)::numeric, 2) AS food_rating,
                       ROUND(AVG(service_rating)::numeric, 2) AS service_rating,
                       ROUND(AVG((food_rating + service_rating) / 2.0)::numeric, 2) AS overall_rating
                FROM feedback f
                WHERE f.unit_id = :unit_id
                  AND f.meal_date BETWEEN :start AND :end
                  {restaurant_clause}
                """
            ),
            params,
        ).mappings().one()

        response_count = int(totals["responses"] or 0)
        suppressed = response_count < MIN_REPORT_GROUP
        if suppressed:
            return {
                "unit_id": unit_id,
                "restaurant_id": restaurant_id,
                "period_start": start.isoformat(),
                "period_end": end.isoformat(),
                "responses": response_count,
                "minimum_group": MIN_REPORT_GROUP,
                "suppressed": True,
                "message": "Dados detalhados ocultados para proteger grupos pequenos.",
                "ratings": None,
                "tags": [],
                "trend": [],
                "comments": [],
            }

        tags = conn.execute(
            text(
                f"""
                SELECT ft.tag, COUNT(*) AS count
                FROM feedback_tags ft
                JOIN feedback f ON f.id = ft.feedback_id
                WHERE f.unit_id = :unit_id
                  AND f.meal_date BETWEEN :start AND :end
                  {restaurant_clause}
                GROUP BY ft.tag
                ORDER BY count DESC, ft.tag
                LIMIT 10
                """
            ),
            params,
        ).mappings().all()

        trend = conn.execute(
            text(
                f"""
                SELECT f.meal_date AS day,
                       COUNT(*) AS responses,
                       ROUND(AVG((f.food_rating + f.service_rating) / 2.0)::numeric, 2) AS rating
                FROM feedback f
                WHERE f.unit_id = :unit_id
                  AND f.meal_date BETWEEN :start AND :end
                  {restaurant_clause}
                GROUP BY f.meal_date
                HAVING COUNT(*) >= :minimum_group
                ORDER BY f.meal_date
                """
            ),
            {**params, "minimum_group": MIN_REPORT_GROUP},
        ).mappings().all()

        comments = conn.execute(
            text(
                f"""
                SELECT f.meal_date, f.comment
                FROM feedback f
                WHERE f.unit_id = :unit_id
                  AND f.meal_date BETWEEN :start AND :end
                  {restaurant_clause}
                  AND NULLIF(BTRIM(f.comment), '') IS NOT NULL
                ORDER BY f.created_at DESC
                LIMIT 20
                """
            ),
            params,
        ).mappings().all()

    return {
        "unit_id": unit_id,
        "restaurant_id": restaurant_id,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "responses": response_count,
        "minimum_group": MIN_REPORT_GROUP,
        "suppressed": False,
        "message": None,
        "ratings": {
            "overall": float(totals["overall_rating"]),
            "food": float(totals["food_rating"]),
            "service": float(totals["service_rating"]),
        },
        "tags": [{"tag": row["tag"], "count": int(row["count"])} for row in tags],
        "trend": [
            {
                "date": row["day"].isoformat(),
                "responses": int(row["responses"]),
                "rating": float(row["rating"]),
            }
            for row in trend
        ],
        "comments": [
            {"date": row["meal_date"].isoformat(), "comment": row["comment"]}
            for row in comments
        ],
    }
