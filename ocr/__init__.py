"""Распознавание паспорта: MRZ (fastmrz / passporteye) + Claude vision."""

from ocr.models import FIELD_LABELS, FieldStatus, PassportData, PassportField, PassportResult


def build_recognizer(use_vision: bool = True):
    """Собирает распознаватель из настроек .env."""
    from config import settings
    from ocr.mrz import MRZReader
    from ocr.pipeline import PassportRecognizer
    from ocr.vision import PassportVision

    vision = PassportVision(settings.anthropic_api_key, settings.claude_model) if use_vision else None
    return PassportRecognizer(
        MRZReader(settings.tesseract_cmd, settings.tessdata_dir),
        vision,
        photo_max_kb=settings.portal_photo_max_kb,
        passport_max_kb=settings.portal_passport_max_kb,
    )


__all__ = ["FIELD_LABELS", "FieldStatus", "PassportData", "PassportField", "PassportResult",
           "build_recognizer"]
