"""SQLite persistence for arrangements, practice sessions and preferences (no accounts)."""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from pathlib import Path

from ..schemas import Arrangement, PracticeSession, UserPreferences

_DEFAULT_DB = Path(__file__).resolve().parents[2] / "data" / "music_decoder.sqlite3"


class Storage:
    def __init__(self, path: str | os.PathLike | None = None):
        self.path = str(path or os.environ.get("MUSIC_DECODER_DB", _DEFAULT_DB))
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS arrangements (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS practice_sessions (
                id TEXT PRIMARY KEY, arrangement_id TEXT NOT NULL, created_at TEXT NOT NULL, body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL);
            """
        )
        self._conn.commit()

    def save_arrangement(self, arr: Arrangement) -> None:
        with self._lock:
            self._conn.execute("INSERT OR REPLACE INTO arrangements VALUES (?, ?, ?, ?)",
                               (arr.id, arr.title, arr.created_at, arr.model_dump_json()))
            self._conn.commit()

    def get_arrangement(self, arr_id: str) -> Arrangement | None:
        with self._lock:
            row = self._conn.execute("SELECT body FROM arrangements WHERE id = ?", (arr_id,)).fetchone()
        return Arrangement.model_validate_json(row[0]) if row else None

    def list_arrangements(self) -> list[dict]:
        with self._lock:
            rows = self._conn.execute("SELECT body FROM arrangements ORDER BY created_at DESC").fetchall()
        out = []
        for (body,) in rows:
            d = json.loads(body)
            out.append({"id": d["id"], "title": d["title"], "created_at": d["created_at"], "key": d["key"]["name"],
                        "tempo_bpm": d["tempo_bpm"], "total_bars": d["total_bars"], "skill_level": d["skill_level"],
                        "style": d["style"], "harmonization": d["harmonization"]["label"],
                        "source": d["original_melody"]["source"]})
        return out

    def rename_arrangement(self, arr_id: str, title: str) -> Arrangement | None:
        arr = self.get_arrangement(arr_id)
        if not arr:
            return None
        arr = arr.model_copy(update={"title": title})
        self.save_arrangement(arr)
        return arr

    def delete_arrangement(self, arr_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute("DELETE FROM arrangements WHERE id = ?", (arr_id,))
            self._conn.execute("DELETE FROM practice_sessions WHERE arrangement_id = ?", (arr_id,))
            self._conn.commit()
        return cur.rowcount > 0

    def save_session(self, s: PracticeSession) -> None:
        with self._lock:
            self._conn.execute("INSERT INTO practice_sessions VALUES (?, ?, ?, ?)",
                               (s.id, s.result.arrangement_id, s.created_at, s.model_dump_json()))
            self._conn.commit()

    def list_sessions(self, arrangement_id: str | None = None) -> list[PracticeSession]:
        with self._lock:
            if arrangement_id:
                rows = self._conn.execute(
                    "SELECT body FROM practice_sessions WHERE arrangement_id = ? ORDER BY created_at",
                    (arrangement_id,)).fetchall()
            else:
                rows = self._conn.execute("SELECT body FROM practice_sessions ORDER BY created_at").fetchall()
        return [PracticeSession.model_validate_json(r[0]) for r in rows]

    def get_preferences(self) -> UserPreferences:
        with self._lock:
            row = self._conn.execute("SELECT body FROM preferences WHERE id = 1").fetchone()
        return UserPreferences.model_validate_json(row[0]) if row else UserPreferences()

    def save_preferences(self, p: UserPreferences) -> None:
        with self._lock:
            self._conn.execute("INSERT OR REPLACE INTO preferences VALUES (1, ?)", (p.model_dump_json(),))
            self._conn.commit()
