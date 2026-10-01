from app.services.technical_sheet_import import read_import


def test_reads_csv_technical_sheets_and_reports_incomplete_values() -> None:
    content = (
        "codigo;preparacao;categoria;porcao;unidade;kcal;proteina;carboidratos;gorduras;ingredientes;alergenicos\n"
        "06.03.01.258;Frango grelhado;prato_principal;120;g;198;37;1;5;Frango|Ervas;soja:may_contain\n"
        "06.03.01.259;Salada verde;salada;80;g;48;;;2;Alface|Tomate;\n"
    ).encode("utf-8")

    items, warnings = read_import("fichas.csv", content)

    assert warnings == []
    assert len(items) == 2
    assert items[0].code == "06.03.01.258"
    assert str(items[0].kcal) == "198"
    assert items[0].ingredients == ["Frango", "Ervas"]
    assert items[0].allergens == [{"allergen": "soja", "status": "may_contain"}]
    assert items[1].protein_g is None
    assert items[1].carbs_g is None


def test_requires_code_and_name_headers() -> None:
    content = "kcal;proteina\n100;10\n".encode("utf-8")

    try:
        read_import("fichas.csv", content)
    except ValueError as exc:
        assert "código" in str(exc)
    else:
        raise AssertionError("expected ValueError")
