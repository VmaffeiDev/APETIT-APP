from __future__ import annotations

from uuid import UUID, uuid4

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
    token = response.json()["token"]
    assert token
    return token


def publication_status(token: str, unit_id: UUID):
    return client.get(
        "/api/admin/menus/publication-status",
        headers=auth(token),
        params={
            "unit_id": str(unit_id),
            "start": "2026-10-01",
            "end": "2026-10-02",
            "meal_type": "almoco",
        },
    )


def preview_menu(token: str, unit_id: UUID):
    return client.post(
        "/api/admin/menu-imports/preview",
        headers=auth(token),
        data={"unit_id": str(unit_id), "meal_type": "almoco"},
        files={
            "file": (
                "cardapio.csv",
                b"Dia;ARROZ\n1;ARROZ BRANCO (100g) - 01.02.03.004 - 1.25\n",
                "text/csv",
            )
        },
    )


def test_admin_users_roles_unit_access_and_audit():
    suffix = uuid4().hex
    company_id = uuid4()
    allowed_unit_id = uuid4()
    blocked_unit_id = uuid4()
    admin_id = uuid4()
    password = "Teste-RBAC-2026!"
    email_prefix = f"rbac-{suffix}"

    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO companies(id,name) VALUES (:id,:name)"),
            {"id": company_id, "name": f"Empresa RBAC {suffix[:8]}"},
        )
        conn.execute(
            text(
                """
                INSERT INTO units(id,company_id,name)
                VALUES (:allowed,:company,'Unidade permitida RBAC'),
                       (:blocked,:company,'Unidade bloqueada RBAC')
                """
            ),
            {
                "allowed": allowed_unit_id,
                "blocked": blocked_unit_id,
                "company": company_id,
            },
        )
        conn.execute(
            text(
                """
                INSERT INTO admin_users(id,email,name,password_hash,role,active)
                VALUES (:id,:email,'Admin RBAC',:password,'admin',TRUE)
                """
            ),
            {
                "id": admin_id,
                "email": f"{email_prefix}-admin@example.com",
                "password": hash_password(password),
            },
        )

    try:
        admin_token = login(f"{email_prefix}-admin@example.com", password)

        me = client.get("/api/admin/auth/me", headers=auth(admin_token))
        assert me.status_code == 200
        assert me.json()["role"] == "admin"

        created_user_ids: list[str] = []
        role_tokens: dict[str, str] = {}

        for role in ("operacao", "nutricao", "visualizacao"):
            email = f"{email_prefix}-{role}@example.com"
            created = client.post(
                "/api/admin/users",
                headers=auth(admin_token),
                json={
                    "name": f"Usuário {role}",
                    "email": email,
                    "password": password,
                    "role": role,
                    "unit_ids": [str(allowed_unit_id)],
                },
            )
            assert created.status_code == 200, created.text
            payload = created.json()
            assert payload["role"] == role
            assert payload["unit_ids"] == [str(allowed_unit_id)]
            created_user_ids.append(payload["id"])

            token = login(email, password)
            role_tokens[role] = token

            own_me = client.get("/api/admin/auth/me", headers=auth(token))
            assert own_me.status_code == 200
            assert own_me.json()["role"] == role
            assert own_me.json()["unit_ids"] == [str(allowed_unit_id)]

            allowed = publication_status(token, allowed_unit_id)
            assert allowed.status_code == 200, allowed.text

            blocked = publication_status(token, blocked_unit_id)
            assert blocked.status_code == 403
            assert blocked.json()["detail"] == "Sua conta não possui acesso a esta unidade"

            manage_users = client.get("/api/admin/users", headers=auth(token))
            assert manage_users.status_code == 403

        for role in ("operacao", "nutricao"):
            allowed_preview = preview_menu(role_tokens[role], allowed_unit_id)
            assert allowed_preview.status_code == 200, allowed_preview.text

            blocked_preview = preview_menu(role_tokens[role], blocked_unit_id)
            assert blocked_preview.status_code == 403
            assert blocked_preview.json()["detail"] == "Sua conta não possui acesso a esta unidade"

        view_preview = preview_menu(role_tokens["visualizacao"], allowed_unit_id)
        assert view_preview.status_code == 403
        assert view_preview.json()["detail"] == "Seu perfil não permite esta ação"

        audit = client.get("/api/admin/audit?limit=100", headers=auth(admin_token))
        assert audit.status_code == 200
        created_events = {
            event["resource_id"]: event
            for event in audit.json()["events"]
            if event["action"] == "admin_user.created"
            and event["resource_id"] in created_user_ids
        }
        assert set(created_events) == set(created_user_ids)
        assert all(event["actor_name"] == "Admin RBAC" for event in created_events.values())
    finally:
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM admin_users WHERE email LIKE :prefix"),
                {"prefix": f"{email_prefix}-%"},
            )
            conn.execute(
                text("DELETE FROM units WHERE id IN (:allowed,:blocked)"),
                {"allowed": allowed_unit_id, "blocked": blocked_unit_id},
            )
            conn.execute(
                text("DELETE FROM companies WHERE id=:id"),
                {"id": company_id},
            )
