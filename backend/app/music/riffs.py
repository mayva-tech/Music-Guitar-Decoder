"""Riff practice library.

Two kinds of riffs, both written out note by note:

* Public-domain classics (published before 1929) that guitarists love to play as riffs.
* Original Music Decoder riffs that teach the signature moves of rock, pop and blues.

Copyrighted songs are deliberately NOT transcribed here. To practise a riff from any song,
the learner hums it into the recorder and Music Decoder builds the part from their audio.

Note format: (note name, start beat, duration in beats, options)
options: s/f = string/fret (else the position optimiser chooses), tech = technique,
bend = semitones, vib = vibrato. For a bend, the note name is the pitch you hear.
"""
from __future__ import annotations

from dataclasses import dataclass, field

N = tuple  # (name, start, dur, opts?)


@dataclass(frozen=True)
class ChordSpec:
    symbol_root: str   # note name of the root, e.g. "A"
    quality: str       # maj | min | 5 | 7
    roman: str
    start: float
    length: float


@dataclass(frozen=True)
class RiffDef:
    id: str
    title: str
    credit: str
    source: str              # "public_domain" | "original"
    year: int | None
    genre: str               # rock | pop | blues
    style: str               # backing style
    difficulty: int          # 1 easy – 3 harder
    tempo: float
    tonic: str
    mode: str
    position_level: str      # comfort zone for automatically chosen positions
    focus: tuple[str, ...]
    tips: tuple[str, ...]
    notes: tuple[N, ...]
    chords: tuple[ChordSpec, ...]
    bars: int = 4
    power_chords: bool = False
    vibe: str = ""            # style the original riff is written in (e.g. "Grunge")
    extra: dict = field(default_factory=dict)


def _c(root, quality, roman, start, length):
    return ChordSpec(root, quality, roman, start, length)


