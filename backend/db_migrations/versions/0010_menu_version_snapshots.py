from alembic import op

revision = "0010_menu_version_snapshots"
down_revision = "0009_menu_publication_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE menu_imports
        ADD COLUMN restored_from UUID REFERENCES menu_imports(id);
        CREATE TABLE menu_version_snapshots (
            menu_import_id UUID PRIMARY KEY REFERENCES menu_imports(id),
            snapshot JSONB NOT NULL,
            restorable BOOLEAN NOT NULL DEFAULT FALSE,
            provenance TEXT NOT NULL,
            archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    """)
    # Existing active rows can be recorded, but old overwritten dishes cannot be recovered.
    # Never mark historical backfills restorable: prior publication may have lost days.
    op.execute("""
        INSERT INTO menu_version_snapshots
          (menu_import_id, snapshot, restorable, provenance)
        SELECT mi.id,
          jsonb_build_object(
            'days', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object(
                  'date', md.service_date,
                  'meal_type', md.meal_type,
                  'items', COALESCE((
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'name', itm.name, 'category', itm.category,
                        'standard_portion', itm.standard_portion,
                        'technical_sheet_code', itm.technical_sheet_code,
                        'kcal', itm.kcal, 'protein_g', itm.protein_g,
                        'carbs_g', itm.carbs_g, 'fat_g', itm.fat_g,
                        'allergens', COALESCE((
                          SELECT jsonb_agg(jsonb_build_object(
                            'allergen', ma.allergen, 'status', ma.status
                          ) ORDER BY ma.allergen)
                          FROM menu_item_allergens ma WHERE ma.menu_item_id=itm.id
                        ), '[]'::jsonb)
                      ) ORDER BY itm.category, itm.name, itm.id)
                    FROM menu_items itm WHERE itm.menu_day_id=md.id
                  ), '[]'::jsonb)
                ) ORDER BY md.service_date, md.meal_type
              ) FROM menu_days md WHERE md.menu_import_id=mi.id
            ), '[]'::jsonb)
          ), FALSE, 'legacy_active_partial'
        FROM menu_imports mi
        WHERE mi.status='published'
        ON CONFLICT (menu_import_id) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS menu_version_snapshots")
    op.execute("ALTER TABLE menu_imports DROP COLUMN IF EXISTS restored_from")
