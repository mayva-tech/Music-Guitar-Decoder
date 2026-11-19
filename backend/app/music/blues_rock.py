"""Blues-rock collection: 20 original riffs and licks, about 20 seconds each, plus the Embers ballad lick.

Each one comes with its own chord progression, so on the practice page the band plays the changes and you can
play the riff, then loop it and solo over the same chords. All are written for Music Decoder; none copies a song.

Parts are written as TAB tokens played one after another (see `_tab`), which keeps every note's string, fret
and technique explicit and lets the bar lengths be checked when the module loads.
"""
from __future__ import annotations

import re

from .guitar import STANDARD_TUNING
from .riff_model import ChordSpec, RiffDef, _c
from .theory import midi_to_name, name_to_midi

COLLECTION = "blues_rock"
BEATS_PER_BAR = 4

_TOKEN = re.compile(r"^([1-6]):([mhp/\\]?)(\d{1,2})(?:([br])([12]))?(~?)(?:=(\d*\.?\d+))?$")
_REST = re.compile(r"^-(?:=(\d*\.?\d+))?$")
_TECH = {"h": "hammer_on", "p": "pull_off", "/": "slide_up", "\\": "slide_down", "m": "palm_mute"}


def _tab(spec: str) -> tuple[tuple, int]:
    """Parse a part written as TAB tokens; returns (notes, bars).

    Bars are separated by '|' and must each last exactly 4 beats.
    Note token: <string>:<prefix><fret><suffix>[=<beats>]   (beats default to 0.5, an eighth note)
        prefix   h hammer-on · p pull-off · / slide up · \\ slide down · m palm mute
                 (h/p/slides from the previous note on that string; m is a picked chug)
        suffix   b1 / b2 bend up a half / whole step (you hear the bent pitch)
                 r1 / r2 bend up and release back to the fretted note
                 ~ vibrato (after any bend suffix)
    Rest token: -[=<beats>]
    Bends are fretted with the ring finger (helped by the fingers behind it).
    """
    notes: list[tuple] = []
    t = 0.0
    bars = [b for b in spec.split("|") if b.strip()]
    for bi, bar in enumerate(bars):
        bar_start = t
        for tok in bar.split():
            rest = _REST.match(tok)
            if rest:
                t += float(rest.group(1) or .5)
                continue
            m = _TOKEN.match(tok)
            if not m:
                raise ValueError(f"Bad TAB token {tok!r}")
            s, prefix, fret, kind, amount, vib, dur = m.groups()
            s, f, d = int(s), int(fret), float(dur or .5)
            opts: dict = {"s": s, "f": f}
            pitch = STANDARD_TUNING[s] + f
            if prefix:
                opts["tech"] = _TECH[prefix]
            if kind:
                opts.update(tech="bend" if kind == "b" else "bend_release", bend=int(amount), fin=3)
                if kind == "b":
                    pitch += int(amount)
            if vib:
                opts["vib"] = True
            notes.append((midi_to_name(pitch), t, d, opts))
            t += d
        if abs(t - bar_start - BEATS_PER_BAR) > 1e-6:
            raise ValueError(f"Bar {bi + 1} lasts {t - bar_start} beats, not {BEATS_PER_BAR}: {bar.strip()!r}")
    return tuple(notes), len(bars)


_ROMAN = ("I", "bII", "II", "bIII", "III", "IV", "bV", "V", "bVI", "VI", "bVII", "VII")
_CHORD = re.compile(r"^([A-G][#b]?)(m|5|7)?$")


def _progression(spec: str, tonic: str, mode: str) -> tuple[ChordSpec, ...]:
    """One chord per bar ('E7 A7 …'); 'G5,A5' splits a bar in half. Repeated chords are merged."""
    tonic_pc = name_to_midi(tonic + "4") % 12
    slots: list[tuple[str, str, float]] = []
    for bar in spec.split():
        parts = bar.split(",")
        for part in parts:
            m = _CHORD.match(part)
            if not m:
                raise ValueError(f"Bad chord {part!r}")
            root, suffix = m.groups()
            quality = {None: "maj", "m": "min", "5": "5", "7": "7"}[suffix]
            slots.append((root, quality, BEATS_PER_BAR / len(parts)))
    chords: list[ChordSpec] = []
    t = 0.0
    for root, quality, length in slots:
        if chords and (chords[-1].symbol_root, chords[-1].quality) == (root, quality):
            last = chords[-1]
            chords[-1] = _c(last.symbol_root, last.quality, last.roman, last.start, last.length + length)
        else:
            iv = (name_to_midi(root + "4") - tonic_pc) % 12
            roman = _ROMAN[iv]
            if quality == "min" or (quality == "5" and mode == "minor" and iv in (0, 5)):
                roman = roman.lower()
            chords.append(_c(root, quality, roman, t, length))
        t += length
    return tuple(chords)


