from __future__ import annotations

import hashlib
import json
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID
from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text

from app.api.admin_auth import (
    AdminPrincipal, allowed_unit_ids, create_session, hash_password, require_admin,
    require_permission, revoke_session, verify_password,
)
from app.db import engine
from app.services.email_delivery import EmailDeliveryError, send_admin_password_reset
from app.settings import settings

router = APIRouter()
logger = logging.getLogger("apetit.admin_auth")
ADMIN_RESET_TTL_MINUTES = 15
ADMIN_RESET_REQUEST_LIMIT = 3
ADMIN_RESET_VERIFY_LIMIT = 5
ADMIN_RESET_RATE_WINDOW_MINUTES = 15


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)




class UserRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str
    unit_ids: list[UUID] = []


def public_user(row) -> dict:
    return {"id": str(row["id"]), "name": row["name"], "email": str(row["email"]),
            "role": row["role"], "active": row["active"],
            "last_login_at": row["last_login_at"].isoformat() if row["last_login_at"] else None,
            "unit_ids": [str(value) for value in (row.get("unit_ids") or [])]}


@router.post("/api/admin/auth/login", tags=["admin-auth"])
def login(payload: LoginRequest) -> dict:
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT id,name,email,password_hash,role,active,last_login_at
            FROM admin_users WHERE email=:email
        """), {"email": str(payload.email)}).mappings().one_or_none()
    if not row or not row["active"] or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    token, expires = create_session(row["id"])
    return {"token": token, "expires_at": expires.isoformat(),
            "user": public_user(row)}


@router.get("/api/admin/auth/me", tags=["admin-auth"])
def me(principal: AdminPrincipal = Depends(require_admin)) -> dict:
    unit_ids = allowed_unit_ids(principal)
    return {"id": str(principal.id) if principal.id else None, "name": principal.name,
            "email": principal.email, "role": principal.role,
            "presentation": principal.presentation,
            "unit_ids": [] if unit_ids is None else [str(value) for value in unit_ids]}


@router.post("/api/admin/auth/logout", tags=["admin-auth"])
def logout(
    authorization: str | None = Header(default=None),
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    if authorization and authorization.startswith("Bearer ") and principal.id:
        revoke_session(authorization[7:].strip())
    return {"status": "ok"}


@router.post("/api/admin/auth/change-password", tags=["admin-auth"])
def change_password(
    payload: ChangePasswordRequest,
    authorization: str | None = Header(default=None),
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    if principal.id is None:
        raise HTTPException(status_code=403, detail="Use uma conta individual para alterar a senha")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=422, detail="A nova senha deve ser diferente da senha atual")

    token = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else ""
    current_token_hash = hashlib.sha256(token.encode()).hexdigest() if token else None

    with engine.begin() as conn:
        row = conn.execute(text("""
            SELECT password_hash FROM admin_users
            WHERE id=:id AND active=TRUE
            FOR UPDATE
        """), {"id": principal.id}).mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Conta administrativa não encontrada")
        if not verify_password(payload.current_password, row["password_hash"]):
            raise HTTPException(status_code=400, detail="Senha atual incorreta")

        conn.execute(text("""
            UPDATE admin_users SET password_hash=:password WHERE id=:id
        """), {"id": principal.id, "password": hash_password(payload.new_password)})

        if current_token_hash:
            conn.execute(text("""
                UPDATE admin_sessions SET revoked_at=now()
                WHERE user_id=:id AND revoked_at IS NULL AND token_hash<>:current_token
            """), {"id": principal.id, "current_token": current_token_hash})
        else:
            conn.execute(text("""
                UPDATE admin_sessions SET revoked_at=now()
                WHERE user_id=:id AND revoked_at IS NULL
            """), {"id": principal.id})

        conn.execute(text("""
            DELETE FROM admin_password_resets
            WHERE user_id=:id AND used_at IS NULL
        """), {"id": principal.id})

        conn.execute(text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id,metadata)
            VALUES (:actor,'admin_user.password_changed','admin_user',:target,
                    jsonb_build_object('other_sessions_revoked',TRUE))
        """), {"actor": principal.id, "target": str(principal.id)})

    return {"status": "password_changed", "other_sessions_revoked": True}




