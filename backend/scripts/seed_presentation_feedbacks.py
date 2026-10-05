from __future__ import annotations

from sqlalchemy import text

from app.db import engine


UNIT_ID = "20000000-0000-4000-8000-000000000001"
RESTAURANT_ID = "30000000-0000-4000-8000-000000000001"

PEOPLE = [
    ("71000000-0000-4000-8000-000000000001", "Colaborador Demo 01", "Operação"),
    ("71000000-0000-4000-8000-000000000002", "Colaborador Demo 02", "Operação"),
    ("71000000-0000-4000-8000-000000000003", "Colaborador Demo 03", "Administrativo"),
    ("71000000-0000-4000-8000-000000000004", "Colaborador Demo 04", "Manutenção"),
    ("71000000-0000-4000-8000-000000000005", "Colaborador Demo 05", "TI"),
    ("71000000-0000-4000-8000-000000000006", "Colaborador Demo 06", "Operação"),
    ("71000000-0000-4000-8000-000000000007", "Colaborador Demo 07", "Produção"),
    ("71000000-0000-4000-8000-000000000008", "Colaborador Demo 08", "Administrativo"),
    ("71000000-0000-4000-8000-000000000009", "Colaborador Demo 09", "Logística"),
    ("71000000-0000-4000-8000-000000000010", "Colaborador Demo 10", "Qualidade"),
]

RESPONSES = [
    (5, 5, "sabor", "Refeição saborosa e atendimento rápido."),
    (4, 5, "atendimento", "Equipe muito atenciosa no horário do almoço."),
    (5, 4, "variedade", "Boa variedade de acompanhamentos hoje."),
    (4, 4, "temperatura", "Comida bem servida e na temperatura adequada."),
    (4, 5, "sabor", "Almoço muito bom, principalmente o prato principal."),
    (5, 5, "atendimento", "Fila organizada e atendimento excelente."),
    (4, 4, "variedade", "Gostei das opções, poderia ter mais saladas."),
    (3, 4, "temperatura", "A refeição estava boa, mas poderia estar um pouco mais quente."),
    (5, 5, "sabor", "Ótima experiência no refeitório hoje."),
    (4, 5, "variedade", "Cardápio equilibrado e serviço bem organizado."),
]


def main() -> None:
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM units WHERE id=:unit_id"),
            {"unit_id": UNIT_ID},
        ).scalar_one_or_none()
        if exists is None:
            raise SystemExit("Copel presentation unit not found")

        for person_id, name, sector in PEOPLE:
            conn.execute(
                text(
                    """
                    INSERT INTO people(
                        id,email,name,unit_id,sector,goal,onboarding_completed_at
                    )
                    VALUES (
                        :id,NULL,:name,:unit_id,:sector,'alimentacao_equilibrada',now()
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name=EXCLUDED.name,
                        unit_id=EXCLUDED.unit_id,
                        sector=EXCLUDED.sector,
                        goal=EXCLUDED.goal,
                        onboarding_completed_at=EXCLUDED.onboarding_completed_at
                    """
                ),
                {
                    "id": person_id,
                    "name": name,
                    "unit_id": UNIT_ID,
                    "sector": sector,
                },
            )

        for index, ((person_id, _, _), (food, service, tag, comment)) in enumerate(
            zip(PEOPLE, RESPONSES, strict=True)
        ):
            day_offset = 1 if index < 5 else 0
            feedback_id = conn.execute(
                text(
                    """
                    INSERT INTO feedback(
                        id,person_id,unit_id,restaurant_id,meal_date,
                        food_rating,service_rating,comment,created_at
                    )
                    VALUES (
                        gen_random_uuid(),:person_id,:unit_id,:restaurant_id,
                        CURRENT_DATE - :day_offset,
                        :food_rating,:service_rating,:comment,
                        now() - (:day_offset || ' days')::interval + (:minute_offset || ' minutes')::interval
                    )
                    ON CONFLICT (person_id,restaurant_id,meal_date) DO UPDATE SET
                        food_rating=EXCLUDED.food_rating,
                        service_rating=EXCLUDED.service_rating,
                        comment=EXCLUDED.comment,
                        created_at=EXCLUDED.created_at
                    RETURNING id
                    """
                ),
                {
                    "person_id": person_id,
                    "unit_id": UNIT_ID,
                    "restaurant_id": RESTAURANT_ID,
                    "day_offset": day_offset,
                    "food_rating": food,
                    "service_rating": service,
                    "comment": comment,
                    "minute_offset": index + 1,
                },
            ).scalar_one()

            conn.execute(
                text("DELETE FROM feedback_tags WHERE feedback_id=:feedback_id"),
                {"feedback_id": feedback_id},
            )
            conn.execute(
                text(
                    """
                    INSERT INTO feedback_tags(feedback_id,tag)
                    VALUES (:feedback_id,:tag)
                    """
                ),
                {"feedback_id": feedback_id, "tag": tag},
            )

            if service == 5 and tag != "atendimento":
                conn.execute(
                    text(
                        """
                        INSERT INTO feedback_tags(feedback_id,tag)
                        VALUES (:feedback_id,'atendimento')
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    {"feedback_id": feedback_id},
                )

    print("Presentation feedback seeded: unit=Copel people=10 responses=10")


if __name__ == "__main__":
    main()
