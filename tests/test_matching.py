from pathlib import Path

from filler.matching import Dictionaries

DICTS = Dictionaries.load(Path(__file__).resolve().parent.parent / "config" / "dictionaries.yaml")


def test_canonical():
    assert DICTS.canonical("country", "Республика Узбекистан") == "UZB"
    assert DICTS.canonical("marital_status", "женат") == "MARRIED"
    assert DICTS.canonical("birth_place_uz", "TOSHKENT SHAHRI") == "TASHKENT"


def test_match_option_exact():
    options = ["-- Select --", "Uzbekistan", "Ukraine", "United Kingdom"]
    m = DICTS.match_option("country", "UZB", options)
    assert m and m.option == "Uzbekistan" and m.exact


def test_match_option_fuzzy():
    options = ["Select", "Uzbekistan (Republic of)", "Kazakhstan"]
    m = DICTS.match_option("country", "UZB", options)
    assert m and m.option == "Uzbekistan (Republic of)"


def test_no_confident_match():
    assert DICTS.match_option("country", "UZB", ["Kazakhstan", "Kyrgyzstan"]) is None
