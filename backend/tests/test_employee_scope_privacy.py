"""HTTP regressions with isolated synthetic records in PostgreSQL."""

import hashlib
from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api import admin_overview as overview_module
from app.db import engine
from app.main import app
from app.settings import settings

client = TestClient(app)


@pytest.fixture
def case(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    company = uuid4()
    units = [uuid4(), uuid4()]
    restaurants = [uuid4(), uuid4()]
    people = [uuid4() for _ in range(7)]
    admins = [uuid4(), uuid4()]
    imports = [uuid4(), uuid4()]
    tokens = [uuid4().hex for _ in range(7)]
    admin_tokens = [uuid4().hex, uuid4().hex]
    items = {}
    today = date.today()
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO companies(id,name) VALUES (:id,'Scope test')"), {"id": company}
        )
        for index in range(2):
            conn.execute(
                text("INSERT INTO units(id,company_id,name) VALUES (:id,:company,:name)"),
                {"id": units[index], "company": company, "name": f"Unit {index}"},
            )
            conn.execute(
                text("INSERT INTO restaurants(id,unit_id,name) VALUES (:id,:unit,'Test')"),
                {"id": restaurants[index], "unit": units[index]},
            )
            conn.execute(
                text("""
                INSERT INTO menu_imports(id,unit_id,file_name,status)
                VALUES (:id,:unit,'scope.csv','published')
            """),
                {"id": imports[index], "unit": units[index]},
            )
        for index, person in enumerate(people):
            unit = units[0] if index < 5 else units[1] if index == 5 else None
            conn.execute(
                text("INSERT INTO people(id,name,unit_id) VALUES (:id,'Synthetic',:unit)"),
                {"id": person, "unit": unit},
            )
            conn.execute(
                text("""
                INSERT INTO employee_sessions(person_id,token_hash,expires_at)
                VALUES (:person,:token,now()+interval '1 day')
            """),
                {"person": person, "token": hashlib.sha256(tokens[index].encode()).hexdigest()},
            )
        for index, admin in enumerate(admins):
            conn.execute(
                text("""
                INSERT INTO admin_users(id,name,email,password_hash,role)
                VALUES (:id,'Scope test',:email,'unused',:role)
            """),
                {
                    "id": admin,
                    "email": f"{admin}@example.com",
                    "role": "admin" if index == 0 else "visualizacao",
                },
            )
            conn.execute(
                text("""
                INSERT INTO admin_sessions(user_id,token_hash,expires_at)
                VALUES (:id,:token,now()+interval '1 day')
            """),
                {"id": admin, "token": hashlib.sha256(admin_tokens[index].encode()).hexdigest()},
            )
            for unit in units:
                conn.execute(
                    text("INSERT INTO admin_user_units(user_id,unit_id) VALUES (:id,:unit)"),
                    {"id": admin, "unit": unit},
                )
        for name, unit_index, day, meal_type in (
            ("own", 0, today, "almoco"),
            ("foreign", 1, today, "almoco"),
            ("old", 0, today - timedelta(days=1), "almoco"),
            ("dinner", 0, today, "jantar"),
        ):
            day_id, item_id = uuid4(), uuid4()
            conn.execute(
                text("""
                INSERT INTO menu_days(id,menu_import_id,unit_id,service_date,meal_type)
                VALUES (:id,:import,:unit,:day,:type)
            """),
                {
                    "id": day_id,
                    "import": imports[unit_index],
                    "unit": units[unit_index],
                    "day": day,
                    "type": meal_type,
                },
            )
            conn.execute(
                text("""
                INSERT INTO menu_items(id,menu_day_id,name,category,kcal,protein_g,carbs_g,fat_g)
                VALUES (:id,:day,:name,'arroz',100,10,10,2)
            """),
                {"id": item_id, "day": day_id, "name": name},
            )
            items[name] = str(item_id)
    try:
        yield {
            "units": units,
            "restaurants": restaurants,
            "people": people,
            "items": items,
            "headers": [{"Authorization": f"Bearer {token}"} for token in tokens],
            "admin": {"Authorization": f"Bearer {admin_tokens[0]}"},
            "viewer": {"Authorization": f"Bearer {admin_tokens[1]}"},
            "today": today,
        }
    finally:
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM admin_audit_events WHERE user_id=ANY(:ids)"), {"ids": admins}
            )
            conn.execute(text("DELETE FROM admin_users WHERE id=ANY(:ids)"), {"ids": admins})
            conn.execute(text("DELETE FROM people WHERE id=ANY(:ids)"), {"ids": people})
            conn.execute(text("DELETE FROM menu_imports WHERE id=ANY(:ids)"), {"ids": imports})
            conn.execute(text("DELETE FROM restaurants WHERE id=ANY(:ids)"), {"ids": restaurants})
            conn.execute(text("DELETE FROM units WHERE id=ANY(:ids)"), {"ids": units})
            conn.execute(text("DELETE FROM companies WHERE id=:id"), {"id": company})


