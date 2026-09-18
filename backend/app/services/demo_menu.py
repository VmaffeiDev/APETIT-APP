from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import text

from app.settings import settings


def resolve_menu_service_date(conn, *, unit_id: str, requested_date: date, meal_type: str) -> date:
    """Resolve the date whose published menu should be used.

    Production always uses the requested date. In development/presentation mode,
    when there is no menu for the requested date, fall back to the latest
    published menu for the same unit/meal. The API can still present the
    requested date to the client while reusing stable demo content.
    """
    exact = conn.execute(
        text(
            """
            SELECT service_date
            FROM menu_days
            WHERE unit_id = :unit_id
              AND service_date = :service_date
              AND meal_type = :meal_type
            LIMIT 1
            """
        ),
        {
            "unit_id": UUID(unit_id),
            "service_date": requested_date,
            "meal_type": meal_type,
        },
    ).scalar_one_or_none()
    if exact is not None:
        return exact

    if settings.environment.strip().lower() != "development":
        return requested_date

    latest = conn.execute(
        text(
            """
            SELECT service_date
            FROM menu_days
            WHERE unit_id = :unit_id
              AND meal_type = :meal_type
            ORDER BY service_date DESC
            LIMIT 1
            """
        ),
        {"unit_id": UUID(unit_id), "meal_type": meal_type},
    ).scalar_one_or_none()
    return latest or requested_date
