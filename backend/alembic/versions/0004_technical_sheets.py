from alembic import op

revision = "0004_technical_sheets"
down_revision = "0003_auth_rate_limit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE technical_sheets (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        portion_quantity NUMERIC(10,2),
        portion_unit TEXT,
        kcal NUMERIC(10,2),
        protein_g NUMERIC(10,2),
        carbs_g NUMERIC(10,2),
        fat_g NUMERIC(10,2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE technical_sheet_ingredients (
        technical_sheet_code TEXT NOT NULL REFERENCES technical_sheets(code) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        ingredient TEXT NOT NULL,
        PRIMARY KEY (technical_sheet_code, position)
    );

    CREATE TABLE technical_sheet_allergens (
        technical_sheet_code TEXT NOT NULL REFERENCES technical_sheets(code) ON DELETE CASCADE,
        allergen TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'contains',
        PRIMARY KEY (technical_sheet_code, allergen)
    );

    CREATE INDEX idx_technical_sheets_name ON technical_sheets(name);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS technical_sheet_allergens CASCADE")
    op.execute("DROP TABLE IF EXISTS technical_sheet_ingredients CASCADE")
    op.execute("DROP TABLE IF EXISTS technical_sheets CASCADE")