def _br(id: str, title: str, vibe: str, genre: str, key: str, tempo: float, difficulty: int,
        focus: tuple[str, ...], tips: tuple[str, ...], chords: str, tab: str) -> RiffDef:
    tonic, mode = key.split()
    notes, bars = _tab(tab)
    prog = _progression(chords, tonic, mode)
    if abs(sum(c.length for c in prog) - bars * BEATS_PER_BAR) > 1e-6:
        raise ValueError(f"{id}: the chords cover {sum(c.length for c in prog)} beats, the part {bars * BEATS_PER_BAR}")
    kind = "lick" if "lick" in vibe.lower() else "riff"
    return RiffDef(
        id=id, title=title, vibe=vibe, collection=COLLECTION,
        credit=f"Original Music Decoder blues-rock {kind}.", source="original", year=None,
        genre=genre, style="blues" if genre == "blues" else "classic_rock", difficulty=difficulty, tempo=tempo,
        tonic=tonic, mode=mode, position_level="intermediate", focus=focus, tips=tips, notes=notes, chords=prog,
        bars=bars, power_chords=all(c.quality == "5" for c in prog),
    )


# ---------------------------------------------------------------------------------------------------- riffs

_TEXAS_E = "6:0 6:3 6:h4 5:2 5:4 5:2 6:3 6:h4"
_TEXAS_A = "5:0 5:3 5:h4 4:2 4:4 4:2 5:3 5:h4"
_TEXAS_B = "5:2 5:5 5:h6 4:4 4:6 4:4 5:5 5:h6"

_BOOGIE_A = "4:5 4:4 4:2 5:4 5:0=1 5:3 5:h4"
_BOOGIE_D = "3:5 3:4 3:2 4:4 4:0=1 4:3 4:h4"
_BOOGIE_E = "5:5 5:4 5:2 6:4 6:0=1 6:3 6:h4"

_MUD_G = "6:3 6:3 4:3 4:/5=1 4:3 5:5 5:2"
_MUD_G2 = "6:3 6:3 4:3 4:/5=1 4:3 5:1 5:h2"
_MUD_C = "5:3 5:3 3:3 3:/5=1 3:3 4:1 4:h2"
_MUD_D = "5:5 5:5 3:5 3:/7=1 3:5 4:3 4:h4"

_STOMP_D = "4:0 4:3 3:0 3:2 3:p0 4:3 4:0=1"
_STOMP_D2 = "4:0 4:3 3:0 3:2 3:p0 4:3 4:p0 5:3"
_STOMP_G = "6:3 6:6 5:3 5:5 5:p3 6:6 6:3=1"
_STOMP_A = "5:0 5:3 4:0 4:2 4:p0 5:3 5:0=1"

_RAIL_D = "4:0 4:0 4:h2 4:4 3:2 4:4 4:2=1"
_RAIL_C = "5:3 5:3 5:h5 4:2 4:5 4:2 5:5=1"
_RAIL_G = "6:3 6:3 6:h5 5:2 5:5 5:2 6:5=1"
_RAIL_A = "5:0 5:0 5:h2 5:4 4:2 5:4 5:2=1"

_PUMP_FS = "6:2=.25 6:2=.25 6:5 6:2=.25 6:2=.25 6:7 6:2=.25 6:2=.25 5:4 5:2=.25 6:5=.25 6:2"
_PUMP_FS2 = "6:2=.25 6:2=.25 6:5 6:2=.25 6:2=.25 6:7 5:4=1 5:2 6:5"
_PUMP_B = "5:2=.25 5:2=.25 5:5 5:2=.25 5:2=.25 5:7 5:2=.25 5:2=.25 4:4 4:2=.25 5:5=.25 5:2"

