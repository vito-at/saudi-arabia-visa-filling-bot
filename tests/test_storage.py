import os
import time

import pytest
from cryptography.fernet import Fernet

from db.database import Database, Status
from db.storage import SecureStorage, StorageError


@pytest.fixture()
def db(tmp_path):
    storage = SecureStorage(tmp_path / "files", Fernet.generate_key().decode())
    return Database(tmp_path / "app.sqlite3", storage)


def test_files_encrypted_on_disk(db):
    app_id = db.create({"passport": {"fields": {"surname": {"value": "TOSHMATOV"}}}})
    rel = db.add_file(app_id, "passport", b"\xff\xd8JPEGDATA")
    raw = (db.storage.root / rel).read_bytes()
    assert b"JPEGDATA" not in raw
    assert db.load_file(app_id, "passport") == b"\xff\xd8JPEGDATA"


def test_db_personal_data_encrypted(db):
    app_id = db.create({"passport": {"fields": {"surname": {"value": "TOSHMATOV"}}}})
    assert b"TOSHMATOV" not in db.path.read_bytes()
    app = db.get(app_id)
    assert app.client_name == "TOSHMATOV"
    db.set_status(app_id, Status.CONFIRMED)
    assert db.get(app_id).status == Status.CONFIRMED


def test_wrong_key_fails(tmp_path):
    s1 = SecureStorage(tmp_path, Fernet.generate_key().decode())
    s2 = SecureStorage(tmp_path, Fernet.generate_key().decode())
    rel = s1.save(b"secret", 1, "face")
    with pytest.raises(StorageError):
        s2.load(rel)


def test_path_traversal_blocked(db):
    with pytest.raises(StorageError):
        db.storage.load("../../etc/passwd")


def test_purge_old_files(db):
    app_id = db.create({})
    rel = db.add_file(app_id, "face", b"x")
    path = db.storage.root / rel
    old = time.time() - 30 * 86400
    os.utime(path, (old, old))
    assert db.storage.purge_older_than(14) == 1
    assert not path.exists()
