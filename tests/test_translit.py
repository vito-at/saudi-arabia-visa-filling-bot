from ocr.translit import compare_key, cyrillic_to_latin, display_latin, names_match


def test_uzbek_apostrophes_removed():
    assert display_latin("G‘AYRAT") == "GAYRAT"
    assert display_latin("Oʻlmas") == "OLMAS"
    assert display_latin("Farg'ona") == "FARGONA"


def test_mrz_filler():
    assert display_latin("GAYRAT<ORIFJON") == "GAYRAT ORIFJON"


def test_cyrillic():
    assert cyrillic_to_latin("Шоҳрух") == "SHOHRUX"
    assert display_latin("Ғайрат") == "GAYRAT"


def test_variants_match():
    assert names_match("KHURSHID", "XURSHID")
    assert names_match("MUHAMMAD", "MUXAMMAD")
    assert names_match("YULDASHEV", "IULDASHEV")
    assert names_match("G'AYRAT", "GAYRAT")
    assert not names_match("AZIZ", "ANVAR")


def test_compare_key_stable():
    assert compare_key("Shoxrux") == compare_key("SHOKHRUKH")