@router.get("/api/admin/users", tags=["admin-users"])
def users(principal: AdminPrincipal = Depends(require_admin)) -> dict:
    require_permission(principal, "manage_users")
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT u.id,u.name,u.email,u.role,u.active,u.last_login_at,
                   COALESCE(array_agg(auu.unit_id) FILTER (WHERE auu.unit_id IS NOT NULL),
                            ARRAY[]::uuid[]) AS unit_ids
            FROM admin_users u LEFT JOIN admin_user_units auu ON auu.user_id=u.id
            GROUP BY u.id,u.name,u.email,u.role,u.active,u.last_login_at
            ORDER BY u.active DESC,u.name
        """)).mappings().all()
    return {"users": [public_user(row) for row in rows]}


@router.post("/api/admin/users", tags=["admin-users"])
def create_user(payload: UserRequest, principal: AdminPrincipal = Depends(require_admin)) -> dict:
    require_permission(principal, "manage_users")
    if payload.role not in {"admin","operacao","nutricao","visualizacao"}:
        raise HTTPException(status_code=422, detail="Perfil inválido")
    with engine.begin() as conn:
        existing = conn.execute(text("SELECT 1 FROM admin_users WHERE email=:email"),
                                {"email": str(payload.email)}).first()
        if existing:
            raise HTTPException(status_code=409, detail="Já existe um usuário com este e-mail")
        row = conn.execute(text("""
            INSERT INTO admin_users(name,email,password_hash,role)
            VALUES (:name,:email,:password,:role)
            RETURNING id,name,email,role,active,last_login_at
        """), {"name": payload.name.strip(), "email": str(payload.email),
               "password": hash_password(payload.password), "role": payload.role}).mappings().one()
        if payload.unit_ids:
            requested = set(payload.unit_ids)
            found = set(conn.execute(
                text("SELECT id FROM units WHERE id = ANY(:ids)"),
                {"ids": list(requested)},
            ).scalars().all())
            if found != requested:
                raise HTTPException(status_code=422, detail="Uma ou mais unidades são inválidas")
        for unit_id in set(payload.unit_ids) if payload.role != "admin" else set():
            conn.execute(text("""
                INSERT INTO admin_user_units(user_id,unit_id) VALUES (:user_id,:unit_id)
            """), {"user_id": row["id"], "unit_id": unit_id})
        conn.execute(text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id,metadata)
            VALUES (:actor,'admin_user.created','admin_user',:target,
                    CAST(:metadata AS jsonb))
        """), {
            "actor": principal.id,
            "target": str(row["id"]),
            "metadata": json.dumps({"role": payload.role, "email": str(payload.email)}),
        })
    return {**public_user(row), "unit_ids": [str(id) for id in payload.unit_ids] if payload.role != "admin" else []}


@router.post("/api/admin/auth/bootstrap-demo", tags=["admin-auth"])
def bootstrap_demo(payload: UserRequest, x_apetit_admin_key: str | None = Header(default=None)) -> dict:
    if settings.environment.strip().lower() != "development" or (x_apetit_admin_key or "").strip() != "presentation":
        raise HTTPException(status_code=404, detail="indisponível")
    if payload.role != "admin":
        raise HTTPException(status_code=422, detail="O primeiro usuário da demo deve ser administrador")
    with engine.begin() as conn:
        count = conn.execute(text("SELECT count(*) FROM admin_users")).scalar_one()
        if count:
            raise HTTPException(status_code=409, detail="A demo já possui usuário administrativo")
        row = conn.execute(text("""
            INSERT INTO admin_users(name,email,password_hash,role)
            VALUES (:name,:email,:password,'admin')
            RETURNING id,name,email,role,active,last_login_at
        """), {"name": payload.name.strip(), "email": str(payload.email),
               "password": hash_password(payload.password)}).mappings().one()
    token, expires = create_session(row["id"])
    return {"token": token, "expires_at": expires.isoformat(), "user": public_user(row)}


class UserAccessRequest(BaseModel):
    role: str
    unit_ids: list[UUID] = []


