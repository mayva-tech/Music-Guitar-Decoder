"""Melody transcription: audio -> DetectedMelody.

Pipeline
  A. decode / resample / normalise / find usable signal
  B. pitch tracking with probabilistic YIN (librosa.pyin) + voicing
  C. note segmentation (pitch changes + re-articulation onsets), spurious-note filtering
  D. tempo candidates + eighth-note quantisation
  E. key candidates
Every note carries a confidence; nothing is invented to fill gaps.
"""
from __future__ import annotations

import math
from typing import Callable, Optional

import librosa
import numpy as np
from scipy.ndimage import median_filter

from ..music.theory import estimate_keys, midi_to_name
from ..schemas import (Contour, DetectedMelody, KeyCandidate, NoteEvent, Recording, TempoCandidate)
from .audio_io import AudioError, decode_audio, preprocess
from .rhythm import RawNote, estimate_tempo, quantize

HOP = 256
FRAME = 2048
FMIN = 70.0     # ~C#2, low humming
FMAX = 1700.0   # ~G#6, whistling
MIN_NOTE_SEC = 0.08
LOW_CONFIDENCE = 0.5

ProgressFn = Optional[Callable[[str], None]]


def _segments_from_mask(mask: np.ndarray, bridge: int = 2) -> list[tuple[int, int]]:
    """Contiguous True runs [start, end), bridging tiny gaps."""
    segs = []
    i, n = 0, len(mask)
    while i < n:
        if not mask[i]:
            i += 1
            continue
        j = i
        while j < n:
            if mask[j]:
                j += 1
                continue
            k = j
            while k < n and not mask[k] and k - j < bridge:
                k += 1
            if k < n and mask[k] and k - j <= bridge:
                j = k
            else:
                break
        segs.append((i, j))
        i = j
    return segs


def _split_on_pitch(pitch: np.ndarray, start: int, end: int, thresh: float = 0.6, hold: int = 3) -> list[tuple[int, int]]:
    out = []
    seg_start = start
    i = start
    while i < end:
        ref = float(np.median(pitch[max(seg_start, i - 8):i])) if i - seg_start >= 3 else float(pitch[seg_start])
        if abs(pitch[i] - ref) > thresh and i - seg_start >= 3:
            j = i
            while j < end and abs(pitch[j] - ref) > thresh and j - i < hold:
                j += 1
            if j - i >= hold or j == end:
                out.append((seg_start, i))
                seg_start = i
        i += 1
    out.append((seg_start, end))
    return [s for s in out if s[1] > s[0]]


def _split_on_onsets(seg: tuple[int, int], onsets: np.ndarray, rms: np.ndarray, min_frames: int) -> list[tuple[int, int]]:
    s, e = seg
    cuts = []
    for o in onsets:
        if s + min_frames <= o <= e - min_frames:
            before = rms[max(s, o - 6):o]
            after = rms[o:min(e, o + 6)]
            if before.size and after.size and before.min() < 0.75 * after.max():
                if not cuts or o - cuts[-1] >= min_frames:
                    cuts.append(int(o))
    bounds = [s] + cuts + [e]
    return [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]


