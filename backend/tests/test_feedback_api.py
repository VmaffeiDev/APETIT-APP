from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_feedback_summary_requires_admin_key():
    response = client.get(
        "/api/admin/feedback/summary",
        params={
            "unit_id": "11111111-1111-1111-1111-111111111111",
            "start": "2026-09-01",
            "end": "2026-09-07",
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "credencial administrativa inválida"


def test_feedback_rating_validation_happens_before_database():
    response = client.post(
        "/api/feedback",
        json={
            "person_id": "11111111-1111-1111-1111-111111111111",
            "unit_id": "22222222-2222-2222-2222-222222222222",
            "restaurant_id": "33333333-3333-3333-3333-333333333333",
            "meal_date": "2026-09-16",
            "food_rating": 6,
            "service_rating": 5,
            "tags": [],
        },
    )
    assert response.status_code == 422
