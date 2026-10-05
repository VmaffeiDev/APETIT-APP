from __future__ import annotations

import json
import os
from uuid import UUID

from sqlalchemy import text

from app.api.admin_auth import hash_password
from app.db import engine


ALLOWED_ROLES = {"admin", "operacao", "nutricao", "visualizacao"}


def main() -> None:
    email = os.environ.get("APETIT_PROVISION_USER_EMAIL", "").strip().lower()
    password = os.environ.get("APETIT_PROVISION_USER_PASSWORD", "")
    name = os.environ.get("APETIT_PROVISION_USER_NAME", "").strip()
    role = os.environ.get("APETIT_PROVISION_USER_ROLE", "").strip().lower()
    raw_units = os.environ.get("APETIT_PROVISION_USER_UNIT_IDS", "").strip()
    actor_email = os.environ.get("APETIT_PROVISION_ACTOR_EMAIL", "").strip().lower()

    if not email or not password or not name:
        raise SystemExit("Provisioning user name, email and password are required")
    if role not in ALLOWED_ROLES:
        raise SystemExit("Invalid provisioning role")
    if len(password) < 12:
        raise SystemExit("Provisioning password must have at least 12 characters")

    unit_ids = [UUID(value.strip()) for value in raw_units.split(",") if value.strip()]
    if role == "admin":
        unit_ids = []

    with engine.begin() as conn:
        if unit_ids:
            found = set(
                conn.execute(
                    text("SELECT id FROM units WHERE id = ANY(:ids)"),
                    {"ids": unit_ids},
                ).scalars().all()
            )
            if found != set(unit_ids):
                raise SystemExit("One or more provisioning unit IDs do not exist")

        row = conn.execute(
            text(
                """
                INSERT INTO admin_users(name,email,password_hash,role,active)
                VALUES (:name,:email,:password,:role,TRUE)
                ON CONFLICT (email) DO UPDATE SET
                    name=EXCLUDED.name,
                    password_hash=EXCLUDED.password_hash,
                    role=EXCLUDED.role,
                    active=TRUE
                RETURNING id,email,role
                """
            ),
            {
                "name": name,
                "email": email,
                "password": hash_password(password),
                "role": role,
            },
        ).mappings().one()

        conn.execute(
            text("DELETE FROM admin_user_units WHERE user_id=:id"),
            {"id": row["id"]},
        )
        for unit_id in unit_ids:
            conn.execute(
                text(
                    """
                    INSERT INTO admin_user_units(user_id,unit_id)
                    VALUES (:user_id,:unit_id)
                    ON CONFLICT DO NOTHING
                    """
                ),
                {"user_id": row["id"], "unit_id": unit_id},
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

        actor_id = None
        if actor_email:
            actor_id = conn.execute(
                text("SELECT id FROM admin_users WHERE email=:email AND active=TRUE"),
                {"email": actor_email},
            ).scalar_one_or_none()

        conn.execute(
            text(
                """
                INSERT INTO admin_audit_events(
                    user_id,action,resource_type,resource_id,metadata
                )
                VALUES (
                    :actor_id,
                    'admin_user.provisioned',
                    'admin_user',
                    :resource_id,
                    CAST(:metadata AS jsonb)
                )
                """
            ),
            {
                "actor_id": actor_id,
                "resource_id": str(row["id"]),
                "metadata": json.dumps(
                    {
                        "role": role,
                        "email": email,
                        "unit_ids": [str(value) for value in unit_ids],
                    }
                ),
            },
        )

    print(f"Admin user provisioned: {email} role={role} units={len(unit_ids)}")


if __name__ == "__main__":
    main()
