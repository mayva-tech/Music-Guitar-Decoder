"""Synthetic 'humming' generator for integration tests (no recordings checked in)."""
from __future__ import annotations

import io

import numpy as np
import soundfile as sf


def synth_hum(midis: list[int | None], bpm: float, sr: int = 22050, beats: list[float] | None = None,
              harmonics=(1.0, 0.45, 0.25, 0.12), vibrato_cents: float = 15.0, noise: float = 0.01,
              detune_cents: float = 0.0, gap_sec: float = 0.07, glide: bool = False, seed: int = 0,
              lead_sec: float = 0.4, tail_sec: float = 0.5) -> np.ndarray:
    """Render a monophonic tune. None = rest. beats = per-note durations in beats (default 1)."""
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    beats = beats or [1.0] * len(midis)
    total = lead_sec + sum(beats) * beat + tail_sec
    y = np.zeros(int(total * sr), dtype=np.float64)
    t_cursor = lead_sec
    prev_f = None
    for m, b in zip(midis, beats):
        dur = b * beat
        if m is None:
            t_cursor += dur
            prev_f = None
            continue
        f = 440.0 * 2 ** ((m - 69 + detune_cents / 100.0) / 12)
        n = int((dur - gap_sec) * sr)
        t = np.arange(n) / sr
        vib = 2 ** (vibrato_cents / 1200.0 * np.sin(2 * np.pi * 5.2 * t + rng.uniform(0, 6)))
        inst_f = f * vib
        if glide and prev_f is not None:
            g = np.clip(t / 0.12, 0, 1)
            inst_f = (prev_f * (1 - g) + f * g) * vib
        phase = 2 * np.pi * np.cumsum(inst_f) / sr
        tone = sum(a * np.sin((k + 1) * phase) for k, a in enumerate(harmonics))
        env = np.ones(n)
        a, r = int(0.03 * sr), int(0.05 * sr)
        env[:a] = np.linspace(0, 1, a)
        env[-r:] = np.linspace(1, 0, r)
        start = int(t_cursor * sr)
        y[start:start + n] += 0.3 * tone * env
        t_cursor += dur
        prev_f = f
    y += noise * rng.standard_normal(y.size)
    return y.astype(np.float32)


def to_wav_bytes(y: np.ndarray, sr: int = 22050) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()
