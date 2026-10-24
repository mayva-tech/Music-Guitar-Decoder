"""Beginner rock solo generator.

Rule-based and deterministic, so every result can be explained:

1. Range fitting  — choose a transposition (and per-note octave moves only if needed)
   so the tune sits on the beginner's strings/frets. Every change is reported.
2. Rhythm         — zero/few-notes levels use one note per beat (held notes stay held,
   rests stay rests); higher levels keep the melody's eighth-note rhythm.
3. Harmony        — strong beats land on chord tones; other notes stay in the key.
4. Lead devices   — phrase-opening echo (1-2-2-1), neighbour-note approach for
   back-and-forth figures, varied repeats of earlier bars, and a cadence that walks
   down the home chord to land on the home note.
5. Fingering      — positions from the guitar path optimiser; TAB rendered from them.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..music.guitar import choose_positions, level_constraints, playable_midis
from ..music.tab import render_tab
from ..music.theory import Chord, Key, midi_to_name
from ..schemas import DetectedMelody, GeneratedSolo, Harmonization, NoteEvent

FRIENDLY_MAJOR = {0, 7, 2, 9, 4}  # C G D A E
FRIENDLY_MINOR = {9, 4, 2}        # Am Em Dm
GUITAR_LOW, GUITAR_HIGH = 40, 86


@dataclass
class FitResult:
    shift: int
    coverage: float
    folded: int = 0
    unreachable: int = 0
    notes: list[str] = field(default_factory=list)


def choose_transposition(midis: list[int], playable: set[int], key: Key) -> FitResult:
    best: FitResult | None = None
    best_score = float("-inf")
    for shift in range(-12, 13):
        cov, folded, unreach = 0.0, 0, 0
        for m in midis:
            t = m + shift
            if t in playable:
                cov += 1
            elif any(t + 12 * k in playable for k in (-3, -2, -1, 1, 2, 3)):
                cov += 0.6
                folded += 1
            else:
                unreach += 1
        cov /= len(midis)
        tonic = (key.tonic + shift) % 12
        friendly = tonic in (FRIENDLY_MAJOR if key.mode == "major" else FRIENDLY_MINOR)
        score = cov - 0.004 * abs(shift) - (0.03 if shift % 12 else 0) + (0.02 if friendly else 0)
        if score > best_score + 1e-9:
            best_score, best = score, FitResult(shift, cov, folded, unreach)
    assert best is not None
    return best


def _nearest(target: int, pool: list[int], prev: int | None) -> int:
    return min(pool, key=lambda p: (abs(p - target), abs(p - prev) if prev is not None else 0, p))


def _fold(m: int, playable: list[int], prev: int | None) -> int:
    options = [m + 12 * k for k in range(-3, 4) if m + 12 * k in playable]
    if options:
        ref = prev if prev is not None else m
        return min(options, key=lambda p: (abs(p - ref), abs(p - m)))
    return _nearest(m, playable, prev)


@dataclass
class Slot:
    start: float
    dur: float
    midi: int
    role: str = "melody"


def _chord_at(h: Harmonization, beat: float, key: Key) -> Chord:
    for c in h.chords:
        if c.start_beat - 1e-6 <= beat < c.start_beat + c.duration_beats - 1e-6:
            minor = c.roman.lstrip("b")[:1].islower()
            return Chord(c.root_pc, "min" if minor else "maj")
    last = h.chords[-1]
    return Chord(last.root_pc, "maj")


def _rhythm_slots(notes: list[NoteEvent], total_beats: float, quarter_only: bool) -> list[Slot]:
    if not quarter_only:
        return [Slot(n.start_beat, n.duration_beats, n.midi) for n in notes]
    slots: list[Slot] = []
    b = 0.0
    while b < total_beats - 1e-9:
        best, best_ov, starts_here = None, 0.0, False
        for n in notes:
            ov = min(b + 1, n.start_beat + n.duration_beats) - max(b, n.start_beat)
            sh = b - 1e-6 <= n.start_beat < b + 1 - 1e-6
            if ov > 1e-6 and (sh and not starts_here or (sh == starts_here and ov > best_ov)):
                best, best_ov, starts_here = n, ov, sh
        if best is None:
            b += 1
            continue
        if not starts_here and slots and slots[-1].start + slots[-1].dur >= b - 1e-6 and slots[-1].midi == best.midi:
            slots[-1].dur += 1  # a held note stays held
        else:
            slots.append(Slot(b, 1.0, best.midi))
        b += 1
    return slots


def generate_solo(melody: DetectedMelody, harmonization: Harmonization, level: str = "zero",
                  style: str = "classic_rock", allow_transpose: bool = True) -> tuple[GeneratedSolo, list[NoteEvent], int, list[str]]:
    """Returns (solo, melody_on_guitar, transposition, melody_changes)."""
    from .harmonizer import transpose_harmonization

    notes = sorted(melody.notes, key=lambda n: n.start_beat)
    if not notes:
        raise ValueError("The melody has no notes")
    bpb = melody.beats_per_bar
    cons = level_constraints(level)
    playable_set = playable_midis(cons)
    playable = sorted(playable_set)
    key = Key(harmonization.key.tonic, harmonization.key.mode)
    end = max(n.start_beat + n.duration_beats for n in notes)
    total_bars = max(1, int(-(-end // bpb)))
    total_beats = total_bars * bpb

    fit = choose_transposition([n.midi for n in notes], playable_set, key)
    shift = fit.shift if allow_transpose else 0  # riffs keep their own key; notes are octave-folded instead
    h = transpose_harmonization(harmonization, shift, style)
    tkey = key.transpose(shift)
    changes: list[str] = []
    if shift:
        direction = "up" if shift > 0 else "down"
        changes.append(f"Moved the whole tune {direction} {abs(shift)} semitone{'s' if abs(shift) != 1 else ''} "
                       f"(from {key.name} to {tkey.name}) so it sits on the easy strings.")

    # --- Melody on guitar (same rhythm, same notes, only transposed / octave-folded if unplayable)
    melody_changes: list[str] = []
    mg_midis = []
    for n in notes:
        t = n.midi + shift
        while t < GUITAR_LOW:
            t += 12
        while t > GUITAR_HIGH:
            t -= 12
        mg_midis.append(t)
    if any(m != n.midi + shift for m, n in zip(mg_midis, notes)):
        melody_changes.append("Some notes were outside the guitar's range and were moved by an octave.")
    mg_pos = choose_positions(mg_midis, level)
    melody_guitar = [
        NoteEvent(midi=p.midi, name=midi_to_name(p.midi, tkey.prefer_flats), start_beat=n.start_beat,
                  duration_beats=n.duration_beats, string=p.string, fret=p.fret, finger=p.finger,
                  confidence=n.confidence, low_confidence=n.low_confidence,
                  source="transposed" if shift else n.source, role="melody", in_level_range=p.in_level_range)
        for n, p in zip(notes, mg_pos)
    ]
    out_of_zone = sum(1 for p in mg_pos if not p.in_level_range)
    if out_of_zone:
        melody_changes.append(f"{out_of_zone} melody note{'s need' if out_of_zone > 1 else ' needs'} a stretch "
                              f"beyond your current zone (shown in the TAB).")

    # --- Solo
    shifted = [n.model_copy(update={"midi": n.midi + shift}) for n in notes]
    slots = _rhythm_slots(shifted, total_beats, cons.quarter_notes_only)
    if cons.quarter_notes_only and any(abs(n.start_beat - round(n.start_beat)) > 1e-6 or n.duration_beats < 1
                                       for n in notes):
        changes.append("Simplified the rhythm to one note per beat.")

    folded = 0
    prev = None
    for s in slots:
        m = s.midi
        if m not in playable_set:
            m2 = _fold(m, playable, prev)
            if (m2 - m) % 12 == 0:
                folded += 1
            s.midi = m2
        prev = s.midi
    if folded:
        changes.append(f"Moved {folded} note{'s' if folded > 1 else ''} by an octave to keep them in reach.")

    # Harmony constraints
    replaced = 0
    prev = None
    for s in slots:
        chord = _chord_at(h, s.start, tkey)
        beat_in_bar = s.start % bpb
        strong = abs(beat_in_bar) < 1e-6 or (bpb % 2 == 0 and abs(beat_in_bar - bpb / 2) < 1e-6)
        if strong and s.midi % 12 not in chord.pcs:
            pool = [p for p in playable if p % 12 in chord.pcs]
            if pool:
                s.midi = _nearest(s.midi, pool, prev)
                s.role = "chord_tone"
                replaced += 1
        elif not strong and s.midi % 12 not in tkey.scale:
            pool = [p for p in playable if p % 12 in tkey.scale]
            s.midi = _nearest(s.midi, pool, prev)
            s.role = "passing"
            replaced += 1
        elif strong:
            s.role = "chord_tone"
        prev = s.midi
    if replaced:
        changes.append(f"Adjusted {replaced} note{'s' if replaced > 1 else ''} so the solo agrees with the chords.")

    # Lead devices, bar by bar (only on full bars of four single-beat attacks)
    bars: dict[int, list[Slot]] = {}
    for s in slots:
        bars.setdefault(int(s.start // bpb), []).append(s)
    seen_patterns: dict[tuple[int, ...], int] = {}
    scale_pool = [p for p in playable if p % 12 in tkey.scale]
    for b in range(total_bars):
        bs = bars.get(b, [])
        quarter_bar = (len(bs) == bpb == 4 and all(abs(s.dur - 1) < 1e-6 for s in bs))
        final = b == total_bars - 1
        if not quarter_bar or final:
            continue
        pattern = tuple(s.midi for s in bs)
        chord = _chord_at(h, b * bpb, tkey)
        a, x, c, d = pattern
        if pattern in seen_patterns:
            # Varied repeat: end the bar on a different chord tone.
            pool = [p for p in playable if p % 12 in chord.pcs and p != d]
            if pool:
                bs[3].midi = _nearest(d, pool, c)
                bs[3].role = "variation"
        elif a == c and x == d and a != x and a % 12 in chord.pcs:
            # Back-and-forth figure -> approach the main note from the step below.
            lower = [p for p in scale_pool if p < a]
            if lower and a - max(lower) <= 2:
                bs[2].midi, bs[2].role = max(lower), "neighbor"
                bs[3].midi, bs[3].role = a, "chord_tone"
        elif b % 4 == 0 and x % 12 in chord.pcs and a != x:
            # Phrase-opening echo: repeat the second note, then return to the first.
            bs[2].midi, bs[2].role = x, "echo"
            bs[3].midi, bs[3].role = a, "echo"
        seen_patterns[pattern] = b

    # Cadence: land on the home note.
    tonic_pool = [p for p in playable if p % 12 == tkey.tonic]
    if tonic_pool and slots:
        last = slots[-1]
        prev_m = slots[-2].midi if len(slots) > 1 else last.midi
        tonic = _nearest(last.midi, tonic_pool, prev_m)
        bar_start = (total_bars - 1) * bpb
        final_bar = [s for s in slots if s.start >= bar_start - 1e-6]
        home = Chord(tkey.tonic, "maj" if tkey.mode == "major" else "min")
        last_chord = _chord_at(h, bar_start, tkey)
        if (len(final_bar) == 4 and all(abs(s.dur - 1) < 1e-6 for s in final_bar)
                and last_chord.root == tkey.tonic):
            above = sorted({p for p in playable if p % 12 in home.pcs and tonic < p <= tonic + 9}, reverse=True)
            if len(above) >= 2:
                final_bar[0].midi, final_bar[1].midi = above[0], above[1]
                final_bar[0].role = final_bar[1].role = "cadence"
            final_bar[2].midi = final_bar[3].midi = tonic
            final_bar[2].role = final_bar[3].role = "home"
            changes.append(f"Ends by walking down the home chord to {midi_to_name(tonic, tkey.prefer_flats)}.")
        else:
            if last.midi != tonic:
                changes.append(f"Ends on the home note {midi_to_name(tonic, tkey.prefer_flats)}.")
            last.midi, last.role = tonic, "home"
        last = slots[-1]
        last.dur = max(last.dur, total_beats - last.start)

    positions = choose_positions([s.midi for s in slots], level)
    solo_notes = [
        NoteEvent(midi=p.midi, name=midi_to_name(p.midi, tkey.prefer_flats), start_beat=s.start,
                  duration_beats=s.dur, string=p.string, fret=p.fret, finger=p.finger, source="generated",
                  role=s.role, in_level_range=p.in_level_range)
        for s, p in zip(slots, positions)
    ]
    stretch = sum(1 for p in positions if not p.in_level_range)
    if stretch:
        changes.append(f"{stretch} note{'s' if stretch > 1 else ''} sit just outside the beginner zone.")
    bar_chords = [_bar_symbol(h, b * bpb) for b in range(total_bars)]
    tab = render_tab(solo_notes, bpb, total_bars, bar_chords)
    solo = GeneratedSolo(level=level, style=style, notes=solo_notes, transposition_semitones=shift,
                         changes=changes, tab_ascii=tab)
    return solo, melody_guitar, shift, melody_changes


def _bar_symbol(h: Harmonization, beat: float) -> str:
    for c in h.chords:
        if c.start_beat - 1e-6 <= beat < c.start_beat + c.duration_beats - 1e-6:
            return c.symbol
    return ""