RIFFS = (
    _br("texas-two-step", "Texas Two-Step", "Shuffle riff", "blues", "E major", 144, 2,
        ("12-bar shuffle", "The ♭3 to 3 hammer-on", "Moving the riff to each chord"),
        ("One shape, three chords: play it from the low E for E7, the A string for A7 and fret 2 of the A string for B7.",
         "Hammer from the ♭3 to the 3 (G to G♯ on E7) — that half-step is the blues in one move.",
         "Swing it long-short and keep your picking hand moving down-up even through the hammer-ons.",
         "Solo over it: E minor pentatonic at fret 12 or open position; aim for G♯ over E7, C♯ over A7, D♯ over B7."),
        "E7 E7 E7 E7 A7 A7 E7 E7 B7 A7 E7 B7",
        " | ".join([_TEXAS_E] * 4 + [_TEXAS_A] * 2 + [_TEXAS_E] * 2 + [_TEXAS_B, _TEXAS_A, _TEXAS_E, _TEXAS_B])),

    _br("down-home-boogie", "Down-Home Boogie", "Boogie riff", "blues", "A major", 140, 2,
        ("Quick-change 12-bar", "Walking down from the ♭7", "Open-string bass notes"),
        ("Each bar walks down the chord from its ♭7, lands on the open root, then climbs ♭3 – 3 back up.",
         "Quick change: bar 2 goes to D7 for one bar, then back to A7.",
         "Let the open root ring for its full beat — it is the anchor the rest of the bar swings around.",
         "Solo over it: A minor pentatonic at fret 5; bend the C (G string, fret 5) a half step to C♯ over A7."),
        "A7 D7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7",
        " | ".join([_BOOGIE_A, _BOOGIE_D, _BOOGIE_A, _BOOGIE_A, _BOOGIE_D, _BOOGIE_D, _BOOGIE_A, _BOOGIE_A,
                    _BOOGIE_E, _BOOGIE_D, _BOOGIE_A, _BOOGIE_E])),

    _br("iron-horse", "Iron Horse", "Hard-rock riff", "rock", "E minor", 96, 1,
        ("Low-string riffing", "Hammer-ons and pull-offs", "A chromatic walk-down"),
        ("Palm-mute the open E notes (marked m in TAB) and let the fretted notes ring out.",
         "Bars 5–6 are the same riff moved to the A string — same frets, one string up.",
         "Bar 4 walks down G – F♯ – F – E; bar 8 walks down to F♯ to lead you back to the top.",
         "Solo over it: E minor pentatonic at fret 12; land on E over E5, A over A5 and B over B5."),
        "E5 E5 E5 E5 A5 A5 G5,A5 B5",
        "6:m0 6:m0 6:3 6:m0 5:0 5:h2 6:m0 6:3 | 5:0 5:2 5:p0 6:3 6:m0=2 | "
        "6:m0 6:m0 6:3 6:m0 5:0 5:h2 6:m0 6:3 | 5:0 5:2 5:p0 6:3 6:2 6:1 6:m0=1 | "
        "5:0 5:0 5:3 5:0 4:0 4:h2 5:0 5:3 | 4:0 4:2 4:p0 5:3 5:0=2 | "
        "6:3 6:3 6:5 6:3 5:0 5:0 5:2 5:0 | 5:2=1 5:2 5:5 5:2 5:0 6:3 6:2"),

    _br("dust-devil", "Dust Devil", "Stomp riff", "rock", "A minor", 100, 1,
        ("Down-stroke drive", "Pull-offs to open strings", "A chromatic climb"),
        ("Pick every note with a down-stroke and accent the first note of each bar.",
         "Bars 3–4 move the riff to the D string: same frets, one string thinner.",
         "The last bar climbs E – G – G♯ – A – A♯ – B to slingshot you back to A.",
         "Solo over it: A minor pentatonic at fret 5; bend the D (G string, fret 7) up to E over the E5."),
        "A5 A5 D5 D5 A5 A5 C5,D5 E5",
        "5:0 5:0 5:3 5:0 5:5 5:3 5:0=1 | 5:0 5:0 5:3 5:0 6:5 6:3 6:p0=1 | "
        "4:0 4:0 4:3 4:0 4:5 4:3 4:0=1 | 4:0 4:0 4:3 4:0 5:5 5:3 5:p0=1 | "
        "5:0 5:0 5:3 5:0 5:5 5:3 5:0=1 | 5:0 5:0 5:3 5:0 6:5 6:3 6:p0=1 | "
        "5:3 5:3 5:3 5:3 5:5 5:5 5:5 5:5 | 6:0 6:0 6:3 6:4 6:5 6:6 6:7=1"),

    _br("mudslide", "Mudslide", "Slide riff", "blues", "G major", 96, 2,
        ("8-bar blues", "Sliding up to the root", "The ♭3 to 3 hammer-on"),
        ("Each bar slides from the ♭7 up to the root an octave higher (F to G on the D string for G7).",
         "Keep the finger pressed down through the slide so the note never stops sounding.",
         "The 8-bar blues goes G7 – C7 – G7 – G7 – D7 – C7 – G7 – D7.",
         "Solo over it: G minor pentatonic at fret 3 or 15, with the B (3rd) over G7."),
        "G7 C7 G7 G7 D7 C7 G7 D7",
        " | ".join([_MUD_G, _MUD_C, _MUD_G, _MUD_G2, _MUD_D, _MUD_C, _MUD_G2, _MUD_D])),

    _br("stomp-box", "Stomp Box", "Minor-blues riff", "rock", "D minor", 144, 1,
        ("12-bar minor blues", "Pull-offs", "One shape on three chords"),
        ("The riff is root – ♭3 – 4 – 5 – 4 – ♭3 – root: the minor pentatonic in one bar.",
         "Move the same shape to Gm (low E string, fret 3) and Am (open A string).",
         "Bars 4 and 8 pull off to the open D and step down to C to lead you onward.",
         "Solo over it: D minor pentatonic at fret 10; end phrases on D, G or A to match the chord."),
        "Dm Dm Dm Dm Gm Gm Dm Dm Am Gm Dm Am",
        " | ".join([_STOMP_D, _STOMP_D, _STOMP_D, _STOMP_D2, _STOMP_G, _STOMP_G, _STOMP_D, _STOMP_D2,
                    _STOMP_A, _STOMP_G, _STOMP_D, _STOMP_A])),

    _br("southern-rail", "Southern Rail", "Southern-rock riff", "rock", "D major", 100, 2,
        ("Major-key riffing", "Hammer-ons from open strings", "I – ♭VII – IV"),
        ("Bright major-scale riff: root, 2, 3, 5 and back down on each chord.",
         "D – C – G is the classic southern-rock move; the A in bar 8 turns it around.",
         "Hammer from the open D string to fret 2 without picking again.",
         "Solo over it: Highway Twang (in this set) is written over the same chords."),
        "D D C C G G D A",
        " | ".join([_RAIL_D, _RAIL_D, _RAIL_C, _RAIL_C, _RAIL_G, _RAIL_G, _RAIL_D, _RAIL_A])),

    _br("thunder-pump", "Thunder Pump", "Sixteenth riff", "rock", "F# minor", 92, 3,
        ("Sixteenth-note gallops", "Low-string riffing", "Even alternate picking"),
        ("Count “1-e-and-a”: each beat is two quick notes and one longer one — da-da-dum.",
         "Pick down-up for the sixteenths and down for the eighths; keep the wrist loose.",
         "Bar 7 hammers A then E on the open strings; bar 8 walks down from C♯ to G♯ to return.",
         "Solo over it: F♯ minor pentatonic at fret 14 or 2."),
        "F#5 F#5 B5 B5 F#5 F#5 A5,E5 C#5",
        " | ".join([_PUMP_FS, _PUMP_FS2, _PUMP_B, _PUMP_B, _PUMP_FS, _PUMP_FS2,
                    "5:0=.25 5:0=.25 5:0 5:0=.25 5:0=.25 5:2 6:0=.25 6:0=.25 6:0 6:0=.25 6:0=.25 6:2",
                    "5:4=.25 5:4=.25 5:4 5:4=.25 5:4=.25 5:7 5:4 5:2 6:5 6:4"])),
)


