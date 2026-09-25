from alembic import op

revision = "0012_admin_password_reset_codes"
down_revision = "0011_admin_users_rbac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE admin_password_reset_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX ix_admin_password_reset_active
      ON admin_password_reset_codes(user_id, expires_at DESC)
      WHERE used_at IS NULL;
    """)


def downgrade() -> None:
    op.execute("""
    DROP TABLE IF EXISTS admin_password_reset_codes;
    """)
