// TypeScript mirrors of the backend's Pydantic schemas (backend/app/schemas.py).

export type SkillLevel = "zero" | "few_notes" | "basic_chords" | "intermediate" | "advanced";
export type Style = "classic_rock" | "blues" | "ballad" | "pop" | "acoustic";
export type Handedness = "right" | "left";
export type ViewMode = "beginner" | "chart" | "facing" | "vertical";
export type InstructionMode = "text" | "voice" | "both" | "silent";
export type HarmonizationKind = "simple" | "genre" | "alternative";
export type Genre = "rock" | "pop" | "blues";
export type Technique = "slide_up" | "slide_down" | "hammer_on" | "pull_off" | "bend" | "bend_release";
export type TechniquesMode = "auto" | "none" | "slides" | "all";
export type MarkerLabel = "finger" | "interval" | "note";
export type Part = "solo" | "lead" | "melody";

export interface NoteEvent {
  id: string;
  midi: number;
  name: string;
  start_beat: number;
  duration_beats: number;
  start_sec?: number | null;
  duration_sec?: number | null;
  string?: number | null;
  fret?: number | null;
  finger?: number | null;
  confidence?: number | null;
  low_confidence?: boolean;
  cents_off?: number | null;
  source?: "detected" | "edited" | "generated" | "demo" | "transposed" | "riff";
  role?: string | null;
  in_level_range?: boolean | null;
  technique?: Technique | null;
  bend_semitones?: number | null;
  slide_from_fret?: number | null;
  vibrato?: boolean;
  chord_degree?: string | null;
}

export interface PlayableNote extends NoteEvent {
  string: number;
  fret: number;
  finger: number;
}

export interface KeyCandidate {
  tonic: number;
  mode: "major" | "minor";
  name: string;
  confidence: number;
  scale_coverage: number;
}

export interface TempoCandidate {
  bpm: number;
  score: number;
}

export interface DetectedMelody {
  id: string;
  source: "recording" | "upload" | "demo" | "edited" | "riff";
  title: string;
  tempo_bpm: number;
  beats_per_bar: number;
  beat_offset: number;
  notes: NoteEvent[];
  tempo_candidates: TempoCandidate[];
  key_candidates: KeyCandidate[];
  tuning_offset_cents: number;
  duration_sec?: number | null;
  warnings: string[];
  contour?: { times: number[]; midi: (number | null)[] } | null;
  recording?: { id: string; filename: string; format: string; duration_sec: number; sample_rate: number } | null;
}

export interface ChordDiagram {
  frets: (number | null)[]; // strings 6..1
  fingers: (number | null)[];
}

export interface ChordCandidate {
  symbol: string;
  root_pc: number;
  quality: string;
  roman: string;
  function: string;
  start_beat: number;
  duration_beats: number;
  fit: number;
  diagram: ChordDiagram;
  power_diagram: ChordDiagram;
  voicing_midis: number[];
}

export interface Harmonization {
  id: string;
  kind: HarmonizationKind;
  genre: Genre;
  label: string;
  progression_name: string;
  description: string;
  key: KeyCandidate;
  chords: ChordCandidate[];
  score: number;
  use_power_chords: boolean;
}

export interface HarmonizeResponse {
  key_candidates: KeyCandidate[];
  harmonizations: Harmonization[];
  explanation: string;
}

export interface BackingEvent {
  start_beat: number;
  duration_beats: number;
  symbol: string;
  midis: number[];
  velocity: number;
}

export interface DrumHit {
  start_beat: number;
  kind: "kick" | "snare" | "hat" | "crash";
  velocity: number;
}

export interface ScalePosition {
  string: number;
  fret: number;
  midi: number;
  degree: string;
  is_root: boolean;
  is_blue: boolean;
}

export interface GeneratedSolo {
  id: string;
  kind: "easy" | "lead";
  level: SkillLevel;
  style: Style;
  notes: PlayableNote[];
  transposition_semitones: number;
  changes: string[];
  tab_ascii: string;
  scale_name: string;
  position_fret: number | null;
  scale_positions: ScalePosition[];
  techniques_used: (Technique | "vibrato")[];
}

