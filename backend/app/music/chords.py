"""Guitar chord shapes (diagrams) and voicings derived from them.

A diagram lists frets for strings 6..1 (index 0 = string 6). None = muted (X),
0 = open (O). Every voicing's pitches are computed from the diagram, so the
sound and the picture can never disagree.
"""
from __future__ import annotations

from dataclasses import dataclass

from .guitar import STANDARD_TUNING
from .theory import Chord

STRING_ORDER = (6, 5, 4, 3, 2, 1)


@dataclass
class Shape:
    frets: list[int | None]  # strings 6..1
    fingers: list[int | None]

    def midis(self) -> list[int]:
        return [STANDARD_TUNING[s] + f for s, f in zip(STRING_ORDER, self.frets) if f is not None]


# Common open shapes keyed by (root pc, quality).
_OPEN: dict[tuple[int, str], Shape] = {
    (0, "maj"): Shape([None, 3, 2, 0, 1, 0], [None, 3, 2, 0, 1, 0]),   # C
    (2, "maj"): Shape([None, None, 0, 2, 3, 2], [None, None, 0, 1, 3, 2]),  # D
    (4, "maj"): Shape([0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]),         # E
    (5, "maj"): Shape([None, None, 3, 2, 1, 1], [None, None, 3, 2, 1, 1]),  # F (easy)
    (7, "maj"): Shape([3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]),         # G
    (9, "maj"): Shape([None, 0, 2, 2, 2, 0], [None, 0, 1, 2, 3, 0]),   # A
    (9, "min"): Shape([None, 0, 2, 2, 1, 0], [None, 0, 2, 3, 1, 0]),   # Am
    (4, "min"): Shape([0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]),         # Em
    (2, "min"): Shape([None, None, 0, 2, 3, 1], [None, None, 0, 2, 3, 1]),  # Dm
    (11, "min"): Shape([None, 2, 4, 4, 3, 2], [None, 1, 3, 4, 2, 1]),  # Bm
    (0, "7"): Shape([None, 3, 2, 3, 1, 0], [None, 3, 2, 4, 1, 0]),     # C7
    (2, "7"): Shape([None, None, 0, 2, 1, 2], [None, None, 0, 2, 1, 3]),  # D7
    (4, "7"): Shape([0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]),           # E7
    (7, "7"): Shape([3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]),           # G7
    (9, "7"): Shape([None, 0, 2, 0, 2, 0], [None, 0, 2, 0, 3, 0]),     # A7
    (11, "7"): Shape([None, 2, 1, 2, 0, 2], [None, 2, 1, 3, 0, 4]),    # B7
}

# Movable barre templates (relative frets, fingers) rooted on string 6 or 5.
_E_SHAPE = {
    "maj": ([0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1]),
    "min": ([0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1]),
    "7": ([0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1]),
}
_A_SHAPE = {
    "maj": ([None, 0, 2, 2, 2, 0], [None, 1, 3, 3, 3, 1]),
    "min": ([None, 0, 2, 2, 1, 0], [None, 1, 3, 4, 2, 1]),
    "7": ([None, 0, 2, 0, 2, 0], [None, 1, 3, 1, 4, 1]),
}


def _fret_on(string: int, pc: int, min_fret: int = 0) -> int:
    f = (pc - STANDARD_TUNING[string]) % 12
    while f < min_fret:
        f += 12
    return f


def power_chord_shape(root: int) -> Shape:
    """Two-finger power chord (root + fifth + octave)."""
    f6 = _fret_on(6, root)
    f5 = _fret_on(5, root)
    if f6 <= 7 and (f6 <= f5 or f5 > 7):
        if f6 == 0:
            return Shape([0, 2, 2, None, None, None], [0, 1, 1, None, None, None])
        return Shape([f6, f6 + 2, f6 + 2, None, None, None], [1, 3, 4, None, None, None])
    if f5 == 0:
        return Shape([None, 0, 2, 2, None, None], [None, 0, 1, 1, None, None])
    return Shape([None, f5, f5 + 2, f5 + 2, None, None], [None, 1, 3, 4, None, None])


def full_chord_shape(chord: Chord) -> Shape:
    quality = "maj" if chord.quality == "5" else chord.quality
    if (chord.root, quality) in _OPEN:
        return _OPEN[(chord.root, quality)]
    if quality == "dim":
        r = _fret_on(5, chord.root, 1)
        return Shape([None, r, r + 1, r + 2, r + 1, None], [None, 1, 2, 4, 3, None])
    f6 = _fret_on(6, chord.root, 1)
    f5 = _fret_on(5, chord.root, 1)
    if f6 <= f5:
        rel, fing = _E_SHAPE[quality]
        return Shape([f6 + r for r in rel], list(fing))
    rel, fing = _A_SHAPE[quality]
    return Shape([None if r is None else f5 + r for r in rel], list(fing))


def shape_for(chord: Chord, power: bool) -> Shape:
    if power or chord.quality == "5":
        return power_chord_shape(chord.root)
    return full_chord_shape(chord)
