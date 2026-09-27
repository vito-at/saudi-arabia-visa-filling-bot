"""Чтение и проверка MRZ паспорта (формат TD3, 2 строки по 44 символа, ICAO 9303).

Порядок работы:
1. Получаем «сырой» текст MRZ: сначала fastmrz, если не вышло — passporteye.
2. Разбираем его своим парсером и проверяем ВСЕ контрольные суммы.
3. Если контрольная сумма не сошлась, пробуем исправить типичные ошибки OCR
   (O↔0, I↔1, S↔5, B↔8 ...) только так, чтобы контрольная сумма сошлась.
   Каждое исправленное поле помечается, чтобы его показали на проверку.
"""

from __future__ import annotations

import io
import itertools
import logging
import re
from dataclasses import dataclass, field
from datetime import date

import numpy as np

log = logging.getLogger(__name__)

LINE_LEN = 44

_WEIGHTS = (7, 3, 1)

# Как OCR путает буквы и цифры. Используется только когда не сходится контрольная сумма.
_TO_DIGIT = {"O": "0", "Q": "0", "D": "0", "U": "0", "I": "1", "L": "1", "T": "1",
             "Z": "2", "S": "5", "G": "6", "B": "8", "A": "4"}
_TO_ALPHA = {"0": "O", "1": "I", "2": "Z", "4": "A", "5": "S", "6": "G", "8": "B"}


def char_value(ch: str) -> int:
    if ch.isdigit():
        return int(ch)
    if "A" <= ch <= "Z":
        return ord(ch) - ord("A") + 10
    if ch == "<":
        return 0
    raise ValueError(f"Недопустимый символ MRZ: {ch!r}")


def check_digit(data: str) -> str:
    total = sum(char_value(ch) * _WEIGHTS[i % 3] for i, ch in enumerate(data))
    return str(total % 10)


def is_valid(data: str, digit: str) -> bool:
    try:
        if digit == "<":
            # Пустое необязательное поле допускает «<» вместо 0
            return set(data) <= {"<"} or check_digit(data) == "0"
        return check_digit(data) == digit
    except ValueError:
        return False


@dataclass
class MRZField:
    value: str
    valid: bool
    corrected: bool = False  # значение исправлено нашим алгоритмом по контрольной сумме


@dataclass
class MRZResult:
    line1: str
    line2: str
    document_type: str
    issuing_country: str
    surname: str
    given_names: str
    passport_number: MRZField
    nationality: str
    date_of_birth: MRZField  # YYYY-MM-DD
    sex: str  # M / F / X
    date_of_expiry: MRZField  # YYYY-MM-DD
    personal_number: MRZField
    composite_valid: bool
    source: str  # fastmrz / passporteye / vision / text
    warnings: list[str] = field(default_factory=list)

    @property
    def all_valid(self) -> bool:
        return (self.passport_number.valid and self.date_of_birth.valid
                and self.date_of_expiry.valid and self.personal_number.valid
                and self.composite_valid)


# ---------------------------------------------------------------------------
# Очистка и разбор текста
# ---------------------------------------------------------------------------

def clean_mrz_text(raw: str) -> tuple[str, str] | None:
    """Находит в тексте OCR две строки TD3 и приводит их к 44 символам."""
    text = raw.upper().replace("«", "<").replace("‹", "<").replace(" ", "")
    lines = [re.sub(r"[^A-Z0-9<]", "", ln) for ln in text.splitlines()]
    lines = [ln for ln in lines if len(ln) >= 30]
    if len(lines) < 2:
        return None

    # Первая строка паспорта начинается с «P»
    for i in range(len(lines) - 1):
        if lines[i].startswith("P"):
            l1, l2 = lines[i], lines[i + 1]
            break
    else:
        l1, l2 = lines[-2], lines[-1]

    l1 = _fit(l1)
    l2 = _fit(l2)
    return l1, l2


def _fit(line: str) -> str:
    if len(line) > LINE_LEN:
        line = line[:LINE_LEN]
    return line.ljust(LINE_LEN, "<")


