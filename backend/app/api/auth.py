from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text

from app.db import engine
from app.settings import settings

router = APIRouter()

LOGIN_CODE_TTL_MINUTES = 10
SESSION_TTL_DAYS = 30
DEMO_CODE = "123456"


class RequestCodePayload(BaseModel):
    email: EmailStr


class VerifyCodePayload(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class OnboardingPayload(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    unit_id: UUID
    sector: str | None = Field(default=None, max_length=120)
    goal: str | None = Field(default=None, max_length=80)
    restrictions: list[str] = Field(default_factory=list, max_length=20)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="sessão do funcionário ausente")
    return authorization.split(" ", 1)[1].strip()


def current_person(authorization: str | None) -> dict:
    token = _bearer(authorization)
    with engine.connect() as conn:
        person = conn.execute(
            text(
                """
                SELECT p.id, p.email, p.name, p.unit_id, p.sector, p.goal,
                       p.onboarding_completed_at
                FROM employee_sessions s
                JOIN people p ON p.id = s.person_id
                WHERE s.token_hash = :token_hash
                  AND s.revoked_at IS NULL
                  AND s.expires_at > now()
                  AND p.deleted_at IS NULL
                LIMIT 1
                """
            ),
            {"token_hash": _hash(token)},
        ).mappings().first()
    if person is None:
        raise HTTPException(status_code=401, detail="sessão inválida ou expirada")
    return dict(person)


@router.post("/api/auth/request-code", tags=["employee-auth"])
def request_code(payload: RequestCodePayload) -> dict:
    email = str(payload.email).strip().lower()
    code = DEMO_CODE if settings.environment == "development" else f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=LOGIN_CODE_TTL_MINUTES)

    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM employee_login_codes WHERE email = :email AND used_at IS NULL"),
            {"email": email},
        )
        conn.execute(
            text(
                """
                INSERT INTO employee_login_codes (email, code_hash, expires_at)
                VALUES (:email, :code_hash, :expires_at)
                """
            ),
            {"email": email, "code_hash": _hash(code), "expires_at": expires_at},
        )

    response = {
        "status": "code_sent",
        "expires_in_minutes": LOGIN_CODE_TTL_MINUTES,
        "message": "Enviamos um código de acesso para o e-mail informado.",
    }
    if settings.environment == "development":
        response["demo_code"] = code
    return response


@router.post("/api/auth/verify-code", tags=["employee-auth"])
def verify_code(payload: VerifyCodePayload) -> dict:
    email = str(payload.email).strip().lower()
    with engine.begin() as conn:
        code_row = conn.execute(
            text(
                """
                SELECT id FROM employee_login_codes
                WHERE email = :email
                  AND code_hash = :code_hash
                  AND used_at IS NULL
                  AND expires_at > now()
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {"email": email, "code_hash": _hash(payload.code)},
        ).mappings().first()
        if code_row is None:
            raise HTTPException(status_code=401, detail="código inválido ou expirado")
        conn.execute(text("UPDATE employee_login_codes SET used_at = now() WHERE id = :id"), {"id": code_row["id"]})

        person = conn.execute(
            text("SELECT id, name, unit_id, sector, goal, onboarding_completed_at FROM people WHERE email = :email AND deleted_at IS NULL"),
            {"email": email},
        ).mappings().first()
        if person is None:
            person_id = conn.execute(
                text("INSERT INTO people (email) VALUES (:email) RETURNING id"),
                {"email": email},
            ).scalar_one()
            person = {"id": person_id, "name": None, "unit_id": None, "sector": None, "goal": None, "onboarding_completed_at": None}

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
        conn.execute(
            text(
                """
                INSERT INTO employee_sessions (person_id, token_hash, expires_at)
                VALUES (:person_id, :token_hash, :expires_at)
                """
            ),
            {"person_id": person["id"], "token_hash": _hash(token), "expires_at": expires_at},
        )

    return {
        "status": "authenticated",
        "access_token": token,
        "expires_at": expires_at.isoformat(),
        "person": {
            "id": str(person["id"]),
            "email": email,
            "name": person["name"],
            "unit_id": str(person["unit_id"]) if person["unit_id"] else None,
            "sector": person["sector"],
            "goal": person["goal"],
            "onboarding_completed": person["onboarding_completed_at"] is not None,
        },
    }


@router.get("/api/auth/options", tags=["employee-auth"])
def onboarding_options() -> dict:
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT c.id AS company_id, c.name AS company_name,
                       u.id AS unit_id, u.name AS unit_name
                FROM companies c
                JOIN units u ON u.company_id = c.id
                ORDER BY c.name, u.name
                """
            )
        ).mappings().all()
    return {
        "units": [
            {
                "company_id": str(row["company_id"]),
                "company_name": row["company_name"],
                "unit_id": str(row["unit_id"]),
                "unit_name": row["unit_name"],
            }
            for row in rows
        ],
        "goals": ["alimentacao_equilibrada", "seguir_prescricao", "melhorar_habitos"],
    }


@router.get("/api/me", tags=["employee-profile"])
def me(authorization: str | None = Header(default=None)) -> dict:
    person = current_person(authorization)
    with engine.connect() as conn:
        restrictions = conn.execute(
            text("SELECT value FROM dietary_restrictions WHERE person_id = :person_id ORDER BY value"),
            {"person_id": person["id"]},
        ).scalars().all()
    return {
        "id": str(person["id"]),
        "email": person["email"],
        "name": person["name"],
        "unit_id": str(person["unit_id"]) if person["unit_id"] else None,
        "sector": person["sector"],
        "goal": person["goal"],
        "restrictions": list(restrictions),
        "onboarding_completed": person["onboarding_completed_at"] is not None,
    }


@router.put("/api/me/onboarding", tags=["employee-profile"])
def save_onboarding(payload: OnboardingPayload, authorization: str | None = Header(default=None)) -> dict:
    person = current_person(authorization)
    restrictions = sorted({item.strip().lower() for item in payload.restrictions if item.strip()})

    with engine.begin() as conn:
        unit_exists = conn.execute(text("SELECT 1 FROM units WHERE id = :id"), {"id": payload.unit_id}).scalar_one_or_none()
        if unit_exists is None:
            raise HTTPException(status_code=422, detail="unidade não encontrada")

        conn.execute(
            text(
                """
                UPDATE people
                SET name = :name,
                    unit_id = :unit_id,
                    sector = :sector,
                    goal = :goal,
                    onboarding_completed_at = now()
                WHERE id = :person_id
                """
            ),
            {
                "person_id": person["id"],
                "name": payload.name.strip(),
                "unit_id": payload.unit_id,
                "sector": payload.sector.strip() if payload.sector else None,
                "goal": payload.goal,
            },
        )
        conn.execute(text("DELETE FROM dietary_restrictions WHERE person_id = :person_id"), {"person_id": person["id"]})
        for restriction in restrictions:
            conn.execute(
                text("INSERT INTO dietary_restrictions (person_id, kind, value) VALUES (:person_id, 'food', :value)"),
                {"person_id": person["id"], "value": restriction},
            )

    return {"status": "saved", "onboarding_completed": True, "person_id": str(person["id"])}


@router.post("/api/auth/logout", tags=["employee-auth"])
def logout(authorization: str | None = Header(default=None)) -> dict:
    token = _bearer(authorization)
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE employee_sessions SET revoked_at = now() WHERE token_hash = :token_hash AND revoked_at IS NULL"),
            {"token_hash": _hash(token)},
        )
    return {"status": "logged_out"}
