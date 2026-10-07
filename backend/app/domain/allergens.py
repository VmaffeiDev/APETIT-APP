"""One conservative policy for the employee's declared dietary restrictions."""

import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass


def _normalize(value: str) -> str:
    # Normalize spelling only: milk and lactose, for example, are not synonyms.
    return "".join(
        char
        for char in unicodedata.normalize("NFD", value.strip().casefold())
        if not unicodedata.combining(char)
    )


@dataclass(frozen=True)
class AllergenAssessment:
    contains: frozenset[str]
    uncertain: frozenset[str]


def assess_allergens(
    restrictions: Iterable[str], allergen_pairs: Iterable[tuple[str, str | None]]
) -> AllergenAssessment:
    """Require explicit free_from evidence for every declared restriction.

    Missing, unknown and may_contain declarations remain uncertain. Legacy
    confirmed records mean presence, never absence. Conflicting declarations
    cannot override a presence or an uncertainty with free_from.
    """
    statuses: dict[str, set[str]] = {}
    for allergen, status in allergen_pairs:
        statuses.setdefault(_normalize(allergen), set()).add((status or "").strip().lower())

    contains: set[str] = set()
    uncertain: set[str] = set()
    for restriction in {_normalize(value) for value in restrictions if value.strip()}:
        declared = statuses.get(restriction, set())
        if declared & {"contains", "confirmed"}:
            contains.add(restriction)
        elif declared != {"free_from"}:
            uncertain.add(restriction)
    return AllergenAssessment(frozenset(contains), frozenset(uncertain))