def meal_payload(case, item="own"):
    return {
        "person_id": str(case["people"][0]),
        "meal_date": str(case["today"]),
        "meal_type": "almoco",
        "items": [{"menu_item_id": case["items"][item], "quantity": 1}],
    }


def test_options_and_menu_require_session_and_only_assigned_unit(case):
    assert client.get("/api/auth/options").status_code == 401
    params = {"unit_id": str(case["units"][0]), "service_date": str(case["today"])}
    assert client.get("/api/menu", params=params).status_code == 401
    options = client.get("/api/auth/options", headers=case["headers"][0]).json()
    assert [unit["unit_id"] for unit in options["units"]] == [str(case["units"][0])]
    assert options["units"][0]["restaurant_id"] == str(case["restaurants"][0])
    assert client.get("/api/menu", params=params, headers=case["headers"][0]).status_code == 200
    assert client.get("/api/menu", params=params, headers=case["headers"][5]).status_code == 403
    assert client.get("/api/menu", params=params, headers=case["headers"][6]).status_code == 403


@pytest.mark.parametrize("route", ["/api/me", "/api/me/onboarding"])
def test_employee_cannot_assign_or_change_own_unit(case, route):
    payload = {"name": "Synthetic", "unit_id": str(case["units"][1])}
    for person_index in (0, 6):
        assert (
            client.put(route, json=payload, headers=case["headers"][person_index]).status_code
            == 403
        )
    payload["unit_id"] = str(case["units"][0])
    assert client.put(route, json=payload, headers=case["headers"][0]).status_code == 200


def test_assignment_requires_named_admin_and_is_audited(case):
    path = f"/api/admin/employees/{case['people'][6]}/unit"
    payload = {"unit_id": str(case["units"][0])}
    assert client.put(path, json=payload).status_code == 401
    assert client.put(path, json=payload, headers=case["viewer"]).status_code == 403
    assert client.put(path, json=payload, headers=case["headers"][0]).status_code == 401
    assert client.put(path, json=payload, headers=case["admin"]).status_code == 200
    assert client.get("/api/me", headers=case["headers"][6]).json()["unit_id"] == payload["unit_id"]
    with engine.connect() as conn:
        row = (
            conn.execute(
                text("""
            SELECT action,metadata FROM admin_audit_events
            WHERE resource_id=:person AND action='employee.unit_assigned'
        """),
                {"person": str(case["people"][6])},
            )
            .mappings()
            .one()
        )
        assert row["metadata"]["previous_unit_id"] is None


@pytest.mark.parametrize("item", ["foreign", "old", "dinner"])
def test_meal_rejects_wrong_unit_date_and_meal_type(case, item):
    response = client.post("/api/meals", json=meal_payload(case, item), headers=case["headers"][0])
    assert response.status_code == 422
    history = client.get(
        "/api/meals/history",
        params={"person_id": str(case["people"][0])},
        headers=case["headers"][0],
    ).json()
    assert history["meals"] == []


def test_own_meal_saves_but_duplicates_and_other_person_are_rejected(case):
    payload = meal_payload(case)
    response = client.post("/api/meals", json=payload, headers=case["headers"][0])
    assert response.status_code == 200
    assert float(response.json()["estimated_totals"]["kcal"]) == 100
    payload["items"] *= 2
    assert client.post("/api/meals", json=payload, headers=case["headers"][0]).status_code == 422
    assert (
        client.post("/api/meals", json=meal_payload(case), headers=case["headers"][5]).status_code
        == 403
    )
    assert (
        client.get(
            "/api/meals/history",
            params={"person_id": str(case["people"][0])},
            headers=case["headers"][5],
        ).status_code
        == 403
    )


