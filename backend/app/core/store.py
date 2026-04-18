"""
Manifest Store + Key Registry.

W produkcji: PostgreSQL + Redis. Tutaj: SQLite + dict, bo 24h.

Dwie tabele:
  1. credentials — zarejestrowane klucze publiczne (per użytkownik / urządzenie)
  2. manifests   — wszystkie podpisane manifesty, indeksowane po hard hash + soft hash

Lookup soft binding: przy weryfikacji zdjęcia/tekstu bez metadanych liczymy
SimHash/pHash i szukamy bliskich w bazie (Hamming <= próg).
"""

from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from .manifest import Manifest


_DB_PATH = Path(__file__).parent.parent / "trustlayer.db"
_lock = threading.RLock()


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def transaction():
    with _lock:
        conn = _conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def init_db() -> None:
    with transaction() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id              TEXT PRIMARY KEY,        -- handle, np. "alice"
            display_name    TEXT NOT NULL,
            avatar          TEXT,                    -- emoji lub URL
            created_at      INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS credentials (
            credential_id       TEXT PRIMARY KEY,    -- WebAuthn credentialId lub nasz syntetyczny
            user_id             TEXT NOT NULL,
            public_key          TEXT NOT NULL,       -- base64url SPKI
            algorithm           TEXT NOT NULL DEFAULT 'ES256',
            device_label        TEXT,                -- "iPhone 15 Pro", "MacBook Touch ID"
            is_hardware_backed  INTEGER NOT NULL DEFAULT 0,
            created_at          INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS manifests (
            id              TEXT PRIMARY KEY,        -- claim.instance_id
            user_id         TEXT,                    -- nullable dla anonimowych
            credential_id   TEXT,
            content_kind    TEXT NOT NULL,           -- 'text' | 'image'
            hard_hash       TEXT NOT NULL,           -- SHA-256
            soft_hash       TEXT,                    -- SimHash (16 hex) lub pHash (16 hex)
            soft_hash_kind  TEXT,                    -- 'simhash64' | 'phash64'
            manifest_json   TEXT NOT NULL,
            created_at      INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_manifests_hard ON manifests(hard_hash);
        CREATE INDEX IF NOT EXISTS idx_manifests_soft ON manifests(soft_hash);
        CREATE INDEX IF NOT EXISTS idx_manifests_user ON manifests(user_id);
        """)


# ---------- Users + Credentials ----------

def upsert_user(user_id: str, display_name: str, avatar: str | None = None) -> None:
    import time
    with transaction() as conn:
        conn.execute("""
            INSERT INTO users (id, display_name, avatar, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,
                                          avatar=excluded.avatar
        """, (user_id, display_name, avatar, int(time.time() * 1000)))


def list_users() -> list[dict]:
    with transaction() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY created_at").fetchall()
        return [dict(r) for r in rows]


def get_user(user_id: str) -> dict | None:
    with transaction() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        return dict(row) if row else None


def register_credential(
    credential_id: str,
    user_id: str,
    public_key: str,
    device_label: str = "",
    is_hardware_backed: bool = False,
    algorithm: str = "ES256",
) -> None:
    import time
    with transaction() as conn:
        conn.execute("""
            INSERT INTO credentials (credential_id, user_id, public_key, algorithm,
                                     device_label, is_hardware_backed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(credential_id) DO UPDATE SET
                public_key=excluded.public_key,
                device_label=excluded.device_label,
                is_hardware_backed=excluded.is_hardware_backed
        """, (credential_id, user_id, public_key, algorithm, device_label,
              int(is_hardware_backed), int(time.time() * 1000)))


def get_credential(credential_id: str) -> dict | None:
    with transaction() as conn:
        row = conn.execute(
            "SELECT * FROM credentials WHERE credential_id=?", (credential_id,)
        ).fetchone()
        return dict(row) if row else None


def list_credentials_for_user(user_id: str) -> list[dict]:
    with transaction() as conn:
        rows = conn.execute(
            "SELECT * FROM credentials WHERE user_id=? ORDER BY created_at", (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]


# ---------- Manifests ----------

def store_manifest(
    manifest: Manifest,
    user_id: str | None,
    content_kind: str,
    hard_hash: str,
    soft_hash: str | None = None,
    soft_hash_kind: str | None = None,
) -> str:
    import time
    if not manifest.claim:
        raise ValueError("Manifest must have a claim before storing")

    mid = manifest.claim.instance_id
    with transaction() as conn:
        conn.execute("""
            INSERT INTO manifests (id, user_id, credential_id, content_kind,
                                   hard_hash, soft_hash, soft_hash_kind,
                                   manifest_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET manifest_json=excluded.manifest_json
        """, (mid, user_id, manifest.claim.signing_credential_id,
              content_kind, hard_hash, soft_hash, soft_hash_kind,
              json.dumps(manifest.to_dict()), int(time.time() * 1000)))
    return mid


def get_manifest_by_hard_hash(hard_hash: str) -> Manifest | None:
    with transaction() as conn:
        row = conn.execute(
            "SELECT manifest_json FROM manifests WHERE hard_hash=? ORDER BY created_at DESC LIMIT 1",
            (hard_hash,)
        ).fetchone()
        if not row:
            return None
        return Manifest.from_dict(json.loads(row["manifest_json"]))


def get_manifest_by_id(manifest_id: str) -> Manifest | None:
    with transaction() as conn:
        row = conn.execute(
            "SELECT manifest_json FROM manifests WHERE id=?", (manifest_id,)
        ).fetchone()
        if not row:
            return None
        return Manifest.from_dict(json.loads(row["manifest_json"]))


def search_by_soft_hash(
    soft_hash: str,
    soft_hash_kind: str,
    max_hamming: int = 6,
) -> list[tuple[Manifest, int]]:
    """Zwraca manifesty których soft_hash jest blisko podanego (Hamming distance)."""
    with transaction() as conn:
        rows = conn.execute(
            "SELECT manifest_json, soft_hash FROM manifests "
            "WHERE soft_hash_kind=? AND soft_hash IS NOT NULL",
            (soft_hash_kind,)
        ).fetchall()

    target = int(soft_hash, 16)
    bits = len(soft_hash) * 4
    hits: list[tuple[Manifest, int]] = []
    for row in rows:
        candidate = int(row["soft_hash"], 16)
        d = bin(target ^ candidate).count("1")
        if d <= max_hamming:
            hits.append((Manifest.from_dict(json.loads(row["manifest_json"])), d))

    hits.sort(key=lambda x: x[1])
    return hits


def list_manifests_for_user(user_id: str, kind: str | None = None) -> list[Manifest]:
    with transaction() as conn:
        if kind:
            rows = conn.execute(
                "SELECT manifest_json FROM manifests WHERE user_id=? AND content_kind=? "
                "ORDER BY created_at DESC",
                (user_id, kind)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT manifest_json FROM manifests WHERE user_id=? ORDER BY created_at DESC",
                (user_id,)
            ).fetchall()
        return [Manifest.from_dict(json.loads(r["manifest_json"])) for r in rows]


def reset_db() -> None:
    """Czyści bazę — używane przy ponownym ładowaniu demo data."""
    if _DB_PATH.exists():
        _DB_PATH.unlink()
    init_db()
