from __future__ import annotations

import os

from sqlalchemy import text

from app.api.admin_auth import hash_password
from app.db import engine


def main() -> None:
    email = os.environ.get("APETIT_MASTER_ADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("APETIT_MASTER_ADMIN_PASSWORD", "")
    name = os.environ.get("APETIT_MASTER_ADMIN_NAME", "Administrador Master").strip() or "Administrador Master"

    if not email or not password:
        raise SystemExit("Master admin provisioning variables are not configured")

    if len(password) < 12:
        raise SystemExit("Master admin password must have at least 12 characters")

    encoded = hash_password(password)

    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO admin_users(name,email,password_hash,role,active)
                VALUES (:name,:email,:password,'admin',TRUE)
                ON CONFLICT (email) DO UPDATE SET
                    name=EXCLUDED.name,
                    password_hash=EXCLUDED.password_hash,
                    role='admin',
                    active=TRUE
                RETURNING id,email
                """
            ),
            {"name": name, "email": email, "password": encoded},
        ).mappings().one()

        conn.execute(
            text("DELETE FROM admin_user_units WHERE user_id=:id"),
            {"id": row["id"]},
        )
        conn.execute(
            text(
                """
                UPDATE admin_sessions
                SET revoked_at=now()
                WHERE user_id=:id AND revoked_at IS NULL
                """
            ),
            {"id": row["id"]},
        )
        conn.execute(
            text(
                """
                INSERT INTO admin_audit_events(
                    user_id,action,resource_type,resource_id,metadata
                )
                VALUES (
                    :id,
                    'admin_user.master_provisioned',
                    'admin_user',
                    :resource_id,
                    '{"role":"admin","global_access":true}'::jsonb
                )
                """
            ),
            {"id": row["id"], "resource_id": str(row["id"])},
        )

    print(f"Master admin provisioned: {email}")


if __name__ == "__main__":
    main()
