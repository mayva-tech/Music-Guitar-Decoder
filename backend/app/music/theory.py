"""Core music theory helpers: note names, MIDI, frequencies, keys, scales, chords.

Everything in Music Decoder is derived from MIDI numbers. Names and visual
layouts are presentation only.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

_NAME_TO_PC = {n: i for i, n in enumerate(NOTE_NAMES_SHARP)}
_NAME_TO_PC.update({n: i for i, n in enumerate(NOTE_NAMES_FLAT)})
_NAME_TO_PC.update({"E#": 5, "B#": 0, "Fb": 4, "Cb": 11})

MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]

# Keys that are conventionally spelled with flats.
_FLAT_MAJOR_TONICS = {5, 10, 3, 8, 1, 6}  # F Bb Eb Ab Db Gb
_FLAT_MINOR_TONICS = {2, 7, 0, 5, 10, 3}  # D G C F Bb Eb


def pitch_class(midi: int) -> int:
    return midi % 12


def midi_to_name(midi: int, prefer_flats: bool = False) -> str:
    """60 -> 'C4' (scientific pitch notation, MIDI 60 = middle C)."""
    if not 0 <= midi <= 127:
        raise ValueError(f"MIDI note out of range: {midi}")
    names = NOTE_NAMES_FLAT if prefer_flats else NOTE_NAMES_SHARP
    return f"{names[midi % 12]}{midi // 12 - 1}"


_NAME_RE = re.compile(r"^([A-Ga-g])([#b]?)(-?\d+)$")


def name_to_midi(name: str) -> int:
    m = _NAME_RE.match(name.strip())
    if not m:
        raise ValueError(f"Invalid note name: {name!r}")
    letter, accidental, octave = m.groups()
    pc = _NAME_TO_PC[letter.upper() + accidental]
    midi = (int(octave) + 1) * 12 + pc
    # B#3 is enharmonically C4, Cb4 is B3
    if letter.upper() + accidental == "B#":
        midi += 12
    if letter.upper() + accidental == "Cb":
        midi -= 12
    if not 0 <= midi <= 127:
        raise ValueError(f"Note out of MIDI range: {name}")
    return midi


def midi_to_freq(midi: float, a4: float = 440.0) -> float:
    return a4 * 2.0 ** ((midi - 69.0) / 12.0)


def freq_to_midi(freq: float, a4: float = 440.0) -> float:
    if freq <= 0:
        raise ValueError("Frequency must be positive")
    return 69.0 + 12.0 * math.log2(freq / a4)


def pc_name(pc: int, prefer_flats: bool = False) -> str:
    return (NOTE_NAMES_FLAT if prefer_flats else NOTE_NAMES_SHARP)[pc % 12]


@dataclass(frozen=True)
class Key:
    tonic: int  # pitch class
    mode: str  # "major" | "minor"

    @property
    def prefer_flats(self) -> bool:
        if self.mode == "major":
            return self.tonic in _FLAT_MAJOR_TONICS
        return self.tonic in _FLAT_MINOR_TONICS

    @property
    def scale(self) -> list[int]:
        steps = MAJOR_SCALE if self.mode == "major" else MINOR_SCALE
        return [(self.tonic + s) % 12 for s in steps]

    @property
    def name(self) -> str:
        n = pc_name(self.tonic, self.prefer_flats)
        return f"{n} major" if self.mode == "major" else f"{n} minor"

    def transpose(self, semitones: int) -> "Key":
        return Key((self.tonic + semitones) % 12, self.mode)


# Chord qualities: interval sets relative to the root.
CHORD_INTERVALS: dict[str, tuple[int, ...]] = {
    "maj": (0, 4, 7),
    "min": (0, 3, 7),
    "5": (0, 7),
    "dim": (0, 3, 6),
    "7": (0, 4, 7, 10),
}

_QUALITY_SUFFIX = {"maj": "", "min": "m", "5": "5", "dim": "dim", "7": "7"}


@dataclass(frozen=True)
class Chord:
    root: int  # pitch class
    quality: str

    @property
    def pcs(self) -> tuple[int, ...]:
        return tuple((self.root + i) % 12 for i in CHORD_INTERVALS[self.quality])

    def symbol(self, prefer_flats: bool = False) -> str:
        return pc_name(self.root, prefer_flats) + _QUALITY_SUFFIX[self.quality]

    def transpose(self, semitones: int) -> "Chord":
        return Chord((self.root + semitones) % 12, self.quality)

    def as_power(self) -> "Chord":
        return Chord(self.root, "5")


_SYMBOL_RE = re.compile(r"^([A-G][#b]?)(m|5|dim|7)?$")


def parse_chord(symbol: str) -> Chord:
    m = _SYMBOL_RE.match(symbol.strip())
    if not m:
        raise ValueError(f"Unsupported chord symbol: {symbol!r}")
    root, suffix = m.groups()
    quality = {None: "maj", "m": "min", "5": "5", "dim": "dim", "7": "7"}[suffix]
    return Chord(_NAME_TO_PC[root], quality)


# Krumhansl–Kessler key profiles.
_KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
_KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]


@dataclass
class KeyEstimate:
    key: Key
    correlation: float
    confidence: float = 0.0
    scale_coverage: float = 0.0
    extra: dict = field(default_factory=dict)


def _pearson(a: list[float], b: list[float]) -> float:
    n = len(a)
    ma, mb = sum(a) / n, sum(b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = math.sqrt(sum((x - ma) ** 2 for x in a))
    db = math.sqrt(sum((y - mb) ** 2 for y in b))
    if da == 0 or db == 0:
        return 0.0
    return num / (da * db)


def estimate_keys(notes: list[tuple[int, float]], top: int = 5) -> list[KeyEstimate]:
    """Rank keys for a melody.

    notes: list of (midi, weight) in time order (weight usually = duration in beats).
    Uses Krumhansl–Kessler correlation, with a small extra weight on the first and
    last note (melodies very often start/end on the home note).
    """
    if not notes:
        return []
    hist = [0.0] * 12
    for midi, w in notes:
        hist[midi % 12] += max(w, 0.05)
    total = sum(hist)
    hist[notes[-1][0] % 12] += 0.35 * total / max(len(notes), 1) * 2.5
    hist[notes[0][0] % 12] += 0.15 * total / max(len(notes), 1) * 2.5

    used = {m % 12 for m, _ in notes}
    results: list[KeyEstimate] = []
    for tonic in range(12):
        for mode, profile in (("major", _KK_MAJOR), ("minor", _KK_MINOR)):
            rotated = [profile[(pc - tonic) % 12] for pc in range(12)]
            corr = _pearson(hist, rotated)
            key = Key(tonic, mode)
            coverage = sum(1 for pc in used if pc in key.scale) / len(used)
            results.append(KeyEstimate(key, corr, scale_coverage=coverage))
    results.sort(key=lambda k: k.correlation, reverse=True)
    # Softmax over correlations -> pseudo-probabilities for display.
    exps = [math.exp(8.0 * r.correlation) for r in results]
    s = sum(exps)
    for r, e in zip(results, exps):
        r.confidence = e / s
    return results[:top]
