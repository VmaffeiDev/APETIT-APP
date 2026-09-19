from __future__ import annotations

import json
from collections import Counter
from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import text

from app.db import engine


def snapshot_days(conn, *, unit_id: UUID, meal_type: str, dates: list[date]) -> list[dict]:
    if not dates:
        return []
    rows = conn.execute(text("""
        SELECT md.id, md.service_date, md.meal_type
        FROM menu_days md
        WHERE md.unit_id=:unit_id AND md.meal_type=:meal_type
          AND md.service_date = ANY(:dates)
        ORDER BY md.service_date
    """), {"unit_id": unit_id, "meal_type": meal_type, "dates": dates}).mappings().all()
    days = []
    for row in rows:
        items = conn.execute(text("""
            SELECT id, name, category, standard_portion, technical_sheet_code,
                   kcal, protein_g, carbs_g, fat_g
            FROM menu_items WHERE menu_day_id=:id
            ORDER BY category, name, id
        """), {"id": row["id"]}).mappings().all()
        entries = []
        for item in items:
            allergens = conn.execute(text("""
                SELECT allergen, status FROM menu_item_allergens
                WHERE menu_item_id=:id ORDER BY allergen
            """), {"id": item["id"]}).mappings().all()
            entries.append({
                key: str(item[key]) if key in {"kcal", "protein_g", "carbs_g", "fat_g"}
                     and item[key] is not None else item[key]
                for key in ("name", "category", "standard_portion", "technical_sheet_code",
                            "kcal", "protein_g", "carbs_g", "fat_g")
            } | {"allergens": [dict(a) for a in allergens]})
        days.append({"date": row["service_date"].isoformat(),
                     "meal_type": row["meal_type"], "items": entries})
    return days


def archive_snapshot(conn, import_id: UUID, days: list[dict]) -> None:
    conn.execute(text("""
        INSERT INTO menu_version_snapshots
          (menu_import_id, snapshot, restorable, provenance)
        VALUES (:id, CAST(:snapshot AS JSONB), TRUE, 'captured_at_publication')
    """), {"id": import_id, "snapshot": json.dumps({"days": days}, ensure_ascii=False)})


def _signature(item: dict) -> str:
    return json.dumps(item, sort_keys=True, ensure_ascii=False, default=str)


def compare_days(saved: list[dict], current: list[dict]) -> list[dict]:
    by_date = {day["date"]: day for day in current}
    changes = []
    for day in saved:
        existing = by_date.get(day["date"])
        old = Counter(_signature(item) for item in day["items"])
        now = Counter(_signature(item) for item in existing["items"]) if existing else Counter()
        changes.append({
            "date": day["date"],
            "current_published": existing is not None,
            "same": old == now and existing is not None,
            "only_in_version": [json.loads(key) for key, count in (old - now).items()
                                for _ in range(count)],
            "only_in_current": [json.loads(key) for key, count in (now - old).items()
                                for _ in range(count)],
        })
    return changes


