"""Приведение латиницы к единому виду (в первую очередь для паспортов Узбекистана).

Правила:
* Имя и фамилия латиницей для анкеты берутся ТОЛЬКО из MRZ. MRZ — это то, что
  проверяет пограничник, и там уже нет апострофов: Oʻ → O, Gʻ → G.
* display_latin() — как писать в анкете: ВЕРХНИЙ РЕГИСТР, только A–Z, пробел и дефис.
* compare_key() — ключ для сравнения значений из разных источников (MRZ vs vision).
  Он «склеивает» разные системы транслитерации: KH/X, ZH/J, YU/IU, YA/IA и т.д.,
  чтобы «KHURSHID» и «XURSHID» считались одним и тем же именем.
"""

from __future__ import annotations

import re
import unicodedata

# Все виды апострофов, которые встречаются в узбекской латинице (Oʻ, Gʻ, ъ-знак)
_APOSTROPHES = "'`´ʻʼʹ’‘‛′"

# Узбекская кириллица → узбекская латиница (официальный алфавит 1995 г.)
_UZ_CYR_TO_LAT = {
    "А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Е": "E", "Ё": "YO", "Ж": "J",
    "З": "Z", "И": "I", "Й": "Y", "К": "K", "Л": "L", "М": "M", "Н": "N", "О": "O",
    "П": "P", "Р": "R", "С": "S", "Т": "T", "У": "U", "Ф": "F", "Х": "X", "Ц": "TS",
    "Ч": "CH", "Ш": "SH", "Щ": "SH", "Ъ": "", "Ы": "I", "Ь": "", "Э": "E", "Ю": "YU",
    "Я": "YA", "Ў": "O", "Қ": "Q", "Ғ": "G", "Ҳ": "H",
}

# Замены для ключа сравнения: разные стандарты транслитерации → одна форма.
# Порядок важен: сначала длинные сочетания.
_KEY_RULES = [
    ("SHCH", "SH"),
    ("KH", "X"),
    ("X", "H"),  # узб. X (Х) и H (Ҳ) в русской традиции оба дают KH/X
    ("ZH", "J"),
    ("DJ", "J"),
    ("TS", "S"),
    ("IU", "YU"),
    ("IA", "YA"),
    ("IE", "YE"),
    ("OO", "U"),
    ("Q", "K"),
    ("W", "V"),
    ("Y", "I"),
    ("H", ""),  # Ҳ/Х часто то пишут, то опускают: MUHAMMAD / MUXAMMAD / MUHAMAD
]


def cyrillic_to_latin(text: str) -> str:
    out = []
    for ch in text.upper():
        out.append(_UZ_CYR_TO_LAT.get(ch, ch))
    return "".join(out)


def display_latin(text: str) -> str:
    """Форма для анкеты: верхний регистр, A–Z, пробел, дефис."""
    if not text:
        return ""
    text = text.replace("<", " ")
    for ap in _APOSTROPHES:
        text = text.replace(ap, "")
    text = cyrillic_to_latin(text)
    # Убираем диакритику (Ö → O, Ş → S и т.п.)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^A-Z\- ]", " ", text.upper())
    text = re.sub(r"\s*-\s*", "-", text)
    return re.sub(r"\s+", " ", text).strip()


def compare_key(text: str) -> str:
    """Ключ для сравнения имён из разных источников (не для записи в анкету)."""
    key = display_latin(text).replace("-", " ").replace(" ", "")
    for src, dst in _KEY_RULES:
        key = key.replace(src, dst)
    return re.sub(r"(.)\1+", r"\1", key)  # двойные буквы: MUHAMMAD → MUXAMAD


def names_match(a: str, b: str) -> bool:
    return compare_key(a) == compare_key(b)