RIFFS: tuple[RiffDef, ...] = (
    # ------------------------------------------------------------------ public domain
    RiffDef(
        id="mountain-king", title="In the Hall of the Mountain King",
        credit="Edvard Grieg, 1875 (from Peer Gynt). Public domain.", source="public_domain", year=1875,
        genre="rock", style="classic_rock", difficulty=2, tempo=104, tonic="A", mode="minor", position_level="basic_chords",
        focus=("Even eighth notes", "The A and D strings", "Chromatic notes"),
        tips=("Grieg wrote it in B minor. Here it sits in A minor so it starts on the open A string.",
              "Keep the eighth notes even, then let each longer note ring.",
              "The piece speeds up as it goes — learn it at 70% speed, then push the tempo."),
        notes=(("A2", 0, .5), ("B2", .5, .5), ("C3", 1, .5), ("D3", 1.5, .5), ("E3", 2, .5), ("C3", 2.5, .5), ("E3", 3, 1),
               ("D#3", 4, .5), ("B2", 4.5, .5), ("D#3", 5, 1), ("D3", 6, .5), ("A#2", 6.5, .5), ("D3", 7, 1),
               ("A2", 8, .5), ("B2", 8.5, .5), ("C3", 9, .5), ("D3", 9.5, .5), ("E3", 10, .5), ("C3", 10.5, .5), ("E3", 11, .5), ("A3", 11.5, .5),
               ("G3", 12, .5), ("E3", 12.5, .5), ("C3", 13, .5), ("E3", 13.5, .5), ("G3", 14, 2)),
        chords=(_c("A", "5", "i", 0, 4), _c("B", "5", "II", 4, 2), _c("A#", "5", "bII", 6, 2), _c("A", "5", "i", 8, 4),
                _c("C", "5", "bIII", 12, 4)),
        power_chords=True,
    ),
    RiffDef(
        id="toccata", title="Toccata and Fugue in D minor (opening)",
        credit="Attributed to J. S. Bach, c. 1704. Public domain.", source="public_domain", year=1704,
        genre="rock", style="classic_rock", difficulty=3, tempo=60, tonic="D", mode="minor", position_level="intermediate",
        focus=("Pull-offs", "Hammer-ons", "A slide"),
        tips=("The opening twist is a quick pull-off and hammer-on: A–G–A. Pick only the first note.",
              "The run down is pull-offs on the thin strings — pick once per string.",
              "The second time it is an octave lower and ends by sliding into the low D."),
        notes=(("A4", 0, .25, {"s": 1, "f": 5}), ("G4", .25, .25, {"s": 1, "f": 3, "tech": "pull_off"}),
               ("A4", .5, 3.5, {"s": 1, "f": 5, "tech": "hammer_on", "vib": True}),
               ("G4", 4, .25, {"s": 1, "f": 3}), ("F4", 4.25, .25, {"s": 1, "f": 1, "tech": "pull_off"}),
               ("E4", 4.5, .25, {"s": 1, "f": 0, "tech": "pull_off"}), ("D4", 4.75, .25, {"s": 2, "f": 3}),
               ("C#4", 5, 1, {"s": 2, "f": 2, "tech": "pull_off"}), ("D4", 6, 2, {"s": 2, "f": 3, "tech": "hammer_on", "vib": True}),
               ("A3", 8, .25, {"s": 3, "f": 2}), ("G3", 8.25, .25, {"s": 3, "f": 0, "tech": "pull_off"}),
               ("A3", 8.5, 3.5, {"s": 3, "f": 2, "tech": "hammer_on", "vib": True}),
               ("G3", 12, .25, {"s": 3, "f": 0}), ("F3", 12.25, .25, {"s": 4, "f": 3}), ("E3", 12.5, .25, {"s": 4, "f": 2, "tech": "pull_off"}),
               ("D3", 12.75, .25, {"s": 4, "f": 0, "tech": "pull_off"}), ("C#3", 13, 1, {"s": 5, "f": 4}),
               ("D3", 14, 2, {"s": 5, "f": 5, "tech": "slide_up", "vib": True})),
        chords=(_c("D", "5", "i", 0, 4), _c("A", "5", "V", 4, 2), _c("D", "5", "i", 6, 6), _c("A", "5", "V", 12, 2),
                _c("D", "5", "i", 14, 2)),
        power_chords=True,
    ),
    RiffDef(
        id="fur-elise", title="Für Elise (opening)",
        credit="Ludwig van Beethoven, composed 1810. Public domain.", source="public_domain", year=1810,
        genre="pop", style="ballad", difficulty=2, tempo=72, tonic="A", mode="minor", position_level="basic_chords",
        focus=("The two-note wiggle", "Open strings", "Moving across strings"),
        tips=("Written for piano in 3/8 time; here it is counted in 4 so it fits the band.",
              "It is played an octave lower than the piano, like most guitar versions — almost all in first position.",
              "For the E–D♯ wiggle, keep your pinky on fret 4 of the B string and alternate with the open high E."),
        notes=(("E4", 0, .5), ("D#4", .5, .5), ("E4", 1, .5), ("D#4", 1.5, .5), ("E4", 2, .5), ("B3", 2.5, .5), ("D4", 3, .5), ("C4", 3.5, .5),
               ("A3", 4, 1), ("C3", 5, .5), ("E3", 5.5, .5), ("A3", 6, .5), ("B3", 6.5, 1.5),
               ("E3", 8, .5), ("G#3", 8.5, .5), ("B3", 9, .5), ("C4", 9.5, 1.5), ("E4", 11, .5), ("D#4", 11.5, .5),
               ("E4", 12, .5), ("D#4", 12.5, .5), ("E4", 13, .5), ("B3", 13.5, .5), ("D4", 14, .5), ("C4", 14.5, .5), ("A3", 15, 1)),
        chords=(_c("A", "min", "i", 0, 6), _c("E", "maj", "V", 6, 3.5), _c("A", "min", "i", 9.5, 6.5)),
    ),
    RiffDef(
        id="ode-to-joy", title="Ode to Joy",
        credit="Ludwig van Beethoven, Symphony No. 9, 1824. Public domain.", source="public_domain", year=1824,
        genre="pop", style="pop", difficulty=1, tempo=96, tonic="C", mode="major", position_level="zero",
        focus=("First-position notes", "Steady quarter notes", "The two thinnest strings"),
        tips=("Every note is on the two thinnest strings — a great first riff.",
              "In the last bar, hold the E a little longer, then play a quick D."),
        notes=(("E4", 0, 1), ("E4", 1, 1), ("F4", 2, 1), ("G4", 3, 1), ("G4", 4, 1), ("F4", 5, 1), ("E4", 6, 1), ("D4", 7, 1),
               ("C4", 8, 1), ("C4", 9, 1), ("D4", 10, 1), ("E4", 11, 1), ("E4", 12, 1.5), ("D4", 13.5, .5), ("D4", 14, 2)),
        chords=(_c("C", "maj", "I", 0, 4), _c("G", "maj", "V", 4, 4), _c("C", "maj", "I", 8, 4), _c("G", "maj", "V", 12, 4)),
    ),
    RiffDef(
        id="saints", title="When the Saints Go Marching In",
        credit="Traditional spiritual, published 1896. Public domain.", source="public_domain", year=1896,
        genre="blues", style="blues", difficulty=1, tempo=120, tonic="C", mode="major", position_level="zero",
        focus=("Starting after a rest", "Long held notes", "Shuffle feel"),
        tips=("The tune starts on beat 2 — count “1” silently, then play.",
              "Hold each long G for the whole bar while the band shuffles."),
        notes=(("C4", 1, 1), ("E4", 2, 1), ("F4", 3, 1), ("G4", 4, 4),
               ("C4", 9, 1), ("E4", 10, 1), ("F4", 11, 1), ("G4", 12, 4),
               ("C4", 17, 1), ("E4", 18, 1), ("F4", 19, 1), ("G4", 20, 2), ("E4", 22, 2),
               ("C4", 24, 2), ("E4", 26, 2), ("D4", 28, 4)),
        chords=(_c("C", "7", "I", 0, 28), _c("G", "7", "V", 28, 4)),
        bars=8,
    ),
    # ------------------------------------------------------------------ originals
    RiffDef(
        id="engine-room", title="Engine Room",
        credit="Original Music Decoder practice riff.", source="original", year=None,
        genre="rock", style="classic_rock", difficulty=1, tempo=120, tonic="E", mode="minor", position_level="basic_chords",
        focus=("Even eighth notes", "The two thickest strings", "Open-string riffing"),
        tips=("Most of this riff is the open low E — keep it chugging between the fretted notes.",
              "Use down-strokes only for a heavier sound."),
        notes=tuple(
            (n, b * 4 + i * .5, .5) for b, bar in enumerate((
                ("E2", "E2", "B2", "E2", "A2", "G2", "E2", "B2"),
                ("E2", "E2", "B2", "E2", "D3", "B2", "A2", "G2"),
                ("E2", "E2", "B2", "E2", "A2", "G2", "E2", "B2"),
            )) for i, n in enumerate(bar)
        ) + (("E2", 12, .5), ("E2", 12.5, .5), ("B2", 13, .5), ("E2", 13.5, .5), ("G2", 14, .5), ("A2", 14.5, .5), ("B2", 15, 1)),
        chords=(_c("E", "5", "i", 0, 16),),
        power_chords=True,
    ),
    RiffDef(
        id="bend-and-hold", title="Bend and Hold",
        credit="Original Music Decoder practice riff.", source="original", year=None,
        genre="rock", style="classic_rock", difficulty=3, tempo=92, tonic="A", mode="minor", position_level="intermediate",
        focus=("Hammer-on and pull-off", "A full-step bend", "Vibrato"),
        tips=("Everything sits in the A minor pentatonic box at fret 5.",
              "Bend the G string with your ring finger, helped by the middle finger behind it, until it matches the E on the B string.",
              "Finish with wide, slow vibrato on the last note."),
        notes=(("A4", 0, .5, {"s": 1, "f": 5}), ("C5", .5, .5, {"s": 1, "f": 8, "tech": "hammer_on"}),
               ("A4", 1, .5, {"s": 1, "f": 5, "tech": "pull_off"}), ("G4", 1.5, .5, {"s": 2, "f": 8}),
               ("E4", 2, .5, {"s": 2, "f": 5}), ("E4", 2.5, 1.5, {"s": 3, "f": 7, "tech": "bend", "bend": 2}),
               ("G4", 4, .5, {"s": 2, "f": 8}), ("E4", 4.5, .5, {"s": 2, "f": 5}), ("D4", 5, .5, {"s": 3, "f": 7}),
               ("C4", 5.5, .5, {"s": 3, "f": 5, "tech": "pull_off"}), ("A3", 6, 2, {"s": 4, "f": 7, "vib": True})),
        chords=(_c("A", "5", "i", 0, 8),),
        bars=2, power_chords=True,
    ),
    RiffDef(
        id="boogie-shuffle", title="Boogie Shuffle",
        credit="Original practice riff on the traditional boogie bass pattern.", source="original", year=None,
        genre="blues", style="blues", difficulty=2, tempo=108, tonic="A", mode="major", position_level="basic_chords",
        focus=("Shuffle feel", "Walking up and down the chord", "Changing chords"),
        tips=("This walking pattern — root, 3rd, 5th, 6th, ♭7 and back — is the backbone of boogie and early rock 'n' roll.",
              "Swing it: long-short, long-short. The band plays a shuffle so you can lock in."),
        notes=tuple(
            (n, b * 4 + i * .5, .5) for b, bar in enumerate((
                ("A2", "A2", "C#3", "C#3", "E3", "E3", "F#3", "F#3"),
                ("G3", "G3", "F#3", "F#3", "E3", "E3", "C#3", "C#3"),
                ("D3", "D3", "F#3", "F#3", "A3", "A3", "B3", "B3"),
                ("C4", "C4", "B3", "B3", "A3", "A3", "F#3", "F#3"),
            )) for i, n in enumerate(bar)
        ),
        chords=(_c("A", "7", "I", 0, 8), _c("D", "7", "IV", 8, 8)),
    ),
    RiffDef(
        id="blue-curl", title="Blue Curl Lick",
        credit="Original Music Decoder practice riff.", source="original", year=None,
        genre="blues", style="blues", difficulty=3, tempo=80, tonic="A", mode="major", position_level="intermediate",
        focus=("Half-step bends", "The blue note", "Vibrato"),
        tips=("The ♭3 (C) is bent a half step towards the major 3rd (C♯) — the sound of the blues.",
              "Half-step bends are small: push until the note matches the next fret up, no further."),
        notes=(("A4", 0, .5, {"s": 1, "f": 5}), ("C#5", .5, 1, {"s": 1, "f": 8, "tech": "bend", "bend": 1}),
               ("A4", 1.5, .5, {"s": 1, "f": 5}), ("G4", 2, .5, {"s": 2, "f": 8}), ("E4", 2.5, 1.5, {"s": 2, "f": 5}),
               ("G4", 4, .5, {"s": 2, "f": 8}), ("D4", 4.5, .5, {"s": 3, "f": 7}),
               ("C#4", 5, 1, {"s": 3, "f": 5, "tech": "bend", "bend": 1}), ("A3", 6, 2, {"s": 4, "f": 7, "vib": True})),
        chords=(_c("A", "7", "I", 0, 8),),
        bars=2,
    ),
    RiffDef(
        id="arpeggio-hook", title="Four-Chord Arpeggio Hook",
        credit="Original Music Decoder practice riff.", source="original", year=None,
        genre="pop", style="pop", difficulty=2, tempo=100, tonic="G", mode="major", position_level="basic_chords",
        focus=("Arpeggios", "Crossing strings", "The I–V–vi–IV loop"),
        tips=("Each bar spells out the band's chord one note at a time: G, D, Em, C.",
              "Let the notes ring into each other, like a harp."),
        notes=tuple(
            (n, b * 4 + i * .5, .5) for b, pat in enumerate((
                ("G3", "B3", "D4", "B3"), ("D3", "A3", "D4", "A3"), ("E3", "G3", "B3", "G3"), ("C4", "E4", "G4", "E4"),
            )) for i, n in enumerate(pat + pat)
        ),
        chords=(_c("G", "maj", "I", 0, 4), _c("D", "maj", "V", 4, 4), _c("E", "min", "vi", 8, 4), _c("C", "maj", "IV", 12, 4)),
    ),
    RiffDef(
        id="slide-hook", title="Slide Hook",
        credit="Original Music Decoder practice riff.", source="original", year=None,
        genre="pop", style="pop", difficulty=2, tempo=96, tonic="C", mode="major", position_level="intermediate",
        focus=("Slides", "Hammer-ons", "Major pentatonic"),
        tips=("Hammer from C to D, then keep pressing and slide the same finger up to E.",
              "This is the C major pentatonic — every note sounds sweet over the band."),
        notes=(("C4", 0, .5, {"s": 3, "f": 5}), ("D4", .5, .5, {"s": 3, "f": 7, "tech": "hammer_on"}),
               ("E4", 1, 1, {"s": 3, "f": 9, "tech": "slide_up"}), ("G4", 2, .5, {"s": 2, "f": 8}),
               ("E4", 2.5, .5, {"s": 2, "f": 5}), ("D4", 3, 1, {"s": 3, "f": 7}),
               ("C4", 4, .5, {"s": 3, "f": 5}), ("D4", 4.5, .5, {"s": 3, "f": 7, "tech": "hammer_on"}),
               ("E4", 5, 1, {"s": 3, "f": 9, "tech": "slide_up"}), ("A4", 6, .5, {"s": 1, "f": 5}),
               ("G4", 6.5, .5, {"s": 2, "f": 8}), ("E4", 7, 1, {"s": 2, "f": 5, "vib": True})),
        chords=(_c("C", "maj", "I", 0, 4), _c("A", "min", "vi", 4, 4)),
        bars=2,
    ),
)


