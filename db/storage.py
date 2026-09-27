"""Зашифрованное хранилище файлов (фото паспортов, лиц, скриншоты).

Файлы на диске лежат только в зашифрованном виде (*.enc, Fernet = AES-128-CBC + HMAC).
Расшифровка происходит в памяти: для OCR, отправки в Telegram и загрузки на портал
(Playwright умеет загружать файл из байтов, без записи на диск).

Сгенерировать ключ:  python -m db.keygen
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

log = logging.getLogger(__name__)


class StorageError(RuntimeError):
    pass


class SecureStorage:
    def __init__(self, root: Path, key: str):
        if not key:
            raise StorageError("FILE_ENCRYPTION_KEY не задан в .env. "
                               "Сгенерируйте: python -m db.keygen")
        try:
            self._fernet = Fernet(key.encode())
        except ValueError as exc:
            raise StorageError("FILE_ENCRYPTION_KEY имеет неверный формат") from exc
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        _restrict_dir(self.root)

    # --- данные в памяти ---
    def encrypt(self, data: bytes) -> bytes:
        return self._fernet.encrypt(data)

    def decrypt(self, token: bytes) -> bytes:
        try:
            return self._fernet.decrypt(token)
        except InvalidToken as exc:
            raise StorageError("Не удалось расшифровать: неверный ключ или файл повреждён") from exc

    # --- файлы ---
    def save(self, data: bytes, application_id: int, kind: str, ext: str = "jpg") -> str:
        """Сохраняет файл зашифрованным. Возвращает относительный путь для записи в БД."""
        folder = self.root / f"app_{application_id}"
        folder.mkdir(parents=True, exist_ok=True)
        name = f"{kind}_{int(time.time())}_{uuid.uuid4().hex[:8]}.{ext}.enc"
        path = folder / name
        path.write_bytes(self.encrypt(data))
        return str(path.relative_to(self.root))

    def load(self, rel_path: str) -> bytes:
        path = self._safe_path(rel_path)
        if not path.exists():
            raise StorageError(f"Файл не найден (возможно, удалён по сроку хранения): {rel_path}")
        return self.decrypt(path.read_bytes())

    def delete(self, rel_path: str) -> None:
        path = self._safe_path(rel_path)
        if path.exists():
            _wipe(path)

    def purge_older_than(self, days: int) -> int:
        """Удаляет файлы старше N дней. Возвращает количество удалённых."""
        cutoff = time.time() - days * 86400
        removed = 0
        for path in self.root.rglob("*.enc"):
            if path.stat().st_mtime < cutoff:
                _wipe(path)
                removed += 1
        for folder in sorted(self.root.glob("app_*"), reverse=True):
            if folder.is_dir() and not any(folder.iterdir()):
                folder.rmdir()
        return removed

    def _safe_path(self, rel_path: str) -> Path:
        path = (self.root / rel_path).resolve()
        if self.root.resolve() not in path.parents:
            raise StorageError("Недопустимый путь к файлу")
        return path


def _wipe(path: Path) -> None:
    """Перезаписывает файл нулями и удаляет (на SSD не гарантирует, но файл и так зашифрован)."""
    try:
        size = path.stat().st_size
        with open(path, "r+b") as fh:
            fh.write(b"\0" * size)
            fh.flush()
            os.fsync(fh.fileno())
    except OSError:
        pass
    path.unlink(missing_ok=True)


def _restrict_dir(path: Path) -> None:
    """На Linux/macOS — доступ только владельцу. На Windows права задаются через icacls (см. README)."""
    if os.name != "nt":
        try:
            os.chmod(path, 0o700)
        except OSError:
            log.warning("Не удалось ограничить права на %s", path)
