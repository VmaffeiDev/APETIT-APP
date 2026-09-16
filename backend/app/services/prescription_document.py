from __future__ import annotations

import io
import re
from dataclasses import asdict
from decimal import Decimal
from pathlib import Path

from pypdf import PdfReader

from app.domain.prescription import NutritionTarget, PortionInstruction, PrescriptionMeal


_MEAL_ALIASES = {
    "almoco": "almoco",
    "almoço": "almoco",
    "jantar": "jantar",
    "cafe": "cafe",
    "café": "cafe",
    "lanche": "lanche",
}

_NUMBER_PATTERNS = {
    "kcal": re.compile(r"(?:energia|kcal)\s*[:=-]?\s*(\d+(?:[.,]\d+)?)", re.IGNORECASE),
    "protein_g": re.compile(r"prote[ií]na\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*g?", re.IGNORECASE),
    "carbs_g": re.compile(r"carbo(?:idrato)?s?\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*g?", re.IGNORECASE),
    "fat_g": re.compile(r"gordura(?:s)?\s*[:=-]?\s*(\d+(?:[.,]\d+)?)\s*g?", re.IGNORECASE),
}

_PORTION_RE = re.compile(
    r"(?P<quantity>\d+(?:[.,]\d+)?)\s*(?P<unit>g|kg|ml|l|colher(?:es)?|concha(?:s)?|por[cç][aã]o(?:es)?)\s+(?:de\s+)?(?P<category>[\wÀ-ÿ\s]+)",
    re.IGNORECASE,
)


def extract_text(file_name: str, content: bytes) -> tuple[str | None, str]:
    extension = Path(file_name).suffix.lower()
    if extension in {".txt", ".md"}:
        return content.decode("utf-8-sig", errors="replace"), "text"
    if extension == ".pdf":
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join((page.extract_text() or "") for page in reader.pages).strip()
        if text:
            return text, "pdf_text"
        return None, "needs_ocr"
    if extension in {".png", ".jpg", ".jpeg", ".heic", ".webp"}:
        return None, "needs_ocr"
    return None, "unsupported"


def _to_decimal(value: str | None) -> Decimal | None:
    if not value:
        return None
    return Decimal(value.replace(",", "."))


def parse_prescription_text(text: str, default_meal_type: str = "almoco") -> PrescriptionMeal:
    normalized = text.strip()
    meal_type = default_meal_type
    lowered = normalized.casefold()
    for alias, canonical in _MEAL_ALIASES.items():
        if alias in lowered:
            meal_type = canonical
            break

    values: dict[str, Decimal | None] = {}
    for key, pattern in _NUMBER_PATTERNS.items():
        match = pattern.search(normalized)
        values[key] = _to_decimal(match.group(1)) if match else None

    portions: list[PortionInstruction] = []
    for match in _PORTION_RE.finditer(normalized):
        category = match.group("category").strip(" .,:;-").casefold()
        portions.append(
            PortionInstruction(
                category=category,
                quantity=_to_decimal(match.group("quantity")),
                unit=match.group("unit").casefold(),
            )
        )

    return PrescriptionMeal(
        meal_type=meal_type,
        target=NutritionTarget(
            kcal=values["kcal"],
            protein_g=values["protein_g"],
            carbs_g=values["carbs_g"],
            fat_g=values["fat_g"],
        ),
        portions=tuple(portions),
    )


def meal_to_payload(meal: PrescriptionMeal) -> dict:
    return {
        "meal_type": meal.meal_type,
        "target": asdict(meal.target),
        "portions": [asdict(portion) for portion in meal.portions],
    }
