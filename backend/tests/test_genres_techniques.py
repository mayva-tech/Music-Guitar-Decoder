"""Genres (rock / pop / blues), lead solos and playing techniques."""
import itertools

import pytest
from pydantic import ValidationError

from app.music.genres import GENRES, progression_name, solo_scale
from app.music.guitar import STANDARD_TUNING
from app.music.tab import note_token, parse_tab_tokens, render_tab, token_to_technique, grid_resolution
from app.music.theory import Key, name_to_midi
from app.schemas import DetectedMelody, NoteEvent
from app.services.arrangement import build_arrangement, demo_melody, validate_arrangement
from app.services.harmonizer import harmonize
from app.services.lead import LEVEL_STRINGS, techniques_for

STYLES = ["classic_rock", "pop", "blues"]
LEVELS = ["zero", "few_notes", "basic_chords", "intermediate", "advanced"]
MELODIES = {
    "demo": None,
    "minor": ["A4", "C5", "E5", "A4", "G4", "B4", "D5", "G4", "F4", "A4", "C5", "F4", "E4", "G#4", "B4", "A4"],
    "eighths": (["E4", "D4", "C4", "D4", "E4", "E4", "E4", None, "D4", "D4", "D4", None, "E4", "G4", "G4", None],
                [.5, .5, .5, .5, .5, .5, 1, 1, .5, .5, 1, 2, .5, .5, 1, 2]),
    "low": ["G2", "B2", "D3", "G3", "C3", "E3", "G3", "C4"],
}


def melody(name):
    spec = MELODIES[name]
    if spec is None:
        return demo_melody()
    names, beats = (spec if isinstance(spec, tuple) else (spec, [1.0] * len(spec)))
    t, notes = 0.0, []
    for n, b in zip(names, beats):
        if n:
            notes.append(NoteEvent(midi=name_to_midi(n), start_beat=t, duration_beats=b))
        t += b
    return DetectedMelody(tempo_bpm=96, notes=notes)


def build(mel, style, level, techniques="auto", kind="genre"):
    h = next(x for x in harmonize(mel.notes, style=style).harmonizations if x.kind == kind)
    return build_arrangement(mel, h, level, style, techniques=techniques)


# ---------------------------------------------------------------- genre harmony
def test_genre_chords_differ():
    m = demo_melody()
    rock = harmonize(m.notes, style="classic_rock").harmonizations[1]
    blues = harmonize(m.notes, style="blues").harmonizations[1]
    pop = harmonize(m.notes, style="pop").harmonizations[1]
    assert [c.symbol for c in rock.chords] == ["C5", "F5", "G5", "C5"] and rock.use_power_chords
    assert [c.symbol for c in blues.chords] == ["C7", "F7", "G7", "C7"]
    assert all(c.quality == "7" for c in blues.chords)
    assert [c.symbol for c in pop.chords] == ["C", "F", "G", "C"] and not pop.use_power_chords
    assert (rock.label, pop.label, blues.label) == ("Rock", "Pop", "Blues")
    for c in blues.chords:  # 7th-chord shapes really contain the ♭7
        assert (c.root_pc + 10) % 12 in {m % 12 for m in c.voicing_midis}


def test_pop_finds_the_four_chord_loop():
    names = "E4 G4 C5 G4 D4 G4 B4 D5 C4 E4 A4 E4 F4 A4 C5 A4".split()
    notes = [NoteEvent(midi=name_to_midi(n), start_beat=i, duration_beats=1) for i, n in enumerate(names)]
    pop = harmonize(notes, style="pop").harmonizations[1]
    assert [c.symbol for c in pop.chords] == ["C", "G", "Am", "F"]
    assert "four-chord" in pop.progression_name
    assert progression_name(GENRES["rock"], ["I", "bVII", "IV", "I"]).endswith("(rock's borrowed ♭VII)")


