from alembic import op

revision = "0002_employee_auth"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE people
        ADD COLUMN sector TEXT,
        ADD COLUMN goal TEXT,
        ADD COLUMN onboarding_completed_at TIMESTAMPTZ;

    CREATE TABLE employee_login_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email CITEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_employee_login_codes_email
        ON employee_login_codes(email, created_at DESC);

    CREATE TABLE employee_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX idx_employee_sessions_person
        ON employee_sessions(person_id, created_at DESC);
    """)


def downgrade() -> None:
    op.execute("""
    DROP TABLE IF EXISTS employee_sessions CASCADE;
    DROP TABLE IF EXISTS employee_login_codes CASCADE;
    ALTER TABLE people
        DROP COLUMN IF EXISTS onboarding_completed_at,
        DROP COLUMN IF EXISTS goal,
        DROP COLUMN IF EXISTS sector;
    """)
