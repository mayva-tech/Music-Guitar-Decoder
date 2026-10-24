"""Tempo estimation and rhythmic quantisation of detected notes."""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass
class RawNote:
    midi: int
    onset_sec: float
    duration_sec: float


def estimate_tempo(onsets: list[float], bpm_min: float = 50, bpm_max: float = 180) -> list[tuple[float, float]]:
    """Return up to three (bpm, score) candidates, best first.

    Scores how well the onsets fall on an eighth-note grid, preferring tempos where
    the typical gap between notes is about one beat (most hummed tunes), with a mild
    prior towards ~100 BPM.
    """
    on = np.asarray(sorted(onsets), dtype=float)
    if on.size < 3:
        return [(90.0, 0.0)]
    iois = np.diff(on)
    iois = iois[iois > 0.05]
    if iois.size == 0:
        return [(90.0, 0.0)]
    rel_s = on - on[0]
    med_ioi = float(np.median(iois))
    bpms = np.arange(bpm_min, bpm_max + 0.01, 0.5)
    scores = np.zeros_like(bpms)
    for i, bpm in enumerate(bpms):
        beat = 60.0 / bpm
        rel = rel_s / beat
        dev8 = rel * 2 - np.round(rel * 2)
        dev4 = rel - np.round(rel)
        align = 0.5 * np.mean(np.exp(-(dev8 / 0.16) ** 2)) + 0.5 * np.mean(np.exp(-(dev4 / 0.14) ** 2))
        density = math.exp(-(math.log2(med_ioi / beat)) ** 2 / (2 * 0.45 ** 2))
        prior = math.exp(-(math.log2(bpm / 100.0)) ** 2 / (2 * 0.6 ** 2))
        scores[i] = align * (0.35 + 0.65 * density) * (0.6 + 0.4 * prior)

    order = np.argsort(-scores)
    picked: list[tuple[float, float]] = []
    for idx in order:
        bpm = float(bpms[idx])
        if all(abs(bpm - p) / p > 0.06 for p, _ in picked):
            picked.append((_refine(rel_s, bpm), float(scores[idx])))
        if len(picked) == 3:
            break
    return picked


def _refine(rel_s: np.ndarray, bpm: float) -> float:
    """Least-squares fit of the beat length given the grid assignment at this tempo."""
    beat = 60.0 / bpm
    k = np.round(rel_s / beat * 2) / 2
    if np.unique(k).size < 3:
        return round(bpm * 2) / 2
    # onset = intercept + beat * k  (intercept absorbs a late/early first note)
    beat_fit = float(np.polyfit(k, rel_s, 1)[0])
    if beat_fit <= 0:
        return round(bpm * 2) / 2
    fitted = 60.0 / beat_fit
    if abs(fitted - bpm) / bpm > 0.05:
        fitted = bpm
    return round(fitted * 2) / 2


def quantize(notes: list[RawNote], bpm: float, beat_offset: float = 0.0, grid: float = 0.5) -> list[tuple[float, float]]:
    """Map raw (seconds) notes to (start_beat, duration_beats) on a grid (default eighth notes).

    beat_offset shifts where beat 0 lies relative to the first note (e.g. 0.5 for a pickup).
    The result never overlaps and every duration is at least one grid step.
    """
    if not notes:
        return []
    if bpm <= 0:
        raise ValueError("BPM must be positive")
    beat = 60.0 / bpm
    t0 = notes[0].onset_sec
    # Grid phase: the median deviation of all onsets from the grid anchored at the first
    # note, so one early or late first note does not shift everything else.
    g_sec = grid * beat
    rel = np.array([n.onset_sec - t0 for n in notes])
    dev = rel - np.round(rel / g_sec) * g_sec
    t0 = t0 + float(np.median(dev))
    q = []
    for n in notes:
        s = (n.onset_sec - t0) / beat + beat_offset
        e = (n.onset_sec + n.duration_sec - t0) / beat + beat_offset
        sq = max(0.0, round(s / grid) * grid)
        eq = round(e / grid) * grid
        q.append([sq, max(grid, eq - sq)])
    for i in range(1, len(q)):
        if q[i][0] <= q[i - 1][0]:
            q[i][0] = q[i - 1][0] + grid
    for i in range(len(q) - 1):
        span = q[i + 1][0] - q[i][0]
        end_beats = (notes[i].onset_sec + notes[i].duration_sec - t0) / beat + beat_offset
        next_beats = (notes[i + 1].onset_sec - t0) / beat + beat_offset
        if next_beats - end_beats < 0.5:
            # Small breath/articulation gap: the note musically lasts until the next one.
            q[i][1] = span
        else:
            q[i][1] = max(grid, min(q[i][1], span))
    return [(round(s, 4), round(d, 4)) for s, d in q]
