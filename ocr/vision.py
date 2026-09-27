"""Распознавание полей паспорта через Claude (vision). Ответ — строго JSON по схеме."""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass

import anthropic

log = logging.getLogger(__name__)

VISION_FIELDS = {
    "is_passport": "boolean: true, если на фото страница паспорта с фото владельца",
    "issuing_country": "страна выдачи, код ISO 3166-1 alpha-3 (UZB, RUS, KAZ ...)",
    "surname": "фамилия латиницей, как напечатано в визуальной зоне",
    "given_names": "имя (и отчество, если есть в латинской строке) латиницей",
    "passport_number": "номер паспорта",
    "nationality": "гражданство, ISO 3166-1 alpha-3",
    "date_of_birth": "дата рождения YYYY-MM-DD",
    "sex": "M или F",
    "place_of_birth": "место рождения ТОЧНО как напечатано (латиницей, если есть латинский вариант)",
    "date_of_issue": "дата выдачи YYYY-MM-DD",
    "date_of_expiry": "дата окончания срока действия YYYY-MM-DD",
    "issuing_authority": "орган выдачи (Authority), как напечатано",
    "personal_number": "личный номер (ПИНФЛ/ИИН/Personal No.), если есть",
    "mrz_line1": "первая строка MRZ, 44 символа, символ < сохранять",
    "mrz_line2": "вторая строка MRZ, 44 символа, символ < сохранять",
    "quality_issues": "кратко по-русски: блики, обрезано, размыто; пустая строка если всё хорошо",
}

_SCHEMA = {
    "type": "object",
    "properties": {
        name: ({"type": "boolean"} if name == "is_passport" else {"type": "string"})
        for name in VISION_FIELDS
    },
    "required": list(VISION_FIELDS),
    "additionalProperties": False,
}

_SYSTEM = (
    "Ты извлекаешь данные из фотографии страницы паспорта для туристического агентства, "
    "которое оформляет визу по поручению владельца паспорта. Переписывай значения ровно так, "
    "как они напечатаны, ничего не придумывай и не исправляй. Если поле не видно или не "
    "читается — верни пустую строку. Даты приводи к формату YYYY-MM-DD. MRZ переписывай "
    "посимвольно, включая все символы '<'."
)


@dataclass
class VisionResult:
    data: dict
    model: str


class VisionError(RuntimeError):
    pass


class PassportVision:
    def __init__(self, api_key: str, model: str):
        self.client = anthropic.Anthropic(api_key=api_key or None)
        self.model = model

    def extract(self, jpeg_bytes: bytes) -> VisionResult:
        field_list = "\n".join(f"- {name}: {desc}" for name, desc in VISION_FIELDS.items())
        image_b64 = base64.standard_b64encode(jpeg_bytes).decode("ascii")
        try:
            response = self.client.beta.messages.create(
                model=self.model,
                max_tokens=16000,
                system=_SYSTEM,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image",
                         "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                        {"type": "text", "text": f"Извлеки поля паспорта:\n{field_list}"},
                    ],
                }],
            )
        except anthropic.AuthenticationError as exc:
            raise VisionError("Неверный ANTHROPIC_API_KEY в .env") from exc
        except anthropic.RateLimitError as exc:
            raise VisionError("Превышен лимит запросов Claude API, повторите через минуту") from exc
        except anthropic.APIStatusError as exc:
            raise VisionError(f"Claude API вернул ошибку {exc.status_code}: {exc.message}") from exc
        except anthropic.APIConnectionError as exc:
            raise VisionError("Нет соединения с Claude API (проверьте интернет)") from exc

        if response.stop_reason == "refusal":
            raise VisionError("Модель отказалась обрабатывать изображение")
        if response.stop_reason == "max_tokens":
            raise VisionError("Ответ модели обрезан (max_tokens)")

        text = "".join(block.text for block in response.content if block.type == "text")
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise VisionError(f"Модель вернула не JSON: {text[:200]}") from exc
        return VisionResult(data=data, model=response.model)
