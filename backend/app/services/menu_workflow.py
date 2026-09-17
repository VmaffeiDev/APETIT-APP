from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import date
from typing import Iterable
from uuid import UUID, uuid4

from sqlalchemy import text

from app.db import engine
from app.services.menu_import import ImportedMenuItem


_FILENAME_MONTH_RE = re.compile(
    r"(?:^|\D)(?:\d{1,2})\s*(?:a|ate|até|-)\s*\d{1,2}[-_/](\d{1,2})(?:\D|$)",
    re.IGNORECASE,
)


@dataclass
class StagedMenuImport:
    preview_id: str
    unit_id: str
    meal_type: str
    file_name: str
    items: list[ImportedMenuItem]
    suggested_month: int | None
    suggested_year: int | None


_STAGED: dict[str, StagedMenuImport] = {}


def infer_period_hint(file_name: str) -> tuple[int | None, int | None]:
    match = _FILENAME_MONTH_RE.search(file_name)
    if not match:
        return None, None
    month = int(match.group(1))
    return (month if 1 <= month <= 12 else None), None


def stage_menu_import(
    *, unit_id: str, meal_type: str, file_name: str, items: list[ImportedMenuItem]
) -> StagedMenuImport:
    month, year = infer_period_hint(file_name)
    staged = StagedMenuImport(str(uuid4()), unit_id, meal_type, file_name, items, month, year)
    _STAGED[staged.preview_id] = staged
    return staged


def get_staged(preview_id: str) -> StagedMenuImport | None:
    return _STAGED.get(preview_id)


def validate_items(items: Iterable[ImportedMenuItem]) -> list[str]:
    items = list(items)
    warnings: list[str] = []
    if not items:
        return ["Nenhum item de cardápio foi encontrado no arquivo."]
    invalid_days = sorted({item.day for item in items if not 1 <= item.day <= 31})
    if invalid_days:
        warnings.append(f"Dias inválidos encontrados: {invalid_days}")
    missing_codes = sum(1 for item in items if not item.technical_sheet_code)
    if missing_codes:
        warnings.append(
            f"{missing_codes} item(ns) estão sem código de ficha técnica; "
            "os dados nutricionais podem ficar indisponíveis."
        )
    duplicates: dict[tuple[int, str, str], int] = defaultdict(int)
    for item in items:
        duplicates[(item.day, item.category, item.name.casefold())] += 1
    duplicate_count = sum(1 for count in duplicates.values() if count > 1)
    if duplicate_count:
        warnings.append(
            f"{duplicate_count} item(ns) parecem duplicados no mesmo dia e categoria."
        )
    return warnings


def _technical_sheet_statuses(codes: set[str]) -> dict[str, str]:
    statuses: dict[str, str] = {}
    if not codes:
        return statuses
    with engine.connect() as conn:
        for code in codes:
            row = conn.execute(
                text(
                    """
                    SELECT kcal, protein_g, carbs_g, fat_g
                    FROM technical_sheets
                    WHERE code = :code
                    """
                ),
                {"code": code},
            ).mappings().one_or_none()
            if row is None:
                statuses[code] = "missing"
            elif all(row[field] is not None for field in ("kcal", "protein_g", "carbs_g", "fat_g")):
                statuses[code] = "complete"
            else:
                statuses[code] = "incomplete"
    return statuses


def preview_payload(staged: StagedMenuImport) -> dict:
    days: dict[int, list[dict]] = defaultdict(list)
    codes = {item.technical_sheet_code for item in staged.items if item.technical_sheet_code}
    statuses = _technical_sheet_statuses(codes)
    coverage = {"complete": 0, "incomplete": 0, "missing": 0, "no_code": 0}

    for item in staged.items:
        payload = asdict(item)
        if not item.technical_sheet_code:
            status = "no_code"
        else:
            status = statuses.get(item.technical_sheet_code, "missing")
        payload["technical_sheet_status"] = status
        coverage[status] += 1
        days[item.day].append(payload)

    warnings = validate_items(staged.items)
    if coverage["missing"]:
        warnings.append(
            f"{coverage['missing']} item(ns) possuem código, mas ainda não têm ficha técnica cadastrada."
        )
    if coverage["incomplete"]:
        warnings.append(
            f"{coverage['incomplete']} item(ns) possuem ficha técnica com macros incompletos."
        )

    return {
        "preview_id": staged.preview_id,
        "file_name": staged.file_name,
        "unit_id": staged.unit_id,
        "meal_type": staged.meal_type,
        "suggested_month": staged.suggested_month,
        "suggested_year": staged.suggested_year,
        "item_count": len(staged.items),
        "day_count": len(days),
        "days": [{"day": day, "items": days[day]} for day in sorted(days)],
        "warnings": warnings,
        "technical_sheet_coverage": coverage,
        "requires_period_confirmation": True,
    }


def _technical_sheet_snapshot(conn, code: str | None) -> tuple[dict | None, list[dict]]:
    if not code:
        return None, []
    sheet = conn.execute(
        text(
            "SELECT kcal, protein_g, carbs_g, fat_g, portion_quantity, portion_unit "
            "FROM technical_sheets WHERE code = :code"
        ),
        {"code": code},
    ).mappings().one_or_none()
    if sheet is None:
        return None, []
    allergens = conn.execute(
        text(
            "SELECT allergen, status FROM technical_sheet_allergens "
            "WHERE technical_sheet_code = :code"
        ),
        {"code": code},
    ).mappings().all()
    return dict(sheet), [dict(item) for item in allergens]