def _track_pitch(y: np.ndarray, sr: int, loud: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """pYIN, but only where there is sound and only over the pitch range actually used.

    1. Frames before the first / after the last loud frame are silence: skip them.
    2. A fast plain-YIN pass on the loud frames finds the singer's range; pYIN then
       searches that range (± a few semitones) instead of 70–1700 Hz. pYIN's cost grows
       with the number of pitch candidates, so this is roughly 2× faster for humming.
    The output is padded back to the full length, so frame indices are unchanged.
    """
    n_frames = 1 + len(y) // HOP
    f0 = np.full(n_frames, np.nan)
    vflag = np.zeros(n_frames, dtype=bool)
    vprob = np.zeros(n_frames)
    idx = np.flatnonzero(loud)
    if idx.size == 0:
        return f0, vflag, vprob
    margin = 8
    a = max(0, int(idx[0]) - margin)
    b = min(len(loud), int(idx[-1]) + margin + 1)
    seg = y[a * HOP: b * HOP + FRAME]

    fmin, fmax = FMIN, FMAX
    rough = librosa.yin(seg, fmin=FMIN, fmax=FMAX, sr=sr, frame_length=FRAME, hop_length=HOP)
    L = min(len(rough), len(loud) - a)
    vals = rough[:L][loud[a:a + L]]
    vals = vals[(vals > FMIN * 1.01) & (vals < FMAX * 0.99)]
    if vals.size >= 5:
        lo_hz, hi_hz = np.percentile(vals, [3, 97])
        fmin = max(FMIN, lo_hz * 2 ** (-5 / 12))
        fmax = min(FMAX, hi_hz * 2 ** (5 / 12))
        if fmax / fmin < 2 ** (12 / 12):  # keep at least an octave of headroom
            mid = np.sqrt(fmin * fmax)
            fmin, fmax = max(FMIN, mid / 2 ** 0.5), min(FMAX, mid * 2 ** 0.5)
    sf0, sflag, sprob = librosa.pyin(seg, fmin=fmin, fmax=fmax, sr=sr, frame_length=FRAME, hop_length=HOP)
    m = min(len(sf0), n_frames - a)
    f0[a:a + m], vflag[a:a + m], vprob[a:a + m] = sf0[:m], sflag[:m], sprob[:m]
    return f0, vflag, vprob


def transcribe_audio(data: bytes, filename: str, source: str = "recording", progress: ProgressFn = None,
                     title: str = "My tune") -> DetectedMelody:
    def stage(name: str):
        if progress:
            progress(name)

    stage("decoding")
    audio = decode_audio(data, filename)
    y, peak = preprocess(audio.y, audio.sr)
    sr = audio.sr
    warnings: list[str] = []
    if peak < 0.02:
        warnings.append("The recording was very quiet. Moving closer to the microphone usually helps.")

    stage("detecting_pitch")
    rms = librosa.feature.rms(y=y, frame_length=FRAME, hop_length=HOP, center=True)[0]
    rms_db = 20 * np.log10(np.maximum(rms, 1e-8) / max(rms.max(), 1e-8))
    noise_floor = np.percentile(rms, 10)
    loud = (rms_db > -35) & (rms > 1.8 * noise_floor + 1e-6)
    f0, voiced_flag, voiced_prob = _track_pitch(y, sr, loud)
    n = min(len(f0), len(rms))
    f0, voiced_flag, voiced_prob, rms, loud = f0[:n], voiced_flag[:n], voiced_prob[:n], rms[:n], loud[:n]
    rms_db = rms_db[:n]
    voiced = voiced_flag & (voiced_prob > 0.25) & loud & np.isfinite(f0)

    if voiced.sum() < 5:
        raise AudioError("We couldn't hear a clear melody. Try humming or whistling a little louder, one note at a time.")

    midi_f = np.full(n, np.nan)
    midi_f[voiced] = 69 + 12 * np.log2(f0[voiced] / 440.0)

    # Global tuning offset (people rarely hum at exactly A=440).
    frac = midi_f[voiced] - np.round(midi_f[voiced])
    ang = 2 * np.pi * frac
    offset = math.atan2(float(np.mean(np.sin(ang))), float(np.mean(np.cos(ang)))) / (2 * np.pi)
    tuning_cents = round(offset * 100, 1)
    if abs(tuning_cents) >= 25:
        direction = "sharp" if tuning_cents > 0 else "flat"
        warnings.append(f"You were about {abs(tuning_cents):.0f} cents {direction} of standard tuning — we adjusted for that.")
    midi_c = midi_f - offset

    stage("segmenting")
    regions = _segments_from_mask(voiced, bridge=2)
    # Fill the tiny bridged gaps inside a region by interpolation so filters see no NaNs.
    idx = np.arange(n)
    for s, e in regions:
        seg = midi_c[s:e]
        bad = ~np.isfinite(seg)
        if bad.any() and (~bad).any():
            seg[bad] = np.interp(idx[s:e][bad], idx[s:e][~bad], seg[~bad])
    smooth = np.copy(midi_c)
    for s, e in regions:
        if e - s >= 3:
            smooth[s:e] = median_filter(midi_c[s:e], size=min(5, e - s), mode="nearest")

    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=HOP, backtrack=True, units="frames")
    min_frames = max(2, int(round(MIN_NOTE_SEC * sr / HOP)))
    segments: list[tuple[int, int]] = []
    for reg in regions:
        for ps in _split_on_pitch(smooth, reg[0], reg[1]):
            segments.extend(_split_on_onsets(ps, onset_frames, rms, min_frames + 1))

    frame_sec = HOP / sr
    raw: list[dict] = []
    for s, e in segments:
        if e - s < min_frames:
            continue
        pitch = float(np.nanmedian(midi_c[s:e]))
        if not np.isfinite(pitch):
            continue
        midi = int(round(pitch))
        if not 28 <= midi <= 100:
            continue
        std = float(np.nanstd(midi_c[s:e]))
        dur = (e - s) * frame_sec
        conf = float(np.mean(voiced_prob[s:e]))
        conf *= float(np.clip(1.0 - (std - 0.2) / 0.8, 0.2, 1.0))
        conf *= float(np.clip(dur / 0.18, 0.3, 1.0))
        conf *= float(np.clip(1.0 - (abs(pitch - midi) - 0.25) / 0.5, 0.4, 1.0))
        raw.append(dict(midi=midi, start=s * frame_sec, dur=dur, conf=float(np.clip(conf, 0, 1)),
                        cents=round((pitch - midi) * 100, 1), s=s, e=e))

    # Merge same-pitch fragments separated by tiny gaps without a re-articulation.
    merged: list[dict] = []
    onset_set = set(int(o) for o in onset_frames)
    for r in raw:
        if merged:
            p = merged[-1]
            gap = r["start"] - (p["start"] + p["dur"])
            rearticulated = any(abs(r["s"] - o) <= 2 for o in onset_set)
            if p["midi"] == r["midi"] and gap < 0.06 and not rearticulated:
                p["dur"] = r["start"] + r["dur"] - p["start"]
                p["conf"] = max(p["conf"], r["conf"])
                p["e"] = r["e"]
                continue
        merged.append(r)

    # Drop brief transitional blips (glides between notes).
    cleaned: list[dict] = []
    for i, r in enumerate(merged):
        if r["dur"] < 0.12:
            prev = merged[i - 1] if i > 0 else None
            nxt = merged[i + 1] if i + 1 < len(merged) else None
            near = lambda o: o is not None and abs(o["start"] - r["start"]) < r["dur"] + 0.25 and o["dur"] > r["dur"]
            between = (prev is not None and nxt is not None
                       and min(prev["midi"], nxt["midi"]) <= r["midi"] <= max(prev["midi"], nxt["midi"]))
            if (near(prev) or near(nxt)) and (between or r["conf"] < 0.4):
                continue
        cleaned.append(r)

    if not cleaned:
        raise AudioError("We couldn't find any steady notes. Try holding each note a little longer.")

    stage("estimating_tempo")
    raw_notes = [RawNote(r["midi"], r["start"], r["dur"]) for r in cleaned]
    tempo_cands = estimate_tempo([r.onset_sec for r in raw_notes])
    bpm = tempo_cands[0][0]
    q = quantize(raw_notes, bpm)

    notes = []
    for r, (sb, db) in zip(cleaned, q):
        notes.append(NoteEvent(
            midi=r["midi"], name=midi_to_name(r["midi"]), start_beat=sb, duration_beats=db,
            start_sec=round(r["start"], 4), duration_sec=round(max(r["dur"], 0.01), 4),
            confidence=round(r["conf"], 3), low_confidence=r["conf"] < LOW_CONFIDENCE,
            cents_off=r["cents"], source="detected"))

    stage("finding_key")
    keys = key_candidates_for(notes)

    voiced_frac = float(voiced.sum()) / max(1, int(loud.sum()))
    if voiced_frac < 0.4:
        warnings.append("Parts of the recording didn't have a clear pitch (breath, noise or speech).")
    n_low = sum(1 for x in notes if x.low_confidence)
    if n_low:
        warnings.append(f"{n_low} note{'s' if n_low > 1 else ''} might be wrong — they are marked in amber so you can check them.")
    if audio.duration_sec > 15.5:
        warnings.append("Recordings of 5–15 seconds work best.")

    step = 2
    times = [round(i * frame_sec, 3) for i in range(0, n, step)]
    cont = [None if not voiced[i] else round(float(midi_c[i]), 2) for i in range(0, n, step)]

    return DetectedMelody(
        source=source if source in ("recording", "upload") else "recording",
        title=title,
        tempo_bpm=bpm,
        notes=notes,
        tempo_candidates=[TempoCandidate(bpm=b, score=round(s, 4)) for b, s in tempo_cands],
        key_candidates=keys,
        tuning_offset_cents=tuning_cents,
        duration_sec=round(audio.duration_sec, 3),
        warnings=warnings,
        contour=Contour(times=times, midi=cont),
        recording=Recording(filename=filename, format=audio.format, duration_sec=round(audio.duration_sec, 3),
                            sample_rate=audio.original_sr),
    )