@router.patch("/api/admin/users/{user_id}/access", tags=["admin-users"])
def update_user_access(user_id: UUID, payload: UserAccessRequest,
                       principal: AdminPrincipal = Depends(require_admin)) -> dict:
    require_permission(principal, "manage_users")
    if principal.id is None:
        raise HTTPException(status_code=403, detail="Use uma conta individual de administrador")
    if payload.role not in {"admin","operacao","nutricao","visualizacao"}:
        raise HTTPException(status_code=422, detail="Perfil inválido")
    if user_id == principal.id and payload.role != "admin":
        raise HTTPException(status_code=409, detail="Você não pode remover seu próprio perfil de administrador")
    with engine.begin() as conn:
        row = conn.execute(text("SELECT id FROM admin_users WHERE id=:id"), {"id": user_id}).first()
        if row is None:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        if payload.unit_ids:
            found = set(conn.execute(text("SELECT id FROM units WHERE id = ANY(:ids)"), {"ids": list(set(payload.unit_ids))}).scalars().all())
            if found != set(payload.unit_ids):
                raise HTTPException(status_code=422, detail="Uma ou mais unidades são inválidas")
        conn.execute(text("UPDATE admin_users SET role=:role WHERE id=:id"), {"role": payload.role, "id": user_id})
        conn.execute(text("DELETE FROM admin_user_units WHERE user_id=:id"), {"id": user_id})
        if payload.role != "admin":
            for unit_id in set(payload.unit_ids):
                conn.execute(text("INSERT INTO admin_user_units(user_id,unit_id) VALUES (:user_id,:unit_id)"),
                             {"user_id": user_id, "unit_id": unit_id})
        conn.execute(text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id,metadata)
            VALUES (:actor,'admin_user.access_updated','admin_user',:target,
                    CAST(:metadata AS jsonb))
        """), {
            "actor": principal.id,
            "target": str(user_id),
            "metadata": json.dumps({
                "role": payload.role,
                "unit_ids": [str(v) for v in payload.unit_ids],
            }),
        })
    return {"status":"updated","id":str(user_id),"role":payload.role,
            "unit_ids":[] if payload.role=="admin" else [str(v) for v in payload.unit_ids]}


class UserStatusRequest(BaseModel):
    active: bool


class PasswordResetRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)


@router.patch("/api/admin/users/{user_id}/status", tags=["admin-users"])
def update_user_status(user_id: UUID, payload: UserStatusRequest,
                       principal: AdminPrincipal = Depends(require_admin)) -> dict:
    require_permission(principal, "manage_users")
    if principal.id is None:
        raise HTTPException(status_code=403, detail="Use uma conta individual de administrador")
    if user_id == principal.id and not payload.active:
        raise HTTPException(status_code=409, detail="Você não pode desativar sua própria conta")
    with engine.begin() as conn:
        row = conn.execute(text("""
            UPDATE admin_users SET active=:active WHERE id=:id
            RETURNING id,name,email,role,active,last_login_at
        """), {"id": user_id, "active": payload.active}).mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        if not payload.active:
            conn.execute(text("UPDATE admin_sessions SET revoked_at=now() WHERE user_id=:id AND revoked_at IS NULL"), {"id": user_id})
        conn.execute(text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id,metadata)
            VALUES (:actor,:action,'admin_user',:target,CAST(:metadata AS jsonb))
        """), {
            "actor": principal.id,
            "action": "admin_user.activated" if payload.active else "admin_user.deactivated",
            "target": str(user_id),
            "metadata": json.dumps({"active": payload.active}),
        })
    return public_user(row)


@router.post("/api/admin/users/{user_id}/reset-password", tags=["admin-users"])
def reset_user_password(user_id: UUID, payload: PasswordResetRequest,
                        principal: AdminPrincipal = Depends(require_admin)) -> dict:
    require_permission(principal, "manage_users")
    if principal.id is None:
        raise HTTPException(status_code=403, detail="Use uma conta individual de administrador")
    with engine.begin() as conn:
        result = conn.execute(text("""
            UPDATE admin_users SET password_hash=:password WHERE id=:id
        """), {"id": user_id, "password": hash_password(payload.password)})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        conn.execute(text("UPDATE admin_sessions SET revoked_at=now() WHERE user_id=:id AND revoked_at IS NULL"), {"id": user_id})
        conn.execute(text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id)
            VALUES (:actor,'admin_user.password_reset','admin_user',:target)
        """), {"actor": principal.id, "target": str(user_id)})
    return {"status": "password_reset", "sessions_revoked": True}


@router.get("/api/admin/audit", tags=["admin-audit"])
def admin_audit(limit: int = 50, principal: AdminPrincipal = Depends(require_admin)) -> dict:
    require_permission(principal, "manage_users")
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=422, detail="Limite inválido")
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT e.id,e.action,e.resource_type,e.resource_id,e.metadata,e.created_at,
                   u.name AS actor_name,u.email AS actor_email
            FROM admin_audit_events e LEFT JOIN admin_users u ON u.id=e.user_id
            ORDER BY e.created_at DESC,e.id DESC LIMIT :limit
        """), {"limit": limit}).mappings().all()
    return {"events": [{"id": str(row["id"]), "action": row["action"],
                        "resource_type": row["resource_type"], "resource_id": row["resource_id"],
                        "metadata": row["metadata"], "created_at": row["created_at"].isoformat(),
                        "actor_name": row["actor_name"], "actor_email": str(row["actor_email"]) if row["actor_email"] else None}
                       for row in rows]}