# ---------------------------------------------------------------------- modern-style originals
# Written for Music Decoder to teach the moves of modern styles. None of them copies a song.


def _seq(notes: tuple[str, ...], start: float, step: float, opts: dict | None = None) -> tuple:
    return tuple((n, start + i * step, step) + ((opts,) if opts else ()) for i, n in enumerate(notes))


def _trem(names: tuple[str, ...], start: float, per_note: int = 4) -> tuple:
    """Tremolo picking: each note repeated as fast sixteenths."""
    out = []
    t = start
    for n in names:
        for _ in range(per_note):
            out.append((n, t, .25))
            t += .25
    return tuple(out)


_GRUNGE_A = (("E2", 0, .5), ("E2", .5, .5), ("A#2", 1, .5, {"s": 6, "f": 6}), ("A2", 1.5, .5, {"s": 6, "f": 5, "tech": "pull_off"}),
             ("E2", 2, .5), ("D3", 2.5, .5, {"s": 5, "f": 5}), ("C3", 3, 1, {"s": 5, "f": 3, "tech": "pull_off"}))
_GRUNGE_B = (("E2", 4, .5), ("E2", 4.5, .5), ("A#2", 5, .5, {"s": 6, "f": 6}), ("A2", 5.5, .5, {"s": 6, "f": 5, "tech": "pull_off"}),
             ("E2", 6, .5), ("B2", 6.5, 1.5, {"s": 5, "f": 2, "vib": True}))


