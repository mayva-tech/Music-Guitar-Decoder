"""Music Decoder API (FastAPI).

Run:  uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .music.theory import midi_to_name
from .schemas import (Arrangement, DetectedMelody, Harmonization, HarmonizeResponse, KeyCandidate, PracticeResult,
                      PracticeSession, SkillLevel, Style, TechniquesMode, UserPreferences)
from .services.arrangement import build_arrangement, demo_melody, validate_arrangement
from .services.audio_io import AudioError
from .services.harmonizer import harmonize
from .services.progress import compute_progress, recommendations, score_result
from .services.riffs import build_riff_arrangement, list_riffs
from .services.storage import Storage
from .services.transcription import key_candidates_for, requantize, transcribe_audio

app = FastAPI(title="Music Decoder API", version="0.2.0",
              description="Hum It. Rock It. Play It. — transcription, harmonisation and solo generation.")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["*"], allow_headers=["*"])

storage = Storage()
_executor = ThreadPoolExecutor(max_workers=2)
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()
STAGES = ["queued", "decoding", "detecting_pitch", "segmenting", "estimating_tempo", "finding_key", "done"]


def set_storage(s: Storage) -> None:
    global storage
    storage = s


# ---------------------------------------------------------------- transcription
def _run_job(job_id: str, data: bytes, filename: str, source: str, title: str) -> None:
    def progress(stage: str):
        with _jobs_lock:
            _jobs[job_id]["stage"] = stage
            _jobs[job_id]["updated_at"] = time.time()

    with _jobs_lock:
        _jobs[job_id]["status"] = "running"
    try:
        melody = transcribe_audio(data, filename, source=source, progress=progress, title=title)
        with _jobs_lock:
            _jobs[job_id].update(status="done", stage="done", result=melody.model_dump())
    except AudioError as e:
        with _jobs_lock:
            _jobs[job_id].update(status="error", error=str(e), error_kind="audio")
    except Exception as e:  # pragma: no cover - unexpected failure is reported, not hidden
        with _jobs_lock:
            _jobs[job_id].update(status="error", error=f"Analysis failed: {e}", error_kind="internal")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...), source: str = Form("recording"), title: str = Form("My tune"),
                     wait: bool = Query(False, description="Block until finished (used by tests/CLI)")):
    data = await file.read()
    filename = file.filename or "recording.webm"
    if not data:
        raise HTTPException(422, "The recording is empty.")
    job_id = f"job_{uuid4().hex[:12]}"
    with _jobs_lock:
        _jobs[job_id] = {"id": job_id, "status": "queued", "stage": "queued", "result": None, "error": None,
                         "created_at": time.time(), "updated_at": time.time()}
    if wait:
        _run_job(job_id, data, filename, source, title)
        job = _jobs[job_id]
        if job["status"] == "error":
            raise HTTPException(422 if job.get("error_kind") == "audio" else 500, job["error"])
        return job
    _executor.submit(_run_job, job_id, data, filename, source, title)
    return {**_jobs[job_id]}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Unknown job")
        return {**job, "stages": STAGES}


class QuantizeRequest(BaseModel):
    melody: DetectedMelody
    bpm: float
    beat_offset: float = 0.0


@app.post("/api/quantize", response_model=DetectedMelody)
def quantize_endpoint(req: QuantizeRequest):
    if not 30 <= req.bpm <= 240:
        raise HTTPException(422, "BPM must be between 30 and 240")
    if req.beat_offset < 0 or req.beat_offset >= 4:
        raise HTTPException(422, "Beat offset must be between 0 and 4 beats")
    try:
        return requantize(req.melody, req.bpm, req.beat_offset)
    except ValueError as e:
        raise HTTPException(422, str(e))


class RefreshRequest(BaseModel):
    melody: DetectedMelody


@app.post("/api/melody/refresh", response_model=DetectedMelody)
def refresh_melody(req: RefreshRequest):
    """Recompute names and key candidates after the user edits notes."""
    m = req.melody
    notes = [n.model_copy(update={"name": midi_to_name(n.midi)}) for n in sorted(m.notes, key=lambda x: x.start_beat)]
    if not notes:
        raise HTTPException(422, "The melody needs at least one note")
    return m.model_copy(update={"notes": notes, "key_candidates": key_candidates_for(notes)})


@app.get("/api/demo", response_model=DetectedMelody)
def demo():
    return demo_melody()


# ---------------------------------------------------------------- harmony & solo
class HarmonizeRequest(BaseModel):
    melody: DetectedMelody
    style: Style = "classic_rock"
    skill_level: SkillLevel = "zero"
    key: Optional[KeyCandidate] = None


@app.post("/api/harmonize", response_model=HarmonizeResponse)
def harmonize_endpoint(req: HarmonizeRequest):
    if not req.melody.notes:
        raise HTTPException(422, "The melody has no notes to harmonise.")
    return harmonize(req.melody.notes, req.melody.beats_per_bar, req.style, req.key)


class SoloRequest(BaseModel):
    melody: DetectedMelody
    harmonization: Harmonization
    skill_level: SkillLevel = "zero"
    style: Style = "classic_rock"
    title: Optional[str] = None
    techniques: TechniquesMode = "auto"
    save: bool = True


@app.post("/api/generate-solo", response_model=Arrangement)
def generate_solo_endpoint(req: SoloRequest):
    if not req.melody.notes:
        raise HTTPException(422, "The melody has no notes.")
    try:
        arr = build_arrangement(req.melody, req.harmonization, req.skill_level, req.style, req.title, req.techniques)
    except ValueError as e:
        raise HTTPException(422, str(e))
    if req.save:
        storage.save_arrangement(arr)
    return arr


@app.get("/api/arrangement/{arr_id}", response_model=Arrangement)
def get_arrangement(arr_id: str):
    arr = storage.get_arrangement(arr_id)
    if not arr:
        raise HTTPException(404, "Arrangement not found")
    return arr


@app.get("/api/arrangements")
def list_arrangements():
    return storage.list_arrangements()


class RenameRequest(BaseModel):
    title: str


@app.patch("/api/arrangement/{arr_id}", response_model=Arrangement)
def rename_arrangement(arr_id: str, req: RenameRequest):
    title = req.title.strip()[:80]
    if not title:
        raise HTTPException(422, "Title cannot be empty")
    arr = storage.rename_arrangement(arr_id, title)
    if not arr:
        raise HTTPException(404, "Arrangement not found")
    return arr


@app.delete("/api/arrangement/{arr_id}")
def delete_arrangement(arr_id: str):
    if not storage.delete_arrangement(arr_id):
        raise HTTPException(404, "Arrangement not found")
    return {"deleted": arr_id}


@app.post("/api/arrangement/validate")
def validate(arr: Arrangement):
    return {"problems": validate_arrangement(arr)}


# ---------------------------------------------------------------- riff library
@app.get("/api/riffs")
def riffs():
    return list_riffs()


class RiffRequest(BaseModel):
    skill_level: SkillLevel = "zero"
    techniques: TechniquesMode = "auto"
    save: bool = True


@app.post("/api/riffs/{riff_id}/arrangement", response_model=Arrangement)
def riff_arrangement(riff_id: str, req: RiffRequest):
    try:
        arr = build_riff_arrangement(riff_id, req.skill_level, req.techniques)
    except KeyError:
        raise HTTPException(404, "Unknown riff")
    if req.save:
        storage.save_arrangement(arr)
    return arr


# ---------------------------------------------------------------- practice & progress
@app.post("/api/practice-result")
def practice_result(result: PracticeResult):
    arr = storage.get_arrangement(result.arrangement_id)
    if not arr:
        raise HTTPException(404, "Arrangement not found")
    acc, timing = score_result(result)
    session = PracticeSession(result=result, accuracy=acc, mean_abs_timing_ms=timing)
    storage.save_session(session)
    sessions = storage.list_sessions()
    return {"session": session, "progress": compute_progress(sessions),
            "recommendations": recommendations(sessions, result.arrangement_id, len(arr.solo.notes))}


@app.get("/api/progress")
def progress(arrangement_id: Optional[str] = None):
    sessions = storage.list_sessions()
    out = {"progress": compute_progress(sessions),
           "history": [s.model_dump() for s in sessions[-50:]][::-1]}
    if arrangement_id:
        arr = storage.get_arrangement(arrangement_id)
        out["recommendations"] = recommendations(sessions, arrangement_id, len(arr.solo.notes) if arr else 0)
    return out


@app.get("/api/preferences", response_model=UserPreferences)
def get_prefs():
    return storage.get_preferences()


@app.put("/api/preferences", response_model=UserPreferences)
def put_prefs(p: UserPreferences):
    storage.save_preferences(p)
    return p