class AdminPasswordResetRequest(BaseModel):
    email: EmailStr


class AdminPasswordResetConfirm(BaseModel):
    email: EmailStr
    token: str = Field(min_length=32, max_length=256)
    new_password: str = Field(min_length=8, max_length=128)


def _recovery_key(email: str) -> str:
    return hashlib.sha256(f"admin-auth:{email.strip().lower()}".encode()).hexdigest()


def _recovery_rate(conn, *, email: str, kind: str, maximum: int) -> None:
    count = conn.execute(text("""
        SELECT COUNT(*) FROM auth_rate_events
        WHERE key_hash=:key_hash AND event_type=:kind
          AND created_at >= now() - (:minutes * interval '1 minute')
    """), {
        "key_hash": _recovery_key(email),
        "kind": kind,
        "minutes": ADMIN_RESET_RATE_WINDOW_MINUTES,
    }).scalar_one()
    if count >= maximum:
        raise HTTPException(
            status_code=429,
            detail=f"Muitas tentativas. Aguarde {ADMIN_RESET_RATE_WINDOW_MINUTES} minutos e tente novamente.",
        )


def _recovery_record(conn, *, email: str, kind: str) -> None:
    conn.execute(text("""
        INSERT INTO auth_rate_events(key_hash,event_type)
        VALUES (:key_hash,:kind)
    """), {"key_hash": _recovery_key(email), "kind": kind})


@router.post("/api/admin/auth/password-reset/request", tags=["admin-auth"])
def request_admin_password_reset(payload: AdminPasswordResetRequest, request: Request) -> dict:
    email = str(payload.email).strip().lower()
    reset_token: str | None = None
    user_id = None

    with engine.begin() as conn:
        _recovery_rate(conn, email=email, kind="admin_reset_request", maximum=ADMIN_RESET_REQUEST_LIMIT)
        _recovery_record(conn, email=email, kind="admin_reset_request")
        row = conn.execute(text("""
            SELECT id,email,active FROM admin_users WHERE email=:email
        """), {"email": email}).mappings().one_or_none()

        if row and row["active"]:
            user_id = row["id"]
            reset_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=ADMIN_RESET_TTL_MINUTES)
            conn.execute(text("""
                INSERT INTO admin_password_resets(user_id,token_hash,expires_at,used_at)
                VALUES (:user_id,:token_hash,:expires_at,NULL)
                ON CONFLICT (user_id) DO UPDATE SET
                    token_hash=EXCLUDED.token_hash,
                    expires_at=EXCLUDED.expires_at,
                    created_at=now(),
                    used_at=NULL
            """), {
                "user_id": user_id,
                "token_hash": token_hash,
                "expires_at": expires_at,
            })

    if reset_token and user_id:
        origin = (request.headers.get("origin") or "").rstrip("/")
        if origin not in settings.allowed_origins:
            origin = (settings.allowed_origins[0] if settings.allowed_origins else "").rstrip("/")
        if not origin:
            raise HTTPException(status_code=503, detail="Origem do Admin não configurada para recuperação")
        reset_url = (
            f"{origin}/?reset_token={quote(reset_token)}&email={quote(email)}"
            "#redefinir-senha"
        )
        try:
            send_admin_password_reset(
                recipient=email,
                reset_url=reset_url,
                expires_in_minutes=ADMIN_RESET_TTL_MINUTES,
            )
        except EmailDeliveryError as exc:
            logger.warning("Falha ao enviar recuperação do Admin: %s", exc)
            with engine.begin() as conn:
                conn.execute(text("""
                    DELETE FROM admin_password_resets
                    WHERE user_id=:user_id AND used_at IS NULL
                """), {"user_id": user_id})
            raise HTTPException(
                status_code=503,
                detail="Não foi possível enviar o código de recuperação. Tente novamente em instantes.",
            ) from exc

    return {
        "status": "accepted",
        "message": "Se existir uma conta ativa com este e-mail, enviaremos um link para criar uma nova senha.",
        "expires_in_minutes": ADMIN_RESET_TTL_MINUTES,
    }


