"""Online song key lookup (GetSongBPM API).

Search a song title, get its key, tempo and time signature. The API is free but needs a key
(register at https://getsongbpm.com/api) and a visible link back to GetSongBPM.com, which the
song search page shows. Set it as the GETSONGBPM_API_KEY environment variable; without it the
search page still works from its built-in songbook.

Chords are not available from any free API, so this returns keys only; the frontend derives the
scale and the chords that belong to the key.
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from typing import Any, Callable, Optional

# Docs (2024+): https://api.getsong.co — older getsongbpm.com host still redirects.
API_BASE = "https://api.getsong.co"
SOURCE = "GetSongBPM.com"
TIMEOUT_S = 6.0
CACHE_SIZE = 256
CACHE_TTL_S = 24 * 3600
MAX_RESULTS = 8
DETAIL_LOOKUPS = 4  # search hits without a key get a /song/ lookup, up to this many


class LookupError(Exception):
    """The online service couldn't be reached or returned an error."""


Fetch = Callable[[str, dict[str, str]], Any]


def _http_get_json(url: str, headers: dict[str, str]) -> Any:
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:  # noqa: S310 - fixed https host
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise LookupError(f"The song key service answered {e.code}.") from e
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise LookupError("Couldn't reach the song key service.") from e
    except json.JSONDecodeError as e:
        raise LookupError("The song key service sent something unexpected.") from e


_fetch: Fetch = _http_get_json
_cache: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
_lock = threading.Lock()


def set_fetch(fn: Optional[Fetch]) -> None:
    """Tests swap the HTTP call for a fake; None restores the real one. Clears the cache."""
    global _fetch
    _fetch = fn or _http_get_json
    with _lock:
        _cache.clear()


def api_key() -> str:
    return os.environ.get("GETSONGBPM_API_KEY", "").strip()


# ------------------------------------------------------------------ parsing
_KEY_RE = re.compile(r"^\s*([A-Ga-g])\s*(#|♯|b|♭)?\s*(m(?:in(?:or)?)?|maj(?:or)?)?\s*$", re.IGNORECASE)


def normalise_key(raw: Any) -> Optional[str]:
    """'F♯m', 'Bb', 'C# minor', 'A major' → 'F♯m', 'B♭', 'C♯m', 'A'. Unknown → None."""
    if not isinstance(raw, str):
        return None
    m = _KEY_RE.match(raw)
    if not m:
        return None
    letter, acc, mode = m.group(1).upper(), m.group(2) or "", (m.group(3) or "").lower()
    acc = {"#": "♯", "♯": "♯", "b": "♭", "♭": "♭"}.get(acc, "")
    minor = mode.startswith("m") and not mode.startswith("maj")
    return f"{letter}{acc}{'m' if minor else ''}"


def _items(payload: Any, field: str) -> list[dict]:
    """The API wraps results as {"search": [...]} / {"song": {...}}; tolerate a bare list too."""
    if isinstance(payload, dict):
        payload = payload.get(field, payload)
    if isinstance(payload, dict):
        if "error" in payload:
            return []
        return [payload]
    if isinstance(payload, list):
        return [p for p in payload if isinstance(p, dict)]
    return []


def _artist(item: dict) -> str:
    a = item.get("artist")
    if isinstance(a, list):
        a = a[0] if a else None
    if isinstance(a, dict):
        return str(a.get("name") or "")
    return str(a or "")


def _num(v: Any) -> Optional[int]:
    try:
        n = int(round(float(v)))
        return n if 20 <= n <= 320 else None
    except (TypeError, ValueError):
        return None


def _song(item: dict) -> dict:
    ts = item.get("time_sig")
    return {
        "id": str(item.get("id") or ""),
        "title": str(item.get("title") or "").strip(),
        "artist": _artist(item).strip(),
        "key": normalise_key(item.get("key_of")),
        "tempo": _num(item.get("tempo")),
        "time_sig": str(ts) if ts not in (None, "") else None,
        "uri": item.get("uri") if isinstance(item.get("uri"), str) else None,
    }


# ------------------------------------------------------------------ search
def search(query: str) -> dict:
    """{configured, source, results: [{id, title, artist, key, tempo, time_sig, uri}]}."""
    q = " ".join(query.split())
    key = api_key()
    if not key:
        return {"configured": False, "source": SOURCE, "results": []}
    cache_key = q.lower()
    now = time.time()
    with _lock:
        hit = _cache.get(cache_key)
        if hit and now - hit[0] < CACHE_TTL_S:
            _cache.move_to_end(cache_key)
            return hit[1]

    headers = {"X-API-KEY": key, "Accept": "application/json", "User-Agent": "MusicDecoder/0.2"}
    url = f"{API_BASE}/search/?" + urllib.parse.urlencode({"api_key": key, "type": "song", "lookup": q, "limit": MAX_RESULTS})
    songs = [_song(i) for i in _items(_fetch(url, headers), "search")]
    songs = [s for s in songs if s["title"]][:MAX_RESULTS]

    # Search hits may leave out the key: ask for the song's details (a few, to stay under rate limits).
    for s in [s for s in songs if not s["key"] and s["id"]][:DETAIL_LOOKUPS]:
        try:
            detail = _items(_fetch(f"{API_BASE}/song/?" + urllib.parse.urlencode({"api_key": key, "id": s["id"]}), headers), "song")
        except LookupError:
            continue
        if detail:
            d = _song(detail[0])
            s.update({k: v for k, v in d.items() if v and not s.get(k)})

    result = {"configured": True, "source": SOURCE, "results": songs}
    with _lock:
        _cache[cache_key] = (now, result)
        while len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)
    return result
