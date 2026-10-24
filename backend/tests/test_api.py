"""Integration tests for the audio-analysis and arrangement endpoints."""
import shutil
import subprocess
import time

import numpy as np
import pytest

from app.music.fixtures import DEMO_MELODY
from app.music.theory import name_to_midi
from app.services.storage import Storage
from app import main
from tests.audio_synth import synth_hum, to_wav_bytes

DEMO_MIDIS = [name_to_midi(n) for bar in DEMO_MELODY for n in bar]


def _upload(client, data: bytes, name="hum.wav", wait=True):
    return client.post(f"/api/transcribe?wait={'true' if wait else 'false'}",
                       files={"file": (name, data, "audio/wav")}, data={"source": "recording"})


@pytest.fixture(scope="module")
def demo_wav():
    return to_wav_bytes(synth_hum(DEMO_MIDIS, 80))


# 10. Melody note timing (+ pitch) from real audio analysis
def test_transcribe_synthetic_hum(client, demo_wav):
    r = _upload(client, demo_wav)
    assert r.status_code == 200, r.text
    mel = r.json()["result"]
    assert [n["midi"] for n in mel["notes"]] == DEMO_MIDIS
    assert mel["tempo_bpm"] == pytest.approx(80, abs=2)
    assert [n["start_beat"] for n in mel["notes"]] == [float(i) for i in range(16)]
    assert all(n["duration_beats"] == 1.0 for n in mel["notes"][:-1])
    assert mel["key_candidates"][0]["name"] == "C major"
    assert all(not n["low_confidence"] for n in mel["notes"])
    assert mel["contour"]["times"] and len(mel["contour"]["times"]) == len(mel["contour"]["midi"])


def test_transcribe_detuned_whistle_range():
    # whistling: higher octave, pure tone, 30 cents sharp
    mids = [m + 12 for m in DEMO_MIDIS[:8]]
    y = synth_hum(mids, 100, harmonics=(1.0,), detune_cents=30, vibrato_cents=8)
    from app.services.transcription import transcribe_audio
    mel = transcribe_audio(to_wav_bytes(y), "w.wav")
    assert [n.midi for n in mel.notes] == mids
    assert mel.tuning_offset_cents == pytest.approx(30, abs=8)


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_transcribe_webm_opus_via_ffmpeg(client, demo_wav, tmp_path):
    src, dst = tmp_path / "in.wav", tmp_path / "out.webm"
    src.write_bytes(demo_wav)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-c:a", "libopus", str(dst)], check=True)
    r = _upload(client, dst.read_bytes(), "recording.webm")
    assert r.status_code == 200, r.text
    assert [n["midi"] for n in r.json()["result"]["notes"]] == DEMO_MIDIS


def test_async_job_reports_stages(client, demo_wav):
    r = _upload(client, demo_wav, wait=False)
    assert r.status_code == 200
    job_id = r.json()["id"]
    seen, deadline = set(), time.time() + 60
    while time.time() < deadline:
        j = client.get(f"/api/jobs/{job_id}").json()
        seen.add(j["stage"])
        if j["status"] in ("done", "error"):
            break
        time.sleep(0.05)
    assert j["status"] == "done"
    assert j["result"]["notes"]
    assert "done" in seen


# 16. Empty recording
def test_empty_recording_rejected(client):
    r = _upload(client, b"")
    assert r.status_code == 422
    silent = to_wav_bytes(np.zeros(22050 * 3, dtype=np.float32))
    r = _upload(client, silent)
    assert r.status_code == 422
    assert "silent" in r.json()["detail"].lower()


def test_noise_only_and_bad_format_rejected(client):
    noise = to_wav_bytes((0.2 * np.random.default_rng(1).standard_normal(22050 * 3)).astype(np.float32))
    r = _upload(client, noise)
    assert r.status_code == 422
    assert "melody" in r.json()["detail"].lower()
    r = _upload(client, b"not audio at all", "song.txt")
    assert r.status_code == 422
    r = _upload(client, b"garbage bytes" * 100, "song.mp3")
    assert r.status_code == 422
    short = to_wav_bytes(synth_hum([60], 200, lead_sec=0, tail_sec=0))
    r = _upload(client, short)
    assert r.status_code == 422 and "short" in r.json()["detail"].lower()


# 17. Low-confidence humming
def test_unsteady_note_is_flagged_not_hidden():
    from app.services.transcription import transcribe_audio
    clean = synth_hum([64, 67, 64, 60], 90, seed=1, tail_sec=0.0)
    wobbly = synth_hum([65], 45, vibrato_cents=110, noise=0.0, seed=2, lead_sec=0.0)
    y = np.concatenate([clean, wobbly])
    mel = transcribe_audio(to_wav_bytes(y), "mix.wav")
    by_midi = {n.midi: n for n in mel.notes}
    assert not any(n.low_confidence for n in mel.notes if n.midi in (64, 67, 60))
    unsteady = [n for n in mel.notes if n.start_sec > len(clean) / 22050 - 0.05]
    assert unsteady and all(n.low_confidence for n in unsteady)
    assert any("marked in amber" in w for w in mel.warnings)
    assert by_midi  # nothing invented: only detected notes are returned