def test_feedback_and_nutrition_reject_foreign_unit(case):
    payload = {
        "person_id": str(case["people"][0]),
        "unit_id": str(case["units"][1]),
        "restaurant_id": str(case["restaurants"][1]),
        "meal_date": str(case["today"]),
        "food_rating": 4,
        "service_rating": 4,
    }
    assert client.post("/api/feedback", json=payload, headers=case["headers"][0]).status_code == 403
    params = {
        "person_id": payload["person_id"],
        "unit_id": payload["unit_id"],
        "service_date": str(case["today"]),
    }
    assert (
        client.get(
            "/api/nutrition/recommendation", params=params, headers=case["headers"][0]
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/nutrition/plate-evaluate",
            headers=case["headers"][0],
            json={**params, "selections": meal_payload(case)["items"]},
        ).status_code
        == 403
    )
    payload.update(unit_id=str(case["units"][0]), restaurant_id=str(case["restaurants"][0]))
    assert client.post("/api/feedback", json=payload, headers=case["headers"][0]).status_code == 200


def add_feedback(case, person_index, days_ago=0, tags=("sabor",)):
    index = 0 if person_index < 5 else 1
    feedback_id = uuid4()
    with engine.begin() as conn:
        conn.execute(
            text("""
            INSERT INTO feedback(id,person_id,unit_id,restaurant_id,meal_date,food_rating,service_rating,comment)
            VALUES (:id,:person,:unit,:restaurant,:day,4,4,'Identifying text must stay private')
        """),
            {
                "id": feedback_id,
                "person": case["people"][person_index],
                "unit": case["units"][index],
                "restaurant": case["restaurants"][index],
                "day": case["today"] - timedelta(days=days_ago),
            },
        )
        for tag in tags:
            conn.execute(
                text("INSERT INTO feedback_tags(feedback_id,tag) VALUES (:id,:tag)"),
                {"id": feedback_id, "tag": tag},
            )


def summary(case):
    response = client.get(
        "/api/admin/feedback/summary",
        headers=case["viewer"],
        params={
            "unit_id": str(case["units"][0]),
            "start": str(case["today"] - timedelta(days=4)),
            "end": str(case["today"]),
        },
    )
    assert response.status_code == 200
    return response.json()


def test_repeated_person_is_suppressed_in_summary_overview_and_pdf(case, monkeypatch):
    for day in range(5):
        add_feedback(case, 0, days_ago=day)
    data = summary(case)
    assert data["responses"] == 5 and data["suppressed"] is True
    assert data["ratings"] is None and data["tags"] == [] and data["comments"] == []
    overview = client.get("/api/admin/overview", headers=case["viewer"]).json()
    assert overview["satisfaction_overall"] is None and overview["top_feedback_tag"] is None
    assert all(row["satisfaction"] is None for row in overview["unit_comparison"])
    captured = []
    original = overview_module._report_pdf

    def render(payload):
        captured.append(payload)
        return original(payload)

    monkeypatch.setattr(overview_module, "_report_pdf", render)
    pdf = client.get("/api/admin/overview.pdf", headers=case["viewer"])
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert captured[0]["satisfaction_overall"] is None
    assert all(row["satisfaction"] is None for row in captured[0]["unit_comparison"])


def test_five_people_release_ratings_but_not_rare_tags_or_comments(case):
    for person in range(5):
        add_feedback(case, person, tags=("sabor", "rare") if person == 0 else ("sabor",))
    data = summary(case)
    assert data["suppressed"] is False and data["ratings"]["overall"] == 4
    assert data["tags"] == [{"tag": "sabor", "count": 5}]
    assert len(data["trend"]) == 1 and data["comments"] == []
    assert (
        client.get("/api/admin/overview", headers=case["viewer"]).json()["satisfaction_overall"]
        == 4
    )
    add_feedback(case, 5)
    overview = client.get("/api/admin/overview", headers=case["viewer"]).json()
    assert overview["satisfaction_overall"] is None and overview["top_feedback_tag"] is None
    by_unit = {row["unit_id"]: row for row in overview["unit_comparison"]}
    assert by_unit[str(case["units"][0])]["satisfaction"] == 4
    assert by_unit[str(case["units"][1])]["satisfaction"] is None


def test_daily_trend_counts_distinct_people_within_each_day(case):
    for person in range(5):
        add_feedback(case, person, days_ago=person)
    data = summary(case)
    assert data["suppressed"] is False
    assert data["trend"] == []


@pytest.mark.parametrize("path", ["/api/admin/employees", "/api/admin/employees/unit-options"])
def test_employee_directory_requires_individual_admin(case, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers=case["headers"][0]).status_code == 401
    assert client.get(path, headers=case["viewer"]).status_code == 403
    assert client.get(path, headers={"X-Apetit-Admin-Key": settings.api_secret}).status_code == 401
    assert client.get(path, headers=case["admin"]).status_code == 200


