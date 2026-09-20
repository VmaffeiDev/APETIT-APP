from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Header, HTTPException
from sqlalchemy import text

from app.db import engine
from app.settings import settings

PRESENTATION_ADMIN_KEY = "presentation"
SESSION_HOURS = 12
ROLE_PERMISSIONS = {
    "admin": {"read", "publish_menu", "manage_sheets", "restore_menu", "manage_users"},
    "operacao": {"read", "publish_menu", "restore_menu"},
    "nutricao": {"read", "publish_menu", "manage_sheets"},
    "visualizacao": {"read"},
}


@dataclass(frozen=True)
class AdminPrincipal:
    id: UUID | None
    name: str
    email: str | None
    role: str
    presentation: bool = False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return "pbkdf2_sha256$210000$" + salt.hex() + "$" + digest.hex()


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt_hex, expected_hex = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds))
        return hmac.compare_digest(digest.hex(), expected_hex)
    except (ValueError, TypeError):
        return False


def _presentation_allowed(value: str | None) -> bool:
    return (
        settings.environment.strip().lower() == "development"
        and (value or "").strip() == PRESENTATION_ADMIN_KEY
    )


def require_admin(
    authorization: str | None = Header(default=None),
    x_apetit_admin_key: str | None = Header(default=None),
) -> AdminPrincipal:
    if _presentation_allowed(x_apetit_admin_key):
        return AdminPrincipal(None, "Operador da demonstração", None, "admin", True)
    if (x_apetit_admin_key or "").strip() == settings.api_secret:
        return AdminPrincipal(None, "Administrador legado", None, "admin", True)
    prefix = "Bearer "
    if not authorization or not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Faça login no Admin")
    token = authorization[len(prefix):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Sessão inválida")
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT u.id,u.name,u.email,u.role
            FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id
            WHERE s.token_hash=:token AND s.revoked_at IS NULL
              AND s.expires_at > now() AND u.active=TRUE
        """), {"token": _token_hash(token)}).mappings().one_or_none()
    if not row:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inválida")
    return AdminPrincipal(row["id"], row["name"], str(row["email"]), row["role"])


def require_permission(principal: AdminPrincipal, permission: str) -> None:
    if permission not in ROLE_PERMISSIONS.get(principal.role, set()):
        raise HTTPException(status_code=403, detail="Seu perfil não permite esta ação")


def require_admin_key(value: str | None) -> None:
    normalized = (value or "").strip()
    if normalized == settings.api_secret or _presentation_allowed(value):
        return
    raise HTTPException(status_code=401, detail="credencial administrativa inválida")



def require_unit_access(principal: AdminPrincipal, unit_id: UUID) -> None:
    """Admins and development presentation principals are global; named non-admins require an explicit unit grant."""
    if principal.role == "admin":
        return
    if principal.id is None:
        raise HTTPException(status_code=403, detail="Conta individual necessária para acessar unidades")
    with engine.connect() as conn:
        allowed = conn.execute(text("""
            SELECT 1 FROM admin_user_units
            WHERE user_id=:user_id AND unit_id=:unit_id
        """), {"user_id": principal.id, "unit_id": unit_id}).scalar_one_or_none()
    if allowed is None:
        raise HTTPException(status_code=403, detail="Sua conta não possui acesso a esta unidade")


def allowed_unit_ids(principal: AdminPrincipal) -> list[UUID] | None:
    if principal.role == "admin":
        return None
    if principal.id is None:
        return []
    with engine.connect() as conn:
        return list(conn.execute(text("""
            SELECT unit_id FROM admin_user_units WHERE user_id=:user_id ORDER BY unit_id
        """), {"user_id": principal.id}).scalars().all())


def create_session(user_id: UUID) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(40)
    expires = datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO admin_sessions(user_id,token_hash,expires_at)
            VALUES (:user_id,:token,:expires)
        """), {"user_id": user_id, "token": _token_hash(token), "expires": expires})
        conn.execute(text("UPDATE admin_users SET last_login_at=now() WHERE id=:id"), {"id": user_id})
    return token, expires


def revoke_session(token: str) -> None:
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE admin_sessions SET revoked_at=now()
            WHERE token_hash=:token AND revoked_at IS NULL
        """), {"token": _token_hash(token)})
