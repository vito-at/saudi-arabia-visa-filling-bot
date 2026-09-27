"""База заявок (SQLite) и зашифрованное файловое хранилище."""

from db.database import STATUS_LABELS, Application, Database, Status
from db.storage import SecureStorage, StorageError


def open_database() -> Database:
    """Открывает БД и хранилище по настройкам из .env."""
    from config import settings

    storage = SecureStorage(settings.files_dir, settings.file_encryption_key)
    return Database(settings.db_path, storage)


__all__ = ["STATUS_LABELS", "Application", "Database", "SecureStorage", "Status", "StorageError",
           "open_database"]
