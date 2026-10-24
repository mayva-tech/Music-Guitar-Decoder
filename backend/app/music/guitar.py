"""Guitar model: tuning, string/fret positions, path optimisation and fingering.

String numbering is the guitarist's convention: string 1 = thinnest (high e),
string 6 = thickest (low E). Visual orientation never changes this data.

    MIDI_NOTE = OPEN_STRING_MIDI + FRET_NUMBER
"""
from __future__ import annotations

from dataclasses import dataclass

from .theory import midi_to_name

STANDARD_TUNING: dict[int, int] = {6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64}
STRING_LABELS: dict[int, str] = {6: "E", 5: "A", 4: "D", 3: "G", 2: "B", 1: "e"}
MAX_FRET = 22

FINGER_NAMES = {0: "open string", 1: "index finger", 2: "middle finger", 3: "ring finger", 4: "pinky finger"}


@dataclass(frozen=True)
class LevelConstraints:
    """Playing-position rules for a skill level."""

    level: str
    allowed_strings: tuple[int, ...]
    preferred_strings: tuple[int, ...]
    max_fret: int
    quarter_notes_only: bool


LEVELS: dict[str, LevelConstraints] = {
    "zero": LevelConstraints("zero", (1, 2, 3), (1, 2), 3, True),
    "few_notes": LevelConstraints("few_notes", (1, 2, 3, 4), (1, 2, 3), 5, True),
    "basic_chords": LevelConstraints("basic_chords", (1, 2, 3, 4, 5), (1, 2, 3), 5, False),
    "intermediate": LevelConstraints("intermediate", (1, 2, 3, 4, 5, 6), (1, 2, 3, 4), 12, False),
    "advanced": LevelConstraints("advanced", (1, 2, 3, 4, 5, 6), (1, 2, 3, 4, 5, 6), 17, False),
}


def level_constraints(level: str) -> LevelConstraints:
    try:
        return LEVELS[level]
    except KeyError as exc:
        raise ValueError(f"Unknown skill level: {level}") from exc


def midi_at(string: int, fret: int, tuning: dict[int, int] = STANDARD_TUNING) -> int:
    if string not in tuning:
        raise ValueError(f"Invalid string number: {string}")
    if not 0 <= fret <= MAX_FRET:
        raise ValueError(f"Invalid fret number: {fret}")
    return tuning[string] + fret


def positions_for_midi(midi: int, max_fret: int = MAX_FRET, strings: tuple[int, ...] = (1, 2, 3, 4, 5, 6),
                       tuning: dict[int, int] = STANDARD_TUNING) -> list[tuple[int, int]]:
    """Every (string, fret) that produces exactly this MIDI pitch."""
    out = []
    for s in strings:
        fret = midi - tuning[s]
        if 0 <= fret <= max_fret:
            out.append((s, fret))
    return out


def playable_midis(constraints: LevelConstraints, tuning: dict[int, int] = STANDARD_TUNING) -> set[int]:
    return {tuning[s] + f for s in constraints.allowed_strings for f in range(constraints.max_fret + 1)}


@dataclass
class Position:
    midi: int
    string: int
    fret: int
    finger: int
    in_level_range: bool

    @property
    def name(self) -> str:
        return midi_to_name(self.midi)


def _node_cost(string: int, fret: int, c: LevelConstraints) -> float:
    cost = 0.0
    if string not in c.allowed_strings:
        cost += 12.0
    elif string not in c.preferred_strings:
        cost += 2.5
    if fret > c.max_fret:
        cost += 8.0 + 3.0 * (fret - c.max_fret)
    cost += 0.35 * fret
    if fret == 0:
        cost -= 0.4  # beginners love open strings
    return cost


def _transition_cost(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    (m1, s1, f1), (m2, s2, f2) = a, b
    if m1 == m2:
        return 0.0 if (s1, f1) == (s2, f2) else 6.0  # same note -> same place
    cost = 0.6 * abs(s1 - s2)
    if f1 > 0 and f2 > 0:
        d = abs(f1 - f2)
        cost += 0.5 * d + (2.0 * (d - 3) if d > 3 else 0.0)
    elif f1 == 0 and f2 == 0:
        cost += 0.1
    else:
        cost += 0.15 * max(f1, f2)
    return cost


def choose_positions(midis: list[int], level: str = "zero",
                     tuning: dict[int, int] = STANDARD_TUNING) -> list[Position]:
    """Pick a string/fret for every note, minimising difficulty and hand movement.

    Viterbi over all valid positions of each note. Positions outside the level's
    comfort zone are allowed only with a large cost, and are flagged.
    """
    if not midis:
        return []
    c = level_constraints(level)
    candidates: list[list[tuple[int, int]]] = []
    for m in midis:
        cands = positions_for_midi(m, MAX_FRET, tuple(tuning.keys()), tuning)
        if not cands:
            raise ValueError(f"{midi_to_name(m)} (MIDI {m}) cannot be played on a standard-tuned guitar")
        candidates.append(cands)

    # Viterbi
    costs = [[_node_cost(s, f, c) for s, f in candidates[0]]]
    back: list[list[int]] = [[-1] * len(candidates[0])]
    for i in range(1, len(midis)):
        row, brow = [], []
        for s, f in candidates[i]:
            node = _node_cost(s, f, c)
            best, arg = float("inf"), -1
            for j, (ps, pf) in enumerate(candidates[i - 1]):
                v = costs[i - 1][j] + _transition_cost((midis[i - 1], ps, pf), (midis[i], s, f))
                if v < best:
                    best, arg = v, j
            row.append(best + node)
            brow.append(arg)
        costs.append(row)
        back.append(brow)

    idx = min(range(len(costs[-1])), key=lambda k: costs[-1][k])
    path = [0] * len(midis)
    for i in range(len(midis) - 1, -1, -1):
        path[i] = idx
        idx = back[i][idx]

    chosen = [candidates[i][path[i]] for i in range(len(midis))]
    fingers = assign_fingers([f for _, f in chosen])
    return [
        Position(midi=m, string=s, fret=f, finger=fing,
                 in_level_range=(s in c.allowed_strings and f <= c.max_fret))
        for m, (s, f), fing in zip(midis, chosen, fingers)
    ]


def assign_fingers(frets: list[int]) -> list[int]:
    """Fretting-hand fingers (0 open, 1 index … 4 pinky) using a 4-fret hand window.

    In first position (frets 1–4) the finger number equals the fret number,
    e.g. fret 3 -> ring finger. Higher up, the hand window is chosen to cover as
    many upcoming notes as possible.
    """
    fingers: list[int] = []
    base: int | None = None
    for i, fret in enumerate(frets):
        if fret == 0:
            fingers.append(0)
            continue
        if base is None or not (base <= fret <= base + 3):
            upcoming = [f for f in frets[i:] if f > 0]
            window = [fret]
            for f in upcoming[1:6]:
                trial = window + [f]
                if max(trial) - min(trial) <= 3:
                    window = trial
                else:
                    break
            lo = min(window)
            base = 1 if max(window) <= 4 else lo
            if not (base <= fret <= base + 3):
                base = fret
        fingers.append(fret - base + 1)
    return fingers
