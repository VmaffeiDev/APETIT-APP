from alembic import op

revision = "0009_menu_publication_audit"
down_revision = "0008_demo_feedbacks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
      ALTER TABLE menu_imports
        ADD COLUMN meal_type TEXT,
        ADD COLUMN operator_label TEXT,
        ADD COLUMN replaced_dates DATE[] NOT NULL DEFAULT ARRAY[]::DATE[],
        ADD COLUMN item_count INTEGER,
        ADD COLUMN operation_kind TEXT;
    """)
    # Older records can establish a publication time and unit, but not an authenticated actor
    # or the original meal type after all their menu_days were replaced.
    op.execute("""
      UPDATE menu_imports mi
      SET meal_type = (
        SELECT md.meal_type FROM menu_days md
        WHERE md.menu_import_id = mi.id LIMIT 1
      ),
      operation_kind = CASE WHEN mi.status = 'published' THEN 'legacy_publication' END
      WHERE mi.status = 'published';
    """)
    op.execute("""
      CREATE INDEX ix_menu_imports_history
        ON menu_imports (unit_id, published_at DESC)
        WHERE status = 'published';
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_menu_imports_history")
    op.execute("""
      ALTER TABLE menu_imports
        DROP COLUMN IF EXISTS operation_kind,
        DROP COLUMN IF EXISTS item_count,
        DROP COLUMN IF EXISTS replaced_dates,
        DROP COLUMN IF EXISTS operator_label,
        DROP COLUMN IF EXISTS meal_type;
    """)
