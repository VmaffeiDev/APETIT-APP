from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api.admin_auth import hash_password, require_admin_key
from app.db import engine
from app.main import app
from app.services.admin_login_rate import (
    ADMIN_LOGIN_LIMIT,
    EVENT_TYPE,
    login_key,
    reserve_login_attempt,
)
from app.settings import Settings, settings

client = TestClient(app)
DEV_KEY = "test-only-security-key-not-a-real-secret-2026"
PASSWORD = "Security-Test-2026!"


def test_legacy_key_is_disabled_by_default():
    assert Settings(_env_file=None).allow_legacy_admin_key is False


@pytest.mark.parametrize(
    "environment,enabled,secret,value",
    [
        ("development", False, DEV_KEY, DEV_KEY),
        ("production", True, DEV_KEY, DEV_KEY),
        ("staging", True, DEV_KEY, DEV_KEY),
        (" DEVELOPMENT ", True, "change-me", "change-me"),
        ("development", True, "", None),
        ("development", True, "short", "short"),
        ("development", True, DEV_KEY, None),
        ("development", True, DEV_KEY, "incorrect"),
    ],
)
def test_legacy_key_cannot_bypass_login(monkeypatch, environment, enabled, secret, value):
    monkeypatch.setattr(settings, "environment", environment)
    monkeypatch.setattr(settings, "allow_legacy_admin_key", enabled)
    monkeypatch.setattr(settings, "api_secret", secret)
    headers = {"X-Apetit-Admin-Key": value} if value is not None else {}
    assert client.get("/api/admin/auth/me", headers=headers).status_code == 401
    with pytest.raises(HTTPException) as error:
        require_admin_key(value)
    assert error.value.status_code == 401


def test_legacy_key_requires_explicit_development_opt_in(monkeypatch):
    monkeypatch.setattr(settings, "environment", "development")
    monkeypatch.setattr(settings, "allow_legacy_admin_key", True)
    monkeypatch.setattr(settings, "api_secret", DEV_KEY)
    response = client.get("/api/admin/auth/me", headers={"X-Apetit-Admin-Key": DEV_KEY})
    assert response.status_code == 200
    assert response.json()["id"] is None
    require_admin_key(DEV_KEY)


@pytest.fixture
def admin_account():
    email = f"security-{uuid4().hex}@example.com"
    missing_email = f"missing-{uuid4().hex}@example.com"
    user_id = uuid4()
    with engine.begin() as conn:
        conn.execute(
            text("""
            INSERT INTO admin_users(id,name,email,password_hash,role,active)
            VALUES (:id,'Security regression',:email,:password,'admin',TRUE)
        """),
            {"id": user_id, "email": email, "password": hash_password(PASSWORD)},
        )
    try:
        yield {"id": user_id, "email": email, "missing_email": missing_email}
    finally:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM admin_users WHERE id=:id"), {"id": user_id})
            for address in (email, missing_email):
                conn.execute(
                    text("DELETE FROM auth_rate_events WHERE key_hash=:key AND event_type=:event"),
                    {"key": login_key(address), "event": EVENT_TYPE},
                )


def attempt(email, password=PASSWORD):
    return client.post("/api/admin/auth/login", json={"email": email, "password": password})


def test_failed_logins_persist_and_case_changes_do_not_reset_limit(admin_account):
    email = admin_account["email"]
    for index in range(ADMIN_LOGIN_LIMIT):
        address = email.upper() if index % 2 else email
        response = attempt(address, "Wrong-Password!")
        assert response.status_code == 401
        assert response.json()["detail"] == "E-mail ou senha inválidos"
    blocked = attempt(email)
    assert blocked.status_code == 429
    assert 1 <= int(blocked.headers["Retry-After"]) <= 900


def test_unknown_accounts_have_same_failure_response_and_limit(admin_account):
    for _ in range(ADMIN_LOGIN_LIMIT):
        response = attempt(admin_account["missing_email"])
        assert response.status_code == 401
        assert response.json()["detail"] == "E-mail ou senha inválidos"
    assert attempt(admin_account["missing_email"]).status_code == 429
    # Another account is not blocked by the first account's attempts.
    assert attempt(admin_account["email"]).status_code == 200


def test_expired_attempts_allow_login_and_logout_still_revokes_session(admin_account):
    email = admin_account["email"]
    for _ in range(ADMIN_LOGIN_LIMIT):
        reserve_login_attempt(email)
    with engine.begin() as conn:
        conn.execute(
            text("""
            UPDATE auth_rate_events SET created_at=now() - interval '16 minutes'
            WHERE key_hash=:key AND event_type=:event
        """),
            {"key": login_key(email), "event": EVENT_TYPE},
        )
    response = attempt(email)
    assert response.status_code == 200
    headers = {"Authorization": f"Bearer {response.json()['token']}"}
    assert client.get("/api/admin/auth/me", headers=headers).status_code == 200
    assert client.post("/api/admin/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/admin/auth/me", headers=headers).status_code == 401


def test_inactive_user_cannot_login(admin_account):
    with engine.begin() as conn:
        conn.execute(text("UPDATE admin_users SET active=FALSE WHERE id=:id"), admin_account)
    response = attempt(admin_account["email"])
    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha inválidos"


def test_concurrent_requests_cannot_exceed_account_budget(admin_account):
    def reserve(_):
        try:
            reserve_login_attempt(admin_account["email"])
            return 200
        except HTTPException as error:
            return error.status_code

    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(reserve, range(12)))
    assert results.count(200) == ADMIN_LOGIN_LIMIT
    assert results.count(429) == 12 - ADMIN_LOGIN_LIMIT
    with engine.connect() as conn:
        count = conn.execute(
            text("""
            SELECT COUNT(*) FROM auth_rate_events WHERE key_hash=:key AND event_type=:event
        """),
            {"key": login_key(admin_account["email"]), "event": EVENT_TYPE},
        ).scalar_one()
    assert count == ADMIN_LOGIN_LIMIT