def test_feel_and_theory_block():
    m = demo_melody()
    assert build(m, "blues", "zero").theory.feel == "shuffle"
    assert build(m, "blues", "zero").theory.swing == pytest.approx(2 / 3)
    rock = build(m, "classic_rock", "zero")
    assert rock.theory.feel == "straight" and rock.theory.swing == 0.5
    assert rock.theory.scale_degrees == ["R", "b3", "4", "5", "b7"]
    assert len(rock.theory.guide) >= 3
    assert solo_scale(GENRES["blues"], Key(9, "major")).name == "A blues scale"
    assert solo_scale(GENRES["pop"], Key(0, "major")).intervals == (0, 2, 4, 7, 9)


def test_genre_grooves():
    m = demo_melody()
    blues = build(m, "blues", "zero")
    assert all(len(e.midis) == 2 for e in blues.backing)  # shuffle boogie dyads
    assert {e.midis[1] - e.midis[0] for e in blues.backing} == {7, 9, 10}
    first_bar_bass = [n.midi - blues.bass[0].midi for n in blues.bass[:4]]
    assert first_bar_bass == [0, 4, 7, 9]  # walking up the chord
    pop = build(m, "pop", "zero")
    assert [e.start_beat for e in pop.backing[:6]] == [0, 1, 1.5, 2.5, 3, 3.5]  # down, down-up, up-down-up
    rock = build(m, "classic_rock", "zero")
    assert len(rock.backing) == 32  # eighth-note power chords


# ---------------------------------------------------------------- lead solos
@pytest.mark.parametrize("mel,style,level", list(itertools.product(MELODIES, STYLES, LEVELS)))
def test_lead_is_valid_playable_and_honest(mel, style, level):
    arr = build(melody(mel), style, level)
    lead = arr.lead
    assert lead is not None and lead.notes
    assert validate_arrangement(arr) == []
    allowed = techniques_for(level, "auto", "pop" if style == "pop" else ("blues" if style == "blues" else "rock"))
    lo, hi = lead.position_fret, lead.position_fret + 4
    starts = [n.start_beat for n in lead.notes]
    assert starts == sorted(set(starts))  # one note at a time
    for n in lead.notes:
        assert STANDARD_TUNING[n.string] + n.fret + (n.bend_semitones if n.technique == "bend" else 0) == n.midi
        assert lo - 3 <= n.fret <= hi + 2, "the lead stays in one hand position"
        if n.technique in ("bend", "bend_release"):
            assert n.string in (1, 2, 3)
            assert ("bend" in allowed) or (n.bend_semitones == 1 and "half_bend" in allowed)
        if n.technique in ("slide_up", "slide_down"):
            assert "slide" in allowed
        if n.technique in ("hammer_on", "pull_off"):
            assert n.technique in allowed
        if n.vibrato:
            assert "vibrato" in allowed
        if level == "zero":
            assert n.string in LEVEL_STRINGS["zero"] or n.technique
    last = lead.notes[-1]
    assert last.midi % 12 == arr.key.tonic, "ends on the home note"
    assert last.technique not in ("bend", "bend_release"), "the home note is played plain"
    assert last.start_beat + last.duration_beats == arr.total_bars * arr.beats_per_bar


def test_techniques_override_and_variety():
    m = demo_melody()
    none = build(m, "classic_rock", "advanced", techniques="none").lead
    assert all(n.technique is None and not n.vibrato for n in none.notes)
    assert none.techniques_used == []
    zero_all = build(m, "classic_rock", "zero", techniques="all").lead
    assert "bend" in zero_all.techniques_used  # a beginner can still switch bends on
    zero_auto = build(m, "classic_rock", "zero").lead
    assert not any(n.technique in ("bend", "bend_release") for n in zero_auto.notes)
    assert "slide_up" in zero_auto.techniques_used or "slide_down" in zero_auto.techniques_used
    blues_arr = build(m, "blues", "intermediate")
    curls = [n for n in blues_arr.lead.notes
             if n.technique == "bend" and n.bend_semitones == 1 and (n.midi - 1 - blues_arr.key.tonic) % 12 == 3]
    assert curls, "the blues lead uses the ♭3 → 3 'blue curl' bend"
    adv = build(m, "classic_rock", "advanced", techniques="all").lead
    assert "bend_release" in adv.techniques_used
    for n in adv.notes:
        if n.technique == "bend_release":
            assert STANDARD_TUNING[n.string] + n.fret == n.midi  # ends where it started


