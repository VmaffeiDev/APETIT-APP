from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api.admin_auth import hash_password
from app.db import engine
from app.main import app


client = TestClient(app)


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def login(email: str, password: str) -> str:
    response = client.post(
        "/api/admin/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()["token"]


def test_technical_sheet_coverage_counts_real_matches():
    suffix = uuid4().hex
    company_id = uuid4()
    unit_id = uuid4()
    menu_import_id = uuid4()
    menu_day_id = uuid4()
    admin_id = uuid4()
    password = "Coverage-Test-2026!"
    email = f"coverage-{suffix}@example.com"
    complete_code = f"COV-{suffix[:8]}-COMPLETE"
    incomplete_code = f"COV-{suffix[:8]}-INCOMPLETE"
    missing_code = f"COV-{suffix[:8]}-MISSING"

    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO companies(id,name) VALUES (:id,:name)"),
            {"id": company_id, "name": f"Coverage Company {suffix[:8]}"},
        )
        conn.execute(
            text("INSERT INTO units(id,company_id,name) VALUES (:id,:company_id,:name)"),
            {"id": unit_id, "company_id": company_id, "name": "Coverage Unit"},
        )
        conn.execute(
            text(
                """
                INSERT INTO admin_users(id,email,name,password_hash,role,active)
                VALUES (:id,:email,'Coverage Nutrition',:password,'nutricao',TRUE)
                """
            ),
            {
                "id": admin_id,
                "email": email,
                "password": hash_password(password),
            },
        )
        conn.execute(
            text("INSERT INTO admin_user_units(user_id,unit_id) VALUES (:user_id,:unit_id)"),
            {"user_id": admin_id, "unit_id": unit_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO technical_sheets(
                    code,name,category,kcal,protein_g,carbs_g,fat_g
                )
                VALUES
                    (:complete,'Ficha completa','teste',100,10,20,3),
                    (:incomplete,'Ficha incompleta','teste',100,NULL,20,3)
                """
            ),
            {"complete": complete_code, "incomplete": incomplete_code},
        )
        conn.execute(
            text(
                """
                INSERT INTO menu_imports(id,unit_id,file_name,status,period_start,period_end,published_at)
                VALUES (:id,:unit_id,'coverage.csv','published','2098-01-01','2098-01-01',now())
                """
            ),
            {"id": menu_import_id, "unit_id": unit_id},
        )
        conn.execute(
            text(
                """
                INSERT INTO menu_days(id,menu_import_id,unit_id,service_date,meal_type)
                VALUES (:id,:menu_import_id,:unit_id,'2098-01-01','almoco')
                """
            ),
            {
                "id": menu_day_id,
                "menu_import_id": menu_import_id,
                "unit_id": unit_id,
            },
        )
        conn.execute(
            text(
                """
                INSERT INTO menu_items(id,menu_day_id,technical_sheet_code,name,category)
                VALUES
                    (:i1,:day,:complete,'Item completo','teste'),
                    (:i2,:day,:incomplete,'Item incompleto','teste'),
                    (:i3,:day,:missing,'Item sem ficha','teste'),
                    (:i4,:day,NULL,'Item sem código','teste')
                """
            ),
            {
                "i1": uuid4(),
                "i2": uuid4(),
                "i3": uuid4(),
                "i4": uuid4(),
                "day": menu_day_id,
                "complete": complete_code,
                "incomplete": incomplete_code,
                "missing": missing_code,
            },
        )

    try:
        token = login(email, password)
        response = client.get(
            "/api/admin/technical-sheets/coverage",
            headers=auth(token),
            params={"unit_id": str(unit_id)},
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["unit_id"] == str(unit_id)
        assert payload["scope"]["file_name"] == "coverage.csv"
        assert payload["scope"]["period_start"] == "2098-01-01"
        assert payload["scope"]["period_end"] == "2098-01-01"
        assert payload["summary"] == {
            "total_items": 4,
            "with_code": 3,
            "matched": 2,
            "complete": 1,
            "incomplete": 1,
            "missing": 1,
            "no_code": 1,
            "coverage_percent": 50,
            "complete_coverage_percent": 25,
        }
        statuses = {item["status"] for item in payload["pending"]}
        assert statuses == {"incomplete", "missing", "no_code"}
        assert payload["pending_count"] == 3

        overview = client.get("/api/admin/overview", headers=auth(token))
        assert overview.status_code == 200, overview.text
        overview_payload = overview.json()
        assert overview_payload["units"] == 1
        assert overview_payload["menu_items"] == 4
        assert overview_payload["enriched_menu_items"] == 2
        assert overview_payload["technical_coverage_percent"] == 50
        assert len(overview_payload["unit_comparison"]) == 1
        assert overview_payload["unit_comparison"][0]["technical_coverage_percent"] == 50
    finally:
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM menu_imports WHERE id=:id"),
                {"id": menu_import_id},
            )
            conn.execute(
                text("DELETE FROM technical_sheets WHERE code IN (:complete,:incomplete)"),
                {"complete": complete_code, "incomplete": incomplete_code},
            )
            conn.execute(text("DELETE FROM admin_users WHERE id=:id"), {"id": admin_id})
            conn.execute(text("DELETE FROM units WHERE id=:id"), {"id": unit_id})
            conn.execute(text("DELETE FROM companies WHERE id=:id"), {"id": company_id})