# ---------------------------------------------------------------------------------------------------- licks

LICKS = (
    _br("first-box", "First Box", "Shuffle lick", "blues", "A major", 96, 2,
        ("The pentatonic box at fret 5", "Bends to chord tones", "A chromatic ending"),
        ("Everything sits in the A minor pentatonic box at fret 5.",
         "Bend the G (B string, fret 8) up to A over D7, and the D (G string, fret 7) up to E over E7.",
         "Bar 4 is a half-step bend: C up to C♯, the 3rd of A7.",
         "The last bar walks down A – G♯ – G – E to set up the next time round."),
        "A7 D7 A7 A7 E7 D7 A7 E7",
        "2:5 1:5=1 2:8 2:5 3:7 3:5=1 | 2:8b2=1.5 2:5 3:7 3:5=1 4:7 | 1:5=1 2:8 2:5 3:7 3:5 4:7=1 | "
        "-=1 4:5 4:7 3:5b1=1.5 4:7 | 3:7b2=1.5 2:5 2:8 2:5 3:7=1 | 2:8b2=1 2:5 3:7 3:5=1 4:7=1 | "
        "1:8 1:5 2:8 2:5 3:7 3:5 4:7=1 | 4:7 4:6 4:5 5:7~=2.5"),

    _br("open-e-rumble", "Open E Rumble", "Open-position lick", "blues", "E major", 144, 2,
        ("Open-string licks", "Pull-offs to open strings", "Targeting each chord's 3rd"),
        ("Open position: the open strings are part of the scale, so pull off to them for speed.",
         "Hit the 3rd of each chord: G♯ over E7, C♯ over A7, D♯ over B7.",
         "Bar 12 spells the B7 chord one note at a time to turn back to the top.",
         "Play it over Texas Two-Step: same key and chords."),
        "E7 E7 E7 E7 A7 A7 E7 E7 B7 A7 E7 B7",
        "3:0 3:h1 4:2 4:p0 5:2 5:p0 6:3 6:0 | 6:0=1 -=1 2:3 2:0 3:2 3:0 | 1:3 1:p0 2:3 2:p0 3:2 3:p0 4:2=1 | "
        "6:0 6:3 6:h4 5:0 5:2 5:3 5:h4=1 | 3:0 3:h2 2:2=1 3:2 3:0 4:2=1 | 5:0 5:3 5:h4 4:2=1 4:0 5:2 5:0 | "
        "3:0 3:h1 2:0 1:0=1 2:3 2:p0 3:1 | 6:0=1.5 6:3 6:h4 5:0 5:h1 5:h2 | 4:1=1 3:2 4:4 4:1 5:2=1.5 | "
        "5:0 5:3 5:h4 4:2 3:0 3:h2 2:2=1 | 1:0=1 2:3 2:p0 3:1 3:p0 4:2=1 | 5:2 4:1 4:4 3:2 4:4 4:1 5:2=1"),

    _br("call-and-response", "Call and Response", "Rock lick", "rock", "B minor", 92, 2,
        ("Question-and-answer phrasing", "Bending the ♭7 to the root", "Leaving space"),
        ("Bars 1–2 ask a question high on the neck; bars 3–4 answer it lower down. Then it happens again.",
         "Bend the A (B string, fret 10) a whole step to B, the root.",
         "Each answer starts after a short rest — the silence is part of the phrase.",
         "Everything is in the B minor pentatonic box at fret 7."),
        "B5 A5 E5 B5 B5 A5 E5 F#5",
        "2:10b2=1.5 1:7 2:10 2:7=1 3:9 | 3:9 3:7 4:9=1 4:7~=2 | -=.5 5:7 5:9 4:7 4:9=1 4:7 5:9 | 5:9 6:10 6:7~=3 | "
        "2:10b2=1.5 1:7 1:10 1:7=1 2:10 | 2:10 2:7 3:9 3:7 4:7~=2 | -=.5 5:7 5:9 4:7 4:9 4:p7 5:9 5:7 | 5:9=1 6:10 6:7 5:9~=2"),

    _br("sweet-spot", "Sweet Spot", "Slow-blues lick", "blues", "C major", 72, 2,
        ("Slow blues phrasing", "The major 3rd up high", "Bends to the 5th and root"),
        ("Bar 1 lives in the ‘sweet spot’ above the box: C on the B string at fret 13 and the major 3rd E at fret 12 of the high E.",
         "Bend the B♭ (B string, fret 11) up to C — the 5th of F7.",
         "Over G7, bend the F (G string, fret 10) up to G, the root.",
         "Play it slowly and let each long note ring with vibrato before moving on."),
        "C7 F7 C7 G7 F7 C7",
        "2:13~=1.5 2:11 2:13 1:12~=1.5 | 2:11b2=1.5 1:11 1:13~=2 | 1:11 1:p8 2:11 2:8 3:10 3:8=1 4:10 | "
        "3:10b2=1.5 3:7 4:9 4:8 5:10=1 | 2:11b2=1.5 2:8 3:10 4:10 5:8=1 | 4:10 4:8 5:10 6:11 6:h12 5:10 6:8~=1"),

    _br("sixteenth-cascade", "Sixteenth Cascade", "Fast rock lick", "rock", "E minor", 92, 3,
        ("Sixteenth-note runs", "Pull-offs", "Landing on chord tones"),
        ("The runs go down the E minor pentatonic in groups of four: start each group one note lower.",
         "Pull off on each string so you only pick the first note of each pair.",
         "After each run, stop on a chord tone: E over Em, G over C, A over D, B over B7.",
         "Practise at 60% speed first; the notes must be even before they are fast."),
        "Em Em C D Em Em C B7",
        "1:15=.25 1:p12=.25 2:15=.25 2:p12=.25 1:12=.25 2:15=.25 2:p12=.25 3:14=.25 "
        "2:15=.25 2:p12=.25 3:14=.25 3:p12=.25 4:14=1 | "
        "-=1 4:14=.25 4:p12=.25 5:14=.25 5:p12=.25 6:15 6:12 5:14=1 | "
        "3:12=.25 3:14=.25 2:12=.25 2:h13=.25 2:p12=.25 3:14=.25 3:12=.25 4:14=.25 3:12=2 | "
        "2:15=1 1:12 1:14 1:17~=2 | "
        "1:17=.25 1:p15=.25 2:17=.25 2:p15=.25 1:15=.25 2:17=.25 2:p15=.25 3:16=.25 "
        "2:17=.25 2:p15=.25 3:16=.25 3:p14=.25 2:17~=1 | "
        "1:15=.25 1:p12=.25 2:15=.25 2:p12=.25 1:12=.25 2:15=.25 2:p12=.25 3:14=.25 "
        "2:15=.25 2:p12=.25 3:14=.25 3:p12=.25 4:14=1 | "
        "4:14=.25 3:12=.25 3:14=.25 2:12=.25 2:13=1 2:12 3:14 3:12=1 | 2:12 1:11 1:14 1:11 2:12~=2"),

    _br("major-moves", "Major Moves", "Rock 'n' roll lick", "rock", "A major", 144, 2,
        ("Major and minor pentatonic mixed", "The ♭3 to 3 hammer-on", "12-bar changes"),
        ("This lick mixes the A major pentatonic (bright) with the minor ♭3 (bluesy C).",
         "Hammer C to C♯ on the G string (frets 5 to 6) — the most-used move in rock 'n' roll.",
         "Over D7 it lands on F♯ and D; over E7 it starts on G♯, each chord's 3rd.",
         "Straight eighths, not swung: think 1950s rock 'n' roll."),
        "A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7",
        "3:5 3:h6 2:5 2:7 1:5=1 2:7 2:5 | 3:7=1 3:5 3:h6 4:7=2 | 2:5 2:7 1:5 1:7 1:9=1 1:7 1:5 | "
        "2:8 2:7 2:5 3:7 3:5=1 4:7=1 | 2:7=1 2:10 2:7 3:7=1 3:5=1 | 1:10=1 1:7 2:10 2:7 3:7=1.5 | "
        "3:5 3:h6 2:5 2:7 1:5=1 2:7 2:5 | 4:7=1 -=1 3:5 3:h6 2:5=1 | 2:9=1.5 2:7 3:9 3:7 4:9=1 | "
        "2:7 2:10 1:7 1:10~=2.5 | 1:9 1:7 1:5 2:7 2:5 3:6 4:7=1 | 4:6=1 4:9 4:7 4:6 5:7~=1.5"),

    _br("rolling-thunder", "Rolling Thunder", "Legato lick", "rock", "G minor", 96, 3,
        ("Pull-off rolls", "Hammer-on climbs", "Sixteenth-note legato"),
        ("Each four-note roll is two pull-offs on neighbouring strings: pick only the first note on each string.",
         "Bars 4 and 8 climb back up with hammer-ons — the mirror image of the rolls.",
         "Everything is in the G minor pentatonic box at fret 3.",
         "The last note is a bend from B♭ to C with vibrato: the 5th of the F chord."),
        "Gm F Eb F Gm F Eb F",
        "1:6=.25 1:p3=.25 2:6=.25 2:p3=.25 1:6=.25 1:p3=.25 2:6=.25 2:p3=.25 "
        "3:5=.25 3:p3=.25 4:5=.25 4:p3=.25 4:5=1 | "
        "2:6=.25 2:p3=.25 3:5=.25 3:p3=.25 2:6=.25 2:p3=.25 3:5=.25 3:p3=.25 4:3=2 | "
        "3:3=1 3:5=.25 3:p3=.25 4:5=.25 4:p3=.25 4:5=.25 4:p3=.25 5:5=.25 5:p3=.25 6:6=1 | "
        "5:3=.25 5:h5=.25 4:3=.25 4:h5=.25 3:3=.25 3:h5=.25 2:3=.25 2:h6=.25 1:3=1 2:6~=1 | "
        "1:6=.25 1:p3=.25 2:6=.25 2:p3=.25 1:6=.25 1:p3=.25 2:6=.25 2:p3=.25 "
        "1:6=.25 1:p3=.25 2:6=.25 2:p3=.25 3:3~=1 | "
        "2:6=.25 2:p3=.25 3:5=.25 3:p3=.25 2:6=.25 2:p3=.25 3:5=.25 3:p3=.25 3:5 4:3=1.5 | "
        "3:3=1 3:5=.25 3:p3=.25 4:5=.25 4:p3=.25 4:5=.25 4:p3=.25 5:5=.25 5:p3=.25 6:6=1 | "
        "4:3=.25 4:h5=.25 3:3=.25 3:h5=.25 2:3=.25 2:h6=.25 1:3=.25 1:h6=.25 1:6b2~=2"),

    _br("minor-blues-cry", "Minor Blues Cry", "Slow minor-blues lick", "blues", "D minor", 72, 2,
        ("Minor blues", "Bend and release", "Ending on the root"),
        ("The box at fret 10 is the D minor pentatonic.",
         "Bend the C (B string, fret 13) up to D — the root — and hold it.",
         "Over Gm, bend F to G; in bar 5 bend it and let it come back down.",
         "The A7 bar uses C♯, the one note outside the scale: it pulls you home to D."),
        "Dm Gm Dm A7 Gm Dm",
        "2:13b2=1.5 2:10 3:12 3:10=1.5 | 1:13b2=1.5 1:10 2:13 2:10 3:12=1 | "
        "2:10 2:13 1:10=1 2:13 2:p10 3:12 3:p10 | 4:14=1 4:12 4:11 5:12~=2 | "
        "1:13r2=1.5 1:10 2:13 2:11=1.5 | 3:10 3:12 4:12=1 4:10 5:12 6:10~=1"),

    _br("slide-highway", "Slide Highway", "Slide lick", "rock", "G major", 100, 2,
        ("Slides between positions", "Travelling up and down the neck", "I – ♭VII – IV"),
        ("Slides join one pentatonic position to the next, so the lick travels from fret 3 up to fret 15 and back.",
         "Keep the finger pressed during the slide and pick only the first note.",
         "Bar 3 has a long slide on the B string from fret 8 to 13: G up to C.",
         "Each bar ends on a note of its chord."),
        "G5 F5 C5 G5 G5 F5 C5 G5",
        "3:3 3:/5 3:/7=1 2:6 2:/8=1.5 | 1:6 1:/8=1 1:6 2:8 2:6=1.5 | 3:5 3:/7=1 3:5 2:8 2:/13=1.5 | "
        "2:13 2:\\11=1 2:8 3:10 3:\\7=1.5 | 2:13 2:/15=1 1:13 1:/15~=2 | 1:15 1:\\13=1 2:13 2:\\10=1 3:10=1 | "
        "3:10 3:/12=1 3:10 4:10=2 | 4:8 4:/10=1 4:8 5:10~=2"),

    _br("bend-city", "Bend City", "Bending lick", "rock", "B minor", 92, 3,
        ("Whole- and half-step bends", "Bending to chord tones", "Two positions"),
        ("Every bar starts with a bend that lands on a note of the chord.",
         "Half-step bends (F♯ to G over the G chord) only go to the next fret's pitch — don't overshoot.",
         "Bars 1–4 sit in the box at fret 7; bars 5–8 repeat the idea an octave up, at frets 12–17.",
         "The last bar bends E up to F♯ and lets it fall back: the ♭7 of F♯7."),
        "Bm A G F#7 Bm A G F#7",
        "3:9b2=1.5 2:7 3:7 4:9~=1.5 | 1:9 1:7 2:10 2:7 3:7b2=2 | 2:7b1=1.5 2:10 1:7 1:10=1.5 | "
        "1:10b2=1.5 1:9 2:11 2:7=1.5 | 1:17b2=1.5 1:14 2:15 2:12=1.5 | 2:15b2=1.5 2:12 3:14~=2 | "
        "1:14b1=1.5 2:15 2:12 3:12=1.5 | 1:12r2=1.5 1:9 2:11 2:7~=1.5"),

    _br("highway-twang", "Highway Twang", "Country-rock lick", "rock", "D major", 100, 2,
        ("Major pentatonic", "Hammer-ons from open strings", "Moving up the neck"),
        ("Bright major-pentatonic lines with hammer-ons, in open position and at fret 7.",
         "Bar 7 hammers F to F♯ on the D string — the country-rock ‘slip’ into the major 3rd.",
         "Written over the same chords as Southern Rail: play the riff, then this lick, over one loop.",
         "Keep it snappy and short — let the open strings ring only where it's marked."),
        "D D C C G G D A",
        "3:2 3:h4 2:3 1:2 1:5=1 1:2 2:3 | 3:7 3:h9 2:7 2:10=1 1:7 1:10=1 | "
        "2:1=1 2:3 2:1 3:2 3:p0=1 4:2 | 1:8~=1 2:8 2:p5=1 3:5=1.5 | 3:0 3:h2 3:h4=1 2:3 2:p0=1.5 | "
        "3:4=1 2:3 2:h5 2:p3 3:4 4:5=1 | 4:3 4:h4 4:p0 5:2 5:p0 5:h2 4:0=1 | 5:0 5:3 5:h4 4:2 3:2=2"),

    _br("peak-hour", "Peak Hour", "High-register lick", "rock", "A minor", 96, 3,
        ("Soloing high on the neck", "Bends at fret 15–20", "A sixteenth-note run"),
        ("This is the A minor pentatonic box an octave up, at fret 17, and the box at fret 12.",
         "Frets are close together up here: use one finger per fret and bend with three fingers.",
         "Bar 4 is the peak — a sixteenth run down from C to E. Then bars 5–8 calm it down.",
         "Bar 7 bends F♯ up a half step to G and spells the G chord: G – D – B – G."),
        "Am F G Am Am F G E7",
        "1:17 1:20=1 1:17 2:20b2~=2 | 2:20 2:17 3:19 3:17=1 4:19~=1.5 | 3:17b2=1.5 2:17 2:20~=2 | "
        "1:20=.25 1:17=.25 2:20=.25 2:17=.25 1:17=.25 2:20=.25 2:17=.25 3:19=.25 "
        "2:20=.25 2:17=.25 3:19=.25 3:17=.25 2:17~=1 | "
        "1:20r2=1.5 1:17 2:20 2:17=1.5 | 2:18=1 2:17 3:19 3:17=1 4:19~=1 | 2:19b1=1.5 2:15 3:16 3:12=1.5 | "
        "3:14 3:p13 4:14 4:p12 5:14~=2"),
)