def test_employee_directory_filters_paginates_and_minimizes_data(case):
    marker = uuid4().hex
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE people SET name=:name WHERE id=ANY(:ids)"),
            {"name": marker, "ids": case["people"]},
        )
        conn.execute(
            text("UPDATE people SET deleted_at=now() WHERE id=:id"), {"id": case["people"][5]}
        )
    query = {"q": marker, "limit": 2}
    first = client.get("/api/admin/employees", params=query, headers=case["admin"]).json()
    second = client.get(
        "/api/admin/employees", params={**query, "offset": 2}, headers=case["admin"]
    ).json()
    assert first["has_more"] and second["has_more"]
    assert len(first["employees"]) == 2
    assert {p["id"] for p in first["employees"]}.isdisjoint(p["id"] for p in second["employees"])
    assert set(first["employees"][0]) == {
        "id",
        "name",
        "email",
        "unit_id",
        "unit_name",
        "company_name",
    }
    all_rows = client.get(
        "/api/admin/employees", params={"q": marker}, headers=case["admin"]
    ).json()
    assert len(all_rows["employees"]) == 6
    assert not all_rows["has_more"]
    pending = client.get(
        "/api/admin/employees", params={"q": marker, "unassigned": True}, headers=case["admin"]
    ).json()
    assert [p["id"] for p in pending["employees"]] == [str(case["people"][6])]
    literal = client.get(
        "/api/admin/employees", params={"q": "%'; --"}, headers=case["admin"]
    ).json()
    assert literal["employees"] == []
    assert (
        client.get("/api/admin/employees", params={"limit": 101}, headers=case["admin"]).status_code
        == 422
    )
    options = client.get("/api/admin/employees/unit-options", headers=case["admin"]).json()["units"]
    assert set(map(str, case["units"])).issubset({u["id"] for u in options})


def test_demo_sessions_are_separate_short_lived_and_development_only(case, monkeypatch):
    from datetime import datetime, timezone

    assert client.post("/api/auth/demo-session").status_code == 404
    monkeypatch.setattr(settings, "environment", "development")
    created = []
    try:
        for _ in range(2):
            response = client.post("/api/auth/demo-session")
            assert response.status_code == 200
            created.append(response.json())
        first, second = created
        assert first["person"]["id"] != second["person"]["id"]
        assert first["person"]["email"] != second["person"]["email"]
        assert first["access_token"] != second["access_token"]
        assert (
            0
            < (
                datetime.fromisoformat(first["expires_at"]) - datetime.now(timezone.utc)
            ).total_seconds()
            <= 8 * 3600
        )
        headers = {"Authorization": f"Bearer {first['access_token']}"}
        other = {"Authorization": f"Bearer {second['access_token']}"}
        assert client.get("/api/me", headers=headers).json()["id"] == first["person"]["id"]
        assert client.get("/api/me", headers=other).json()["id"] == second["person"]["id"]
        assert (
            client.get(
                "/api/meals/history", params={"person_id": second["person"]["id"]}, headers=headers
            ).status_code
            == 403
        )
        assert client.post("/api/auth/logout", headers=headers).status_code == 200
        assert client.get("/api/me", headers=headers).status_code == 401
        assert client.get("/api/me", headers=other).status_code == 200
    finally:
        from uuid import UUID

        with engine.begin() as conn:
            for entry in created:
                conn.execute(
                    text("DELETE FROM people WHERE id=:id"), {"id": UUID(entry["person"]["id"])}
                )


