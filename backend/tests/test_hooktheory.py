from app.services import hooktheory


def setup_function():
    hooktheory.set_fetch(None)


def test_not_configured(monkeypatch):
    monkeypatch.delenv("HOOKTHEORY_USERNAME", raising=False)
    monkeypatch.delenv("HOOKTHEORY_PASSWORD", raising=False)
    assert hooktheory.configured() is False
    assert hooktheory.examples_for_mode("major") == {"configured": False, "progressions": []}


def test_examples_auth_and_songs(monkeypatch):
    monkeypatch.setenv("HOOKTHEORY_USERNAME", "u")
    monkeypatch.setenv("HOOKTHEORY_PASSWORD", "p")
    calls = []

    def fake(method, url, headers, body):
        calls.append((method, url))
        if url.endswith("/users/auth"):
            assert method == "POST"
            assert b'"username": "u"' in body
            return {"id": 1, "username": "u", "activkey": "tok-abc"}
        assert method == "GET"
        assert headers["Authorization"] == "Bearer tok-abc"
        assert "trends/songs" in url
        if "1%2C5%2C6%2C4" in url or "cp=1,5,6,4" in url:
            return [
                {"artist": "Adele", "song": "Someone Like You", "section": "Chorus",
                 "url": "https://www.hooktheory.com/theorytab/view/adele/someone-like-you#chorus"},
                {"artist": "X", "song": ""},
            ]
        return []

    hooktheory.set_fetch(fake)
    out = hooktheory.examples_for_mode("major")
    assert out["configured"] is True
    assert out["source"] == "Hooktheory TheoryTab"
    first = out["progressions"][0]
    assert first["cp"] == "1,5,6,4"
    assert first["label"] == "I–V–vi–IV"
    assert first["songs"] == [{
        "song": "Someone Like You", "artist": "Adele", "section": "Chorus",
        "url": "https://www.hooktheory.com/theorytab/view/adele/someone-like-you#chorus",
    }]
    assert any("/users/auth" in u for _, u in calls)