def test_lead_tab_shows_techniques_from_data():
    lead = build(demo_melody(), "classic_rock", "advanced", techniques="all").lead
    tokens = parse_tab_tokens(lead.tab_ascii, 4, grid_resolution(lead.notes))
    assert [t for _, _, t in tokens] == [note_token(n) for n in sorted(lead.notes, key=lambda x: (x.start_beat, x.string))]
    assert any("b" in t for _, _, t in tokens) and any(t.endswith("~") for _, _, t in tokens)


def test_scale_positions_for_overlay():
    lead = build(demo_melody(), "classic_rock", "zero").lead
    roots = [p for p in lead.scale_positions if p.is_root]
    assert roots and all(p.midi % 12 == 0 for p in roots)
    assert {p.degree for p in lead.scale_positions} == {"R", "b3", "4", "5", "b7"}
    for p in lead.scale_positions:
        assert STANDARD_TUNING[p.string] + p.fret == p.midi


# ---------------------------------------------------------------- notation & validation
@pytest.mark.parametrize("tech,bend,vib,tok", [
    (None, None, False, "7"), ("bend", 2, False, "7b9"), ("bend", 1, True, "7b8~"), ("bend_release", 2, False, "7b9r7"),
    ("slide_up", None, False, "/7"), ("slide_down", None, False, "\\7"), ("hammer_on", None, False, "h7"),
    ("pull_off", None, False, "p7"), (None, None, True, "7~"),
])
def test_tab_tokens_roundtrip(tech, bend, vib, tok):
    n = NoteEvent(midi=69 + (bend if tech == "bend" else 0), start_beat=0, duration_beats=1, string=2, fret=10, finger=3,
                  technique=tech, bend_semitones=bend, vibrato=vib,
                  slide_from_fret=(8 if tech == "slide_up" else 12 if tech == "slide_down" else None))
    expected = tok.replace("7", "10").replace("b9", "b12").replace("b8", "b11").replace("r10", "r10")
    assert note_token(n) == expected
    t = token_to_technique(expected)
    assert (t["fret"], t["technique"], t["bend_semitones"], t["vibrato"]) == (10, tech, bend, vib)


def test_technique_validation():
    with pytest.raises(ValidationError):  # bend that doesn't reach its pitch
        NoteEvent(midi=72, start_beat=0, duration_beats=1, string=2, fret=10, technique="bend", bend_semitones=1)
    with pytest.raises(ValidationError):  # bend without amount
        NoteEvent(midi=71, start_beat=0, duration_beats=1, string=2, fret=10, technique="bend")
    with pytest.raises(ValidationError):  # slide direction contradicts frets
        NoteEvent(midi=69, start_beat=0, duration_beats=1, string=2, fret=10, technique="slide_up", slide_from_fret=12)
    arr = build(demo_melody(), "classic_rock", "advanced", techniques="all")
    bad = arr.lead.model_copy(update={"tab_ascii": arr.lead.tab_ascii.replace("b", "x", 1)})
    assert any("TAB does not match" in p for p in validate_arrangement(arr.model_copy(update={"lead": bad})))
    flipped = arr.lead.model_copy(update={"tab_ascii": arr.lead.tab_ascii.replace("~", "-", 1)})
    assert any("TAB does not match" in p for p in validate_arrangement(arr.model_copy(update={"lead": flipped})))


def test_api_techniques_and_genre(client):
    mel = client.get("/api/demo").json()
    har = client.post("/api/harmonize", json={"melody": mel, "style": "blues"}).json()
    g = next(h for h in har["harmonizations"] if h["kind"] == "genre")
    assert g["label"] == "Blues" and g["genre"] == "blues"
    arr = client.post("/api/generate-solo", json={"melody": mel, "harmonization": g, "skill_level": "zero",
                                                  "style": "blues", "techniques": "all"}).json()
    assert arr["theory"]["feel"] == "shuffle"
    assert arr["lead"]["techniques_used"]
    assert any(n["technique"] == "bend" for n in arr["lead"]["notes"])
    assert client.post("/api/generate-solo", json={"melody": mel, "harmonization": g, "techniques": "wild"}).status_code == 422
