"""Assemble a complete Arrangement (solo + melody + backing band) and validate it."""
from __future__ import annotations

from ..music.fixtures import DEMO_MELODY, DEMO_TEMPO, DEMO_TITLE
from ..music.genres import GenreDef, degree_name, genre_of, scale_degree_labels, solo_scale
from ..music.guitar import STANDARD_TUNING
from ..music.tab import grid_resolution, parse_tab_tokens, render_tab, token_to_technique
from ..music.theory import Key, name_to_midi
from ..schemas import (Arrangement, ArrangementTheory, BackingEvent, ChordCandidate, DetectedMelody, DrumHit,
                       Harmonization, NoteEvent, TheoryNote)
from .lead import generate_lead
from .solo import generate_solo
from .transcription import key_candidates_for


def demo_melody() -> DetectedMelody:
    notes = [NoteEvent(midi=name_to_midi(n), start_beat=b * 4 + i, duration_beats=1, source="demo", confidence=1.0)
             for b, bar in enumerate(DEMO_MELODY) for i, n in enumerate(bar)]
    return DetectedMelody(source="demo", title=DEMO_TITLE, tempo_bpm=DEMO_TEMPO, notes=notes,
                          key_candidates=key_candidates_for(notes),
                          warnings=[], duration_sec=len(notes) * 60 / DEMO_TEMPO)


def _bar_chords(h: Harmonization, total_beats: float):
    for c in h.chords:
        yield c, c.start_beat, min(c.start_beat + c.duration_beats, total_beats)


def _accent(t: float, bpb: int) -> float:
    beat_in_bar = t % bpb
    return 0.8 if abs(beat_in_bar) < 1e-6 or abs(beat_in_bar - bpb / 2) < 1e-6 else 0.55


def _bass_root(c: ChordCandidate) -> int:
    return 28 + (c.root_pc - 4) % 12  # E1..D#2


def backing_for(h: Harmonization, total_beats: float, style: str, beats_per_bar: int = 4) -> list[BackingEvent]:
    """Rhythm guitar, in the genre's own pattern (the 'simple' option plays fewer strums)."""
    genre = genre_of(style)
    out: list[BackingEvent] = []
    for c, start, end in _bar_chords(h, total_beats):
        if genre.key == "blues" and h.kind != "alternative":
            # Shuffle boogie on the low strings: root+5th, root+6th (and ♭7 on the 3rd beat), two eighths per beat.
            root = 40 + (c.root_pc - 4) % 12
            if root > 47:
                root -= 12
            shapes = [7, 7, 9, 9, 10, 10, 9, 9] if h.kind == "genre" else [7, 7, 9, 9, 7, 7, 9, 9]
            t = start
            while t < end - 1e-6:
                idx = int(round((t % beats_per_bar) * 2)) % 8
                out.append(BackingEvent(start_beat=round(t, 4), duration_beats=min(0.45, end - t), symbol=c.symbol,
                                        midis=[root, root + shapes[idx]], velocity=_accent(t, beats_per_bar)))
                t += 0.5
            continue
        if genre.key == "pop" and h.kind != "simple":
            # Down, down-up, up-down-up strum.
            pattern = [(0, 1.0, 0.8), (1, 0.5, 0.6), (1.5, 1.0, 0.5), (2.5, 0.5, 0.5), (3, 0.5, 0.65), (3.5, 0.5, 0.5)]
            bar0 = start - (start % beats_per_bar)
            b = bar0
            while b < end - 1e-6:
                for off, dur, vel in pattern:
                    t = b + off
                    if start - 1e-6 <= t < end - 1e-6:
                        out.append(BackingEvent(start_beat=round(t, 4), duration_beats=min(dur, end - t), symbol=c.symbol,
                                                midis=list(c.voicing_midis), velocity=vel))
                b += beats_per_bar
            continue
        if h.use_power_chords:
            step, length = 0.5, 0.45   # eighth-note chugs
        elif style == "ballad" or (genre.key == "pop" and h.kind == "simple"):
            step, length = 2.0, 2.0
        elif h.kind == "simple":
            step, length = 2.0, 2.0
        else:
            step, length = 1.0, 0.9
        t = start
        while t < end - 1e-6:
            out.append(BackingEvent(start_beat=round(t, 4), duration_beats=min(length, end - t), symbol=c.symbol,
                                    midis=list(c.voicing_midis), velocity=_accent(t, beats_per_bar)))
            t += step
    return out


