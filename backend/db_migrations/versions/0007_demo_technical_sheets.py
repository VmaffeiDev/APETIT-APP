import os

from alembic import op

revision = "0007_demo_technical_sheets"
down_revision = "0006_demo_presentation_menu"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if os.getenv("APETIT_ENVIRONMENT", "").strip().lower() != "development":
        return

    op.execute("""
    INSERT INTO technical_sheets
        (code, name, category, portion_quantity, portion_unit, kcal, protein_g, carbs_g, fat_g)
    VALUES
      ('DEMO-001','Frango grelhado com ervas','prato_principal',120,'g',198,37,1,5),
      ('DEMO-002','Arroz integral','arroz',4,'colheres',156,4,32,1),
      ('DEMO-003','Feijão carioca','feijao',1,'concha',92,6,16,1),
      ('DEMO-004','Salada verde com tomate','salada',1,'porção',48,2,7,2),
      ('DEMO-005','Legumes assados','guarnicao',1,'porção',118,3,18,4),
      ('DEMO-006','Melancia','sobremesa',1,'fatia',45,1,11,0),

      ('DEMO-101','Peixe assado ao limão','prato_principal',120,'g',184,30,2,6),
      ('DEMO-102','Arroz branco','arroz',4,'colheres',168,3,36,1),
      ('DEMO-103','Feijão preto','feijao',1,'concha',96,6,17,1),
      ('DEMO-104','Salada de folhas e cenoura','salada',1,'porção',42,2,7,1),
      ('DEMO-105','Abóbora assada','guarnicao',1,'porção',112,2,21,3),
      ('DEMO-106','Laranja','sobremesa',1,'unidade',62,1,15,0),

      ('DEMO-201','Carne bovina assada','prato_principal',120,'g',228,31,1,11),
      ('DEMO-202','Arroz com cenoura','arroz',4,'colheres',162,4,34,1),
      ('DEMO-203','Feijão carioca','feijao',1,'concha',92,6,16,1),
      ('DEMO-204','Mix de folhas','salada',1,'porção',38,2,6,1),
      ('DEMO-205','Batata rústica assada','guarnicao',1,'porção',138,3,26,3),
      ('DEMO-206','Mamão','sobremesa',1,'porção',54,1,13,0)
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      portion_quantity = EXCLUDED.portion_quantity,
      portion_unit = EXCLUDED.portion_unit,
      kcal = EXCLUDED.kcal,
      protein_g = EXCLUDED.protein_g,
      carbs_g = EXCLUDED.carbs_g,
      fat_g = EXCLUDED.fat_g,
      updated_at = now();

    INSERT INTO technical_sheet_ingredients (technical_sheet_code, position, ingredient)
    VALUES
      ('DEMO-001',1,'Peito de frango'),('DEMO-001',2,'Ervas'),('DEMO-001',3,'Azeite'),
      ('DEMO-002',1,'Arroz integral'),('DEMO-002',2,'Água'),('DEMO-002',3,'Sal'),
      ('DEMO-003',1,'Feijão carioca'),('DEMO-003',2,'Água'),('DEMO-003',3,'Temperos'),
      ('DEMO-004',1,'Folhas verdes'),('DEMO-004',2,'Tomate'),('DEMO-004',3,'Azeite'),
      ('DEMO-005',1,'Abobrinha'),('DEMO-005',2,'Cenoura'),('DEMO-005',3,'Azeite'),
      ('DEMO-006',1,'Melancia'),

      ('DEMO-101',1,'Peixe'),('DEMO-101',2,'Limão'),('DEMO-101',3,'Azeite'),
      ('DEMO-102',1,'Arroz branco'),('DEMO-102',2,'Água'),('DEMO-102',3,'Sal'),
      ('DEMO-103',1,'Feijão preto'),('DEMO-103',2,'Água'),('DEMO-103',3,'Temperos'),
      ('DEMO-104',1,'Folhas verdes'),('DEMO-104',2,'Cenoura'),
      ('DEMO-105',1,'Abóbora'),('DEMO-105',2,'Azeite'),('DEMO-105',3,'Temperos'),
      ('DEMO-106',1,'Laranja'),

      ('DEMO-201',1,'Carne bovina'),('DEMO-201',2,'Temperos'),('DEMO-201',3,'Azeite'),
      ('DEMO-202',1,'Arroz branco'),('DEMO-202',2,'Cenoura'),('DEMO-202',3,'Sal'),
      ('DEMO-203',1,'Feijão carioca'),('DEMO-203',2,'Água'),('DEMO-203',3,'Temperos'),
      ('DEMO-204',1,'Folhas verdes'),('DEMO-204',2,'Cenoura'),('DEMO-204',3,'Tomate'),
      ('DEMO-205',1,'Batata'),('DEMO-205',2,'Azeite'),('DEMO-205',3,'Ervas'),
      ('DEMO-206',1,'Mamão')
    ON CONFLICT (technical_sheet_code, position) DO UPDATE SET ingredient = EXCLUDED.ingredient;

    INSERT INTO technical_sheet_allergens (technical_sheet_code, allergen, status)
    VALUES
      ('DEMO-001','gluten','free_from'),
      ('DEMO-001','lactose','free_from'),
      ('DEMO-003','gluten','free_from'),
      ('DEMO-004','gluten','free_from'),
      ('DEMO-005','gluten','free_from'),
      ('DEMO-006','gluten','free_from'),

      ('DEMO-101','peixe','contains'),
      ('DEMO-101','gluten','free_from'),
      ('DEMO-102','gluten','free_from'),
      ('DEMO-103','gluten','free_from'),
      ('DEMO-104','gluten','free_from'),
      ('DEMO-105','gluten','free_from'),
      ('DEMO-106','gluten','free_from'),

      ('DEMO-201','gluten','free_from'),
      ('DEMO-202','gluten','free_from'),
      ('DEMO-203','gluten','free_from'),
      ('DEMO-204','gluten','free_from'),
      ('DEMO-205','gluten','free_from'),
      ('DEMO-206','gluten','free_from')
    ON CONFLICT (technical_sheet_code, allergen) DO UPDATE SET status = EXCLUDED.status;
    """)


def downgrade() -> None:
    if os.getenv("APETIT_ENVIRONMENT", "").strip().lower() != "development":
        return

    op.execute("""
    DELETE FROM technical_sheets
    WHERE code LIKE 'DEMO-%';
    """)
