"""Load backend/.env into os.environ (no python-dotenv dependency).

Existing process env wins — so GETSONGBPM_API_KEY=… uvicorn still overrides the file.
"""
from __future__ import annotations

import os
from pathlib import Path

_LOADED = False


def load_env(path: Path | None = None) -> Path | None:
    global _LOADED
    if _LOADED:
        return None
    _LOADED = True
    env_path = path or Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return None
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        if not key or key in os.environ:
            continue
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        os.environ[key] = val
    return env_path
