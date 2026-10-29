"""Hooktheory Trends API — songs that use a chord progression (TheoryTab links).

Docs: https://www.hooktheory.com/api/trends/docs
Auth: POST /v1/users/auth with HOOKTHEORY_USERNAME + HOOKTHEORY_PASSWORD → Bearer activkey
       (token lasts about an hour; we refresh on 401).

This API does not search by song title. Title/key/tempo search is GetSongBPM; Hooktheory
adds TheoryTab examples for common progressions in the song's key.
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from typing import Any, Callable, Optional

API_BASE = "https://api.hooktheory.com/v1"
TIMEOUT_S = 8.0
CACHE_SIZE = 128
CACHE_TTL_S = 6 * 3600
TOKEN_SKEW_S = 50 * 60  # re-auth before the ~1h expiry
MAX_SONGS = 12

# Common progressions as Hooktheory child_path (scale-degree IDs).
# With scale=minor, "1" is the minor tonic (i), "7" is ♭VII, etc.
PROGRESSIONS: dict[str, list[tuple[str, str]]] = {
    "major": [
        ("1,5,6,4", "I–V–vi–IV"),
        ("1,6,4,5", "I–vi–IV–V"),
        ("1,4,5,1", "I–IV–V–I"),
        ("2,5,1", "ii–V–I"),
    ],
    "minor": [
        ("1,7,6,7", "i–VII–VI–VII"),
        ("1,6,3,7", "i–VI–III–VII"),
        ("1,4,5", "i–iv–V"),
        ("1,7,4,6", "i–VII–iv–VI"),
    ],
}


class HooktheoryError(Exception):
    """Auth or HTTP failure talking to Hooktheory."""


Fetch = Callable[[str, str, dict[str, str], Optional[bytes]], Any]  # method, url, headers, body


def _http(method: str, url: str, headers: dict[str, str], body: Optional[bytes] = None) -> Any:
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:  # noqa: S310
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:200]
        raise HooktheoryError(f"Hooktheory answered {e.code}: {detail}") from e
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise HooktheoryError("Couldn't reach Hooktheory.") from e
    except json.JSONDecodeError as e:
        raise HooktheoryError("Hooktheory sent something unexpected.") from e


_fetch: Fetch = _http
_cache: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()
_lock = threading.Lock()
_token: Optional[str] = None
_token_at = 0.0


def set_fetch(fn: Optional[Fetch]) -> None:
    global _fetch, _token, _token_at
    _fetch = fn or _http
    with _lock:
        _cache.clear()
        _token = None
        _token_at = 0.0


def configured() -> bool:
    return bool(os.environ.get("HOOKTHEORY_USERNAME", "").strip() and os.environ.get("HOOKTHEORY_PASSWORD", "").strip())


def _auth(force: bool = False) -> str:
    global _token, _token_at
    with _lock:
        if not force and _token and time.time() - _token_at < TOKEN_SKEW_S:
            return _token
    user = os.environ.get("HOOKTHEORY_USERNAME", "").strip()
    password = os.environ.get("HOOKTHEORY_PASSWORD", "").strip()
    if not user or not password:
        raise HooktheoryError("Hooktheory is not configured.")
    body = json.dumps({"username": user, "password": password}).encode("utf-8")
    data = _fetch(
        "POST",
        f"{API_BASE}/users/auth",
        {"Accept": "application/json", "Content-Type": "application/json", "User-Agent": "MusicDecoder/0.2"},
        body,
    )
    if not isinstance(data, dict) or not data.get("activkey"):
        raise HooktheoryError("Hooktheory login failed.")
    with _lock:
        _token = str(data["activkey"])
        _token_at = time.time()
        return _token


def _get(path: str, params: dict[str, str], retry: bool = True) -> Any:
    token = _auth()
    url = f"{API_BASE}/{path.lstrip('/')}?" + urllib.parse.urlencode(params)
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "MusicDecoder/0.2",
    }
    try:
        return _fetch("GET", url, headers, None)
    except HooktheoryError as e:
        if retry and "401" in str(e):
            _auth(force=True)
            return _get(path, params, retry=False)
        raise


def songs_for_progression(cp: str, scale: str = "major", page: int = 1) -> list[dict]:
    """Songs on TheoryTab that use this chord path. scale: major | minor | …"""
    cache_key = f"songs:{scale}:{cp}:{page}"
    now = time.time()
    with _lock:
        hit = _cache.get(cache_key)
        if hit and now - hit[0] < CACHE_TTL_S:
            _cache.move_to_end(cache_key)
            return hit[1]

    raw = _get("trends/songs", {"cp": cp, "page": str(page), "scale": scale})
    out: list[dict] = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            song = str(item.get("song") or "").strip()
            artist = str(item.get("artist") or "").strip()
            if not song:
                continue
            out.append({
                "song": song,
                "artist": artist,
                "section": str(item.get("section") or "").strip() or None,
                "url": item.get("url") if isinstance(item.get("url"), str) else None,
            })
    out = out[:MAX_SONGS]
    with _lock:
        _cache[cache_key] = (now, out)
        while len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)
    return out


def examples_for_mode(mode: str) -> dict:
    """{configured, progressions: [{cp, label, songs: [...]}]} for major or minor."""
    if not configured():
        return {"configured": False, "progressions": []}
    scale = "minor" if mode == "minor" else "major"
    rows = []
    for cp, label in PROGRESSIONS.get(scale, []):
        try:
            songs = songs_for_progression(cp, scale=scale)
        except HooktheoryError:
            songs = []
        rows.append({"cp": cp, "label": label, "songs": songs})
    return {"configured": True, "source": "Hooktheory TheoryTab", "progressions": rows}