def _shift(notes: tuple, beats: float) -> tuple:
    return tuple((n[0], n[1] + beats, n[2]) + tuple(n[3:]) for n in notes)


def _gallop(note: str, start: float) -> tuple:
    return ((note, start, .5), (note, start + .5, .25), (note, start + .75, .25))


MODERN_RIFFS: tuple[RiffDef, ...] = (
    RiffDef(
        id="flannel-crunch", title="Flannel Crunch", vibe="Grunge",
        credit="Original Music Decoder riff in a grunge style.", source="original", year=None,
        genre="rock", style="classic_rock", difficulty=2, tempo=100, tonic="E", mode="minor", position_level="basic_chords",
        focus=("Low-string riffing", "Pull-offs", "The dark ♭5 note"),
        tips=("The B♭ on fret 6 is the ♭5 — the 'sour' note that gives grunge its gloom.",
              "Pick the higher note, then pull off to the lower one without picking again.",
              "Keep the open low E loose and loud between the fretted notes."),
        notes=_GRUNGE_A + _GRUNGE_B + _shift(_GRUNGE_A, 8) + (
            ("E2", 12, .5), ("E2", 12.5, .5), ("A#2", 13, .5, {"s": 6, "f": 6}), ("A2", 13.5, .5, {"s": 6, "f": 5, "tech": "pull_off"}),
            ("E2", 14, .5), ("F2", 14.5, .5, {"s": 6, "f": 1}), ("E2", 15, 1, {"s": 6, "f": 0, "tech": "pull_off"})),
        chords=(_c("E", "5", "i", 0, 16),), power_chords=True,
    ),
    RiffDef(
        id="sixteenth-strut", title="Sixteenth Strut", vibe="Funk",
        credit="Original Music Decoder riff in a funk style.", source="original", year=None,
        genre="pop", style="pop", difficulty=3, tempo=96, tonic="E", mode="minor", position_level="basic_chords",
        focus=("Sixteenth-note timing", "Rests that groove", "A hammer-on"),
        tips=("Count “1-e-and-a” for every beat: the riff lives on those tiny subdivisions.",
              "The gaps matter as much as the notes — mute the strings with your fretting hand during rests.",
              "Hammer from the open D string up to fret 2."),
        notes=tuple(x for bar in range(4) for x in _shift((
            ("E3", 0, .25, {"s": 4, "f": 2}), ("E3", .5, .25, {"s": 4, "f": 2}), ("G3", .75, .25, {"s": 3, "f": 0}),
            ("A3", 1, .5, {"s": 3, "f": 2}), ("G3", 1.75, .25, {"s": 3, "f": 0}), ("E3", 2, .25, {"s": 4, "f": 2}),
            ("D3", 2.5, .25, {"s": 4, "f": 0}), ("E3", 2.75, .75, {"s": 4, "f": 2, "tech": "hammer_on"}),
        ) + ((("B3", 3.5, .5, {"s": 3, "f": 4}),) if bar < 3 else (("B3", 3.5, .5, {"s": 3, "f": 4, "vib": True}),)), bar * 4)),
        chords=(_c("E", "7", "I", 0, 16),),
    ),
    RiffDef(
        id="basement-show", title="Basement Show", vibe="Pop-punk",
        credit="Original Music Decoder riff in a pop-punk style.", source="original", year=None,
        genre="rock", style="classic_rock", difficulty=1, tempo=160, tonic="D", mode="major", position_level="basic_chords",
        focus=("Fast down-strokes", "Root notes", "Walking into the next chord"),
        tips=("Play every note with a down-stroke — that's the pop-punk drive.",
              "The last two notes of each bar walk into the next chord, so you never get lost."),
        notes=_seq(("D3",) * 6 + ("C#3", "B2"), 0, .5) + _seq(("A2",) * 6 + ("A#2", "B2"), 4, .5)
        + _seq(("B2",) * 6 + ("A2", "A2"), 8, .5) + _seq(("G2",) * 6, 12, .5) + (("A2", 15, 1),),
        chords=(_c("D", "5", "I", 0, 4), _c("A", "5", "V", 4, 4), _c("B", "5", "vi", 8, 4), _c("G", "5", "IV", 12, 4)),
        power_chords=True,
    ),
    RiffDef(
        id="gallop-run", title="Gallop Run", vibe="Metal",
        credit="Original Music Decoder riff in a metal style.", source="original", year=None,
        genre="rock", style="classic_rock", difficulty=3, tempo=132, tonic="E", mode="minor", position_level="basic_chords",
        focus=("The gallop rhythm", "Pull-offs on the A string", "Picking speed"),
        tips=("A gallop is one eighth note and two sixteenths: “da-da-dum, da-da-dum”.",
              "Rest the side of your picking hand lightly on the strings near the bridge for a tight, chunky sound.",
              "Start at 60% speed; the gallop must stay even before it gets fast."),
        notes=_gallop("E2", 0) + _gallop("E2", 1) + (("B2", 2, .5), ("C3", 2.5, .5)) + _gallop("E2", 3)
        + _gallop("E2", 4) + _gallop("E2", 5) + (("D3", 6, .5, {"s": 5, "f": 5}), ("C3", 6.5, .5, {"s": 5, "f": 3, "tech": "pull_off"}),
                                                  ("B2", 7, 1, {"s": 5, "f": 2, "tech": "pull_off"}))
        + _gallop("E2", 8) + _gallop("E2", 9) + (("B2", 10, .5), ("C3", 10.5, .5)) + _gallop("E2", 11)
        + _gallop("E2", 12) + _gallop("E2", 13) + (("G2", 14, .5), ("F#2", 14.5, .5), ("E2", 15, 1)),
        chords=(_c("E", "5", "i", 0, 16),), power_chords=True,
    ),
    RiffDef(
        id="bedroom-shimmer", title="Bedroom Shimmer", vibe="Indie",
        credit="Original Music Decoder riff in an indie style.", source="original", year=None,
        genre="pop", style="pop", difficulty=2, tempo=110, tonic="D", mode="major", position_level="basic_chords",
        focus=("Ringing arpeggios", "Open strings over chords", "I–vi–IV–V"),
        tips=("Let every note ring into the next — the open high E floating over each chord is the indie shimmer.",
              "Pick gently and evenly; this one is about tone, not speed."),
        notes=_seq(("D3", "A3", "D4", "E4", "F#4", "E4", "D4", "A3"), 0, .5) + _seq(("B2", "F#3", "B3", "D4", "E4", "D4", "B3", "F#3"), 4, .5)
        + _seq(("G2", "D3", "G3", "B3", "E4", "B3", "G3", "D3"), 8, .5) + _seq(("A2", "E3", "A3", "C#4", "E4", "C#4", "A3"), 12, .5)
        + (("E3", 15.5, .5),),
        chords=(_c("D", "maj", "I", 0, 4), _c("B", "min", "vi", 4, 4), _c("G", "maj", "IV", 8, 4), _c("A", "maj", "V", 12, 4)),
    ),
    RiffDef(
        id="offbeat-sunrise", title="Offbeat Sunrise", vibe="Reggae",
        credit="Original Music Decoder riff in a reggae style.", source="original", year=None,
        genre="pop", style="pop", difficulty=2, tempo=76, tonic="A", mode="minor", position_level="basic_chords",
        focus=("Starting off the beat", "Leaving space", "Low melodic riffing"),
        tips=("Reggae leaves beat 1 empty and lands on the “and” — feel the silence before each phrase.",
              "Play it relaxed and a little behind the beat."),
        notes=(("A2", .5, .5), ("C3", 1, .5), ("E3", 1.5, .5), ("G3", 2.5, .5), ("E3", 3, .5), ("D3", 3.5, .5),
               ("C3", 4.5, .5), ("D3", 5, .5), ("E3", 5.5, 1.5, {"vib": True}),
               ("A2", 8.5, .5), ("C3", 9, .5), ("E3", 9.5, .5), ("G3", 10.5, .5), ("E3", 11, .5), ("D3", 11.5, .5),
               ("C3", 12.5, .5), ("B2", 13, .5), ("A2", 13.5, 2.5)),
        chords=(_c("A", "min", "i", 0, 4), _c("G", "maj", "bVII", 4, 4), _c("A", "min", "i", 8, 4), _c("G", "maj", "bVII", 12, 4)),
    ),
    RiffDef(
        id="desert-highway", title="Desert Highway", vibe="Desert rock",
        credit="Original Music Decoder riff in a desert-rock style.", source="original", year=None,
        genre="rock", style="classic_rock", difficulty=2, tempo=88, tonic="E", mode="minor", position_level="basic_chords",
        focus=("Exotic half steps", "Pull-offs", "Heavy, slow groove"),
        tips=("The F (fret 1) and G♯ (fret 4) give the Middle-Eastern, sun-baked sound.",
              "Play behind the beat and let the low notes sustain."),
        notes=tuple(x for k in (0, 8) for x in _shift((
            ("E2", 0, 1), ("F2", 1, .5, {"s": 6, "f": 1}), ("E2", 1.5, .5, {"s": 6, "f": 0, "tech": "pull_off"}),
            ("G#2", 2, .5, {"s": 6, "f": 4}), ("A2", 2.5, .5, {"s": 6, "f": 5}), ("G#2", 3, 1, {"s": 6, "f": 4, "tech": "pull_off"}),
            ("B2", 4, 1, {"s": 5, "f": 2}), ("C3", 5, .5, {"s": 5, "f": 3}), ("B2", 5.5, .5, {"s": 5, "f": 2, "tech": "pull_off"}),
            ("G#2", 6, 1, {"s": 6, "f": 4}), ("E2", 7, 1),
        ), k)),
        chords=(_c("E", "5", "i", 0, 16),), power_chords=True,
    ),
    RiffDef(
        id="tide-pool", title="Tide Pool Tremolo", vibe="Surf",
        credit="Original Music Decoder riff in a surf style.", source="original", year=None,
        genre="rock", style="classic_rock", difficulty=3, tempo=120, tonic="A", mode="minor", position_level="zero",
        focus=("Tremolo picking", "A descending melody", "Light, fast alternate picking"),
        tips=("Tremolo picking means picking one note very fast, down-up-down-up.",
              "Keep your picking hand loose — the speed comes from the wrist, not the arm.",
              "Under it, the band plays the falling Am–G–F–E chords."),
        notes=_trem(("E4", "D4", "C4", "B3"), 0) + _trem(("C4", "B3", "A3", "B3"), 4) + _trem(("E4", "D4", "C4", "B3"), 8)
        + _trem(("C4", "B3"), 12) + (("A3", 14, 2, {"vib": True}),),
        chords=(_c("A", "min", "i", 0, 1), _c("G", "maj", "bVII", 1, 1), _c("F", "maj", "bVI", 2, 1), _c("E", "maj", "V", 3, 1),
                _c("A", "min", "i", 4, 4),
                _c("A", "min", "i", 8, 1), _c("G", "maj", "bVII", 9, 1), _c("F", "maj", "bVI", 10, 1), _c("E", "maj", "V", 11, 1),
                _c("A", "min", "i", 12, 4)),
    ),
    RiffDef(
        id="back-porch", title="Back Porch Pickin'", vibe="Country",
        credit="Original Music Decoder riff in a country style.", source="original", year=None,
        genre="pop", style="acoustic", difficulty=2, tempo=110, tonic="G", mode="major", position_level="basic_chords",
        focus=("Hammer-ons", "Pull-offs", "Major pentatonic runs"),
        tips=("Country lines bounce between hammer-ons and open strings — keep them crisp and short.",
              "The B♭ hammered up to B is a classic country 'slip' into the major 3rd."),
        notes=(("G3", 0, .5, {"s": 3, "f": 0}), ("A3", .5, .5, {"s": 3, "f": 2, "tech": "hammer_on"}), ("B3", 1, .5, {"s": 2, "f": 0}),
               ("D4", 1.5, .5, {"s": 2, "f": 3}), ("E4", 2, .5, {"s": 1, "f": 0}), ("D4", 2.5, .5, {"s": 2, "f": 3}),
               ("B3", 3, .5, {"s": 2, "f": 0}), ("G3", 3.5, .5, {"s": 3, "f": 0}),
               ("A#3", 4, .5, {"s": 3, "f": 3}), ("B3", 4.5, .5, {"s": 3, "f": 4, "tech": "hammer_on"}), ("D4", 5, .5, {"s": 2, "f": 3}),
               ("B3", 5.5, .5, {"s": 2, "f": 0}), ("A3", 6, .5, {"s": 3, "f": 2}), ("G3", 6.5, 1.5, {"s": 3, "f": 0, "tech": "pull_off"}),
               ("C4", 8, .5, {"s": 2, "f": 1}), ("D4", 8.5, .5, {"s": 2, "f": 3, "tech": "hammer_on"}), ("E4", 9, .5, {"s": 1, "f": 0}),
               ("G4", 9.5, .5, {"s": 1, "f": 3}), ("E4", 10, .5, {"s": 1, "f": 0}), ("D4", 10.5, .5, {"s": 2, "f": 3}),
               ("C4", 11, .5, {"s": 2, "f": 1}), ("G3", 11.5, .5, {"s": 3, "f": 0}),
               ("A#3", 12, .5, {"s": 3, "f": 3}), ("B3", 12.5, .5, {"s": 3, "f": 4, "tech": "hammer_on"}), ("D4", 13, .5, {"s": 2, "f": 3}),
               ("B3", 13.5, .5, {"s": 2, "f": 0}), ("A3", 14, .5, {"s": 3, "f": 2}), ("G3", 14.5, 1.5, {"s": 3, "f": 0, "tech": "pull_off"})),
        chords=(_c("G", "maj", "I", 0, 8), _c("C", "maj", "IV", 8, 4), _c("D", "maj", "V", 12, 2), _c("G", "maj", "I", 14, 2)),
    ),
    RiffDef(
        id="velvet-slide", title="Velvet Slide", vibe="Neo-soul",
        credit="Original Music Decoder riff in a neo-soul style.", source="original", year=None,
        genre="pop", style="ballad", difficulty=3, tempo=72, tonic="E", mode="minor", position_level="intermediate",
        focus=("Slides", "Pull-offs", "Smooth, vocal phrasing"),
        tips=("Neo-soul phrases slide into notes like a singer — keep the finger pressed while you glide.",
              "Play softly with the flesh of your thumb or fingers for a warm tone."),
        notes=(("B3", 0, .5, {"s": 3, "f": 4}), ("D4", .5, 1, {"s": 3, "f": 7, "tech": "slide_up"}), ("E4", 1.5, .5, {"s": 2, "f": 5}),
               ("G4", 2, 1, {"s": 2, "f": 8, "tech": "slide_up"}), ("F#4", 3, .5, {"s": 2, "f": 7, "tech": "pull_off"}),
               ("E4", 3.5, .5, {"s": 2, "f": 5, "tech": "pull_off"}),
               ("D4", 4, .5, {"s": 3, "f": 7}), ("B3", 4.5, .5, {"s": 3, "f": 4}), ("A3", 5, .5, {"s": 4, "f": 7}),
               ("B3", 5.5, 2.5, {"s": 4, "f": 9, "tech": "slide_up", "vib": True})),
        chords=(_c("E", "min", "i", 0, 4), _c("C", "maj", "bVI", 4, 4)),
        bars=2,
    ),
)

RIFFS = RIFFS + MODERN_RIFFS

RIFFS_BY_ID = {r.id: r for r in RIFFS}
