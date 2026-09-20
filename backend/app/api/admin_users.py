from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import text

from app.api.admin_auth import (
    AdminPrincipal, create_session, hash_password, require_admin,
    require_permission, revoke_session, verify_password,
)
from app.db import engine
from app.settings import settings

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


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
    return {"id": str(principal.id) if principal.id else None, "name": principal.name,
            "email": principal.email, "role": principal.role,
            "presentation": principal.presentation}


@router.post("/api/admin/auth/logout", tags=["admin-auth"])
def logout(
    authorization: str | None = Header(default=None),
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    if authorization and authorization.startswith("Bearer ") and principal.id:
        revoke_session(authorization[7:].strip())
    return {"status": "ok"}


@router.get("/api/admin/users", tags=["admin-users"])
def users(principal: AdminPrincipal = Depends(require_admin)) -> dict:
    require_permission(principal, "manage_users")
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id,name,email,role,active,last_login_at FROM admin_users
            ORDER BY active DESC,name
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
        for unit_id in set(payload.unit_ids):
            conn.execute(text("""
                INSERT INTO admin_user_units(user_id,unit_id) VALUES (:user_id,:unit_id)
            """), {"user_id": row["id"], "unit_id": unit_id})
        conn.execute(text("""
            INSERT INTO admin_audit_events(user_id,action,resource_type,resource_id,metadata)
            VALUES (:actor,'admin_user.created','admin_user',:target,
                    jsonb_build_object('role',:role,'email',:email))
        """), {"actor": principal.id, "target": str(row["id"]),
               "role": payload.role, "email": str(payload.email)})
    return public_user(row)


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
                    jsonb_build_object('role',:role,'unit_ids',:unit_ids))
        """), {"actor": principal.id, "target": str(user_id), "role": payload.role,
               "unit_ids": [str(v) for v in payload.unit_ids]})
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
            VALUES (:actor,:action,'admin_user',:target,jsonb_build_object('active',:active))
        """), {"actor": principal.id, "action": "admin_user.activated" if payload.active else "admin_user.deactivated",
               "target": str(user_id), "active": payload.active})
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
