"""Полный цикл распознавания паспорта: фото → MRZ + Claude vision → сверка → PassportData."""

from __future__ import annotations

import logging
import re
from datetime import date

from ocr import images
from ocr.models import FieldStatus, PassportData, PassportField, PassportResult
from ocr.mrz import MRZReader, MRZResult, best_of, parse_td3
from ocr.translit import display_latin, names_match
from ocr.vision import PassportVision, VisionError

log = logging.getLogger(__name__)

BLUR_THRESHOLD = 60.0


class PassportRecognizer:
    def __init__(self, mrz_reader: MRZReader, vision: PassportVision | None,
                 photo_max_kb: int = 200, passport_max_kb: int = 500):
        self.mrz_reader = mrz_reader
        self.vision = vision
        self.photo_max_kb = photo_max_kb
        self.passport_max_kb = passport_max_kb

    def process(self, photo_bytes: bytes) -> PassportResult:
        original = images.load_image(photo_bytes)
        page = images.crop_document(original)
        blur = images.blur_score(page)

        # Для OCR используем и обрезку, и оригинал: иногда обрезка режет MRZ
        page_jpeg = images.encode_jpeg(page, max_side=2400)
        mrz = self.mrz_reader.read(page, page_jpeg)
        if mrz is None or not mrz.all_valid:
            orig_jpeg = images.encode_jpeg(original, max_side=2400)
            mrz = best_of([mrz, self.mrz_reader.read(original, orig_jpeg)])

        vision_data: dict = {}
        warnings: list[str] = []
        if self.vision is not None:
            try:
                vision_data = self.vision.extract(images.encode_jpeg(page, max_side=2000)).data
            except VisionError as exc:
                warnings.append(f"Claude vision: {exc}")
                log.error("Vision error: %s", exc)

        # Если локальный OCR не справился, проверяем MRZ, переписанную моделью
        if (mrz is None or not mrz.all_valid) and vision_data.get("mrz_line1") and vision_data.get("mrz_line2"):
            from_vision = parse_td3(vision_data["mrz_line1"], vision_data["mrz_line2"], source="vision")
            mrz = best_of([mrz, from_vision])

        data = merge(mrz, vision_data)
        data.warnings = warnings + data.warnings
        if blur < BLUR_THRESHOLD:
            data.warnings.append(f"Фото размыто (резкость {blur:.0f}), лучше переснять")
        if vision_data.get("quality_issues"):
            data.warnings.append(f"Качество фото: {vision_data['quality_issues']}")
        if vision_data and vision_data.get("is_passport") is False:
            data.warnings.append("Модель считает, что на фото не страница паспорта")

        face = images.crop_face(page)
        return PassportResult(
            data=data,
            passport_jpeg=images.encode_jpeg(page, max_kb=self.passport_max_kb, max_side=2000),
            face_jpeg=images.encode_jpeg(face, max_kb=self.photo_max_kb) if face is not None else None,
            blur=blur,
        )


# ---------------------------------------------------------------------------
# Сверка источников
# ---------------------------------------------------------------------------