def test_integrated_employee_journey_from_email_login_to_report(case, monkeypatch):
    from app.api import auth as auth_module

    email = f"journey-{uuid4().hex}@example.com"
    person_id = case["people"][6]
    delivered = []
    monkeypatch.setattr(auth_module, "send_login_code", lambda **payload: delivered.append(payload))
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE people SET email=:email WHERE id=:id"), {"email": email, "id": person_id}
        )
    try:
        requested = client.post("/api/auth/request-code", json={"email": email})
        assert requested.status_code == 200 and "demo_code" not in requested.json()
        assert len(delivered) == 1 and delivered[0]["recipient"] == email
        verified = client.post(
            "/api/auth/verify-code", json={"email": email, "code": delivered[0]["code"]}
        )
        assert verified.status_code == 200
        headers = {"Authorization": f"Bearer {verified.json()['access_token']}"}
        assert client.get("/api/auth/options", headers=headers).json()["units"] == []
        assert (
            client.put(
                f"/api/admin/employees/{person_id}/unit",
                headers=case["admin"],
                json={"unit_id": str(case["units"][0])},
            ).status_code
            == 200
        )
        options = client.get("/api/auth/options", headers=headers).json()["units"]
        assert options[0]["unit_id"] == str(case["units"][0])
        assert (
            client.put(
                "/api/me/onboarding",
                headers=headers,
                json={"name": "Ensaio integrado", "unit_id": str(case["units"][0])},
            ).status_code
            == 200
        )
        assert client.get("/api/me", headers=headers).json()["onboarding_completed"] is True
        menu = client.get(
            "/api/menu",
            headers=headers,
            params={"unit_id": str(case["units"][0]), "service_date": str(case["today"])},
        )
        assert menu.status_code == 200
        payload = {**meal_payload(case), "person_id": str(person_id)}
        assert client.post("/api/meals", headers=headers, json=payload).status_code == 200
        history = client.get(
            "/api/meals/history", headers=headers, params={"person_id": str(person_id)}
        ).json()
        assert len(history["meals"]) == 1
        for index in [6, 0, 1, 2, 3]:
            response = client.post(
                "/api/feedback",
                headers=headers if index == 6 else case["headers"][index],
                json={
                    "person_id": str(case["people"][index]),
                    "unit_id": str(case["units"][0]),
                    "restaurant_id": str(case["restaurants"][0]),
                    "meal_date": str(case["today"]),
                    "food_rating": 4,
                    "service_rating": 4,
                    "tags": ["sabor"],
                    "comment": "Sintético, não divulgar",
                },
            )
            assert response.status_code == 200
            if index == 6:
                assert summary(case)["suppressed"] is True
        report = summary(case)
        assert report["responses"] == 5 and report["suppressed"] is False
        assert report["ratings"]["overall"] == 4 and report["comments"] == []
        assert client.get("/api/admin/overview.pdf", headers=headers).status_code == 401
        pdf = client.get("/api/admin/overview.pdf", headers=case["viewer"])
        assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
        assert client.post("/api/auth/logout", headers=headers).status_code == 200
        assert client.get("/api/me", headers=headers).status_code == 401
    finally:
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM employee_login_codes WHERE email=:email"), {"email": email}
            )
            conn.execute(
                text("DELETE FROM auth_rate_events WHERE key_hash=:key"),
                {"key": auth_module._rate_key(email)},
            )


@pytest.mark.parametrize(
    "environment,is_demo,expected",
    [
        ("development", True, 200),
        ("production", True, 404),
        ("development", False, 404),
    ],
)
def test_demo_nutrition_target_is_scoped_and_does_not_create_prescription(
    case, monkeypatch, environment, is_demo, expected
):
    monkeypatch.setattr(settings, "environment", environment)
    email = f"visitante.{uuid4().hex}@apetit.local" if is_demo else f"{uuid4().hex}@example.com"
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE people SET email=:email WHERE id=:id"),
            {"email": email, "id": case["people"][0]},
        )
    params = {
        "person_id": str(case["people"][0]),
        "unit_id": str(case["units"][0]),
        "service_date": str(case["today"]),
        "meal_type": "almoco",
    }
    recommendation = client.get(
        "/api/nutrition/recommendation", params=params, headers=case["headers"][0]
    )
    plate = client.post(
        "/api/nutrition/plate-evaluate",
        json={**params, "selections": [{"menu_item_id": case["items"]["own"], "quantity": 1}]},
        headers=case["headers"][0],
    )
    assert recommendation.status_code == expected
    assert plate.status_code == expected
    if expected == 200:
        assert recommendation.json()["reference_kind"] == "demo"
        assert plate.json()["reference_kind"] == "demo"
        progress = client.get(
            "/api/meals/progress",
            params={"person_id": params["person_id"]},
            headers=case["headers"][0],
        ).json()
        assert progress["meal_days"] == 0
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT count(*) FROM prescriptions WHERE person_id=:id"),
                {"id": case["people"][0]},
            ).scalar_one()
            == 0
        )


def test_overview_and_feedback_include_same_seven_day_window(case):
    for index in range(5):
        add_feedback(case, index, days_ago=6)
    overview = client.get("/api/admin/overview", headers=case["viewer"]).json()
    report = client.get(
        "/api/admin/feedback/summary",
        params={
            "unit_id": str(case["units"][0]),
            "start": str(case["today"] - timedelta(days=6)),
            "end": str(case["today"]),
        },
        headers=case["viewer"],
    ).json()
    assert overview["feedback_period_start"] == report["period_start"]
    assert overview["feedback_responses"] == report["responses"] == 5
    own = next(
        row for row in overview["unit_comparison"] if row["unit_id"] == str(case["units"][0])
    )
    assert own["feedback_responses"] == 5 and own["satisfaction"] == report["ratings"]["overall"]
