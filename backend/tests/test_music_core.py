"""Unit tests: tuning, MIDI conversion, fret positions, fingering, TAB, validation."""
import pytest
from pydantic import ValidationError

from app.music.chords import full_chord_shape, power_chord_shape
from app.music.fixtures import REFERENCE_SOLO, REFERENCE_TAB, VERIFIED_POSITIONS, DEMO_MELODY
from app.music.guitar import (STANDARD_TUNING, assign_fingers, choose_positions, midi_at, playable_midis,
                              level_constraints, positions_for_midi)
from app.music.tab import grid_resolution, parse_tab, render_tab
from app.music.theory import (Chord, Key, estimate_keys, freq_to_midi, midi_to_freq, midi_to_name, name_to_midi,
                              parse_chord)
from app.schemas import GuitarPosition, NoteEvent


# 1. Standard tuning
def test_standard_tuning():
    assert STANDARD_TUNING == {6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64}
    assert [midi_to_name(STANDARD_TUNING[s]) for s in (6, 5, 4, 3, 2, 1)] == ["E2", "A2", "D3", "G3", "B3", "E4"]


# 2. MIDI pitch conversion
@pytest.mark.parametrize("name,midi", [("C4", 60), ("A4", 69), ("E2", 40), ("E4", 64), ("B3", 59), ("Bb3", 58),
                                       ("C#5", 73), ("Db5", 73), ("C-1", 0), ("G9", 127)])
def test_name_midi_roundtrip(name, midi):
    assert name_to_midi(name) == midi


def test_midi_to_name_and_freq():
    assert midi_to_name(61) == "C#4" and midi_to_name(61, prefer_flats=True) == "Db4"
    assert midi_to_freq(69) == pytest.approx(440.0)
    assert midi_to_freq(60) == pytest.approx(261.6256, rel=1e-5)
    assert freq_to_midi(329.6276) == pytest.approx(64, abs=1e-3)
    with pytest.raises(ValueError):
        name_to_midi("H4")
    with pytest.raises(ValueError):
        midi_to_name(128)


# 3. Fret position calculation
@pytest.mark.parametrize("name,pos", list(VERIFIED_POSITIONS.items()))
def test_verified_positions(name, pos):
    string, fret = pos
    assert midi_at(string, fret) == name_to_midi(name)
    assert pos in positions_for_midi(name_to_midi(name))


def test_formula_for_every_string_and_fret():
    for s, open_midi in STANDARD_TUNING.items():
        for f in range(0, 23):
            assert midi_at(s, f) == open_midi + f


def test_invalid_positions_rejected():
    with pytest.raises(ValueError):
        midi_at(7, 0)
    with pytest.raises(ValueError):
        midi_at(1, 30)
    assert positions_for_midi(39) == []  # below low E
    with pytest.raises(ValueError):
        choose_positions([39])


def test_beginner_path_prefers_first_position_on_top_strings():
    mids = [name_to_midi(n) for bar in DEMO_MELODY for n in bar]
    pos = choose_positions(mids, "zero")
    for p in pos:
        assert (p.string, p.fret) == VERIFIED_POSITIONS[p.name]
        assert p.in_level_range


def test_fingers_first_position_and_open():
    assert assign_fingers([0, 1, 2, 3, 4]) == [0, 1, 2, 3, 4]
    pos = choose_positions([name_to_midi("G4")], "zero")[0]
    assert (pos.string, pos.fret, pos.finger) == (1, 3, 3)  # ring finger
    assert assign_fingers([5, 7, 8, 5]) == [1, 3, 4, 1]       # box shape at fret 5


def test_guitar_position_validation():
    GuitarPosition(string=1, fret=3, finger=3, midi=67)
    with pytest.raises(ValidationError):
        GuitarPosition(string=1, fret=3, finger=3, midi=66)  # mismatched pitch
    with pytest.raises(ValidationError):
        GuitarPosition(string=1, fret=0, finger=2, midi=64)  # finger on open string


def test_note_event_validation():
    NoteEvent(midi=60, start_beat=0, duration_beats=1, string=2, fret=1, finger=1)
    with pytest.raises(ValidationError):
        NoteEvent(midi=61, start_beat=0, duration_beats=1, string=2, fret=1, finger=1)
    with pytest.raises(ValidationError):
        NoteEvent(midi=60, start_beat=0, duration_beats=0)  # missing timing
    with pytest.raises(ValidationError):
        NoteEvent(midi=60, start_beat=0, duration_beats=1, string=2)  # fret missing


def test_level_ranges():
    zero = playable_midis(level_constraints("zero"))
    assert min(zero) == 55 and max(zero) == 67
    assert 63 not in zero  # D#4 needs fret 4 on the B string


# 9 / 13. TAB accuracy and agreement with the data
def _reference_notes():
    mids = [name_to_midi(n) for bar in REFERENCE_SOLO for n in bar]
    pos = choose_positions(mids, "zero")
    return [NoteEvent(midi=p.midi, start_beat=i, duration_beats=1, string=p.string, fret=p.fret, finger=p.finger)
            for i, p in enumerate(pos)]


def test_reference_tab_exact():
    notes = _reference_notes()
    tab = render_tab(notes, 4, 4, ["C", "F", "G", "C"])
    assert tab.split("\n", 1)[1] == REFERENCE_TAB
    lines = tab.splitlines()
    assert lines[1].startswith("e|") and lines[6].startswith("E|")  # thin string on top, thick at bottom
    assert all(len(line) == len(lines[1]) for line in lines[1:])


def test_tab_parse_roundtrip_matches_pitches():
    notes = _reference_notes()
    tab = render_tab(notes, 4, 4)
    parsed = parse_tab(tab)
    assert parsed == sorted((n.start_beat, n.string, n.fret) for n in notes)
    for (beat, s, f), n in zip(parsed, sorted(notes, key=lambda x: x.start_beat)):
        assert STANDARD_TUNING[s] + f == n.midi


def test_tab_two_digit_frets_eighths_and_rests():
    notes = [NoteEvent(midi=76, start_beat=0, duration_beats=0.5, string=1, fret=12),
             NoteEvent(midi=74, start_beat=0.5, duration_beats=0.5, string=1, fret=10),
             NoteEvent(midi=72, start_beat=2, duration_beats=1, string=2, fret=13)]
    assert grid_resolution(notes) == 2
    tab = render_tab(notes, 4, 1)
    assert parse_tab(tab, 4, 2) == [(0.0, 1, 12), (0.5, 1, 10), (2.0, 2, 13)]


# Chords
def test_chord_shapes_sound_their_chord():
    for sym in ["C", "D", "E", "F", "G", "A", "Am", "Em", "Dm", "Bm", "Bb", "Eb", "F#m", "Ab", "C#m", "G7", "B7"]:
        ch = parse_chord(sym)
        shape = full_chord_shape(ch)
        pcs = {m % 12 for m in shape.midis()}
        assert pcs <= set(ch.pcs), sym
        assert ch.root in pcs, sym
    for root in range(12):
        shape = power_chord_shape(root)
        assert {m % 12 for m in shape.midis()} == {root, (root + 7) % 12}


def test_key_estimate_demo_is_c_major():
    mids = [name_to_midi(n) for bar in DEMO_MELODY for n in bar]
    best = estimate_keys([(m, 1.0) for m in mids])[0]
    assert best.key == Key(0, "major")
    assert Chord(0, "maj").pcs == (0, 4, 7)
