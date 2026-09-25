from alembic import op

revision = "0011_admin_users_rbac"
down_revision = "0010_menu_version_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email CITEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','operacao','nutricao','visualizacao')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ
    );
    CREATE TABLE admin_user_units (
        user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
        PRIMARY KEY(user_id, unit_id)
    );
    CREATE TABLE admin_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        revoked_at TIMESTAMPTZ
    );
    CREATE TABLE admin_audit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE menu_imports ADD COLUMN actor_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL;
    CREATE INDEX ix_admin_sessions_token ON admin_sessions(token_hash) WHERE revoked_at IS NULL;
    CREATE INDEX ix_admin_audit_events_created ON admin_audit_events(created_at DESC);
    CREATE INDEX ix_admin_audit_events_user ON admin_audit_events(user_id, created_at DESC);
    """)


def downgrade() -> None:
    op.execute("""
    ALTER TABLE menu_imports DROP COLUMN IF EXISTS actor_user_id;
    DROP TABLE IF EXISTS admin_audit_events;
    DROP TABLE IF EXISTS admin_sessions;
    DROP TABLE IF EXISTS admin_user_units;
    DROP TABLE IF EXISTS admin_users;
    """)
