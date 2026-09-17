import os

from alembic import op

revision = "0006_demo_presentation_menu"
down_revision = "0005_demo_presentation_units"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if os.getenv("APETIT_ENVIRONMENT", "").strip().lower() != "development":
        return

    op.execute("""
    INSERT INTO menu_imports (id, unit_id, file_name, status, period_start, period_end, published_at)
    VALUES
      ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'demo-copel.xlsx', 'published', CURRENT_DATE, CURRENT_DATE, now()),
      ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'demo-sanepar.xlsx', 'published', CURRENT_DATE, CURRENT_DATE, now()),
      ('60000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'demo-cocacola.xlsx', 'published', CURRENT_DATE, CURRENT_DATE, now())
    ON CONFLICT (id) DO UPDATE SET
      period_start = CURRENT_DATE,
      period_end = CURRENT_DATE,
      published_at = now(),
      status = 'published';

    INSERT INTO menu_days (id, menu_import_id, unit_id, service_date, meal_type)
    VALUES
      ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', CURRENT_DATE, 'almoco'),
      ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', CURRENT_DATE, 'almoco'),
      ('61000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', CURRENT_DATE, 'almoco')
    ON CONFLICT (id) DO UPDATE SET service_date = CURRENT_DATE;

    INSERT INTO menu_items (id, menu_day_id, technical_sheet_code, name, category, standard_portion, kcal, protein_g, carbs_g, fat_g)
    VALUES
      ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'DEMO-001', 'Frango grelhado com ervas', 'prato_principal', '120 g', 198, 37, 1, 5),
      ('62000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000001', 'DEMO-002', 'Arroz integral', 'arroz', '4 colheres', 156, 4, 32, 1),
      ('62000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000001', 'DEMO-003', 'Feijão carioca', 'feijao', '1 concha', 92, 6, 16, 1),
      ('62000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000001', 'DEMO-004', 'Salada verde com tomate', 'salada', '1 porção', 48, 2, 7, 2),
      ('62000000-0000-4000-8000-000000000005', '61000000-0000-4000-8000-000000000001', 'DEMO-005', 'Legumes assados', 'guarnicao', '1 porção', 118, 3, 18, 4),
      ('62000000-0000-4000-8000-000000000006', '61000000-0000-4000-8000-000000000001', 'DEMO-006', 'Melancia', 'sobremesa', '1 fatia', 45, 1, 11, 0),
      ('62000000-0000-4000-8000-000000000101', '61000000-0000-4000-8000-000000000002', 'DEMO-101', 'Peixe assado ao limão', 'prato_principal', '120 g', 184, 30, 2, 6),
      ('62000000-0000-4000-8000-000000000102', '61000000-0000-4000-8000-000000000002', 'DEMO-102', 'Arroz branco', 'arroz', '4 colheres', 168, 3, 36, 1),
      ('62000000-0000-4000-8000-000000000103', '61000000-0000-4000-8000-000000000002', 'DEMO-103', 'Feijão preto', 'feijao', '1 concha', 96, 6, 17, 1),
      ('62000000-0000-4000-8000-000000000104', '61000000-0000-4000-8000-000000000002', 'DEMO-104', 'Salada de folhas e cenoura', 'salada', '1 porção', 42, 2, 7, 1),
      ('62000000-0000-4000-8000-000000000105', '61000000-0000-4000-8000-000000000002', 'DEMO-105', 'Abóbora assada', 'guarnicao', '1 porção', 112, 2, 21, 3),
      ('62000000-0000-4000-8000-000000000106', '61000000-0000-4000-8000-000000000002', 'DEMO-106', 'Laranja', 'sobremesa', '1 unidade', 62, 1, 15, 0),
      ('62000000-0000-4000-8000-000000000201', '61000000-0000-4000-8000-000000000003', 'DEMO-201', 'Carne bovina assada', 'prato_principal', '120 g', 228, 31, 1, 11),
      ('62000000-0000-4000-8000-000000000202', '61000000-0000-4000-8000-000000000003', 'DEMO-202', 'Arroz com cenoura', 'arroz', '4 colheres', 162, 4, 34, 1),
      ('62000000-0000-4000-8000-000000000203', '61000000-0000-4000-8000-000000000003', 'DEMO-203', 'Feijão carioca', 'feijao', '1 concha', 92, 6, 16, 1),
      ('62000000-0000-4000-8000-000000000204', '61000000-0000-4000-8000-000000000003', 'DEMO-204', 'Mix de folhas', 'salada', '1 porção', 38, 2, 6, 1),
      ('62000000-0000-4000-8000-000000000205', '61000000-0000-4000-8000-000000000003', 'DEMO-205', 'Batata rústica assada', 'guarnicao', '1 porção', 138, 3, 26, 3),
      ('62000000-0000-4000-8000-000000000206', '61000000-0000-4000-8000-000000000003', 'DEMO-206', 'Mamão', 'sobremesa', '1 porção', 54, 1, 13, 0)
    ON CONFLICT (id) DO UPDATE SET
      menu_day_id = EXCLUDED.menu_day_id,
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      standard_portion = EXCLUDED.standard_portion,
      kcal = EXCLUDED.kcal,
      protein_g = EXCLUDED.protein_g,
      carbs_g = EXCLUDED.carbs_g,
      fat_g = EXCLUDED.fat_g;
    """)


def downgrade() -> None:
    if os.getenv("APETIT_ENVIRONMENT", "").strip().lower() != "development":
        return

    op.execute("""
    DELETE FROM menu_items WHERE id::text LIKE '62000000-0000-4000-8000-000000000%';
    DELETE FROM menu_days WHERE id IN (
      '61000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000003'
    );
    DELETE FROM menu_imports WHERE id IN (
      '60000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000002',
      '60000000-0000-4000-8000-000000000003'
    );
    """)