# ---------------------------------------------------------------------------------------------------- Embers
# The slow rock-ballad lick that started this collection (4 bars; written out note by note).

EMBERS = RiffDef(
    id="embers", title="Embers", vibe="Rock-ballad lick", collection=COLLECTION,
    credit="Original Music Decoder lick in a slow rock-ballad style.", source="original", year=None,
    genre="rock", style="ballad", difficulty=2, tempo=66, tonic="A", mode="minor", position_level="intermediate",
    focus=("Bend and release onto the root", "Slides between positions", "Wide, slow vibrato"),
    tips=("Bend slowly — take about a beat to reach the target pitch, and check you really land on it.",
          "Bars 1 and 2 are the same idea: bend up to the chord's root (A, then D), release, and fall down the scale.",
          "Bar 3 climbs from fret 7 to fret 15 with two slides, arriving on G exactly when the band plays G.",
          "Bend with your ring finger, with the middle and index fingers behind it pushing too.",
          "The last bend at fret 15 is the peak. Then sigh down E – C – A and give the final A wide, slow vibrato.",
          "Leave space: the rests between phrases are what make it sound sad."),
    notes=(
        # Am — bend G up to A (the root), release, fall to C (the minor 3rd)
        ("G4", 0, 2, {"s": 2, "f": 8, "fin": 3, "tech": "bend_release", "bend": 2}),
        ("E4", 2, .5, {"s": 2, "f": 5, "fin": 1, "tech": "pull_off"}),
        ("D4", 2.5, .5, {"s": 3, "f": 7, "fin": 3}),
        ("C4", 3, 1, {"s": 3, "f": 5, "fin": 1, "vib": True}),
        # Dm — the same idea an octave up: bend C up to D, release, walk down A – F – D
        ("C5", 4, 2, {"s": 1, "f": 8, "fin": 3, "tech": "bend_release", "bend": 2}),
        ("A4", 6, .5, {"s": 1, "f": 5, "fin": 1, "tech": "pull_off"}),
        ("F4", 6.5, .5, {"s": 2, "f": 6, "fin": 2}),
        ("D4", 7, 1, {"s": 3, "f": 7, "fin": 3, "vib": True}),
        # F → G — slide into F, climb through the chord tones, slide up to G on the change
        ("F4", 8, 1, {"s": 3, "f": 10, "tech": "slide_up"}),
        ("A4", 9, .5, {"s": 2, "f": 10, "fin": 3}),
        ("C5", 9.5, .5, {"s": 1, "f": 8, "fin": 1}),
        ("D5", 10, .5, {"s": 1, "f": 10, "fin": 1}),
        ("E5", 10.5, .5, {"s": 1, "f": 12, "fin": 3}),
        ("G5", 11, 1, {"s": 1, "f": 15, "tech": "slide_up", "vib": True}),
        # Am — the peak: bend up to high A, release, sigh down E – C – A
        ("G5", 12, 1.5, {"s": 1, "f": 15, "fin": 3, "tech": "bend_release", "bend": 2}),
        ("E5", 13.5, .5, {"s": 1, "f": 12, "fin": 1, "tech": "pull_off"}),
        ("C5", 14, .5, {"s": 2, "f": 13, "fin": 2}),
        ("A4", 14.5, 1.5, {"s": 3, "f": 14, "fin": 3, "vib": True}),
    ),
    chords=(_c("A", "min", "i", 0, 4), _c("D", "min", "iv", 4, 4), _c("F", "maj", "bVI", 8, 2),
            _c("G", "maj", "bVII", 10, 2), _c("A", "min", "i", 12, 4)),
)

#: The 20 ~20-second riffs and licks (the tests check the length).
TWENTY = RIFFS + LICKS
BLUES_ROCK: tuple[RiffDef, ...] = TWENTY + (EMBERS,)