def test_quantize_endpoint_changes_grid(client, demo_wav):
    mel = _upload(client, demo_wav).json()["result"]
    r = client.post("/api/quantize", json={"melody": mel, "bpm": 160, "beat_offset": 0})
    assert r.status_code == 200
    assert [n["start_beat"] for n in r.json()["notes"]][:4] == [0, 2, 4, 6]
    assert client.post("/api/quantize", json={"melody": mel, "bpm": 5}).status_code == 422


# End-to-end API flow + 19. user progress persistence
def test_demo_to_arrangement_to_progress(client, db_path):
    mel = client.get("/api/demo").json()
    assert mel["source"] == "demo"
    har = client.post("/api/harmonize", json={"melody": mel, "style": "classic_rock"}).json()
    assert len(har["harmonizations"]) == 3
    rock = next(h for h in har["harmonizations"] if h["kind"] == "genre")
    arr = client.post("/api/generate-solo", json={"melody": mel, "harmonization": rock, "skill_level": "zero",
                                                  "style": "classic_rock"}).json()
    assert arr["id"].startswith("arr_")
    got = client.get(f"/api/arrangement/{arr['id']}").json()
    assert got["solo"]["notes"] == arr["solo"]["notes"]
    assert client.get("/api/arrangements").json()[0]["id"] == arr["id"]

    events = [{"event_id": n["id"], "expected_midi": n["midi"], "detected_midi": n["midi"], "correct": True,
               "timing_offset_ms": 40, "string": n["string"], "fret": n["fret"]} for n in arr["solo"]["notes"]]
    res = client.post("/api/practice-result", json={
        "arrangement_id": arr["id"], "mode": "play_with_band", "duration_sec": 30, "completed": True,
        "used_microphone": True, "events": events}).json()
    skills = {s["key"]: s for s in res["progress"]["skills"]}
    assert skills["full_solo"]["achieved"] and skills["phrase_8"]["achieved"] and skills["basic_rhythm"]["achieved"]

    # Manual practice never counts as verified skill.
    manual = [dict(e, correct=True) for e in events]
    client.post("/api/practice-result", json={"arrangement_id": arr["id"], "mode": "manual", "duration_sec": 10,
                                              "used_microphone": False, "events": manual})

    # Persistence: a fresh storage on the same database sees the same data.
    main.set_storage(Storage(db_path))
    prog = client.get(f"/api/progress?arrangement_id={arr['id']}").json()
    assert prog["progress"]["sessions"] == 2
    assert prog["progress"]["verified_sessions"] == 1
    assert prog["recommendations"]

    assert client.patch(f"/api/arrangement/{arr['id']}", json={"title": "My Song"}).json()["title"] == "My Song"
    assert client.delete(f"/api/arrangement/{arr['id']}").status_code == 200
    assert client.get(f"/api/arrangement/{arr['id']}").status_code == 404


def test_struggling_learner_gets_slower_tempo(client):
    mel = client.get("/api/demo").json()
    har = client.post("/api/harmonize", json={"melody": mel}).json()["harmonizations"][0]
    arr = client.post("/api/generate-solo", json={"melody": mel, "harmonization": har}).json()
    bad = [{"event_id": n["id"], "expected_midi": n["midi"], "correct": i < 3} for i, n in enumerate(arr["solo"]["notes"])]
    for _ in range(2):
        r = client.post("/api/practice-result", json={"arrangement_id": arr["id"], "mode": "follow_me",
                                                      "duration_sec": 20, "events": bad}).json()
    kinds = [x["kind"] for x in r["recommendations"]]
    assert "slow_down" in kinds and "shorter_phrase" in kinds


def test_errors(client):
    assert client.get("/api/arrangement/nope").status_code == 404
    mel = client.get("/api/demo").json()
    mel["notes"] = []
    assert client.post("/api/harmonize", json={"melody": mel}).status_code == 422
    bad = client.get("/api/demo").json()
    bad["notes"][0]["string"], bad["notes"][0]["fret"] = 1, 5  # E4 is not string 1 fret 5
    assert client.post("/api/harmonize", json={"melody": bad}).status_code == 422
    assert client.post("/api/practice-result", json={"arrangement_id": "x", "mode": "manual", "duration_sec": 1,
                                                     "events": []}).status_code == 404
