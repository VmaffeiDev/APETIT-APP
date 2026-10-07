"""Regression coverage through both services, using real PostgreSQL queries."""

from contextlib import nullcontext
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.db import engine
from app.services import nutrition_engine, plate_evaluation, prescription_workflow
from app.settings import settings


@pytest.fixture
def nutrition_case(monkeypatch):
    # One rollback-only transaction; no shared demonstration data is modified.
    with engine.connect() as conn:
        transaction = conn.begin()
        try:
            shared_engine = SimpleNamespace(connect=lambda: nullcontext(conn))
            for module in (nutrition_engine, plate_evaluation, prescription_workflow):
                monkeypatch.setattr(module, "engine", shared_engine)
            monkeypatch.setattr(settings, "environment", "production")
            ids = {key: uuid4() for key in ("unit", "person", "prescription", "import", "day")}
            statements = [
                "INSERT INTO units(id,name) VALUES (:unit,'Allergen regression')",
                "INSERT INTO people(id,name,unit_id) VALUES (:person,'Test',:unit)",
                "INSERT INTO dietary_restrictions(person_id,kind,value) "
                "VALUES (:person,'food','glúten')",
                "INSERT INTO prescriptions(id,person_id,source_kind,status,confirmed_at) "
                "VALUES (:prescription,:person,'test','confirmed',now())",
                "INSERT INTO prescription_meals(prescription_id,meal_type,kcal,protein_g,carbs_g,fat_g) "
                "VALUES (:prescription,'almoco',100,10,10,2)",
                "INSERT INTO menu_imports(id,unit_id,file_name,status) "
                "VALUES (:import,:unit,'test.csv','published')",
                "INSERT INTO menu_days(id,menu_import_id,unit_id,service_date,meal_type) "
                "VALUES (:day,:import,:unit,'2098-01-01','almoco')",
            ]
            for statement in statements:
                conn.execute(text(statement), ids)
            items = {}
            for name, status in (
                ("Livre", "free_from"), ("Contém", "contains"),
                ("Traços", "may_contain"), ("Ausente", None),
                ("Legado", "confirmed"), ("Desconhecido", "unknown"),
            ):
                item_id = uuid4()
                items[name] = item_id
                conn.execute(text("""
                    INSERT INTO menu_items(id,menu_day_id,name,category,kcal,protein_g,carbs_g,fat_g)
                    VALUES (:id,:day,:name,'arroz',100,10,10,2)
                """), {"id": item_id, "day": ids["day"], "name": name})
                if status is not None:
                    conn.execute(text("""
                        INSERT INTO menu_item_allergens(menu_item_id,allergen,status)
                        VALUES (:id,'gluten',:status)
                    """), {"id": item_id, "status": status})
            yield SimpleNamespace(
                conn=conn, person=ids["person"], items=items,
                params={"person_id": str(ids["person"]), "unit_id": str(ids["unit"]),
                        "service_date": date(2098, 1, 1), "meal_type": "almoco"},
            )
        finally:
            transaction.rollback()


def test_recommendation_excludes_presence_and_uncertainty(nutrition_case):
    result = nutrition_engine.recommend_meal(**nutrition_case.params)
    assert result["status"] == "recommended"
    assert [item["name"] for item in result["items"]] == ["Livre"]
    assert set(result["warnings"]["excluded_for_restriction"]) == {"Contém", "Legado"}
    assert set(result["warnings"]["uncertain_allergens"]) == {"Traços", "Ausente", "Desconhecido"}


@pytest.mark.parametrize(
    "name,status,warning",
    [("Livre", "within_target", None), ("Contém", "blocked", "unsafe_items"),
     ("Legado", "blocked", "unsafe_items"), ("Traços", "blocked", "uncertain_allergens"),
     ("Ausente", "blocked", "uncertain_allergens"),
     ("Desconhecido", "blocked", "uncertain_allergens")],
)
def test_manual_plate_uses_same_policy(nutrition_case, name, status, warning):
    result = plate_evaluation.evaluate_plate(
        **nutrition_case.params,
        selections=[{"menu_item_id": str(nutrition_case.items[name]), "quantity": 1}],
    )
    assert result["status"] == status
    if warning:
        assert result["warnings"][warning] == [name]
    else:
        assert not any(result["warnings"].values())


def test_missing_second_restriction_prevents_recommendation(nutrition_case):
    nutrition_case.conn.execute(text(
        "INSERT INTO dietary_restrictions(person_id,kind,value) VALUES (:id,'food','soja')"
    ), {"id": nutrition_case.person})
    result = nutrition_engine.recommend_meal(**nutrition_case.params)
    assert result["status"] == "insufficient_data"
    assert result["items"] == []


def test_unrestricted_employee_can_evaluate_item_without_declarations(nutrition_case):
    nutrition_case.conn.execute(text(
        "DELETE FROM dietary_restrictions WHERE person_id=:id"
    ), {"id": nutrition_case.person})
    result = plate_evaluation.evaluate_plate(
        **nutrition_case.params,
        selections=[{"menu_item_id": str(nutrition_case.items["Ausente"]), "quantity": 1}],
    )
    assert result["status"] == "within_target"