def key_candidates_for(notes: list[NoteEvent]) -> list[KeyCandidate]:
    ests = estimate_keys([(n.midi, n.duration_beats) for n in sorted(notes, key=lambda x: x.start_beat)])
    return [KeyCandidate(tonic=e.key.tonic, mode=e.key.mode, name=e.key.name, confidence=round(e.confidence, 4),
                         scale_coverage=round(e.scale_coverage, 3)) for e in ests]


def requantize(melody: DetectedMelody, bpm: float, beat_offset: float = 0.0) -> DetectedMelody:
    """Re-quantise a detected melody at a user-chosen tempo / beat offset (raw times are kept)."""
    timed = [n for n in melody.notes if n.start_sec is not None and n.duration_sec is not None]
    if len(timed) != len(melody.notes):
        raise ValueError("Some notes have no recorded timing, so they cannot be re-quantised")
    timed.sort(key=lambda n: n.start_sec)
    q = quantize([RawNote(n.midi, n.start_sec, n.duration_sec) for n in timed], bpm, beat_offset)
    new_notes = [n.model_copy(update={"start_beat": sb, "duration_beats": db}) for n, (sb, db) in zip(timed, q)]
    return melody.model_copy(update={"tempo_bpm": bpm, "beat_offset": beat_offset, "notes": new_notes})
