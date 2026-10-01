from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class NutritionFacts:
    kcal: Decimal | None = None
    protein_g: Decimal | None = None
    carbs_g: Decimal | None = None
    fat_g: Decimal | None = None


@dataclass(frozen=True)
class MenuItem:
    id: str
    technical_sheet_code: str | None
    name: str
    category: str
    standard_portion: str | None
    nutrition: NutritionFacts
    allergens: tuple[str, ...] = ()


@dataclass(frozen=True)
class PublishedMenuDay:
    unit_id: str
    service_date: date
    meal_type: str
    items: tuple[MenuItem, ...]