def publish_staged_menu(*, preview_id: str, month: int, year: int) -> dict:
    staged = get_staged(preview_id)
    if staged is None:
        raise LookupError("preview não encontrado ou expirado")
    if not 1 <= month <= 12:
        raise ValueError("mês inválido")
    if not 2020 <= year <= 2100:
        raise ValueError("ano inválido")
    dates = sorted({date(year, month, item.day) for item in staged.items})
    if not dates:
        raise ValueError("não há dias válidos para publicar")

    menu_import_id = uuid4()
    unit_uuid = UUID(staged.unit_id)
    enriched_items = 0
    with engine.begin() as conn:
        if conn.execute(
            text("SELECT 1 FROM units WHERE id = :unit_id"), {"unit_id": unit_uuid}
        ).scalar_one_or_none() is None:
            raise LookupError("unidade não encontrada")
        conn.execute(
            text(
                """
                INSERT INTO menu_imports
                    (id, unit_id, file_name, status, period_start, period_end, published_at)
                VALUES
                    (:id, :unit_id, :file_name, 'published', :period_start, :period_end, now())
                """
            ),
            {
                "id": menu_import_id,
                "unit_id": unit_uuid,
                "file_name": staged.file_name,
                "period_start": dates[0],
                "period_end": dates[-1],
            },
        )

        for service_date in dates:
            conn.execute(
                text(
                    "DELETE FROM menu_days WHERE unit_id = :unit_id "
                    "AND service_date = :service_date AND meal_type = :meal_type"
                ),
                {
                    "unit_id": unit_uuid,
                    "service_date": service_date,
                    "meal_type": staged.meal_type,
                },
            )
            menu_day_id = uuid4()
            conn.execute(
                text(
                    "INSERT INTO menu_days "
                    "(id, menu_import_id, unit_id, service_date, meal_type) "
                    "VALUES (:id,:menu_import_id,:unit_id,:service_date,:meal_type)"
                ),
                {
                    "id": menu_day_id,
                    "menu_import_id": menu_import_id,
                    "unit_id": unit_uuid,
                    "service_date": service_date,
                    "meal_type": staged.meal_type,
                },
            )

            for item in [i for i in staged.items if i.day == service_date.day]:
                sheet, allergens = _technical_sheet_snapshot(conn, item.technical_sheet_code)
                if sheet:
                    enriched_items += 1
                standard_portion = item.portion
                if not standard_portion and sheet and sheet.get("portion_quantity") is not None:
                    standard_portion = (
                        f"{sheet['portion_quantity']} {sheet.get('portion_unit') or ''}".strip()
                    )
                menu_item_id = uuid4()
                conn.execute(
                    text(
                        """
                        INSERT INTO menu_items
                            (id, menu_day_id, technical_sheet_code, name, category,
                             standard_portion, kcal, protein_g, carbs_g, fat_g)
                        VALUES
                            (:id,:menu_day_id,:technical_sheet_code,:name,:category,
                             :standard_portion,:kcal,:protein_g,:carbs_g,:fat_g)
                        """
                    ),
                    {
                        "id": menu_item_id,
                        "menu_day_id": menu_day_id,
                        "technical_sheet_code": item.technical_sheet_code,
                        "name": item.name,
                        "category": item.category,
                        "standard_portion": standard_portion,
                        "kcal": sheet.get("kcal") if sheet else None,
                        "protein_g": sheet.get("protein_g") if sheet else None,
                        "carbs_g": sheet.get("carbs_g") if sheet else None,
                        "fat_g": sheet.get("fat_g") if sheet else None,
                    },
                )
                for allergen in allergens:
                    conn.execute(
                        text(
                            "INSERT INTO menu_item_allergens (menu_item_id, allergen, status) "
                            "VALUES (:menu_item_id,:allergen,:status)"
                        ),
                        {"menu_item_id": menu_item_id, **allergen},
                    )

    _STAGED.pop(preview_id, None)
    return {
        "status": "published",
        "menu_import_id": str(menu_import_id),
        "period_start": dates[0].isoformat(),
        "period_end": dates[-1].isoformat(),
        "item_count": len(staged.items),
        "enriched_items": enriched_items,
    }


def published_menu_for_day(*, unit_id: str, service_date: date, meal_type: str) -> dict:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT mi.id, mi.name, mi.category, mi.standard_portion,
                       mi.kcal, mi.protein_g, mi.carbs_g, mi.fat_g,
                       mi.technical_sheet_code
                FROM menu_days md
                JOIN menu_items mi ON mi.menu_day_id = md.id
                WHERE md.unit_id = :unit_id
                  AND md.service_date = :service_date
                  AND md.meal_type = :meal_type
                ORDER BY mi.category, mi.name
                """
            ),
            {
                "unit_id": UUID(unit_id),
                "service_date": service_date,
                "meal_type": meal_type,
            },
        ).mappings().all()
    return {
        "unit_id": unit_id,
        "service_date": service_date.isoformat(),
        "meal_type": meal_type,
        "items": [dict(row) for row in rows],
    }
