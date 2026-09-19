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
            "last_login_at": row["last_login_at"].isoformat() if row["last_login_at"] else None}


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
            "user": public_user(row | {"last_login_at": None})}


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
