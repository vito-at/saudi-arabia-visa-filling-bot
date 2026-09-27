"""Модель распознанных данных паспорта."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class FieldStatus(str, Enum):
    OK = "ok"                # MRZ с верной контрольной суммой и/или совпадение источников
    REVIEW = "review"        # требует проверки: источники расходятся / не сошлась сумма
    VISION_ONLY = "vision"   # есть только в визуальной зоне (место рождения, дата выдачи ...)
    MISSING = "missing"      # не удалось распознать
    MANUAL = "manual"        # исправлено вручную оператором


class PassportField(BaseModel):
    value: str = ""
    status: FieldStatus = FieldStatus.MISSING
    source: str = ""                 # mrz / vision / mrz+vision / manual
    alternative: str = ""            # что вернул второй источник, если расходится
    note: str = ""                   # пояснение для оператора


# Порядок и подписи полей в карточке подтверждения
FIELD_LABELS: dict[str, str] = {
    "surname": "Фамилия",
    "given_names": "Имя",
    "passport_number": "Номер паспорта",
    "nationality": "Гражданство",
    "issuing_country": "Страна выдачи",
    "date_of_birth": "Дата рождения",
    "sex": "Пол",
    "place_of_birth": "Место рождения",
    "date_of_issue": "Дата выдачи",
    "date_of_expiry": "Действителен до",
    "issuing_authority": "Орган выдачи",
    "personal_number": "Личный номер",
}


class PassportData(BaseModel):
    fields: dict[str, PassportField] = Field(
        default_factory=lambda: {name: PassportField() for name in FIELD_LABELS})
    mrz_line1: str = ""
    mrz_line2: str = ""
    mrz_source: str = ""
    mrz_valid: bool = False
    warnings: list[str] = Field(default_factory=list)

    def get(self, name: str) -> str:
        return self.fields[name].value

    def set_manual(self, name: str, value: str) -> None:
        self.fields[name] = PassportField(value=value, status=FieldStatus.MANUAL, source="manual")

    @property
    def fields_to_review(self) -> list[str]:
        return [n for n, f in self.fields.items()
                if f.status in (FieldStatus.REVIEW, FieldStatus.MISSING)]

    @property
    def display_name(self) -> str:
        return f"{self.get('surname')} {self.get('given_names')}".strip()


class PassportResult(BaseModel):
    """Результат обработки одного фото: данные + обрезанные изображения (JPEG bytes)."""

    model_config = {"arbitrary_types_allowed": True}

    data: PassportData
    passport_jpeg: bytes = b""
    face_jpeg: bytes | None = None
    blur: float = 0.0