def _format_date(yymmdd: str, is_birth: bool) -> str:
    yy, mm, dd = int(yymmdd[:2]), int(yymmdd[2:4]), int(yymmdd[4:6])
    if is_birth:
        current_yy = date.today().year % 100
        century = 1900 if yy > current_yy else 2000
    else:
        century = 2000
    return date(century + yy, mm, dd).isoformat()


def _repair(value: str, digit: str, allowed: str) -> tuple[str, str, bool] | None:
    """Пробует заменить похожие символы так, чтобы сошлась контрольная сумма.

    allowed: 'digits' — поле только из цифр (даты), 'alnum' — номер паспорта.
    Возвращает (value, digit, corrected) или None.
    """
    if not digit.isdigit() and digit != "<":
        digit = _TO_DIGIT.get(digit, digit)
    if is_valid(value, digit):
        return value, digit, False

    if allowed == "digits":
        candidate = "".join(_TO_DIGIT.get(ch, ch) for ch in value)
        if candidate.isdigit() and is_valid(candidate, digit):
            return candidate, digit, True
        return None

    # alnum: перебираем варианты только для неоднозначных символов (не больше 2^6 комбинаций)
    options: list[list[str]] = []
    for ch in value:
        alts = {ch}
        if ch in _TO_DIGIT:
            alts.add(_TO_DIGIT[ch])
        if ch in _TO_ALPHA:
            alts.add(_TO_ALPHA[ch])
        options.append(sorted(alts))
    ambiguous = sum(1 for o in options if len(o) > 1)
    if ambiguous > 6:
        return None
    matches = {"".join(combo) for combo in itertools.product(*options)
               if is_valid("".join(combo), digit)}
    if len(matches) == 1:
        return matches.pop(), digit, True
    return None  # либо ничего не подошло, либо вариантов несколько — нельзя угадывать


def _alpha_only(text: str) -> str:
    return "".join(_TO_ALPHA.get(ch, ch) for ch in text)


def parse_td3(line1: str, line2: str, source: str = "text") -> MRZResult:
    warnings: list[str] = []
    line1, line2 = _fit(line1), _fit(line2)

    # В именах и кодах стран цифр не бывает: 0 → O, 1 → I и т.д.
    line1 = line1[:2] + _alpha_only(line1[2:])
    line2 = line2[:10] + _alpha_only(line2[10:13]) + line2[13:]

    doc_type = line1[0:2].replace("<", "")
    issuing = line1[2:5].replace("<", "")
    names = line1[5:44]
    surname_part, _, given_part = names.partition("<<")
    surname = surname_part.replace("<", " ").strip()
    given = re.sub(r"<+", " ", given_part).strip()
    # Хвостовые «K» — частая ошибка OCR вместо «<<<<»
    given = re.sub(r"(\s|^)K{3,}.*$", "", given).strip()

    number_raw, number_cd = line2[0:9], line2[9]
    nationality = line2[10:13].replace("<", "")
    dob_raw, dob_cd = line2[13:19], line2[19]
    sex = line2[20]
    exp_raw, exp_cd = line2[21:27], line2[27]
    pers_raw, pers_cd = line2[28:42], line2[42]
    comp_cd = line2[43]

    def build(raw: str, cd: str, kind: str, label: str) -> tuple[MRZField, str, str]:
        repaired = _repair(raw, cd, kind)
        if repaired is None:
            warnings.append(f"Контрольная сумма не сошлась: {label}")
            return MRZField(raw, False), raw, cd
        val, cd2, corrected = repaired
        if corrected:
            warnings.append(f"Поле исправлено по контрольной сумме: {label}")
        return MRZField(val, True, corrected), val, cd2

    number, number_raw, number_cd = build(number_raw, number_cd, "alnum", "номер паспорта")
    number.value = number.value.replace("<", "")
    dob_field, dob_raw, dob_cd = build(dob_raw, dob_cd, "digits", "дата рождения")
    exp_field, exp_raw, exp_cd = build(exp_raw, exp_cd, "digits", "срок действия")
    pers_field, pers_raw, pers_cd = build(pers_raw, pers_cd, "alnum", "личный номер")
    pers_field.value = pers_field.value.replace("<", "")

    for fld, raw, is_birth, label in ((dob_field, dob_raw, True, "дата рождения"),
                                      (exp_field, exp_raw, False, "срок действия")):
        try:
            fld.value = _format_date(raw, is_birth)
        except ValueError:
            fld.valid = False
            warnings.append(f"Некорректная дата: {label} ({raw})")

    composite_data = number_raw + number_cd + dob_raw + dob_cd + exp_raw + exp_cd + pers_raw + pers_cd
    comp_cd = _TO_DIGIT.get(comp_cd, comp_cd)
    composite_valid = is_valid(composite_data, comp_cd)
    if not composite_valid:
        warnings.append("Общая контрольная сумма MRZ не сошлась")

    if sex not in ("M", "F", "<"):
        warnings.append(f"Неизвестный пол в MRZ: {sex}")
    sex = "X" if sex == "<" else sex

    if doc_type[:1] != "P":
        warnings.append(f"Тип документа не паспорт: {doc_type}")

    return MRZResult(
        line1=line1, line2=line2, document_type=doc_type, issuing_country=issuing,
        surname=surname, given_names=given, passport_number=number,
        nationality=nationality, date_of_birth=dob_field, sex=sex,
        date_of_expiry=exp_field, personal_number=pers_field,
        composite_valid=composite_valid, source=source, warnings=warnings,
    )


