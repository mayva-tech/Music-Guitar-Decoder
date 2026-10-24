"""Harmonizer and solo generator tests."""
import pytest

from app.music.fixtures import DEMO_HARMONY, REFERENCE_SOLO
from app.music.guitar import STANDARD_TUNING
from app.music.tab import grid_resolution, parse_tab
from app.music.theory import Chord, name_to_midi
from app.schemas import DetectedMelody, NoteEvent
from app.services.arrangement import build_arrangement, demo_melody, validate_arrangement
from app.services.harmonizer import harmonize


def _melody(names, beats=None, bpm=100):
    beats = beats or [1.0] * len(names)
    t, notes = 0.0, []
    for n, b in zip(names, beats):
        if n is not None:
            notes.append(NoteEvent(midi=name_to_midi(n), start_beat=t, duration_beats=b))
        t += b
    return DetectedMelody(tempo_bpm=bpm, notes=notes)


def _get(resp, kind):
    return next(h for h in resp.harmonizations if h.kind == kind)


# 11. Chord candidate validation
def test_demo_harmony_is_c_f_g_c():
    m = demo_melody()
    r = harmonize(m.notes)
    assert r.key_candidates[0].name == "C major"
    assert [c.symbol for c in _get(r, "simple").chords] == DEMO_HARMONY
    assert [c.symbol for c in _get(r, "genre").chords] == ["C5", "F5", "G5", "C5"]
    assert {h.kind for h in r.harmonizations} == {"simple", "genre", "alternative"}
    assert "Many different chord progressions" in r.explanation


def test_chord_candidates_are_consistent():
    r = harmonize(demo_melody().notes)
    for h in r.harmonizations:
        assert h.chords[0].start_beat == 0
        for a, b in zip(h.chords, h.chords[1:]):
            assert a.start_beat + a.duration_beats == pytest.approx(b.start_beat)  # contiguous timeline
        for c in h.chords:
            for diag in (c.diagram, c.power_diagram):
                assert len(diag.frets) == 6
                for f, fing in zip(diag.frets, diag.fingers):
                    assert (f is None) == (fing is None)
                    if f == 0:
                        assert fing == 0
            assert all(m % 12 in Chord(c.root_pc, "maj").pcs + Chord(c.root_pc, "min").pcs + Chord(c.root_pc, "7").pcs
                       for m in c.voicing_midis)


def test_alternative_differs_from_simple():
    r = harmonize(demo_melody().notes)
    simple = [c.symbol for c in _get(r, "simple").chords]
    alt = [c.symbol for c in _get(r, "alternative").chords]
    assert alt != simple


def test_minor_melody_gets_minor_key():
    m = _melody(["A4", "C5", "E5", "A4", "G4", "B4", "D5", "G4", "F4", "A4", "C5", "F4", "E4", "G#4", "B4", "A4"])
    r = harmonize(m.notes)
    assert r.key_candidates[0].name == "A minor"
    assert _get(r, "simple").chords[0].symbol == "Am"


# Demo / reference fixture
def test_demo_generates_reference_solo():
    m = demo_melody()
    h = _get(harmonize(m.notes), "genre")
    arr = build_arrangement(m, h, "zero", "classic_rock")
    assert [n.name for n in arr.solo.notes] == [n for bar in REFERENCE_SOLO for n in bar]
    assert [n.start_beat for n in arr.solo.notes] == list(range(16))
    assert arr.transposition_semitones == 0
    assert validate_arrangement(arr) == []


# 12. Solo range constraints (zero level)
@pytest.mark.parametrize("names", [
    ["E4", "G4", "E4", "C4", "F4", "C4", "F4", "C4", "G4", "D4", "B3", "G4", "E4", "G4", "C4", "C4"],
    ["A4", "C5", "E5", "A4", "G4", "B4", "D5", "G4", "F4", "A4", "C5", "F4", "E4", "G#4", "B4", "A4"],
    ["G3", "B3", "D4", "G4", "A3", "C4", "E4", "A4", "D4", "F#4", "A4", "D5", "G3", "G3", "G3", "G3"],
    ["C5", "D5", "E5", "F5", "G5", "A5", "B5", "C6"],
])
def test_zero_level_solo_constraints(names):
    m = _melody(names)
    h = _get(harmonize(m.notes), "genre")
    arr = build_arrangement(m, h, "zero", "classic_rock")
    for n in arr.solo.notes:
        assert n.string in (1, 2, 3)
        assert 0 <= n.fret <= 3
        assert STANDARD_TUNING[n.string] + n.fret == n.midi
        assert n.start_beat == int(n.start_beat)  # one note per beat
        assert (n.fret == 0) == (n.finger == 0)
    starts = [n.start_beat for n in arr.solo.notes]
    assert starts == sorted(set(starts))  # one note at a time
    # ends on the home note
    assert arr.solo.notes[-1].midi % 12 == arr.key.tonic
    assert validate_arrangement(arr) == []


