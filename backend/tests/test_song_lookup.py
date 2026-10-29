import pytest

from app.services import song_lookup


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    monkeypatch.delenv("GETSONGBPM_API_KEY", raising=False)
    yield
    song_lookup.set_fetch(None)


def test_without_api_key_search_is_off(client):
    r = client.get("/api/song-search", params={"q": "wonderwall"})
    assert r.status_code == 200
    body = r.json()
    assert body["configured"] is False
    assert body["source"] == "GetSongBPM.com"
    assert body["results"] == []
    assert "hooktheory" in body


def test_query_is_validated(client):
    assert client.get("/api/song-search", params={"q": "a"}).status_code == 422
    assert client.get("/api/song-search").status_code == 422


@pytest.mark.parametrize("raw,want", [
    ("C", "C"), ("Am", "Am"), ("F♯m", "F♯m"), ("F#m", "F♯m"), ("Bb", "B♭"), ("Eb minor", "E♭m"),
    ("A major", "A"), ("c#m", "C♯m"), ("Dmin", "Dm"), ("H", None), ("", None), (None, None), (7, None),
])
def test_normalise_key(raw, want):
    assert song_lookup.normalise_key(raw) == want


def test_search_parses_results_fills_missing_keys_and_caches(client, monkeypatch):
    monkeypatch.setenv("GETSONGBPM_API_KEY", "test-key")
    calls = []

    def fake(url, headers):
        calls.append(url)
        assert headers["X-API-KEY"] == "test-key"
        if "/search/" in url:
            assert "lookup=hey+there" in url and "type=song" in url
            return {"search": [
                {"id": "a1", "title": "Hey There", "artist": {"name": "Band One"}, "tempo": "96", "key_of": "G", "time_sig": "4/4", "uri": "https://getsongbpm.com/song/a1"},
                {"id": "b2", "title": "Hey There (Live)", "artist": [{"name": "Band Two"}], "tempo": None},
                {"title": ""},
            ]}
        assert "/song/" in url and "id=b2" in url
        return {"song": {"id": "b2", "title": "Hey There (Live)", "tempo": 101, "key_of": "F#m"}}

    song_lookup.set_fetch(fake)
    r = client.get("/api/song-search", params={"q": "  hey   there "})
    assert r.status_code == 200
    body = r.json()
    assert body["configured"] is True
    assert body["results"] == [
        {"id": "a1", "title": "Hey There", "artist": "Band One", "key": "G", "tempo": 96, "time_sig": "4/4", "uri": "https://getsongbpm.com/song/a1"},
        {"id": "b2", "title": "Hey There (Live)", "artist": "Band Two", "key": "F♯m", "tempo": 101, "time_sig": None, "uri": None},
    ]
    n = len(calls)
    client.get("/api/song-search", params={"q": "Hey There"})
    assert len(calls) == n  # cached


def test_no_results_and_errors(client, monkeypatch):
    monkeypatch.setenv("GETSONGBPM_API_KEY", "k")
    song_lookup.set_fetch(lambda url, h: {"search": {"error": "no result"}})
    assert client.get("/api/song-search", params={"q": "zzzz"}).json()["results"] == []

    def boom(url, h):
        raise song_lookup.LookupError("Couldn't reach the song key service.")

    song_lookup.set_fetch(boom)
    r = client.get("/api/song-search", params={"q": "anything"})
    assert r.status_code == 502
    assert "Couldn't reach" in r.json()["detail"]
