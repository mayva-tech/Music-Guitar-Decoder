"""Data model for library riffs (shared by riffs.py and blues_rock.py)."""
from __future__ import annotations

from dataclasses import dataclass, field

N = tuple  # (name, start, dur, opts?)


@dataclass(frozen=True)
class ChordSpec:
    symbol_root: str   # note name of the root, e.g. "A"
    quality: str       # maj | min | 5 | 7
    roman: str
    start: float
    length: float


@dataclass(frozen=True)
class RiffDef:
    id: str
    title: str
    credit: str
    source: str              # "public_domain" | "original"
    year: int | None
    genre: str               # rock | pop | blues
    style: str               # backing style
    difficulty: int          # 1 easy – 3 harder
    tempo: float
    tonic: str
    mode: str
    position_level: str      # comfort zone for automatically chosen positions
    focus: tuple[str, ...]
    tips: tuple[str, ...]
    notes: tuple[N, ...]
    chords: tuple[ChordSpec, ...]
    bars: int = 4
    power_chords: bool = False
    vibe: str = ""            # style the original riff is written in (e.g. "Grunge")
    collection: str = ""      # named set the riff belongs to (e.g. "blues_rock")
    extra: dict = field(default_factory=dict)


def _c(root, quality, roman, start, length):
    return ChordSpec(root, quality, roman, start, length)
