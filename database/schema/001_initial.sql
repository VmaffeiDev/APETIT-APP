CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT UNIQUE,
    name TEXT,
    unit_id UUID REFERENCES units(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE dietary_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    source_kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_confirmation',
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescription_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    meal_type TEXT NOT NULL,
    kcal NUMERIC(10,2),
    protein_g NUMERIC(10,2),
    carbs_g NUMERIC(10,2),
    fat_g NUMERIC(10,2)
);

CREATE TABLE prescription_portions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_meal_id UUID NOT NULL REFERENCES prescription_meals(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    quantity NUMERIC(10,2),
    unit TEXT,
    notes TEXT
);

CREATE TABLE menu_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id),
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded',
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE TABLE menu_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_import_id UUID NOT NULL REFERENCES menu_imports(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id),
    service_date DATE NOT NULL,
    meal_type TEXT NOT NULL,
    UNIQUE(unit_id, service_date, meal_type)
);

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_day_id UUID NOT NULL REFERENCES menu_days(id) ON DELETE CASCADE,
    technical_sheet_code TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    standard_portion TEXT,
    kcal NUMERIC(10,2),
    protein_g NUMERIC(10,2),
    carbs_g NUMERIC(10,2),
    fat_g NUMERIC(10,2)
);

CREATE TABLE menu_item_allergens (
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY(menu_item_id, allergen)
);

CREATE TABLE meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    meal_date DATE NOT NULL,
    meal_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(person_id, meal_date, meal_type)
);

CREATE TABLE meal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    source_menu_item_id UUID REFERENCES menu_items(id),
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,
    unit TEXT,
    kcal NUMERIC(10,2),
    protein_g NUMERIC(10,2),
    carbs_g NUMERIC(10,2),
    fat_g NUMERIC(10,2)
);

CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    meal_date DATE NOT NULL,
    food_rating SMALLINT NOT NULL CHECK(food_rating BETWEEN 1 AND 5),
    service_rating SMALLINT NOT NULL CHECK(service_rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(person_id, restaurant_id, meal_date)
);

CREATE TABLE feedback_tags (
    feedback_id UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY(feedback_id, tag)
);

CREATE INDEX idx_menu_days_date ON menu_days(unit_id, service_date);
CREATE INDEX idx_feedback_report ON feedback(restaurant_id, meal_date);
CREATE INDEX idx_meals_person_date ON meals(person_id, meal_date);
