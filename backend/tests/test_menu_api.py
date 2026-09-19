from fastapi.testclient import TestClient

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
    response = client.post(
        "/api/admin/menu-imports/not-a-real-preview/publish",
        headers={"X-Apetit-Admin-Key": "change-me"},
        json={"month": 8, "year": 2026, "confirm_period": False},
    )
    assert response.status_code == 409
