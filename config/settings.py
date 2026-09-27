"""Настройки проекта. Все секреты читаются из файла .env в корне проекта."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"

load_dotenv(PROJECT_ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    return int(raw) if raw else default


def _env_float(name: str, default: float) -> float:
    raw = _env(name)
    return float(raw) if raw else default


def _resolve(path_str: str) -> Path:
    path = Path(path_str)
    return path if path.is_absolute() else PROJECT_ROOT / path


@dataclass(frozen=True)
class Settings:
    telegram_bot_token: str
    telegram_admin_id: int
    anthropic_api_key: str
    claude_model: str
    file_encryption_key: str
    retention_days: int
    data_dir: Path
    tesseract_cmd: str
    tessdata_dir: str
    portal_url: str
    browser_profile_dir: Path
    action_delay_min: float
    action_delay_max: float
    portal_photo_max_kb: int
    portal_passport_max_kb: int

    @property
    def db_path(self) -> Path:
        return self.data_dir / "applications.sqlite3"

    @property
    def files_dir(self) -> Path:
        return self.data_dir / "files"

    @property
    def debug_dir(self) -> Path:
        return self.data_dir / "debug"

    @property
    def form_map_path(self) -> Path:
        return CONFIG_DIR / "form_map.yaml"

    @property
    def dictionaries_path(self) -> Path:
        return CONFIG_DIR / "dictionaries.yaml"


def load_settings() -> Settings:
    admin_id = _env("TELEGRAM_ADMIN_ID")
    return Settings(
        telegram_bot_token=_env("TELEGRAM_BOT_TOKEN"),
        telegram_admin_id=int(admin_id) if admin_id else 0,
        anthropic_api_key=_env("ANTHROPIC_API_KEY"),
        claude_model=_env("CLAUDE_MODEL", "claude-opus-5"),
        file_encryption_key=_env("FILE_ENCRYPTION_KEY"),
        retention_days=_env_int("RETENTION_DAYS", 14),
        data_dir=_resolve(_env("DATA_DIR", "data")),
        tesseract_cmd=_env("TESSERACT_CMD"),
        tessdata_dir=_env("TESSDATA_DIR"),
        portal_url=_env("PORTAL_URL"),
        browser_profile_dir=_resolve(_env("BROWSER_PROFILE_DIR", "browser_profile")),
        action_delay_min=_env_float("ACTION_DELAY_MIN", 0.6),
        action_delay_max=_env_float("ACTION_DELAY_MAX", 1.8),
        portal_photo_max_kb=_env_int("PORTAL_PHOTO_MAX_KB", 200),
        portal_passport_max_kb=_env_int("PORTAL_PASSPORT_MAX_KB", 500),
    )


settings = load_settings()
