from decimal import Decimal

from app.services.prescription_document import parse_prescription_text


def test_parse_prescription_text_extracts_targets_and_portions():
    meal = parse_prescription_text(
        """
        Almoço
        Energia: 650 kcal
        Proteína: 35 g
        Carboidratos: 70 g
        Gorduras: 20 g
        120 g de frango
        100 g de arroz
        80 g de feijao
        """
    )

    assert meal.meal_type == "almoco"
    assert meal.target.kcal == Decimal("650")
    assert meal.target.protein_g == Decimal("35")
    assert meal.target.carbs_g == Decimal("70")
    assert meal.target.fat_g == Decimal("20")
    assert len(meal.portions) == 3


def test_parse_prescription_text_allows_missing_macros():
    meal = parse_prescription_text("Almoço\n120 g de frango\n100 g de arroz")

    assert meal.target.kcal is None
    assert meal.target.protein_g is None
    assert len(meal.portions) == 2
