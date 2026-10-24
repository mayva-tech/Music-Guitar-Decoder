"""Genre definitions: everything that makes Rock, Pop and Blues sound different.

Each genre sets the chord palette and progression habits, the rhythmic feel, the
solo scale and its signature techniques, and a short plain-language guide.
Ballad and Acoustic styles use the Pop genre with softer backing.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .theory import Key, pc_name

DEGREE_NAMES = {0: "R", 1: "b2", 2: "2", 3: "b3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "b6", 9: "6", 10: "b7", 11: "7"}


def degree_name(semitones: int) -> str:
    return DEGREE_NAMES[semitones % 12]


@dataclass(frozen=True)
class GenreDef:
    key: str
    label: str
    feel: str            # "straight" | "shuffle"
    swing: float         # off-beat eighth position: 0.5 straight, 2/3 shuffle
    palette_major: tuple[str, ...]
    palette_minor: tuple[str, ...]
    dominant7: bool      # play I, IV, V as 7th chords
    power_chords: bool
    special_transitions: dict = field(default_factory=dict)
    template: tuple[str, ...] = ()  # preferred chord per bar (cycled), roman numerals in major
    template_bonus: float = 0.0
    guide: tuple[tuple[str, str], ...] = ()


GENRES: dict[str, GenreDef] = {
    "rock": GenreDef(
        key="rock", label="Rock", feel="straight", swing=0.5,
        palette_major=("I", "IV", "V", "bVII", "vi"), palette_minor=("i", "bIII", "iv", "v", "bVI", "bVII"),
        dominant7=False, power_chords=True,
        special_transitions={("bVII", "IV"): 0.2, ("I", "bVII"): 0.15, ("bVII", "I"): 0.2, ("IV", "I"): 0.1},
        guide=(
            ("Power chords", "Rock rhythm guitar plays just the root and fifth of each chord with distortion. Without a 3rd, the chord is neither happy nor sad — just heavy."),
            ("The ♭VII chord", "Borrowing the chord a whole step below home (B♭ in C) gives the classic rock sound of songs that move I – ♭VII – IV."),
            ("Pentatonic box", "Most rock solos live in the five-note minor pentatonic 'box'. Over a major key it gives a bluesy edge, especially when you bend the ♭3 up towards the 3rd."),
            ("Bends and vibrato", "Rock lead players bend the 4th up to the 5th and the ♭7 up to the root, then hold the note with vibrato to make it sing."),
        ),
    ),
    "pop": GenreDef(
        key="pop", label="Pop", feel="straight", swing=0.5,
        palette_major=("I", "V", "vi", "IV", "ii"), palette_minor=("i", "bVI", "bIII", "bVII", "iv"),
        dominant7=False, power_chords=False,
        special_transitions={("I", "V"): 0.15, ("V", "vi"): 0.25, ("vi", "IV"): 0.25, ("IV", "I"): 0.1, ("IV", "V"): 0.1},
        template=("I", "V", "vi", "IV"), template_bonus=0.18,
        guide=(
            ("The four-chord loop", "I – V – vi – IV (C – G – Am – F in C) powers thousands of pop songs. It moves home → bright → wistful → lifted, then starts again."),
            ("Major pentatonic", "Pop solos and hooks often use the major pentatonic (1 2 3 5 6). With no half steps, every note sounds sweet."),
            ("Slides", "Sliding into a note gives a smooth, vocal sound — like a singer scooping up to a word."),
            ("Strumming pattern", "Down, down-up, up-down-up: the backing guitar's strum keeps eighth notes moving while accents fall on the beat."),
        ),
    ),
    "blues": GenreDef(
        key="blues", label="Blues", feel="shuffle", swing=2 / 3,
        palette_major=("I", "IV", "V"), palette_minor=("i", "iv", "v"),
        dominant7=True, power_chords=False,
        special_transitions={("I", "IV"): 0.15, ("IV", "I"): 0.15, ("V", "IV"): 0.2, ("V", "I"): 0.25},
        template=("I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"), template_bonus=0.25,
        guide=(
            ("12-bar blues", "The blues follows a 12-bar map: four bars of I, two of IV, two of I, then V – IV – I – V to turn around and start again."),
            ("Dominant 7th chords", "Blues plays I, IV and V all as 7th chords (C7, F7, G7). The extra ♭7 gives that unresolved, gritty sound."),
            ("Shuffle feel", "In a shuffle, the second eighth note of each beat comes late — long-short, long-short — like a heartbeat: ta-da, ta-da."),
            ("The blue note", "The blues scale adds the ♭5 to the minor pentatonic. Bending the ♭3 halfway towards the 3rd is the most famous blues sound."),
        ),
    ),
}

STYLE_TO_GENRE = {"classic_rock": "rock", "blues": "blues", "pop": "pop", "ballad": "pop", "acoustic": "pop"}


def genre_of(style: str) -> GenreDef:
    return GENRES[STYLE_TO_GENRE.get(style, "rock")]


# --------------------------------------------------------------------------- solo scales
@dataclass(frozen=True)
class SoloScale:
    name: str
    intervals: tuple[int, ...]   # semitones above the key's home note
    box_root_pc: int             # pitch class whose low-E fret anchors the pentatonic box
    blue_notes: tuple[int, ...] = ()


def solo_scale(genre: GenreDef, key: Key) -> SoloScale:
    t = key.tonic
    flats = key.prefer_flats
    if genre.key == "blues":
        iv = (0, 3, 5, 6, 7, 10)
        return SoloScale(f"{pc_name(t, flats)} blues scale", iv, t, blue_notes=(6,))
    if genre.key == "pop" and key.mode == "major":
        return SoloScale(f"{pc_name(t, flats)} major pentatonic", (0, 2, 4, 7, 9), (t - 3) % 12)
    return SoloScale(f"{pc_name(t, flats)} minor pentatonic", (0, 3, 5, 7, 10), t)


def scale_degree_labels(scale: SoloScale) -> list[str]:
    return [degree_name(i) for i in scale.intervals]


_FOUR_CHORD_LOOPS = ("I–V–vi–IV", "vi–IV–I–V", "I–vi–IV–V", "V–vi–IV–I", "IV–I–V–vi",
                     "bIII–bVII–i–bVI", "i–bVI–bIII–bVII", "bVII–i–bVI–bIII", "bVI–bIII–bVII–i")


def progression_name(genre: GenreDef | None, romans: list[str]) -> str:
    """Human name for a chord sequence (consecutive repeats collapsed)."""
    seq: list[str] = []
    for r in romans:
        if not seq or seq[-1] != r:
            seq.append(r)
    joined = "–".join(seq)
    windows = {"–".join(seq[i:i + 4]) for i in range(max(1, len(seq) - 3))}
    if windows & set(_FOUR_CHORD_LOOPS):
        return f"{joined} (the four-chord pop loop)"
    gk = genre.key if genre else ""
    if gk == "blues":
        return f"{joined} ({'minor blues' if 'i' in seq else 'blues changes with 7th chords'})"
    if "bVII" in seq and "I" in seq:
        return f"{joined} (rock's borrowed ♭VII)"
    if set(seq) <= {"I", "IV", "V"} or set(seq) <= {"i", "iv", "V", "v"}:
        return f"{joined} (the three-chord classic)"
    return joined
