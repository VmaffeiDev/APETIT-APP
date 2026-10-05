import os

from alembic import op

revision = "0005_demo_presentation_units"
down_revision = "0004_technical_sheets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if os.getenv("APETIT_ENVIRONMENT", "").strip().lower() != "development":
        return

    op.execute("""
    INSERT INTO companies (id, name)
    VALUES
      ('10000000-0000-4000-8000-000000000001', 'Copel'),
      ('10000000-0000-4000-8000-000000000002', 'Sanepar'),
      ('10000000-0000-4000-8000-000000000003', 'Coca-Cola')
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

    INSERT INTO units (id, company_id, name)
    VALUES
      ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Unidade Copel — Demonstração'),
      ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Unidade Sanepar — Demonstração'),
      ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Unidade Coca-Cola — Demonstração')
    ON CONFLICT (id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      name = EXCLUDED.name;

    INSERT INTO restaurants (id, unit_id, name)
    VALUES
      ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Refeitório Copel — Demo'),
      ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Refeitório Sanepar — Demo'),
      ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Refeitório Coca-Cola — Demo')
    ON CONFLICT (id) DO UPDATE SET
      unit_id = EXCLUDED.unit_id,
      name = EXCLUDED.name;
    """)


def downgrade() -> None:
    if os.getenv("APETIT_ENVIRONMENT", "").strip().lower() != "development":
        return

    op.execute("""
    DELETE FROM restaurants
    WHERE id IN (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003'
    );

    DELETE FROM units
    WHERE id IN (
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003'
    );

    DELETE FROM companies
    WHERE id IN (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000003'
    );
    """)