def bass_for(h: Harmonization, total_beats: float, style: str, beats_per_bar: int = 4) -> list[NoteEvent]:
    genre = genre_of(style)
    out: list[NoteEvent] = []

    def add(m: int, t: float, d: float, end: float):
        out.append(NoteEvent(midi=m, start_beat=round(t, 4), duration_beats=min(d, end - t), source="generated", role="bass"))

    for c, start, end in _bar_chords(h, total_beats):
        root = _bass_root(c)
        minor = c.roman.lstrip("b")[:1].islower()
        third = root + (3 if minor else 4)
        t = start
        i = 0
        if genre.key == "blues":
            walk_up = [root, third, root + 7, root + 9]
            walk_down = [root + 10, root + 9, root + 7, third]
            while t < end - 1e-6:
                bar = int(t // beats_per_bar)
                seq = walk_up if bar % 2 == 0 else walk_down
                add(seq[int(round(t % beats_per_bar)) % 4], t, 0.9, end)
                t += 1.0
        elif genre.key == "pop":
            pattern = [(0, 1.4, root), (1.5, 0.9, root), (2.5, 0.5, root + 7), (3, 0.9, root + 12)]
            b = start - (start % beats_per_bar)
            while b < end - 1e-6:
                for off, dur, m in pattern:
                    if start - 1e-6 <= b + off < end - 1e-6:
                        add(m, b + off, dur, end)
                b += beats_per_bar
        else:
            while t < end - 1e-6:
                if h.kind == "genre":
                    add(root, t, 0.45, end)
                    t += 0.5
                else:
                    add(root if i % 2 == 0 else root + 7, t, 1.9 if h.kind == "simple" else 0.9, end)
                    t += 2.0 if h.kind == "simple" else 1.0
                i += 1
    return out


def drums_for(total_beats: float, style: str, beats_per_bar: int = 4) -> list[DrumHit]:
    genre = genre_of(style)
    out: list[DrumHit] = [DrumHit(start_beat=0, kind="crash", velocity=0.6)]
    soft = style in ("ballad", "acoustic")
    b = 0.0
    while b < total_beats - 1e-6:
        beat = b % beats_per_bar
        on_beat = abs(b - round(b)) < 1e-6
        ib = int(round(beat)) if on_beat else -1
        if genre.key == "pop":
            if ib == 0 or abs(beat - 2.5) < 1e-6 or (ib == 2 and not soft):
                out.append(DrumHit(start_beat=b, kind="kick", velocity=0.6 if soft else 0.85))
        elif ib in (0, 2) or (genre.key == "rock" and abs(beat - 2.5) < 1e-6):
            out.append(DrumHit(start_beat=b, kind="kick", velocity=0.6 if soft else (0.75 if genre.key == "blues" else 0.9)))
        if ib in (1, 3):
            out.append(DrumHit(start_beat=b, kind="snare", velocity=0.5 if soft else (0.7 if genre.key == "blues" else 0.85)))
        # No hat under the opening crash: both are played by the same monophonic
        # synth voice in the frontend, which rejects two starts at the same time.
        if (not soft or on_beat) and b > 1e-9:
            out.append(DrumHit(start_beat=b, kind="hat", velocity=0.45 if on_beat else 0.3))
        b += 0.5
    return out


def _chord_at(h: Harmonization, beat: float) -> ChordCandidate:
    for c in h.chords:
        if c.start_beat - 1e-6 <= beat < c.start_beat + c.duration_beats - 1e-6:
            return c
    return h.chords[-1]


def _with_degrees(notes: list[NoteEvent], h: Harmonization) -> list[NoteEvent]:
    return [n.model_copy(update={"chord_degree": degree_name(n.midi - _chord_at(h, n.start_beat).root_pc)}) for n in notes]


def theory_for(h: Harmonization, key: Key, genre: GenreDef) -> ArrangementTheory:
    sc = solo_scale(genre, key)
    romans: list[str] = []
    for c in h.chords:
        if not romans or romans[-1] != c.roman:
            romans.append(c.roman)
    guide = [TheoryNote(title=t, body=b) for t, b in genre.guide]
    return ArrangementTheory(
        genre=genre.key, genre_label=genre.label, feel=genre.feel, swing=genre.swing,
        progression_name=h.progression_name or "–".join(romans), progression_roman=romans,
        scale_name=sc.name, scale_degrees=scale_degree_labels(sc), guide=guide)


def build_arrangement(melody: DetectedMelody, harmonization: Harmonization, level: str, style: str,
                      title: str | None = None, techniques: str = "auto") -> Arrangement:
    solo, melody_guitar, shift, melody_changes = generate_solo(melody, harmonization, level, style)
    from .harmonizer import transpose_harmonization
    h = transpose_harmonization(harmonization, shift, style)
    tkey = Key(h.key.tonic, h.key.mode)
    genre = genre_of(style)
    bpb = melody.beats_per_bar
    end = max(n.start_beat + n.duration_beats for n in melody.notes)
    total_bars = max(1, int(-(-end // bpb)))
    total_beats = total_bars * bpb
    bar_chords = [_chord_at(h, b * bpb).symbol for b in range(total_bars)]
    shifted = [n.model_copy(update={"midi": n.midi + shift}) for n in melody.notes]
    lead = generate_lead(shifted, h, tkey, level, style, techniques, bpb, total_bars)
    arr = Arrangement(
        title=title or melody.title, key=h.key, tempo_bpm=melody.tempo_bpm, beats_per_bar=bpb,
        total_bars=total_bars, skill_level=level, style=style, transposition_semitones=shift,
        original_melody=melody, melody_guitar=_with_degrees(melody_guitar, h), harmonization=h,
        solo=solo.model_copy(update={"changes": solo.changes + melody_changes, "notes": _with_degrees(solo.notes, h)}),
        lead=lead, theory=theory_for(h, tkey, genre),
        backing=backing_for(h, total_beats, style, bpb), bass=bass_for(h, total_beats, style, bpb),
        drums=drums_for(total_beats, style, bpb),
        melody_tab_ascii=render_tab(melody_guitar, bpb, total_bars, bar_chords),
    )
    problems = validate_arrangement(arr)
    if problems:
        raise ValueError("Generated arrangement failed validation: " + "; ".join(problems))
    return arr


def validate_arrangement(arr: Arrangement) -> list[str]:
    """Return a list of problems (empty = valid)."""
    issues: list[str] = []
    total_beats = arr.total_bars * arr.beats_per_bar
    parts = [("solo", arr.solo.notes, arr.solo.tab_ascii), ("melody", arr.melody_guitar, arr.melody_tab_ascii)]
    if arr.lead:
        parts.append(("lead", arr.lead.notes, arr.lead.tab_ascii))
    for part_name, notes, tab in parts:
        last_end = -1.0
        for n in sorted(notes, key=lambda x: x.start_beat):
            if n.string is None or n.fret is None:
                issues.append(f"{part_name}: note {n.id} has no guitar position")
                continue
            if not 0 <= n.fret <= 24:
                issues.append(f"{part_name}: invalid fret {n.fret}")
            if STANDARD_TUNING[n.string] + n.fret != n.fretted_midi:
                issues.append(f"{part_name}: {n.name} does not match string {n.string} fret {n.fret}")
            if n.start_beat < last_end - 1e-6:
                issues.append(f"{part_name}: overlapping notes at beat {n.start_beat}")
            if n.start_beat + n.duration_beats > total_beats + 1e-6:
                issues.append(f"{part_name}: note at beat {n.start_beat} runs past the end")
            last_end = n.start_beat + n.duration_beats
        for a, b in zip(notes, notes[1:]):
            if b.technique in ("slide_up", "slide_down", "hammer_on", "pull_off"):
                if a.string != b.string or a.fret is None:
                    issues.append(f"{part_name}: {b.technique} at beat {b.start_beat} is not on the previous note's string")
                elif b.technique.startswith("slide") and b.slide_from_fret != a.fret:
                    issues.append(f"{part_name}: slide at beat {b.start_beat} does not start from the previous fret")
        if tab:
            res = grid_resolution(notes)
            try:
                parsed = parse_tab_tokens(tab, arr.beats_per_bar, res)
                for _, _, tok in parsed:
                    token_to_technique(tok)
            except ValueError:
                issues.append(f"{part_name}: TAB does not match note data (unreadable TAB)")
                continue
            expected = sorted((n.start_beat, n.string, n) for n in notes)
            if [(b, s) for b, s, _ in parsed] != [(b, s) for b, s, _ in expected]:
                issues.append(f"{part_name}: TAB does not match note data")
            else:
                for (_, _, tok), (_, _, n) in zip(parsed, expected):
                    t = token_to_technique(tok)
                    if (t["fret"], t["technique"], t["bend_semitones"], t["vibrato"]) != (
                            n.fret, n.technique, n.bend_semitones, n.vibrato):
                        issues.append(f"{part_name}: TAB does not match note data at beat {n.start_beat}")
                        break
    if arr.solo.notes and any(n.source != "generated" for n in arr.solo.notes):
        issues.append("solo contains non-generated notes")
    return issues