def parse_mrz_text(raw: str, source: str = "text") -> MRZResult | None:
    lines = clean_mrz_text(raw)
    if not lines:
        return None
    return parse_td3(*lines, source=source)


# ---------------------------------------------------------------------------
# OCR изображения
# ---------------------------------------------------------------------------

class MRZReader:
    """Читает MRZ с фото: fastmrz → passporteye. Возвращает лучший результат."""

    def __init__(self, tesseract_cmd: str = "", tessdata_dir: str = ""):
        self.tesseract_cmd = tesseract_cmd
        self.tessdata_dir = tessdata_dir
        self._fastmrz = None
        if tesseract_cmd:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    def _read_fastmrz(self, image_bgr: np.ndarray) -> str:
        if self._fastmrz is None:
            from fastmrz import FastMRZ
            self._fastmrz = FastMRZ(tesseract_path=self.tesseract_cmd,
                                    tessdata_path=self.tessdata_dir)
        fm = self._fastmrz
        try:
            # fastmrz 2.1.x при «чистке» выбрасывает вторую строку MRZ, если в ней нет «<»
            # (например, у паспортов Узбекистана с полным ПИНФЛ). Поэтому берём сырой
            # текст зоны MRZ и чистим его своим парсером.
            processed = fm._process_image(image_bgr)
            fm.net.setInput(processed)
            return fm._get_roi(fm.net.forward(), image_bgr) or ""
        except AttributeError:
            # Внутреннее API fastmrz поменялось — используем публичное
            return fm.get_details(image_bgr, input_type="numpy", ignore_parse=True) or ""

    @staticmethod
    def _read_passporteye(image_bytes: bytes) -> str:
        from passporteye import read_mrz
        mrz = read_mrz(io.BytesIO(image_bytes))
        if mrz is None:
            return ""
        return "\n".join(mrz.aux.get("text", "").splitlines()) or ""

    def read(self, image_bgr: np.ndarray, image_bytes: bytes) -> MRZResult | None:
        candidates: list[MRZResult] = []
        for source, reader in (("fastmrz", lambda: self._read_fastmrz(image_bgr)),
                               ("passporteye", lambda: self._read_passporteye(image_bytes))):
            try:
                raw = reader()
            except Exception as exc:  # библиотека OCR не должна ронять весь процесс
                log.warning("%s не смог прочитать MRZ: %s", source, exc)
                continue
            result = parse_mrz_text(raw, source=source) if raw else None
            if result is None:
                continue
            if result.all_valid:
                return result
            candidates.append(result)
        return best_of(candidates)


def score(result: MRZResult) -> int:
    return sum((result.passport_number.valid, result.date_of_birth.valid,
                result.date_of_expiry.valid, result.personal_number.valid,
                result.composite_valid))


def best_of(results: list[MRZResult | None]) -> MRZResult | None:
    results = [r for r in results if r is not None]
    if not results:
        return None
    return max(results, key=score)
