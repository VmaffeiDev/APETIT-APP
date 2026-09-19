import os

from alembic import op

revision = "0008_demo_feedbacks"
down_revision = "0007_demo_technical_sheets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if os.getenv("APETIT_ENVIRONMENT", "").strip().lower() != "development":
        return

    op.execute("""
    INSERT INTO people (id, email, name, unit_id, sector, goal, onboarding_completed_at)
    VALUES
      ('70000000-0000-4000-8000-000000000001',NULL,'Pessoa Demo 01','20000000-0000-4000-8000-000000000001','Operação','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000002',NULL,'Pessoa Demo 02','20000000-0000-4000-8000-000000000001','Operação','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000003',NULL,'Pessoa Demo 03','20000000-0000-4000-8000-000000000001','Administrativo','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000004',NULL,'Pessoa Demo 04','20000000-0000-4000-8000-000000000001','Manutenção','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000005',NULL,'Pessoa Demo 05','20000000-0000-4000-8000-000000000001','TI','alimentacao_equilibrada',now()),

      ('70000000-0000-4000-8000-000000000101',NULL,'Pessoa Demo 06','20000000-0000-4000-8000-000000000002','Operação','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000102',NULL,'Pessoa Demo 07','20000000-0000-4000-8000-000000000002','Operação','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000103',NULL,'Pessoa Demo 08','20000000-0000-4000-8000-000000000002','Administrativo','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000104',NULL,'Pessoa Demo 09','20000000-0000-4000-8000-000000000002','Manutenção','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000105',NULL,'Pessoa Demo 10','20000000-0000-4000-8000-000000000002','TI','alimentacao_equilibrada',now()),

      ('70000000-0000-4000-8000-000000000201',NULL,'Pessoa Demo 11','20000000-0000-4000-8000-000000000003','Operação','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000202',NULL,'Pessoa Demo 12','20000000-0000-4000-8000-000000000003','Operação','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000203',NULL,'Pessoa Demo 13','20000000-0000-4000-8000-000000000003','Administrativo','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000204',NULL,'Pessoa Demo 14','20000000-0000-4000-8000-000000000003','Manutenção','alimentacao_equilibrada',now()),
      ('70000000-0000-4000-8000-000000000205',NULL,'Pessoa Demo 15','20000000-0000-4000-8000-000000000003','TI','alimentacao_equilibrada',now())
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      unit_id = EXCLUDED.unit_id,
      sector = EXCLUDED.sector,
      goal = EXCLUDED.goal,
      onboarding_completed_at = EXCLUDED.onboarding_completed_at;

    WITH demo_people(person_id, unit_id, restaurant_id, person_index, unit_index) AS (
      VALUES
        ('70000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000001'::uuid,1,1),
        ('70000000-0000-4000-8000-000000000002'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000001'::uuid,2,1),
        ('70000000-0000-4000-8000-000000000003'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000001'::uuid,3,1),
        ('70000000-0000-4000-8000-000000000004'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000001'::uuid,4,1),
        ('70000000-0000-4000-8000-000000000005'::uuid,'20000000-0000-4000-8000-000000000001'::uuid,'30000000-0000-4000-8000-000000000001'::uuid,5,1),

        ('70000000-0000-4000-8000-000000000101'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000002'::uuid,1,2),
        ('70000000-0000-4000-8000-000000000102'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000002'::uuid,2,2),
        ('70000000-0000-4000-8000-000000000103'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000002'::uuid,3,2),
        ('70000000-0000-4000-8000-000000000104'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000002'::uuid,4,2),
        ('70000000-0000-4000-8000-000000000105'::uuid,'20000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-000000000002'::uuid,5,2),

        ('70000000-0000-4000-8000-000000000201'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000003'::uuid,1,3),
        ('70000000-0000-4000-8000-000000000202'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000003'::uuid,2,3),
        ('70000000-0000-4000-8000-000000000203'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000003'::uuid,3,3),
        ('70000000-0000-4000-8000-000000000204'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000003'::uuid,4,3),
        ('70000000-0000-4000-8000-000000000205'::uuid,'20000000-0000-4000-8000-000000000003'::uuid,'30000000-0000-4000-8000-000000000003'::uuid,5,3)
    ),
    generated AS (
      SELECT
        gen_random_uuid() AS id,
        p.person_id,
        p.unit_id,
        p.restaurant_id,
        CURRENT_DATE - d.day_offset AS meal_date,
        (3 + ((p.person_index + d.day_offset + p.unit_index) % 3))::smallint AS food_rating,
        (4 + ((p.person_index + d.day_offset) % 2))::smallint AS service_rating,
        CASE
          WHEN p.person_index = 1 AND d.day_offset = 0 THEN 'Boa variedade e atendimento rápido.'
          WHEN p.person_index = 2 AND d.day_offset = 1 THEN 'A comida estava saborosa e bem servida.'
          WHEN p.person_index = 3 AND d.day_offset = 2 THEN 'Poderia ter mais opções de salada.'
          WHEN p.person_index = 4 AND d.day_offset = 3 THEN 'Temperatura boa e fila organizada.'
          WHEN p.person_index = 5 AND d.day_offset = 4 THEN 'Experiência positiva no almoço.'
          ELSE NULL
        END AS comment,
        now() - (d.day_offset || ' days')::interval + (p.person_index || ' minutes')::interval AS created_at
      FROM demo_people p
      CROSS JOIN generate_series(0,4) AS d(day_offset)
    )
    INSERT INTO feedback
        (id, person_id, unit_id, restaurant_id, meal_date, food_rating, service_rating, comment, created_at)
    SELECT id, person_id, unit_id, restaurant_id, meal_date, food_rating, service_rating, comment, created_at
    FROM generated
    ON CONFLICT (person_id, restaurant_id, meal_date) DO UPDATE SET
      food_rating = EXCLUDED.food_rating,
      service_rating = EXCLUDED.service_rating,
      comment = EXCLUDED.comment,
      created_at = EXCLUDED.created_at;

    INSERT INTO feedback_tags (feedback_id, tag)
    SELECT f.id,
           CASE
             WHEN f.food_rating = 5 THEN 'sabor'
             WHEN f.food_rating = 4 THEN 'variedade'
             ELSE 'temperatura'
           END
    FROM feedback f
    WHERE f.person_id::text LIKE '70000000-0000-4000-8000-%'
    ON CONFLICT DO NOTHING;

    INSERT INTO feedback_tags (feedback_id, tag)
    SELECT f.id, 'atendimento'
    FROM feedback f
    WHERE f.person_id::text LIKE '70000000-0000-4000-8000-%'
      AND f.service_rating = 5
    ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    if os.getenv("APETIT_ENVIRONMENT", "").strip().lower() != "development":
        return

    op.execute("""
    DELETE FROM feedback
    WHERE person_id::text LIKE '70000000-0000-4000-8000-%';

    DELETE FROM people
    WHERE id::text LIKE '70000000-0000-4000-8000-%';
    """)