@router.post("/api/admin/auth/password-reset/confirm", tags=["admin-auth"])
def confirm_admin_password_reset(payload: AdminPasswordResetConfirm) -> dict:
    email = str(payload.email).strip().lower()
    token_hash = hashlib.sha256(payload.token.strip().encode()).hexdigest()

    with engine.begin() as conn:
        _recovery_rate(conn, email=email, kind="admin_reset_verify_failed", maximum=ADMIN_RESET_VERIFY_LIMIT)
        row = conn.execute(text("""
            SELECT u.id AS user_id, r.id AS reset_id
            FROM admin_users u
            JOIN admin_password_resets r ON r.user_id=u.id
            WHERE u.email=:email AND u.active=TRUE
              AND r.token_hash=:token_hash
              AND r.used_at IS NULL
              AND r.expires_at > now()
            FOR UPDATE
        """), {"email": email, "token_hash": token_hash}).mappings().one_or_none()

        if row is None:
            _recovery_record(conn, email=email, kind="admin_reset_verify_failed")
            raise HTTPException(status_code=401, detail="Link de redefinição inválido ou expirado")

        conn.execute(text("""
            UPDATE admin_users SET password_hash=:password WHERE id=:id
        """), {"id": row["user_id"], "password": hash_password(payload.new_password)})
        conn.execute(text("""
            UPDATE admin_password_resets SET used_at=now() WHERE id=:id
        """), {"id": row["reset_id"]})
        conn.execute(text("""
            UPDATE admin_sessions SET revoked_at=now()
            WHERE user_id=:id AND revoked_at IS NULL
        """), {"id": row["user_id"]})
        conn.execute(text("""
            DELETE FROM auth_rate_events
            WHERE key_hash=:key_hash AND event_type='admin_reset_verify_failed'
        """), {"key_hash": _recovery_key(email)})
        conn.execute(text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id,metadata)
            VALUES (:actor,'admin_user.password_recovered','admin_user',:target,
                    jsonb_build_object('all_sessions_revoked',TRUE))
        """), {"actor": row["user_id"], "target": str(row["user_id"])})

    return {"status": "password_reset", "sessions_revoked": True}



class SelfRegistrationRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


@router.post("/api/admin/auth/register", tags=["admin-auth"])
def register_admin_user(payload: SelfRegistrationRequest) -> dict:
    """Public team signup. New accounts are inactive until an administrator approves access."""
    email = str(payload.email).strip().lower()
    with engine.begin() as conn:
        _recovery_rate(conn, email=email, kind="admin_register", maximum=3)
        _recovery_record(conn, email=email, kind="admin_register")
        existing = conn.execute(
            text("SELECT active FROM admin_users WHERE email=:email"),
            {"email": email},
        ).mappings().one_or_none()
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Já existe uma conta com este e-mail. Entre ou recupere sua senha.",
            )
        row = conn.execute(text("""
            INSERT INTO admin_users(name,email,password_hash,role,active)
            VALUES (:name,:email,:password,'visualizacao',FALSE)
            RETURNING id,name,email,role,active,last_login_at
        """), {
            "name": payload.name.strip(),
            "email": email,
            "password": hash_password(payload.password),
        }).mappings().one()
        conn.execute(text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id,metadata)
            VALUES (NULL,'admin_user.registration_requested','admin_user',:target,
                    CAST(:metadata AS jsonb))
        """), {
            "target": str(row["id"]),
            "metadata": json.dumps({"email": email}),
        })
    return {
        "status": "pending_approval",
        "message": "Cadastro recebido. Um administrador precisa aprovar seu acesso antes do primeiro login.",
        "user": public_user(row),
    }
