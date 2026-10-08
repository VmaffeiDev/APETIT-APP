"""Database-backed, atomic reservations for admin password login attempts."""

import hashlib
import math

from fastapi import HTTPException
from sqlalchemy import text

from app.db import engine

ADMIN_LOGIN_LIMIT = 5
ADMIN_LOGIN_WINDOW_SECONDS = 15 * 60
EVENT_TYPE = "admin_password_login"


def login_key(email: str) -> str:
    return hashlib.sha256(f"admin-password-login:{email.strip().casefold()}".encode()).hexdigest()


def reserve_login_attempt(email: str) -> None:
    """Count all attempts before password work, including valid logins.

    Reserving and committing first keeps failures (HTTP 401) counted and prevents
    parallel requests or multiple workers from overrunning the account budget.
    The key is an email hash; passwords and tokens are never persisted here.
    """
    key = login_key(email)
    lock_id = int.from_bytes(bytes.fromhex(key)[:8], signed=True)
    with engine.begin() as conn:
        conn.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": lock_id})
        params = {"key": key, "event": EVENT_TYPE, "window": ADMIN_LOGIN_WINDOW_SECONDS}
        conn.execute(
            text("""
            DELETE FROM auth_rate_events
            WHERE key_hash=:key AND event_type=:event
              AND created_at <= clock_timestamp() - (:window * interval '1 second')
        """),
            params,
        )
        row = (
            conn.execute(
                text("""
            SELECT COUNT(*) AS attempts,
                   EXTRACT(EPOCH FROM (
                       MIN(created_at) + (:window * interval '1 second') - clock_timestamp()
                   )) AS retry_after
            FROM auth_rate_events WHERE key_hash=:key AND event_type=:event
        """),
                params,
            )
            .mappings()
            .one()
        )
        if row["attempts"] >= ADMIN_LOGIN_LIMIT:
            retry_after = max(1, math.ceil(row["retry_after"]))
            raise HTTPException(
                status_code=429,
                detail="Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
                headers={"Retry-After": str(retry_after)},
            )
        conn.execute(
            text("""
            INSERT INTO auth_rate_events(key_hash,event_type,created_at)
            VALUES (:key,:event,clock_timestamp())
        """),
            params,
        )
