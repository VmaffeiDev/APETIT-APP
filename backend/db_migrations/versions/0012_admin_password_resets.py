from alembic import op

revision = "0012_admin_password_resets"
down_revision = "0011_admin_users_rbac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE admin_password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES admin_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        used_at TIMESTAMPTZ
    );
    CREATE INDEX ix_admin_password_resets_expiry ON admin_password_resets(expires_at);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS admin_password_resets;")
