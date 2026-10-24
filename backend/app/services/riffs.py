"""Turn a library riff into a complete practice Arrangement.

Parts:
  melody_guitar  → the riff itself, exactly as written (positions, fingers, techniques)
  solo           → an easier version for the learner's level (same key; octave-folded, simplified rhythm)
  lead           → a genre lead to jam over the riff's chords
The band (backing, bass, drums) uses the riff's own chords and the genre's groove.
"""
from __future__ import annotations

from ..music.genres import GENRES, degree_name, progression_name
from ..music.guitar import STANDARD_TUNING, assign_fingers, choose_positions
from ..music.riffs import RIFFS, RIFFS_BY_ID, RiffDef
from ..music.tab import render_tab
from ..music.theory import Chord, Key, midi_to_name, name_to_midi, parse_chord
from ..schemas import Arrangement, DetectedMelody, Harmonization, KeyCandidate, NoteEvent, RiffInfo
from .arrangement import _chord_at, backing_for, bass_for, drums_for, theory_for, validate_arrangement
from .harmonizer import make_chord_candidate
from .lead import generate_lead
from .solo import generate_solo


def _key(r: RiffDef) -> Key:
    return Key(name_to_midi(r.tonic + "4") % 12, r.mode)


def riff_notes(r: RiffDef) -> list[NoteEvent]:
    """The riff as playable note events. Explicit positions win; the rest are optimised."""
    specs = []
    for item in r.notes:
        name, start, dur = item[0], float(item[1]), float(item[2])
        opts = item[3] if len(item) > 3 else {}
        midi = name_to_midi(name)
        bend = opts.get("bend", 0) if opts.get("tech") == "bend" else 0
        specs.append((midi, start, dur, opts, midi - bend))
    auto = choose_positions([s[4] for s in specs], r.position_level)
    strings, frets = [], []
    for (midi, start, dur, opts, fret_midi), pos in zip(specs, auto):
        s = opts.get("s", pos.string)
        f = opts.get("f", pos.fret)
        if STANDARD_TUNING[s] + f != fret_midi:
            raise ValueError(f"{r.id}: {midi_to_name(midi)} is not on string {s} fret {f}")
        strings.append(s)
        frets.append(f)
    fingers = assign_fingers(frets)
    key = _key(r)
    out: list[NoteEvent] = []
    for i, ((midi, start, dur, opts, _), s, f) in enumerate(zip(specs, strings, frets)):
        tech = opts.get("tech")
        finger = fingers[i]
        slide_from = None
        if tech in ("slide_up", "slide_down"):
            slide_from = frets[i - 1]
            finger = out[-1].finger or finger  # the same finger slides
        out.append(NoteEvent(
            midi=midi, name=midi_to_name(midi, key.prefer_flats), start_beat=start, duration_beats=dur,
            string=s, fret=f, finger=finger, source="riff", role="riff", technique=tech,
            bend_semitones=opts.get("bend") if tech in ("bend", "bend_release") else None,
            slide_from_fret=slide_from, vibrato=bool(opts.get("vib", False)), confidence=1.0))
    return out


def _harmonization(r: RiffDef, key: Key) -> Harmonization:
    genre = GENRES[r.genre]
    kc = KeyCandidate(tonic=key.tonic, mode=key.mode, name=key.name, confidence=1.0)
    chords = []
    for c in r.chords:
        quality = "maj" if c.quality == "5" else c.quality
        chord = Chord(parse_chord(c.symbol_root).root, quality)
        cand = make_chord_candidate(chord, c.roman, c.start, c.length, 1.0, key, power=r.power_chords,
                                    seventh=(c.quality == "7"))
        chords.append(cand)
    romans = [c.roman for c in r.chords]
    return Harmonization(kind="genre", genre=genre.key, label=genre.label,
                         description="The riff's own chords, played by the band in the genre's groove.",
                         key=kc, chords=chords, score=1.0, use_power_chords=r.power_chords,
                         progression_name=progression_name(genre, romans))


def riff_info(r: RiffDef) -> RiffInfo:
    notes = riff_notes(r)
    techniques = sorted({n.technique for n in notes if n.technique} | ({"vibrato"} if any(n.vibrato for n in notes) else set()))
    return RiffInfo(id=r.id, title=r.title, credit=r.credit, source=r.source, year=r.year, genre=r.genre, vibe=r.vibe,
                    difficulty=r.difficulty, focus=list(r.focus), tips=list(r.tips), tempo_bpm=r.tempo,
                    key_name=_key(r).name, bars=r.bars, note_count=len(notes), techniques=techniques,
                    tab_preview=render_tab(notes, 4, r.bars))


def list_riffs() -> list[RiffInfo]:
    return [riff_info(r) for r in RIFFS]


def build_riff_arrangement(riff_id: str, level: str = "zero", techniques: str = "auto") -> Arrangement:
    r = RIFFS_BY_ID.get(riff_id)
    if r is None:
        raise KeyError(riff_id)
    key = _key(r)
    notes = riff_notes(r)
    h = _harmonization(r, key)
    bpb = 4
    total_beats = r.bars * bpb
    for n in notes:
        if n.start_beat + n.duration_beats > total_beats + 1e-6:
            raise ValueError(f"{r.id}: note at beat {n.start_beat} runs past bar {r.bars}")
    plain = [NoteEvent(midi=n.midi, start_beat=n.start_beat, duration_beats=n.duration_beats, source="riff") for n in notes]
    melody = DetectedMelody(source="riff", title=r.title, tempo_bpm=r.tempo, notes=plain, key_candidates=[h.key],
                            duration_sec=total_beats * 60 / r.tempo)
    easy, _, _, easy_notes_changes = generate_solo(melody, h, level, r.style, allow_transpose=False)
    lead = generate_lead(plain, h, key, level, r.style, techniques, bpb, r.bars)
    with_degrees = [n.model_copy(update={"chord_degree": degree_name(n.midi - _chord_at(h, n.start_beat).root_pc)}) for n in notes]
    easy_notes = [n.model_copy(update={"chord_degree": degree_name(n.midi - _chord_at(h, n.start_beat).root_pc)}) for n in easy.notes]
    bar_chords = [_chord_at(h, b * bpb).symbol for b in range(r.bars)]
    easy_changes = [c for c in easy.changes if "Moved the whole tune" not in c]
    lead_changes = ["A lead to jam over the riff's chords — same band, your own solo."] + lead.changes
    arr = Arrangement(
        kind="riff", riff=riff_info(r), title=f"Riff: {r.title}", key=h.key, tempo_bpm=r.tempo, beats_per_bar=bpb,
        total_bars=r.bars, skill_level=level, style=r.style, transposition_semitones=0, original_melody=melody,
        melody_guitar=with_degrees, harmonization=h,
        solo=easy.model_copy(update={"notes": easy_notes, "changes": ["An easier version of the riff for your level."] + easy_changes}),
        lead=lead.model_copy(update={"changes": lead_changes}), theory=theory_for(h, key, GENRES[r.genre]),
        backing=backing_for(h, total_beats, r.style, bpb), bass=bass_for(h, total_beats, r.style, bpb),
        drums=drums_for(total_beats, r.style, bpb), melody_tab_ascii=render_tab(notes, bpb, r.bars, bar_chords),
    )
    problems = validate_arrangement(arr)
    if problems:
        raise ValueError(f"Riff {r.id} failed validation: " + "; ".join(problems))
    return arr
