"""Melody harmonisation: rank chord progressions that fit a melody.

For each segment (bar, or half-bar for the 'alternative' option) every chord in a
style palette is scored against the melody notes (chord tones on strong beats
score highest; out-of-key notes clash). A Viterbi pass then adds musical
'grammar' (home -> away -> tension -> home), start/end-on-home bonuses and a
complexity penalty, and returns the best progression for each palette.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from ..music.chords import power_chord_shape, shape_for
from ..music.genres import GENRES, GenreDef, genre_of, progression_name
from ..music.theory import Chord, Key
from ..schemas import ChordCandidate, ChordDiagram, Harmonization, HarmonizeResponse, KeyCandidate, NoteEvent
from .transcription import key_candidates_for

# roman -> (interval from tonic, quality, functional group)
DEGREES_MAJOR = {
    "I": (0, "maj", "T"), "ii": (2, "min", "S"), "iii": (4, "min", "T"), "IV": (5, "maj", "S"),
    "V": (7, "maj", "D"), "vi": (9, "min", "T"), "bVII": (10, "maj", "S"),
}
DEGREES_MINOR = {
    "i": (0, "min", "T"), "bIII": (3, "maj", "T"), "iv": (5, "min", "S"), "v": (7, "min", "D"),
    "V": (7, "maj", "D"), "bVI": (8, "maj", "S"), "bVII": (10, "maj", "S"),
}
PALETTES = {
    "major": {
        "simple": ["I", "IV", "V"],
        "rock": ["I", "IV", "V", "bVII", "vi"],
        "alternative": ["I", "ii", "iii", "IV", "V", "vi"],
    },
    "minor": {
        "simple": ["i", "iv", "V"],
        "rock": ["i", "bIII", "iv", "v", "bVI", "bVII"],
        "alternative": ["i", "bIII", "iv", "V", "bVI", "bVII"],
    },
}
FUNCTION_TEXT = {
    "I": "Home — sounds settled", "i": "Home — sounds settled",
    "IV": "Moving away — adds lift", "iv": "Moving away — moody lift", "ii": "Moving away — soft lift",
    "V": "Tension — wants to go home", "v": "Gentle tension",
    "vi": "Home's sad cousin", "iii": "Gentle color", "bVII": "Classic rock color",
    "bIII": "Big rock sound", "bVI": "Big dramatic sound",
}
_FLOW = {  # functional group transitions
    ("T", "S"): 0.15, ("S", "D"): 0.2, ("D", "T"): 0.3, ("T", "D"): 0.08, ("S", "T"): 0.12,
    ("D", "S"): -0.05, ("S", "S"): 0.02, ("T", "T"): 0.0, ("D", "D"): -0.05,
}
_SPECIAL = {("bVII", "I"): 0.2, ("bVII", "IV"): 0.1, ("IV", "I"): 0.08, ("V", "vi"): 0.1, ("vi", "IV"): 0.1,
            ("ii", "V"): 0.15, ("bVI", "bVII"): 0.15, ("bVII", "i"): 0.2, ("iv", "V"): 0.1}

DESCRIPTIONS = {
    "simple": ("Simple", "Three friendly chords — home, away and tension. The easiest to hear and play."),
    "alternative": ("Alternative", "A different mood: minor chords and quicker changes where they fit the tune."),
}
GENRE_DESCRIPTIONS = {
    "rock": "Power chords with classic-rock moves like the ♭VII. The backing band chugs them in eighth notes.",
    "pop": "Bright full chords that lean towards the I–V–vi–IV loop, with a strummed groove.",
    "blues": "7th chords and a shuffle groove, following the shape of the 12-bar blues.",
}
_MINOR_TEMPLATE = {"I": "i", "IV": "iv", "V": "v", "vi": "bVI"}
EXPLANATION = ("Many different chord progressions can fit the same melody. Each one contains the tune's important "
               "notes, but gives it a different mood. Listen to all three and keep the one you like best.")


@dataclass
class Segment:
    start: float
    length: float
    notes: list[tuple[int, float, float]]  # (pc, weight, metric strength)


def _metric_strength(beat_in_bar: float, beats_per_bar: int) -> float:
    if abs(beat_in_bar) < 1e-6:
        return 1.0
    if beats_per_bar % 2 == 0 and abs(beat_in_bar - beats_per_bar / 2) < 1e-6:
        return 0.75
    if abs(beat_in_bar - round(beat_in_bar)) < 1e-6:
        return 0.5
    return 0.3


def build_segments(notes: list[NoteEvent], beats_per_bar: int, seg_len: float, total_beats: float) -> list[Segment]:
    n_seg = max(1, ceil(total_beats / seg_len - 1e-9))
    segs = [Segment(i * seg_len, seg_len, []) for i in range(n_seg)]
    for n in notes:
        a, b = n.start_beat, n.start_beat + n.duration_beats
        for i in range(int(a // seg_len), min(n_seg, int(ceil(b / seg_len)))):
            s0, s1 = segs[i].start, segs[i].start + seg_len
            overlap = min(b, s1) - max(a, s0)
            if overlap <= 0:
                continue
            onset_here = s0 <= a < s1
            strength = _metric_strength(a % beats_per_bar, beats_per_bar) if onset_here else 0.4
            segs[i].notes.append((n.midi % 12, min(overlap, 2.0), strength))
    return segs


def chord_fit(seg: Segment, chord: Chord, key: Key) -> float:
    if not seg.notes:
        return 0.0
    pcs = chord.pcs
    total, score = 0.0, 0.0
    for pc, w, strength in seg.notes:
        weight = w * strength
        total += weight
        if pc == chord.root:
            v = 1.0
        elif pc in pcs:
            v = 0.9
        elif pc in key.scale:
            v = -0.15 if strength < 0.75 else -0.45
        else:
            v = -0.8
        score += weight * v
    return score / total if total else 0.0


def _degree(key: Key, roman: str) -> tuple[Chord, str]:
    table = DEGREES_MAJOR if key.mode == "major" else DEGREES_MINOR
    interval, quality, group = table[roman]
    return Chord((key.tonic + interval) % 12, quality), group


def _transition(r1: str, g1: str, r2: str, g2: str, kind: str, genre: GenreDef | None) -> float:
    if r1 == r2:
        return {"genre": 0.06, "simple": 0.04, "alternative": 0.1}[kind]
    v = _FLOW.get((g1, g2), 0.0) + _SPECIAL.get((r1, r2), 0.0)
    if genre is not None:
        v += genre.special_transitions.get((r1, r2), 0.0)
    return v


def _template_roman(genre: GenreDef, key: Key, bar: int) -> str | None:
    if not genre.template:
        return None
    r = genre.template[bar % len(genre.template)]
    return r if key.mode == "major" else _MINOR_TEMPLATE.get(r)


def viterbi(segs: list[Segment], key: Key, palette: list[str], kind: str, avoid: list[str] | None = None,
            genre: GenreDef | None = None, beats_per_bar: int = 4) -> tuple[list[str], float]:
    states = [(r, *_degree(key, r)) for r in palette]
    tonic = palette[0]
    n = len(segs)
    simple_set = set(PALETTES[key.mode]["simple"])

    def emit(i: int, r: str, chord: Chord) -> float:
        e = 1.6 * chord_fit(segs[i], chord, key)
        if r not in simple_set:
            e -= 0.06  # complexity penalty
        if i == 0 and r == tonic:
            e += 0.3
        if i == n - 1 and r == tonic:
            e += 0.5
        if avoid is not None and avoid[i] == r and segs[i].notes:
            e -= 0.3
        if genre is not None and genre.template_bonus:
            if _template_roman(genre, key, int(segs[i].start // beats_per_bar)) == r:
                e += genre.template_bonus
        return e

    score = [[emit(0, r, c) for r, c, _ in states]]
    back = [[-1] * len(states)]
    for i in range(1, n):
        row, brow = [], []
        for r2, c2, g2 in states:
            best, arg = float("-inf"), 0
            for j, (r1, _, g1) in enumerate(states):
                v = score[-1][j] + _transition(r1, g1, r2, g2, kind, genre)
                if v > best:
                    best, arg = v, j
            row.append(best + emit(i, r2, c2))
            brow.append(arg)
        score.append(row)
        back.append(brow)
    k = max(range(len(states)), key=lambda s: score[-1][s])
    total = score[-1][k]
    path = []
    for i in range(n - 1, -1, -1):
        path.append(states[k][0])
        k = back[i][k]
    return path[::-1], total / max(n, 1)


def _diagram(shape) -> ChordDiagram:
    return ChordDiagram(frets=list(shape.frets), fingers=list(shape.fingers))


def make_chord_candidate(chord: Chord, roman: str, start: float, length: float, fit: float, key: Key,
                         power: bool, seventh: bool = False) -> ChordCandidate:
    if seventh and not power and chord.quality == "maj" and roman in ("I", "IV", "V"):
        chord = Chord(chord.root, "7")
    full = shape_for(chord, power=False)
    pwr = power_chord_shape(chord.root)
    used = pwr if power else full
    symbol = chord.as_power().symbol(key.prefer_flats) if power else chord.symbol(key.prefer_flats)
    return ChordCandidate(
        symbol=symbol, root_pc=chord.root, quality="5" if power else chord.quality, roman=roman,
        function=FUNCTION_TEXT.get(roman, ""), start_beat=start, duration_beats=length, fit=round(fit, 3),
        diagram=_diagram(full), power_diagram=_diagram(pwr), voicing_midis=used.midis())


def _merge(path: list[str], segs: list[Segment], key: Key, power: bool, seventh: bool) -> list[ChordCandidate]:
    out: list[ChordCandidate] = []
    i = 0
    while i < len(path):
        j = i
        while j + 1 < len(path) and path[j + 1] == path[i]:
            j += 1
        chord, _ = _degree(key, path[i])
        merged = Segment(segs[i].start, sum(s.length for s in segs[i:j + 1]),
                         [x for s in segs[i:j + 1] for x in s.notes])
        out.append(make_chord_candidate(chord, path[i], merged.start, merged.length, chord_fit(merged, chord, key),
                                        key, power, seventh))
        i = j + 1
    return out


def harmonize(notes: list[NoteEvent], beats_per_bar: int = 4, style: str = "classic_rock",
              key: KeyCandidate | None = None, total_beats: float | None = None) -> HarmonizeResponse:
    if not notes:
        raise ValueError("The melody has no notes to harmonise")
    notes = sorted(notes, key=lambda n: n.start_beat)
    keys = key_candidates_for(notes)
    chosen = key or keys[0]
    k = Key(chosen.tonic, chosen.mode)
    genre = genre_of(style)
    end = max(n.start_beat + n.duration_beats for n in notes)
    total = total_beats or ceil(end / beats_per_bar - 1e-9) * beats_per_bar

    bar_segs = build_segments(notes, beats_per_bar, beats_per_bar, total)
    pal = PALETTES[k.mode]
    simple_path, simple_score = viterbi(bar_segs, k, pal["simple"], "simple")
    g_palette = list(genre.palette_major if k.mode == "major" else genre.palette_minor)
    genre_path, genre_score = viterbi(bar_segs, k, g_palette, "genre", genre=genre, beats_per_bar=beats_per_bar)

    half = beats_per_bar / 2 if beats_per_bar % 2 == 0 else beats_per_bar
    half_segs = build_segments(notes, beats_per_bar, half, total)
    avoid = [simple_path[int(s.start // beats_per_bar)] for s in half_segs]
    alt_path, alt_score = viterbi(half_segs, k, pal["alternative"], "alternative", avoid=avoid)

    out = []
    for kind, path, segs, sc, power, seventh in (
        ("simple", simple_path, bar_segs, simple_score, False, False),
        ("genre", genre_path, bar_segs, genre_score, genre.power_chords, genre.dominant7),
        ("alternative", alt_path, half_segs, alt_score, False, False),
    ):
        if kind == "genre":
            label, desc = genre.label, GENRE_DESCRIPTIONS[genre.key]
        else:
            label, desc = DESCRIPTIONS[kind]
        romans = [path[int(i)] for i in range(len(path))]
        out.append(Harmonization(kind=kind, genre=genre.key, label=label, description=desc, key=chosen,
                                 chords=_merge(path, segs, k, power, seventh), score=round(sc, 3),
                                 use_power_chords=power, progression_name=progression_name(genre if kind == "genre" else None, romans)))
    return HarmonizeResponse(key_candidates=keys, harmonizations=out, explanation=EXPLANATION)


def transpose_harmonization(h: Harmonization, semitones: int, style: str | None = None) -> Harmonization:
    if semitones == 0:
        return h
    k = Key(h.key.tonic, h.key.mode).transpose(semitones)
    new_key = KeyCandidate(tonic=k.tonic, mode=k.mode, name=k.name, confidence=h.key.confidence,
                           scale_coverage=h.key.scale_coverage)
    seventh = any(c.quality == "7" for c in h.chords)
    chords = []
    for c in h.chords:
        chord, _ = _degree(k, c.roman)
        chords.append(make_chord_candidate(chord, c.roman, c.start_beat, c.duration_beats, c.fit, k,
                                           h.use_power_chords, seventh))
    return h.model_copy(update={"key": new_key, "chords": chords})