# 13. Solo notes match rendered TAB
def test_solo_tab_matches_notes():
    m = _melody(["A4", "C5", "E5", "A4", "G4", "B4", "D5", "G4"], beats=[0.5, 0.5, 1, 2, 0.5, 0.5, 1, 2])
    h = _get(harmonize(m.notes), "simple")
    for level in ("zero", "intermediate"):
        arr = build_arrangement(m, h, level, "classic_rock")
        res = grid_resolution(arr.solo.notes)
        parsed = parse_tab(arr.solo.tab_ascii, 4, res)
        assert parsed == sorted((n.start_beat, n.string, n.fret) for n in arr.solo.notes)
        for (beat, s, f) in parsed:
            note = next(n for n in arr.solo.notes if n.start_beat == beat)
            assert STANDARD_TUNING[s] + f == note.midi


# 18. Transposition and range overflow
def test_high_melody_is_transposed_and_original_preserved():
    names = ["C6", "E6", "G6", "C6", "F6", "A6", "C7", "F6"]
    m = _melody(names)
    h = _get(harmonize(m.notes), "simple")
    arr = build_arrangement(m, h, "zero", "classic_rock")
    assert [n.name for n in arr.original_melody.notes] == names  # original untouched
    assert arr.solo.changes  # every change is explained
    assert all(n.fret <= 3 for n in arr.solo.notes)
    assert any("octave" in c or "Moved" in c for c in arr.solo.changes)


def test_transposition_moves_chords_with_melody():
    names = ["A4", "C5", "E5", "A4", "G4", "B4", "D5", "G4", "F4", "A4", "C5", "F4", "E4", "G#4", "B4", "A4"]
    m = _melody(names)
    h = _get(harmonize(m.notes), "simple")
    arr = build_arrangement(m, h, "zero", "classic_rock")
    shift = arr.transposition_semitones
    assert arr.harmonization.chords[0].root_pc == (h.chords[0].root_pc + shift) % 12
    assert arr.key.tonic == (h.key.tonic + shift) % 12
    if shift:
        assert any("Moved the whole tune" in c for c in arr.solo.changes)
    assert [n.midi for n in arr.melody_guitar] == [n.midi + shift for n in m.notes]


def test_backing_band_timeline():
    m = demo_melody()
    h = _get(harmonize(m.notes), "genre")
    arr = build_arrangement(m, h, "zero", "classic_rock")
    total = arr.total_bars * arr.beats_per_bar
    assert len(arr.backing) == total * 2  # eighth-note power chords
    assert all(0 <= e.start_beat < total for e in arr.backing)
    assert {d.kind for d in arr.drums} >= {"kick", "snare", "hat"}
    # Crash and hat share one monophonic synth voice in the frontend, which
    # rejects two starts at the same time — they must never share a beat.
    hat_beats = {d.start_beat for d in arr.drums if d.kind == "hat"}
    crash_beats = {d.start_beat for d in arr.drums if d.kind == "crash"}
    assert not (hat_beats & crash_beats)
    assert all(28 <= n.midi <= 47 for n in arr.bass)
    bar_roots = [next(e.midis[0] % 12 for e in arr.backing if e.start_beat == b * 4) for b in range(4)]
    assert bar_roots == [0, 5, 7, 0]


def test_validation_catches_tab_mismatch():
    m = demo_melody()
    arr = build_arrangement(m, _get(harmonize(m.notes), "simple"), "zero", "classic_rock")
    broken = arr.model_copy(update={"solo": arr.solo.model_copy(
        update={"tab_ascii": arr.solo.tab_ascii.replace("e|--0", "e|--2", 1)})})
    assert any("TAB does not match" in p for p in validate_arrangement(broken))