def get_version(unit_id: UUID, version_id: UUID) -> dict:
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT mi.id, mi.unit_id, mi.meal_type, mi.file_name, mi.period_start,
                   mi.period_end, mi.published_at, mi.operation_kind, mi.operator_label,
                   vs.snapshot, vs.restorable, vs.provenance
            FROM menu_imports mi LEFT JOIN menu_version_snapshots vs
              ON vs.menu_import_id=mi.id
            WHERE mi.id=:id AND mi.unit_id=:unit_id AND mi.status='published'
        """), {"id": version_id, "unit_id": unit_id}).mappings().one_or_none()
        if row is None:
            raise LookupError("versão não encontrada nesta unidade")
        days = row["snapshot"]["days"] if row["snapshot"] else []
        all_dates = [date.fromisoformat(day["date"]) for day in days]
        current = snapshot_days(conn, unit_id=unit_id,
            meal_type=row["meal_type"] or (days[0]["meal_type"] if days else "almoco"),
            dates=all_dates)
        return {
            "id": str(row["id"]), "unit_id": str(row["unit_id"]),
            "meal_type": row["meal_type"], "file_name": row["file_name"],
            "published_at": row["published_at"].isoformat() if row["published_at"] else None,
            "operation_kind": row["operation_kind"], "operator_label": row["operator_label"],
            "restorable": bool(row["restorable"]), "provenance": row["provenance"],
            "days": days, "comparison": compare_days(days, current),
        }


def restore_version(*, unit_id: UUID, version_id: UUID,
                    expected_current: list[dict], operator_label: str) -> dict:
    operator_label = operator_label.strip()
    if not 2 <= len(operator_label) <= 100:
        raise ValueError("informe o nome do operador (2 a 100 caracteres)")
    with engine.begin() as conn:
        row = conn.execute(text("""
            SELECT mi.*, vs.snapshot, vs.restorable
            FROM menu_imports mi JOIN menu_version_snapshots vs
              ON vs.menu_import_id=mi.id
            WHERE mi.id=:id AND mi.unit_id=:unit_id AND mi.status='published'
        """), {"id": version_id, "unit_id": unit_id}).mappings().one_or_none()
        if row is None:
            raise LookupError("versão não encontrada nesta unidade")
        if not row["restorable"]:
            raise ValueError("esta versão é anterior ao arquivamento completo e não pode ser restaurada")
        days = row["snapshot"]["days"]
        if not days:
            raise ValueError("esta versão não contém dias para restaurar")
        meal_type = row["meal_type"]
        if any(day["meal_type"] != meal_type for day in days):
            raise ValueError("versão com refeições inconsistentes")
        dates = [date.fromisoformat(day["date"]) for day in days]
        if len(set(dates)) != len(dates):
            raise ValueError("versão com datas duplicadas")
        conn.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                     {"key": f"{unit_id}:{meal_type}"})
        active = conn.execute(text("""
            SELECT md.service_date, md.menu_import_id FROM menu_days md
            WHERE md.unit_id=:unit_id AND md.meal_type=:meal_type
              AND md.service_date = ANY(:dates)
            ORDER BY md.service_date
        """), {"unit_id": unit_id, "meal_type": meal_type, "dates": dates}).mappings().all()
        actual = [{"date": r["service_date"].isoformat(),
                   "menu_import_id": str(r["menu_import_id"])} for r in active]
        if actual != expected_current:
            raise FileExistsError("O cardápio mudou após a prévia. Atualize a versão antes de restaurar.")
        new_id = uuid4()
        conn.execute(text("""
            INSERT INTO menu_imports
              (id, unit_id, file_name, status, period_start, period_end,
               published_at, meal_type, operator_label, replaced_dates,
               item_count, operation_kind, restored_from)
            VALUES
              (:id, :unit_id, :file, 'published', :start, :end, now(),
               :meal, :operator, :dates, :count, 'restore', :source)
        """), {"id": new_id, "unit_id": unit_id,
               "file": f"Restauração da versão {version_id}",
               "start": min(dates), "end": max(dates), "meal": meal_type,
               "operator": operator_label, "dates": [r["service_date"] for r in active],
               "count": sum(len(day["items"]) for day in days), "source": version_id})
        for day in days:
            service_date = date.fromisoformat(day["date"])
            conn.execute(text("""
                DELETE FROM menu_days WHERE unit_id=:unit_id
                  AND service_date=:day AND meal_type=:meal
            """), {"unit_id": unit_id, "day": service_date, "meal": meal_type})
            day_id = uuid4()
            conn.execute(text("""
                INSERT INTO menu_days (id, menu_import_id, unit_id, service_date, meal_type)
                VALUES (:id, :import_id, :unit_id, :day, :meal)
            """), {"id": day_id, "import_id": new_id, "unit_id": unit_id,
                   "day": service_date, "meal": meal_type})
            for item in day["items"]:
                item_id = uuid4()
                conn.execute(text("""
                    INSERT INTO menu_items
                      (id, menu_day_id, technical_sheet_code, name, category,
                       standard_portion, kcal, protein_g, carbs_g, fat_g)
                    VALUES (:id, :day, :code, :name, :category, :portion,
                            :kcal, :protein, :carbs, :fat)
                """), {"id": item_id, "day": day_id, "code": item["technical_sheet_code"],
                       "name": item["name"], "category": item["category"],
                       "portion": item["standard_portion"], "kcal": item["kcal"],
                       "protein": item["protein_g"], "carbs": item["carbs_g"],
                       "fat": item["fat_g"]})
                for allergen in item["allergens"]:
                    conn.execute(text("""
                        INSERT INTO menu_item_allergens (menu_item_id, allergen, status)
                        VALUES (:id, :allergen, :status)
                    """), {"id": item_id, **allergen})
        archive_snapshot(conn, new_id, days)
    return {"status": "restored", "menu_import_id": str(new_id),
            "restored_from": str(version_id), "days": len(days)}
