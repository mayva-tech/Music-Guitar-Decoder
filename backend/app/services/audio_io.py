"""Audio decoding and preprocessing.

Input files are decoded with soundfile when possible (WAV/FLAC/OGG-Vorbis) and
with ffmpeg otherwise (WebM/Opus from Chrome's MediaRecorder, MP4/AAC from
Safari, MP3, M4A …). Output is always mono float32 at ANALYSIS_SR.
"""
from __future__ import annotations

import io
import shutil
import subprocess
from dataclasses import dataclass

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfiltfilt

ANALYSIS_SR = 22050
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MIN_DURATION_SEC = 0.5
MAX_DURATION_SEC = 30.0
SUPPORTED_EXTENSIONS = {".wav", ".flac", ".ogg", ".oga", ".mp3", ".webm", ".m4a", ".mp4", ".aac", ".opus"}


class AudioError(ValueError):
    """User-facing audio problem (bad format, empty recording …)."""


@dataclass
class DecodedAudio:
    y: np.ndarray
    sr: int
    original_sr: int
    format: str
    duration_sec: float


def _ffmpeg_decode(data: bytes) -> tuple[np.ndarray, int]:
    if shutil.which("ffmpeg") is None:
        raise AudioError("This audio format needs ffmpeg, which is not installed on the server. Upload a WAV file instead.")
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", str(ANALYSIS_SR),
         "-f", "f32le", "pipe:1"],
        input=data, capture_output=True, timeout=60,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise AudioError("Could not decode the audio file. Supported formats: WAV, FLAC, OGG, MP3, WebM, M4A/MP4.")
    return np.frombuffer(proc.stdout, dtype=np.float32).copy(), ANALYSIS_SR


def decode_audio(data: bytes, filename: str = "audio") -> DecodedAudio:
    if not data:
        raise AudioError("The recording is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise AudioError("The file is too large (max 15 MB). Please record 5–15 seconds.")
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext and ext not in SUPPORTED_EXTENSIONS:
        raise AudioError(f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
    fmt = ext.lstrip(".") or "unknown"
    try:
        y, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
        y = y.mean(axis=1)
        original_sr = sr
    except Exception:
        y, sr = _ffmpeg_decode(data)
        original_sr = sr
    if y.size == 0:
        raise AudioError("The recording is empty.")
    if sr != ANALYSIS_SR:
        from math import gcd
        g = gcd(int(sr), ANALYSIS_SR)
        y = resample_poly(y, ANALYSIS_SR // g, int(sr) // g).astype(np.float32)
        sr = ANALYSIS_SR
    duration = y.size / sr
    if duration < MIN_DURATION_SEC:
        raise AudioError("The recording is too short. Hum for at least a couple of seconds (5–15 s works best).")
    if duration > MAX_DURATION_SEC:
        raise AudioError(f"The recording is {duration:.0f} s long. Please keep it under {MAX_DURATION_SEC:.0f} s.")
    if not np.isfinite(y).all():
        raise AudioError("The audio contains invalid samples.")
    return DecodedAudio(y=y, sr=sr, original_sr=original_sr, format=fmt, duration_sec=duration)


def preprocess(y: np.ndarray, sr: int) -> tuple[np.ndarray, float]:
    """Remove DC and rumble (gentle 50 Hz high-pass), peak-normalise.

    Returns (signal, peak_before_normalisation). No aggressive filtering — the
    pitch tracker needs the harmonics.
    """
    y = y - float(np.mean(y))
    sos = butter(2, 50.0, btype="highpass", fs=sr, output="sos")
    y = sosfiltfilt(sos, y).astype(np.float32)
    peak = float(np.max(np.abs(y))) if y.size else 0.0
    if peak < 1e-4:
        raise AudioError("The recording is silent. Check that your microphone is working and hum a little louder.")
    return (0.9 * y / peak).astype(np.float32), peak
