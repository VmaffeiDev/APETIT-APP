from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import engine
from app.main import app


client = TestClient(app)


def test_preview_requires_admin_key():
    response = client.post(
        "/api/admin/menu-imports/preview",
        data={"unit_id": "11111111-1111-1111-1111-111111111111", "meal_type": "almoco"},
        files={"file": ("cardapio.csv", b"Dia;ARROZ\n17;ARROZ BRANCO (100g) - 01.02.03.004 - 1.25\n", "text/csv")},
    )
    assert response.status_code == 401


def test_preview_parses_real_planning_shape():
    response = client.post(
        "/api/admin/menu-imports/preview",
        headers={"X-Apetit-Admin-Key": "change-me"},
        data={"unit_id": "11111111-1111-1111-1111-111111111111", "meal_type": "almoco"},
        files={
            "file": (
                "Cardapio 17 a 21-08.csv",
                (
                    "Dia;PRATO PRINCIPAL;ARROZ;KIT - QUIMICO\n"
                    "17;BIFE ACEBOLADO (80g) - 01.03.01.033 - 3.11;"
                    "ARROZ BRANCO (100g) - 01.02.03.004 - 1.25;KIT TESTE\n"
                ).encode(),
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["suggested_month"] == 8
    assert payload["suggested_year"] is None
    assert payload["requires_period_confirmation"] is True
    assert payload["item_count"] == 2
    assert payload["days"][0]["items"][0]["name"] == "BIFE ACEBOLADO"
    assert all(item["source_column"] != "KIT - QUIMICO" for item in payload["days"][0]["items"])


def test_publish_requires_explicit_period_confirmation():
    preview = client.post(
        "/api/admin/menu-imports/preview",
        headers={"X-Apetit-Admin-Key": "change-me"},
        data={"unit_id": "11111111-1111-1111-1111-111111111111", "meal_type": "almoco"},
        files={
            "file": (
                "cardapio.csv",
                b"Dia;ARROZ\n17;ARROZ BRANCO (100g) - 01.02.03.004 - 1.25\n",
                "text/csv",
            )
        },
    )
    assert preview.status_code == 200

    response = client.post(
        f"/api/admin/menu-imports/{preview.json()['preview_id']}/publish",
        headers={"X-Apetit-Admin-Key": "change-me"},
        json={"month": 8, "year": 2026, "confirm_period": False, "operator_label": "Teste CI"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "confirme explicitamente o período antes de publicar"


def test_publish_and_replace_existing_menu():
    company_id = "90000000-0000-4000-8000-000000000001"
    unit_id = "90000000-0000-4000-8000-000000000002"
    headers = {"X-Apetit-Admin-Key": "change-me"}
    csv = b"Dia;ARROZ\n28;ARROZ BRANCO (100g) - 01.02.03.004 - 1.25\n"

    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO companies(id,name) VALUES (:id,'Empresa Teste Menu')"),
            {"id": company_id},
        )
        conn.execute(
            text("INSERT INTO units(id,company_id,name) VALUES (:id,:company_id,'Unidade Teste Menu')"),
            {"id": unit_id, "company_id": company_id},
        )

    try:
        first_preview = client.post(
            "/api/admin/menu-imports/preview",
            headers=headers,
            data={"unit_id": unit_id, "meal_type": "almoco"},
            files={"file": ("cardapio-correcao.csv", csv, "text/csv")},
        )
        assert first_preview.status_code == 200

        first_publish = client.post(
            f"/api/admin/menu-imports/{first_preview.json()['preview_id']}/publish",
            headers=headers,
            json={
                "month": 12,
                "year": 2098,
                "confirm_period": True,
                "replace_existing": False,
                "operator_label": "Teste CI",
            },
        )
        assert first_publish.status_code == 200

        second_preview = client.post(
            "/api/admin/menu-imports/preview",
            headers=headers,
            data={"unit_id": unit_id, "meal_type": "almoco"},
            files={"file": ("cardapio-correcao.csv", csv, "text/csv")},
        )
        assert second_preview.status_code == 200

        correction = client.post(
            f"/api/admin/menu-imports/{second_preview.json()['preview_id']}/publish",
            headers=headers,
            json={
                "month": 12,
                "year": 2098,
                "confirm_period": True,
                "replace_existing": True,
                "operator_label": "Teste CI",
            },
        )
        assert correction.status_code == 200
        payload = correction.json()
        assert payload["status"] == "published"
        assert payload["period_start"] == "2098-12-28"
        assert payload["period_end"] == "2098-12-28"
    finally:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM menu_imports WHERE unit_id=:unit_id"), {"unit_id": unit_id})
            conn.execute(text("DELETE FROM units WHERE id=:unit_id"), {"unit_id": unit_id})
            conn.execute(text("DELETE FROM companies WHERE id=:company_id"), {"company_id": company_id})
