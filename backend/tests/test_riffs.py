"""Riff practice library."""
import itertools

import pytest

from app.music.guitar import STANDARD_TUNING
from app.music.riffs import RIFFS, RIFFS_BY_ID
from app.music.tab import grid_resolution, note_token, parse_tab_tokens
from app.music.theory import name_to_midi
from app.services.arrangement import validate_arrangement
from app.services.riffs import build_riff_arrangement, list_riffs, riff_notes

LEVELS = ["zero", "few_notes", "basic_chords", "intermediate", "advanced"]


def test_library_has_both_kinds_and_all_genres():
    assert {r.source for r in RIFFS} == {"public_domain", "original"}
    assert {r.genre for r in RIFFS} == {"rock", "pop", "blues"}
    assert len({r.id for r in RIFFS}) == len(RIFFS)


@pytest.mark.parametrize("riff", [r for r in RIFFS if r.source == "public_domain"], ids=lambda r: r.id)
def test_public_domain_riffs_are_old_enough(riff):
    assert riff.year is not None and riff.year < 1929
    assert "Public domain" in riff.credit


def test_known_public_domain_melodies():
    names = lambda rid: [n.name for n in riff_notes(RIFFS_BY_ID[rid])]
    assert names("ode-to-joy")[:8] == ["E4", "E4", "F4", "G4", "G4", "F4", "E4", "D4"]
    assert names("fur-elise")[:9] == ["E4", "D#4", "E4", "D#4", "E4", "B3", "D4", "C4", "A3"]
    assert names("mountain-king")[:7] == ["A2", "B2", "C3", "D3", "E3", "C3", "E3"]
    assert names("saints")[:4] == ["C4", "E4", "F4", "G4"]
    assert names("toccata")[:3] == ["A4", "G4", "A4"]


@pytest.mark.parametrize("riff,level", list(itertools.product(RIFFS, LEVELS)), ids=lambda x: getattr(x, "id", x))
def test_every_riff_builds_a_valid_practice_arrangement(riff, level):
    arr = build_riff_arrangement(riff.id, level)
    assert arr.kind == "riff" and arr.riff.id == riff.id
    assert validate_arrangement(arr) == []
    # The riff part is played exactly as written: same pitches and timing, in its own key.
    written = [(name_to_midi(n[0]), float(n[1])) for n in riff.notes]
    assert [(n.midi, n.start_beat) for n in arr.melody_guitar] == written
    for n in arr.melody_guitar:
        bend = n.bend_semitones if n.technique == "bend" else 0
        assert STANDARD_TUNING[n.string] + n.fret + bend == n.midi
        assert (n.fret == 0) == (n.finger == 0)
    assert arr.transposition_semitones == 0
    assert arr.solo.notes and arr.lead.notes and arr.backing and arr.drums
    if level == "zero":
        assert all(n.string in (1, 2, 3) and n.fret <= 3 for n in arr.solo.notes)  # easy version really is easy


def test_riff_tab_matches_data_including_techniques():
    for riff in RIFFS:
        notes = riff_notes(riff)
        info = next(i for i in list_riffs() if i.id == riff.id)
        tokens = parse_tab_tokens(info.tab_preview, 4, grid_resolution(notes))
        assert [t for _, _, t in tokens] == [note_token(n) for n in sorted(notes, key=lambda x: (x.start_beat, x.string))]


def test_technique_riffs_contain_their_techniques():
    tech = {r.id: set(next(i for i in list_riffs() if i.id == r.id).techniques) for r in RIFFS}
    assert {"bend", "hammer_on", "pull_off", "vibrato"} <= tech["bend-and-hold"]
    assert {"pull_off", "hammer_on", "slide_up"} <= tech["toccata"]
    assert "bend" in tech["blue-curl"] and "slide_up" in tech["slide-hook"]
    curl = [n for n in riff_notes(RIFFS_BY_ID["blue-curl"]) if n.technique == "bend"]
    assert all(n.bend_semitones == 1 for n in curl)


def test_riff_api(client):
    lst = client.get("/api/riffs").json()
    assert len(lst) == len(RIFFS)
    assert all(r["tab_preview"].count("|") > 6 for r in lst)
    arr = client.post("/api/riffs/blue-curl/arrangement", json={"skill_level": "zero", "techniques": "all"}).json()
    assert arr["kind"] == "riff" and arr["riff"]["title"] == "Blue Curl Lick"
    assert arr["theory"]["feel"] == "shuffle"
    assert client.get(f"/api/arrangement/{arr['id']}").status_code == 200
    assert client.post("/api/riffs/nope/arrangement", json={}).status_code == 404


def test_modern_style_originals():
    from app.music.riffs import MODERN_RIFFS
    assert len(MODERN_RIFFS) == 10
    assert all(r.source == "original" and r.year is None and r.vibe for r in MODERN_RIFFS)
    assert len({r.vibe for r in MODERN_RIFFS}) == 10
    assert {"Grunge", "Funk", "Metal", "Reggae", "Surf", "Country", "Neo-soul"} <= {r.vibe for r in MODERN_RIFFS}
    info = {i.id: i for i in list_riffs()}
    assert info["gallop-run"].vibe == "Metal"
    assert "slide_up" in info["velvet-slide"].techniques


def test_rhythmic_feels_are_written_out():
    gallop = [(n.start_beat, n.duration_beats) for n in riff_notes(RIFFS_BY_ID["gallop-run"])][:3]
    assert gallop == [(0, .5), (.5, .25), (.75, .25)]  # da-da-dum
    tremolo = riff_notes(RIFFS_BY_ID["tide-pool"])[:4]
    assert {n.midi for n in tremolo} == {64} and all(n.duration_beats == .25 for n in tremolo)
    reggae = riff_notes(RIFFS_BY_ID["offbeat-sunrise"])
    assert reggae[0].start_beat == .5  # leaves beat 1 empty