def _norm_date(value: str) -> str:
    """Приводит дату от модели к YYYY-MM-DD (на случай DD.MM.YYYY)."""
    value = (value or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    m = re.fullmatch(r"(\d{2})[./ -](\d{2})[./ -](\d{4})", value)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return value


def _norm_code(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def _mrz_field(value: str, valid: bool, vision_value: str, same: bool,
               corrected: bool = False) -> PassportField:
    """MRZ-поле: MRZ главный источник, vision — для перекрёстной проверки."""
    if not value:
        if vision_value:
            return PassportField(value=vision_value, status=FieldStatus.REVIEW, source="vision",
                                 note="нет в MRZ, взято из визуальной зоны")
        return PassportField()
    if not valid:
        return PassportField(value=value, status=FieldStatus.REVIEW, source="mrz",
                             alternative=vision_value, note="не сошлась контрольная сумма MRZ")
    if vision_value and not same:
        return PassportField(value=value, status=FieldStatus.REVIEW, source="mrz",
                             alternative=vision_value, note="MRZ и визуальная зона расходятся")
    note = "исправлено по контрольной сумме" if corrected else ""
    status = FieldStatus.REVIEW if corrected and not (vision_value and same) else FieldStatus.OK
    return PassportField(value=value, status=status,
                         source="mrz+vision" if vision_value else "mrz", note=note)


def merge(mrz: MRZResult | None, vision: dict) -> PassportData:
    data = PassportData()
    v = {k: (val.strip() if isinstance(val, str) else val) for k, val in vision.items()}

    if mrz is not None:
        data.mrz_line1, data.mrz_line2 = mrz.line1, mrz.line2
        data.mrz_source, data.mrz_valid = mrz.source, mrz.all_valid
        data.warnings.extend(mrz.warnings)

        # Имена латиницей берём из MRZ (важно для паспортов Узбекистана: Oʻ/Gʻ → O/G)
        names_ok = mrz.composite_valid or mrz.source != "vision"
        for key, mrz_value in (("surname", mrz.surname), ("given_names", mrz.given_names)):
            vis = v.get(key, "")
            data.fields[key] = _mrz_field(display_latin(mrz_value), names_ok, display_latin(vis),
                                          names_match(mrz_value, vis))

        pn = mrz.passport_number
        data.fields["passport_number"] = _mrz_field(
            pn.value, pn.valid, _norm_code(v.get("passport_number", "")),
            pn.value == _norm_code(v.get("passport_number", "")), pn.corrected)

        for key in ("date_of_birth", "date_of_expiry"):
            fld = getattr(mrz, key)
            vis = _norm_date(v.get(key, ""))
            data.fields[key] = _mrz_field(fld.value, fld.valid, vis, fld.value == vis, fld.corrected)

        pers = mrz.personal_number
        vis_pers = _norm_code(v.get("personal_number", ""))
        data.fields["personal_number"] = _mrz_field(pers.value, pers.valid, vis_pers,
                                                    pers.value == vis_pers, pers.corrected)

        for key, mrz_value in (("nationality", mrz.nationality),
                               ("issuing_country", mrz.issuing_country),
                               ("sex", mrz.sex)):
            vis = _norm_code(v.get(key, ""))
            data.fields[key] = _mrz_field(mrz_value, mrz.composite_valid or mrz.source != "vision",
                                          vis, mrz_value == vis)
    else:
        data.warnings.append("MRZ не распознана — все поля взяты из визуальной зоны, проверьте их")
        for key in ("surname", "given_names"):
            if v.get(key):
                data.fields[key] = PassportField(value=display_latin(v[key]),
                                                 status=FieldStatus.REVIEW, source="vision")
        for key in ("passport_number", "nationality", "issuing_country", "sex", "personal_number"):
            if v.get(key):
                data.fields[key] = PassportField(value=_norm_code(v[key]),
                                                 status=FieldStatus.REVIEW, source="vision")
        for key in ("date_of_birth", "date_of_expiry"):
            if v.get(key):
                data.fields[key] = PassportField(value=_norm_date(v[key]),
                                                 status=FieldStatus.REVIEW, source="vision")

    # Поля только из визуальной зоны
    if v.get("place_of_birth"):
        data.fields["place_of_birth"] = PassportField(
            value=display_latin(v["place_of_birth"]), status=FieldStatus.VISION_ONLY,
            source="vision", alternative=v["place_of_birth"])
    if v.get("issuing_authority"):
        data.fields["issuing_authority"] = PassportField(
            value=v["issuing_authority"].upper(), status=FieldStatus.VISION_ONLY, source="vision")
    if v.get("date_of_issue"):
        data.fields["date_of_issue"] = PassportField(
            value=_norm_date(v["date_of_issue"]), status=FieldStatus.VISION_ONLY, source="vision")

    _sanity_checks(data)
    return data


def _sanity_checks(data: PassportData) -> None:
    today = date.today().isoformat()
    expiry = data.get("date_of_expiry")
    issue = data.get("date_of_issue")
    if expiry and re.fullmatch(r"\d{4}-\d{2}-\d{2}", expiry):
        if expiry < today:
            data.warnings.append(f"Паспорт просрочен ({expiry})")
        else:
            months_left = (date.fromisoformat(expiry) - date.today()).days / 30.4
            if months_left < 6:
                data.warnings.append(
                    f"До окончания паспорта меньше 6 месяцев ({expiry}) — визу могут не выдать")
    if issue and expiry and issue >= expiry:
        data.fields["date_of_issue"].status = FieldStatus.REVIEW
        data.fields["date_of_issue"].note = "дата выдачи позже срока действия"
    if issue and issue > today:
        data.fields["date_of_issue"].status = FieldStatus.REVIEW
        data.fields["date_of_issue"].note = "дата выдачи в будущем"
