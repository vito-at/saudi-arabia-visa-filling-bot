"""Проверка распознавания на своих фото без Telegram.

Запуск (из папки проекта, с активированным venv):
    python -m ocr.cli путь\\к\\фото1.jpg путь\\к\\фото2.jpg
    python -m ocr.cli фото.jpg --no-vision          # только MRZ, без Claude API
    python -m ocr.cli фото.jpg --save-crops out     # сохранить обрезки (НЕ шифруются!)
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from ocr import FIELD_LABELS, FieldStatus, build_recognizer

_MARK = {
    FieldStatus.OK: "OK   ",
    FieldStatus.VISION_ONLY: "VIS  ",
    FieldStatus.REVIEW: "CHECK",
    FieldStatus.MISSING: "---- ",
    FieldStatus.MANUAL: "MAN  ",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Тест распознавания паспорта")
    parser.add_argument("photos", nargs="+", type=Path)
    parser.add_argument("--no-vision", action="store_true", help="не вызывать Claude API")
    parser.add_argument("--save-crops", type=Path, help="папка для обрезанных фото")
    parser.add_argument("--json", action="store_true", help="вывести полный JSON")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    recognizer = build_recognizer(use_vision=not args.no_vision)
    for photo in args.photos:
        print(f"\n=== {photo} ===")
        result = recognizer.process(photo.read_bytes())
        data = result.data
        print(f"MRZ: источник={data.mrz_source or '-'}, все контрольные суммы={'да' if data.mrz_valid else 'НЕТ'}")
        if data.mrz_line1:
            print(f"  {data.mrz_line1}\n  {data.mrz_line2}")
        for name, label in FIELD_LABELS.items():
            f = data.fields[name]
            extra = ""
            if f.alternative and f.alternative != f.value:
                extra += f"  [другой источник: {f.alternative}]"
            if f.note:
                extra += f"  ({f.note})"
            print(f"  {_MARK[f.status]} {label:<16} {f.value}{extra}")
        for w in data.warnings:
            print(f"  ! {w}")
        print(f"  Резкость: {result.blur:.0f}; лицо найдено: {'да' if result.face_jpeg else 'нет'}")

        if args.json:
            print(json.dumps(data.model_dump(mode="json"), ensure_ascii=False, indent=2))
        if args.save_crops:
            args.save_crops.mkdir(parents=True, exist_ok=True)
            (args.save_crops / f"{photo.stem}_passport.jpg").write_bytes(result.passport_jpeg)
            if result.face_jpeg:
                (args.save_crops / f"{photo.stem}_face.jpg").write_bytes(result.face_jpeg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
