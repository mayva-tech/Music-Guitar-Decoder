"""Pydantic data schemas — the structured source of truth for every arrangement."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator

from .music.guitar import STANDARD_TUNING
from .music.theory import midi_to_name

SkillLevel = Literal["zero", "few_notes", "basic_chords", "intermediate", "advanced"]
Style = Literal["classic_rock", "blues", "ballad", "pop", "acoustic"]
Handedness = Literal["right", "left"]
HarmonizationKind = Literal["simple", "genre", "alternative"]
Genre = Literal["rock", "pop", "blues"]
Technique = Literal["slide_up", "slide_down", "hammer_on", "pull_off", "bend", "bend_release"]
TechniquesMode = Literal["auto", "none", "slides", "all"]


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class GuitarPosition(BaseModel):
    string: int = Field(ge=1, le=6, description="1 = thinnest (high e), 6 = thickest (low E)")
    fret: int = Field(ge=0, le=24)
    finger: int = Field(ge=0, le=4, description="0 open, 1 index, 2 middle, 3 ring, 4 pinky")
    midi: int

    @model_validator(mode="after")
    def _check(self):
        if STANDARD_TUNING[self.string] + self.fret != self.midi:
            raise ValueError(f"Position string {self.string} fret {self.fret} does not produce MIDI {self.midi}")
        if (self.fret == 0) != (self.finger == 0):
            raise ValueError("Finger 0 is used for open strings only")
        return self


class NoteEvent(BaseModel):
    """One musical note on the arrangement timeline."""

    id: str = Field(default_factory=lambda: new_id("n"))
    midi: int = Field(ge=0, le=127)
    name: str = ""
    start_beat: float = Field(ge=0)
    duration_beats: float = Field(gt=0)
    start_sec: Optional[float] = Field(default=None, ge=0, description="Raw onset in the recording, if detected")
    duration_sec: Optional[float] = Field(default=None, gt=0)
    string: Optional[int] = Field(default=None, ge=1, le=6)
    fret: Optional[int] = Field(default=None, ge=0, le=24)
    finger: Optional[int] = Field(default=None, ge=0, le=4)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    low_confidence: bool = False
    cents_off: Optional[float] = None
    source: Literal["detected", "edited", "generated", "demo", "transposed", "riff"] = "detected"
    role: Optional[str] = None
    in_level_range: Optional[bool] = None
    technique: Optional[Technique] = Field(default=None, description="How the note is played (lead parts)")
    bend_semitones: Optional[int] = Field(default=None, ge=1, le=2, description="1 = half-step bend, 2 = whole-step")
    slide_from_fret: Optional[int] = Field(default=None, ge=0, le=24)
    vibrato: bool = False
    chord_degree: Optional[str] = Field(default=None, description="Interval above the current chord's root: R, b3, 3, 5 …")

    @property
    def fretted_midi(self) -> int:
        """Pitch of the fretted string before any bend."""
        return self.midi - (self.bend_semitones or 0) if self.technique == "bend" else self.midi

    @model_validator(mode="after")
    def _check(self):
        if not self.name:
            self.name = midi_to_name(self.midi)
        if (self.string is None) != (self.fret is None):
            raise ValueError("string and fret must be given together")
        if self.technique in ("bend", "bend_release") and not self.bend_semitones:
            raise ValueError("A bend needs bend_semitones (1 or 2)")
        if self.technique not in ("bend", "bend_release") and self.bend_semitones:
            raise ValueError("bend_semitones is only used with bends")
        if self.technique in ("slide_up", "slide_down"):
            if self.slide_from_fret is None or self.fret is None:
                raise ValueError("A slide needs slide_from_fret")
            if (self.technique == "slide_up") != (self.slide_from_fret < self.fret):
                raise ValueError("Slide direction does not match the frets")
        if self.string is not None and self.fret is not None:
            fret_pitch = STANDARD_TUNING[self.string] + self.fret
            if fret_pitch != self.fretted_midi:
                raise ValueError(
                    f"Pitch mismatch: string {self.string} fret {self.fret} plays MIDI "
                    f"{fret_pitch}, not {self.fretted_midi} ({self.name})")
            if self.finger is not None and (self.fret == 0) != (self.finger == 0):
                raise ValueError("Finger 0 is used for open strings only")
        return self


class TempoCandidate(BaseModel):
    bpm: float
    score: float


class KeyCandidate(BaseModel):
    tonic: int = Field(ge=0, le=11)
    mode: Literal["major", "minor"]
    name: str
    confidence: float
    scale_coverage: float = 1.0


class Contour(BaseModel):
    """Downsampled pitch track for display (times in seconds, MIDI floats; null = silence)."""

    times: list[float]
    midi: list[Optional[float]]


class Recording(BaseModel):
    id: str = Field(default_factory=lambda: new_id("rec"))
    filename: str
    format: str
    duration_sec: float
    sample_rate: int
    created_at: str = Field(default_factory=now_iso)


class DetectedMelody(BaseModel):
    id: str = Field(default_factory=lambda: new_id("mel"))
    source: Literal["recording", "upload", "demo", "edited", "riff"] = "recording"
    title: str = "My tune"
    tempo_bpm: float = Field(gt=20, lt=300)
    beats_per_bar: int = 4
    beat_offset: float = 0.0
    notes: list[NoteEvent]
    tempo_candidates: list[TempoCandidate] = []
    key_candidates: list[KeyCandidate] = []
    tuning_offset_cents: float = 0.0
    duration_sec: Optional[float] = None
    warnings: list[str] = []
    contour: Optional[Contour] = None
    recording: Optional[Recording] = None

    @model_validator(mode="after")
    def _check(self):
        last_end = -1.0
        for n in sorted(self.notes, key=lambda x: x.start_beat):
            if n.start_beat < last_end - 1e-6:
                raise ValueError(f"Overlapping notes in a single melody at beat {n.start_beat}")
            last_end = n.start_beat + n.duration_beats
        return self


class ChordDiagram(BaseModel):
    frets: list[Optional[int]] = Field(min_length=6, max_length=6, description="Strings 6..1; null = muted")
    fingers: list[Optional[int]] = Field(min_length=6, max_length=6)


class ChordCandidate(BaseModel):
    symbol: str
    root_pc: int
    quality: str
    roman: str
    function: str
    start_beat: float
    duration_beats: float
    fit: float
    diagram: ChordDiagram
    power_diagram: ChordDiagram
    voicing_midis: list[int]


class Harmonization(BaseModel):
    id: str = Field(default_factory=lambda: new_id("har"))
    kind: HarmonizationKind
    genre: Genre = "rock"
    label: str
    progression_name: str = ""
    description: str
    key: KeyCandidate
    chords: list[ChordCandidate]
    score: float
    use_power_chords: bool


class HarmonizeResponse(BaseModel):
    key_candidates: list[KeyCandidate]
    harmonizations: list[Harmonization]
    explanation: str


class BackingEvent(BaseModel):
    start_beat: float
    duration_beats: float
    symbol: str
    midis: list[int]
    velocity: float = 0.7


class DrumHit(BaseModel):
    start_beat: float
    kind: Literal["kick", "snare", "hat", "crash"]
    velocity: float = 0.8


class ScalePosition(BaseModel):
    string: int = Field(ge=1, le=6)
    fret: int = Field(ge=0, le=24)
    midi: int
    degree: str  # relative to the key's home note
    is_root: bool = False
    is_blue: bool = False


class GeneratedSolo(BaseModel):
    id: str = Field(default_factory=lambda: new_id("solo"))
    kind: Literal["easy", "lead"] = "easy"
    level: SkillLevel
    style: Style
    notes: list[NoteEvent]
    transposition_semitones: int = 0
    changes: list[str] = []
    tab_ascii: str = ""
    scale_name: str = ""
    position_fret: Optional[int] = None
    scale_positions: list[ScalePosition] = []
    techniques_used: list[Technique | Literal["vibrato"]] = []


class TheoryNote(BaseModel):
    title: str
    body: str


class ArrangementTheory(BaseModel):
    genre: Genre
    genre_label: str
    feel: Literal["straight", "shuffle"]
    swing: float = Field(ge=0.5, le=0.75, description="Where the off-beat eighth falls (0.5 straight, 0.667 shuffle)")
    progression_name: str
    progression_roman: list[str]
    scale_name: str
    scale_degrees: list[str]
    guide: list[TheoryNote]


class RiffInfo(BaseModel):
    id: str
    title: str
    credit: str
    source: Literal["public_domain", "original"]
    year: Optional[int] = None
    genre: Genre
    vibe: str = ""
    difficulty: int = Field(ge=1, le=3)
    focus: list[str]
    tips: list[str]
    tempo_bpm: float
    key_name: str
    bars: int
    note_count: int = 0
    techniques: list[str] = []
    tab_preview: str = ""


class Arrangement(BaseModel):
    id: str = Field(default_factory=lambda: new_id("arr"))
    kind: Literal["song", "riff"] = "song"
    riff: Optional[RiffInfo] = None
    title: str
    created_at: str = Field(default_factory=now_iso)
    key: KeyCandidate
    tempo_bpm: float
    beats_per_bar: int = 4
    total_bars: int
    skill_level: SkillLevel
    style: Style
    transposition_semitones: int = 0
    original_melody: DetectedMelody = Field(description="The melody exactly as detected/edited (never altered)")
    melody_guitar: list[NoteEvent] = Field(description="Melody fitted to guitar positions (may be transposed)")
    harmonization: Harmonization
    solo: GeneratedSolo
    lead: Optional[GeneratedSolo] = None
    theory: Optional[ArrangementTheory] = None
    backing: list[BackingEvent]
    bass: list[NoteEvent]
    drums: list[DrumHit]
    melody_tab_ascii: str = ""


class PracticeEventResult(BaseModel):
    event_id: str
    expected_midi: int
    detected_midi: Optional[float] = None
    correct: bool
    timing_offset_ms: Optional[float] = None
    attempts: int = 1
    string: Optional[int] = None
    fret: Optional[int] = None


class PracticeResult(BaseModel):
    arrangement_id: str
    part: Literal["solo", "lead", "melody"] = "solo"
    mode: Literal["follow_me", "play_with_band", "manual"]
    tempo_factor: float = Field(default=1.0, gt=0.1, le=2.0)
    duration_sec: float = Field(ge=0)
    completed: bool = False
    used_microphone: bool = True
    events: list[PracticeEventResult]


class PracticeSession(BaseModel):
    id: str = Field(default_factory=lambda: new_id("ps"))
    created_at: str = Field(default_factory=now_iso)
    result: PracticeResult
    accuracy: float
    mean_abs_timing_ms: Optional[float] = None


class UserPreferences(BaseModel):
    favorite_song: str = ""
    skill_level: SkillLevel = "zero"
    handedness: Handedness = "right"
    style: Style = "classic_rock"
    view_mode: Literal["beginner", "chart", "facing", "vertical"] = "beginner"
    instruction_mode: Literal["text", "voice", "both", "silent"] = "text"
    frets_shown: int = Field(default=12, ge=5, le=22)
