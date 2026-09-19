from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Header
from sqlalchemy import text

from app.api.admin_auth import require_admin_key
from app.db import engine

router = APIRouter()


@router.get("/api/admin/overview", tags=["admin-overview"])
def admin_overview(
    x_apetit_admin_key: str | None = Header(default=None),
) -> dict:
    require_admin_key(x_apetit_admin_key)

    start = date.today() - timedelta(days=4)
    end = date.today()

    with engine.connect() as conn:
        units = int(conn.execute(text("SELECT COUNT(*) FROM units")).scalar_one() or 0)
        restaurants = int(conn.execute(text("SELECT COUNT(*) FROM restaurants")).scalar_one() or 0)
        published_menus = int(
            conn.execute(
                text("SELECT COUNT(*) FROM menu_imports WHERE status = 'published'")
            ).scalar_one()
            or 0
        )
        technical_sheets = int(
            conn.execute(text("SELECT COUNT(*) FROM technical_sheets")).scalar_one() or 0
        )
        complete_sheets = int(
            conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM technical_sheets
                    WHERE kcal IS NOT NULL
                      AND protein_g IS NOT NULL
                      AND carbs_g IS NOT NULL
                      AND fat_g IS NOT NULL
                    """
                )
            ).scalar_one()
            or 0
        )
        enriched_menu_items = int(
            conn.execute(
                text("SELECT COUNT(*) FROM menu_items WHERE technical_sheet_code IS NOT NULL")
            ).scalar_one()
            or 0
        )
        total_menu_items = int(
            conn.execute(text("SELECT COUNT(*) FROM menu_items")).scalar_one() or 0
        )

        feedback = conn.execute(
            text(
                """
                SELECT COUNT(*) AS responses,
                       ROUND(AVG((food_rating + service_rating) / 2.0)::numeric, 2) AS overall
                FROM feedback
                WHERE meal_date BETWEEN :start AND :end
                """
            ),
            {"start": start, "end": end},
        ).mappings().one()

        top_tag = conn.execute(
            text(
                """
                SELECT ft.tag, COUNT(*) AS count
                FROM feedback_tags ft
                JOIN feedback f ON f.id = ft.feedback_id
                WHERE f.meal_date BETWEEN :start AND :end
                GROUP BY ft.tag
                ORDER BY count DESC, ft.tag
                LIMIT 1
                """
            ),
            {"start": start, "end": end},
        ).mappings().one_or_none()

        latest_menu = conn.execute(
            text(
                """
                SELECT mi.period_start, mi.period_end, mi.published_at, u.name AS unit_name
                FROM menu_imports mi
                JOIN units u ON u.id = mi.unit_id
                WHERE mi.status = 'published'
                ORDER BY mi.published_at DESC NULLS LAST
                LIMIT 1
                """
            )
        ).mappings().one_or_none()

    coverage = round((enriched_menu_items / total_menu_items) * 100) if total_menu_items else 0

    return {
        "units": units,
        "restaurants": restaurants,
        "published_menus": published_menus,
        "technical_sheets": technical_sheets,
        "complete_sheets": complete_sheets,
        "menu_items": total_menu_items,
        "enriched_menu_items": enriched_menu_items,
        "technical_coverage_percent": coverage,
        "feedback_period_start": start.isoformat(),
        "feedback_period_end": end.isoformat(),
        "feedback_responses": int(feedback["responses"] or 0),
        "satisfaction_overall": float(feedback["overall"]) if feedback["overall"] is not None else None,
        "top_feedback_tag": dict(top_tag) if top_tag else None,
        "latest_menu": {
            "unit_name": latest_menu["unit_name"],
            "period_start": latest_menu["period_start"].isoformat() if latest_menu["period_start"] else None,
            "period_end": latest_menu["period_end"].isoformat() if latest_menu["period_end"] else None,
            "published_at": latest_menu["published_at"].isoformat() if latest_menu["published_at"] else None,
        } if latest_menu else None,
    }
