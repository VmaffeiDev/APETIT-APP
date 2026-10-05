from app.services.menu_import import normalize_planning_rows, parse_planning_cell


def test_parse_portion_and_cost():
    assert parse_planning_cell("BIFE ACEBOLADO (80g) - C51 - 3.11") == (
        "BIFE ACEBOLADO",
        "80g",
        None,
    )


def test_parse_full_technical_sheet_code():
    assert parse_planning_cell("30% - 06.03.01.258 - CUBOS DE MELAO - 0.55") == (
        "CUBOS DE MELAO",
        None,
        "06.03.01.258",
    )


def test_operational_columns_do_not_reach_employee_menu():
    rows = [
        ["Dia", "PRATO PRINCIPAL", "SALADA", "KIT - QUIMICO", "KIT - TEMPERO"],
        [
            "17",
            "BIFE ACEBOLADO (80g) - C51 - 3.11",
            "SAL. TOMATE - 0.51",
            "100% - 09.03.01.077-1 - KIT - QUIMICO - A. YOSHII - 0.05",
            "KIT - GALETEIRO - A. YOSHII - 0.04",
        ],
    ]

    items = normalize_planning_rows(rows)

    assert [item.name for item in items] == ["BIFE ACEBOLADO", "SAL. TOMATE"]
    assert [item.category for item in items] == ["prato_principal", "salada"]
    assert all("QUIMICO" not in item.name for item in items)
    assert all("GALETEIRO" not in item.name for item in items)


def test_real_week_shape_is_normalized_to_items():
    rows = [
        ["Dia", "PRATO PRINCIPAL", "PRATO PRINCIPAL 2", "ARROZ", "FEIJAO", "BEBIDA"],
        [
            "21",
            "POSTA ASSADA AO MOLHO DE STROGONOFF (80g) - C51 - 2.96",
            "LINGUICA TOSCANA ASSADA (80g) - C51 - 1.21",
            "ARROZ PARBOILIZADO - C51 - 0.24",
            "FEIJAO PRETO - C51 - 0.15",
            "SUCO POLPA DE UVA - 1.84",
        ],
    ]

    items = normalize_planning_rows(rows)

    assert len(items) == 5
    assert {item.day for item in items} == {21}
    assert items[0].portion == "80g"
    assert items[3].name == "FEIJAO PRETO"
