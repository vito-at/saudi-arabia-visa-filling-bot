"""Сопоставление значений с пунктами выпадающих списков портала через словарь.

Идея: у нас есть «канонический» ключ (например, UZB, MARRIED, TASHKENT), а в
config/dictionaries.yaml для него перечислены все варианты текста, которые могут
быть на портале или прийти от клиента (Uzbekistan, Республика Узбекистан, ...).

match_option() выбирает пункт списка на странице:
1. точное совпадение с любым синонимом (без учёта регистра и знаков);
2. если нет — нечёткое совпадение (rapidfuzz) с порогом;
3. если уверенности нет — возвращает None, и бот спрашивает оператора.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import yaml
from rapidfuzz import fuzz, process

FUZZY_THRESHOLD = 88


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^\w]+", " ", text.lower(), flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class MatchResult:
    option: str      # текст пункта на странице, который нужно выбрать
    score: float     # 100 = точное совпадение
    exact: bool


class Dictionaries:
    def __init__(self, data: dict[str, dict[str, list[str]]]):
        # {"country": {"UZB": ["Uzbekistan", ...]}, ...}
        self.data = data

    @classmethod
    def load(cls, path: Path) -> "Dictionaries":
        with open(path, encoding="utf-8") as fh:
            raw = yaml.safe_load(fh) or {}
        return cls({cat: {str(k): [str(s) for s in (v or [])] for k, v in items.items()}
                    for cat, items in raw.items()})

    def synonyms(self, category: str, key: str) -> list[str]:
        items = self.data.get(category, {})
        return [key, *items.get(key, [])]

    def canonical(self, category: str, text: str) -> str | None:
        """Любой вариант текста → канонический ключ (например, 'Узбекистан' → 'UZB')."""
        target = normalize(text)
        for key, syns in self.data.get(category, {}).items():
            if target in {normalize(s) for s in (key, *syns)}:
                return key
        choices = {normalize(s): key for key, syns in self.data.get(category, {}).items()
                   for s in (key, *syns)}
        if not choices or not target:
            return None
        best = process.extractOne(target, list(choices), scorer=fuzz.token_sort_ratio)
        if best and best[1] >= FUZZY_THRESHOLD:
            return choices[best[0]]
        return None

    def match_option(self, category: str, key_or_text: str, options: list[str]) -> MatchResult | None:
        """Выбирает пункт из options (тексты пунктов выпадающего списка на странице)."""
        key = self.canonical(category, key_or_text) or key_or_text
        wanted = [normalize(s) for s in self.synonyms(category, key)]
        wanted.append(normalize(key_or_text))
        norm_options = {normalize(o): o for o in options if o and o.strip()}

        for w in wanted:
            if w in norm_options:
                return MatchResult(norm_options[w], 100.0, True)

        best: MatchResult | None = None
        for w in wanted:
            hit = process.extractOne(w, list(norm_options), scorer=fuzz.token_sort_ratio)
            if hit and hit[1] >= FUZZY_THRESHOLD and (best is None or hit[1] > best.score):
                best = MatchResult(norm_options[hit[0]], float(hit[1]), False)
        return best
