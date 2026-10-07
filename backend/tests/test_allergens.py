import pytest

from app.domain.allergens import assess_allergens


@pytest.mark.parametrize(
    "pairs,contains,uncertain",
    [
        ([("gluten", "free_from")], set(), set()),
        ([("gluten", "contains")], {"gluten"}, set()),
        ([("gluten", "may_contain")], set(), {"gluten"}),
        ([], set(), {"gluten"}),
        ([("soja", "free_from")], set(), {"gluten"}),
        ([("gluten", "unknown")], set(), {"gluten"}),
        ([("gluten", None)], set(), {"gluten"}),
        ([("gluten", "confirmed")], {"gluten"}, set()),
        ([(" GLÚTEN ", "FREE_FROM")], set(), set()),
        ([("gluten", "free_from"), ("GLÚTEN", "contains")], {"gluten"}, set()),
        ([("gluten", "free_from"), ("GLÚTEN", "may_contain")], set(), {"gluten"}),
    ],
)
def test_declared_restriction_requires_explicit_absence(pairs, contains, uncertain):
    result = assess_allergens([" glúten "], pairs)
    assert result.contains == contains
    assert result.uncertain == uncertain


def test_every_restriction_needs_evidence():
    result = assess_allergens(["gluten", "soja"], [("gluten", "free_from")])
    assert result.contains == set()
    assert result.uncertain == {"soja"}


def test_no_restrictions_does_not_block_items():
    result = assess_allergens([], [("gluten", "contains")])
    assert not result.contains and not result.uncertain


def test_does_not_equate_milk_with_lactose():
    result = assess_allergens(["leite"], [("lactose", "free_from")])
    assert result.uncertain == {"leite"}