export interface ArrangementTheory {
  genre: Genre;
  genre_label: string;
  feel: "straight" | "shuffle";
  swing: number;
  progression_name: string;
  progression_roman: string[];
  scale_name: string;
  scale_degrees: string[];
  guide: { title: string; body: string }[];
}

export interface RiffInfo {
  id: string;
  title: string;
  credit: string;
  source: "public_domain" | "original";
  year: number | null;
  genre: Genre;
  vibe: string;
  difficulty: number;
  focus: string[];
  tips: string[];
  tempo_bpm: number;
  key_name: string;
  bars: number;
  note_count: number;
  techniques: string[];
  tab_preview: string;
}

export interface Arrangement {
  id: string;
  kind?: "song" | "riff";
  riff?: RiffInfo | null;
  title: string;
  created_at: string;
  key: KeyCandidate;
  tempo_bpm: number;
  beats_per_bar: number;
  total_bars: number;
  skill_level: SkillLevel;
  style: Style;
  transposition_semitones: number;
  original_melody: DetectedMelody;
  melody_guitar: PlayableNote[];
  harmonization: Harmonization;
  solo: GeneratedSolo;
  lead: GeneratedSolo | null;
  theory: ArrangementTheory | null;
  backing: BackingEvent[];
  bass: NoteEvent[];
  drums: DrumHit[];
  melody_tab_ascii: string;
}

export interface ArrangementSummary {
  id: string;
  title: string;
  created_at: string;
  key: string;
  tempo_bpm: number;
  total_bars: number;
  skill_level: SkillLevel;
  style: Style;
  harmonization: string;
  source: string;
}

export interface PracticeEventResult {
  event_id: string;
  expected_midi: number;
  detected_midi?: number | null;
  correct: boolean;
  timing_offset_ms?: number | null;
  attempts?: number;
  string?: number | null;
  fret?: number | null;
}

export type PracticeMode = "follow_me" | "play_with_band" | "manual";

export interface PracticeResult {
  arrangement_id: string;
  part: Part;
  mode: PracticeMode;
  tempo_factor: number;
  duration_sec: number;
  completed: boolean;
  used_microphone: boolean;
  events: PracticeEventResult[];
}

export interface Skill {
  key: string;
  label: string;
  how: string;
  progress: number;
  achieved: boolean;
}

export interface ProgressSummary {
  skills: Skill[];
  sessions: number;
  verified_sessions: number;
  practice_minutes: number;
  next_skill: string | null;
}

export interface Recommendation {
  kind: "start" | "slow_down" | "shorter_phrase" | "simpler" | "speed_up" | "longer_phrase" | "new_skill" | "keep_going";
  message: string;
  tempo_factor?: number;
  phrase_length?: number;
}

export interface PracticeSessionRecord {
  id: string;
  created_at: string;
  result: PracticeResult;
  accuracy: number;
  mean_abs_timing_ms?: number | null;
}

export interface UserPreferences {
  favoriteSong: string;
  skillLevel: SkillLevel;
  handedness: Handedness;
  style: Style;
  viewMode: ViewMode;
  instructionMode: InstructionMode;
  fretsShown: number;
  equalFretSpacing: boolean;
  showNoteNames: boolean;
  a4: number;
  toleranceCents: number;
  clarityThreshold: number;
  noiseGate: number;
  handOverlay: boolean;
  handOpacity: number; // 0.1 – 0.9
  showScale: boolean;
  markerLabel: MarkerLabel;
  techniques: TechniquesMode;
  animateHand: boolean;
  /** Unlocks all Progress lessons and marks skills complete (local UI only). */
  developerMode: boolean;
  /** When on, selecting a Read item speaks its English text (Microsoft Andrew). */
  autoReadAloud: boolean;
  /** Lead Solo Workshop: "clean" = the app's lead voice, "crunch" adds mild drive. */
  leadTone: "clean" | "crunch";
}
