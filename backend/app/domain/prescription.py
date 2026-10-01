from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class NutritionTarget:
    kcal: Decimal | None = None
    protein_g: Decimal | None = None
    carbs_g: Decimal | None = None
    fat_g: Decimal | None = None


@dataclass(frozen=True)
class PortionInstruction:
    category: str
    quantity: Decimal | None = None
    unit: str | None = None
    notes: str | None = None


@dataclass(frozen=True)
class PrescriptionMeal:
    meal_type: str
    target: NutritionTarget = field(default_factory=NutritionTarget)
    portions: tuple[PortionInstruction, ...] = ()


@dataclass(frozen=True)
class ConfirmedPrescription:
    person_id: str
    source_kind: str
    meals: tuple[PrescriptionMeal, ...]
    confirmed_by_person: bool
