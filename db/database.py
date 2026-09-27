"""Учёт заявок в SQLite.

Персональные данные (ФИО, паспорт, контакты) хранятся в колонке data_enc в
зашифрованном виде. Открыто лежат только служебные поля: id, статус, даты, пути к
зашифрованным файлам.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Iterator

from db.storage import SecureStorage


class Status(str, Enum):
    RECOGNIZED = "recognized"        # распознан
    CONFIRMED = "confirmed"          # подтверждён оператором
    FILLING = "filling"              # идёт заполнение
    FILLED = "filled"                # заполнен
    AWAITING_PAYMENT = "awaiting_payment"  # ожидает оплаты
    ERROR = "error"                  # ошибка
    CANCELLED = "cancelled"          # отменён


STATUS_LABELS = {
    Status.RECOGNIZED: "распознан",
    Status.CONFIRMED: "подтверждён",
    Status.FILLING: "заполняется",
    Status.FILLED: "заполнен",
    Status.AWAITING_PAYMENT: "ожидает оплаты",
    Status.ERROR: "ошибка",
    Status.CANCELLED: "отменён",
}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS applications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id        TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    data_enc        BLOB,
    error           TEXT NOT NULL DEFAULT '',
    purged          INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id  INTEGER NOT NULL REFERENCES applications(id),
    kind            TEXT NOT NULL,         -- photo_original / passport / face / screenshot / debug_html
    path            TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    deleted         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_files_app ON files(application_id);
"""


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


@dataclass
class Application:
    id: int
    group_id: str
    status: Status
    created_at: str
    updated_at: str
    data: dict = field(default_factory=dict)  # расшифрованные данные: passport, trip, contacts
    error: str = ""

    @property
    def client_name(self) -> str:
        fields = self.data.get("passport", {}).get("fields", {})
        surname = fields.get("surname", {}).get("value", "")
        given = fields.get("given_names", {}).get("value", "")
        return f"{surname} {given}".strip() or "(без имени)"

    @property
    def passport_number(self) -> str:
        return (self.data.get("passport", {}).get("fields", {})
                .get("passport_number", {}).get("value", ""))


class Database:
    def __init__(self, path: Path, storage: SecureStorage):
        self.path = path
        self.storage = storage
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as conn:
            conn.executescript(_SCHEMA)

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _encrypt(self, data: dict) -> bytes:
        return self.storage.encrypt(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _decrypt(self, blob: bytes | None) -> dict:
        if not blob:
            return {}
        return json.loads(self.storage.decrypt(blob).decode("utf-8"))

    def _row_to_app(self, row: sqlite3.Row) -> Application:
        return Application(id=row["id"], group_id=row["group_id"], status=Status(row["status"]),
                           created_at=row["created_at"], updated_at=row["updated_at"],
                           data=self._decrypt(row["data_enc"]), error=row["error"])

    # --- заявки ---
    def create(self, data: dict, group_id: str = "", status: Status = Status.RECOGNIZED) -> int:
        now = _now()
        with self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO applications (group_id, status, created_at, updated_at, data_enc) "
                "VALUES (?, ?, ?, ?, ?)",
                (group_id, status.value, now, now, self._encrypt(data)))
            return int(cur.lastrowid)

    def get(self, app_id: int) -> Application | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM applications WHERE id = ?", (app_id,)).fetchone()
        return self._row_to_app(row) if row else None

    def update_data(self, app_id: int, data: dict) -> None:
        with self._conn() as conn:
            conn.execute("UPDATE applications SET data_enc = ?, updated_at = ? WHERE id = ?",
                         (self._encrypt(data), _now(), app_id))

    def set_status(self, app_id: int, status: Status, error: str = "") -> None:
        with self._conn() as conn:
            conn.execute("UPDATE applications SET status = ?, error = ?, updated_at = ? WHERE id = ?",
                         (status.value, error, _now(), app_id))

    def list_recent(self, limit: int = 30, status: Status | None = None) -> list[Application]:
        query = "SELECT * FROM applications"
        params: tuple = ()
        if status is not None:
            query += " WHERE status = ?"
            params = (status.value,)
        query += " ORDER BY id DESC LIMIT ?"
        with self._conn() as conn:
            rows = conn.execute(query, params + (limit,)).fetchall()
        return [self._row_to_app(r) for r in rows]

    def list_group(self, group_id: str) -> list[Application]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM applications WHERE group_id = ? ORDER BY id",
                                (group_id,)).fetchall()
        return [self._row_to_app(r) for r in rows]

    # --- файлы ---
    def add_file(self, app_id: int, kind: str, data: bytes, ext: str = "jpg") -> str:
        rel = self.storage.save(data, app_id, kind, ext)
        with self._conn() as conn:
            conn.execute("INSERT INTO files (application_id, kind, path, created_at) VALUES (?, ?, ?, ?)",
                         (app_id, kind, rel, _now()))
        return rel

    def files(self, app_id: int, kind: str | None = None) -> list[sqlite3.Row]:
        query = "SELECT * FROM files WHERE application_id = ? AND deleted = 0"
        params: tuple = (app_id,)
        if kind:
            query += " AND kind = ?"
            params += (kind,)
        with self._conn() as conn:
            return conn.execute(query + " ORDER BY id", params).fetchall()

    def load_file(self, app_id: int, kind: str) -> bytes | None:
        rows = self.files(app_id, kind)
        return self.storage.load(rows[-1]["path"]) if rows else None

    # --- срок хранения ---
    def purge_expired(self, days: int) -> tuple[int, int]:
        """Удаляет файлы старше N дней и стирает персональные данные у закрытых заявок.

        Возвращает (удалено файлов, очищено заявок).
        """
        cutoff = (datetime.now() - timedelta(days=days)).isoformat(timespec="seconds")
        removed_files = 0
        with self._conn() as conn:
            for row in conn.execute("SELECT id, path FROM files WHERE deleted = 0 AND created_at < ?",
                                    (cutoff,)).fetchall():
                self.storage.delete(row["path"])
                conn.execute("UPDATE files SET deleted = 1 WHERE id = ?", (row["id"],))
                removed_files += 1
            cur = conn.execute(
                "UPDATE applications SET data_enc = NULL, purged = 1 "
                "WHERE purged = 0 AND updated_at < ? AND status IN (?, ?, ?)",
                (cutoff, Status.AWAITING_PAYMENT.value, Status.CANCELLED.value, Status.ERROR.value))
            purged = cur.rowcount
        # На случай «осиротевших» файлов, не записанных в БД
        removed_files += self.storage.purge_older_than(days)
        return removed_files, purged
