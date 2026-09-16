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


_FILENAME_MONTH_RE = re.compile(r"(?:^|\D)(?:\d{1,2})\s*(?:a|ate|até|-)\s*\d{1,2}[-_/](\d{1,2})(?:\D|$)", re.IGNORECASE)


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
    *,
    unit_id: str,
    meal_type: str,
    file_name: str,
    items: list[ImportedMenuItem],
) -> StagedMenuImport:
    month, year = infer_period_hint(file_name)
    staged = StagedMenuImport(
        preview_id=str(uuid4()),
        unit_id=unit_id,
        meal_type=meal_type,
        file_name=file_name,
        items=items,
        suggested_month=month,
        suggested_year=year,
    )
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
            f"{missing_codes} item(ns) estão sem código de ficha técnica; os dados nutricionais podem ficar indisponíveis."
        )

    duplicates: dict[tuple[int, str, str], int] = defaultdict(int)
    for item in items:
        duplicates[(item.day, item.category, item.name.casefold())] += 1
    duplicate_count = sum(1 for count in duplicates.values() if count > 1)
    if duplicate_count:
        warnings.append(f"{duplicate_count} item(ns) parecem duplicados no mesmo dia e categoria.")

    return warnings


def preview_payload(staged: StagedMenuImport) -> dict:
    days: dict[int, list[dict]] = defaultdict(list)
    for item in staged.items:
        days[item.day].append(asdict(item))
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
        "warnings": validate_items(staged.items),
        "requires_period_confirmation": True,
    }


def publish_staged_menu(
    *,
    preview_id: str,
    month: int,
    year: int,
) -> dict:
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

    with engine.begin() as conn:
        unit_exists = conn.execute(
            text("SELECT 1 FROM units WHERE id = :unit_id"), {"unit_id": unit_uuid}
        ).scalar_one_or_none()
        if unit_exists is None:
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
                    """
                    DELETE FROM menu_days
                    WHERE unit_id = :unit_id
                      AND service_date = :service_date
                      AND meal_type = :meal_type
                    """
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
                    """
                    INSERT INTO menu_days
                        (id, menu_import_id, unit_id, service_date, meal_type)
                    VALUES
                        (:id, :menu_import_id, :unit_id, :service_date, :meal_type)
                    """
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
                conn.execute(
                    text(
                        """
                        INSERT INTO menu_items
                            (menu_day_id, technical_sheet_code, name, category, standard_portion)
                        VALUES
                            (:menu_day_id, :technical_sheet_code, :name, :category, :standard_portion)
                        """
                    ),
                    {
                        "menu_day_id": menu_day_id,
                        "technical_sheet_code": item.technical_sheet_code,
                        "name": item.name,
                        "category": item.category,
                        "standard_portion": item.portion,
                    },
                )

    _STAGED.pop(preview_id, None)
    return {
        "status": "published",
        "menu_import_id": str(menu_import_id),
        "period_start": dates[0].isoformat(),
        "period_end": dates[-1].isoformat(),
        "item_count": len(staged.items),
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
