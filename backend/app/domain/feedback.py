from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True)
class MealFeedback:
    id: str
    person_id: str
    unit_id: str
    restaurant_id: str
    meal_date: date
    food_rating: int
    service_rating: int
    tags: tuple[str, ...] = ()
    comment: str | None = None
    created_at: datetime | None = None

    def validate(self) -> None:
        if not 1 <= self.food_rating <= 5:
            raise ValueError("food_rating deve estar entre 1 e 5")
        if not 1 <= self.service_rating <= 5:
            raise ValueError("service_rating deve estar entre 1 e 5")
