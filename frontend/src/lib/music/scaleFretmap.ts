import { MAX_FRET, STANDARD_TUNING, STRING_LABELS } from "@/lib/music/guitar";
import { NOTE_NAMES_SHARP, pitchClassName } from "@/lib/music/theory";

export const SCALE_ROOTS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type ScaleRoot = (typeof SCALE_ROOTS)[number];

/** Scale kinds shown on the fretboard map. */
export const SCALE_KINDS = [
  { id: "major", label: "Major", steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: "minor", label: "Minor", steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: "major-pentatonic", label: "Maj penta", steps: [0, 2, 4, 7, 9] },
  { id: "minor-pentatonic", label: "Min penta", steps: [0, 3, 5, 7, 10] },
  { id: "blues", label: "Blues", steps: [0, 3, 5, 6, 7, 10] },
  { id: "harmonic-minor", label: "Harm. min", steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: "melodic-minor", label: "Mel. min", steps: [0, 2, 3, 5, 7, 9, 11] },
  { id: "dorian", label: "Dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: "mixolydian", label: "Mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: "phrygian", label: "Phrygian", steps: [0, 1, 3, 5, 7, 8, 10] },
  { id: "lydian", label: "Lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
  { id: "locrian", label: "Locrian", steps: [0, 1, 3, 5, 6, 8, 10] },
] as const;

export type ScaleMode = (typeof SCALE_KINDS)[number]["id"];

/** @deprecated alias — prefer ScaleMode */
export type ScaleKind = ScaleMode;

/** Thin e on top → thick E on bottom (TAB order). */
export const FRETMAP_STRINGS = [1, 2, 3, 4, 5, 6] as const;

export interface FretmapCell {
  string: number;
  fret: number;
  midi: number;
  /** Pitch-class label, e.g. "F#". */
  name: string;
  stringLabel: string;
  /** Index in the scale (0 = tonic), or -1 if not in scale. */
  degree: number;
  inScale: boolean;
  isRoot: boolean;
}

export function rootPc(root: ScaleRoot): number {
  return NOTE_NAMES_SHARP.indexOf(root);
}

export function scaleKindById(id: ScaleMode): (typeof SCALE_KINDS)[number] {
  return SCALE_KINDS.find((k) => k.id === id) ?? SCALE_KINDS[0]!;
}

/** Pitch classes for a root + scale kind. */
export function scaleKindPcs(tonic: number, mode: ScaleMode): number[] {
  const kind = scaleKindById(mode);
  return kind.steps.map((s) => (tonic + s) % 12);
}

/** Every string × fret cell for a full neck map (open → MAX_FRET). */
export function buildFretmap(
  root: ScaleRoot,
  mode: ScaleMode,
  maxFret = MAX_FRET,
): FretmapCell[] {
  const tonic = rootPc(root);
  const pcs = scaleKindPcs(tonic, mode);
  const cells: FretmapCell[] = [];
  for (const s of FRETMAP_STRINGS) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const midi = STANDARD_TUNING[s]! + fret;
      const pc = ((midi % 12) + 12) % 12;
      const degree = pcs.indexOf(pc);
      cells.push({
        string: s,
        fret,
        midi,
        name: pitchClassName(midi),
        stringLabel: STRING_LABELS[s]!,
        degree,
        inScale: degree >= 0,
        isRoot: degree === 0,
      });
    }
  }
  return cells;
}

export function scaleNoteNames(root: ScaleRoot, mode: ScaleMode): string[] {
  return scaleKindPcs(rootPc(root), mode).map((pc) => NOTE_NAMES_SHARP[pc]!);
}

export function scaleDisplayName(root: ScaleRoot, mode: ScaleMode): string {
  const kind = scaleKindById(mode);
  return `${root} ${kind.label}`;
}

/**
 * One solid fill per pitch-class name so every C (or F#, …) matches across the neck.
 * Chosen for contrast on rosewood.
 */
const NOTE_FILL: Record<string, string> = {
  C: "#e9ddc3",
  "C#": "#7ec8e3",
  D: "#f0a060",
  "D#": "#c9a0dc",
  E: "#6ecf8e",
  F: "#e08090",
  "F#": "#90b0e0",
  G: "#e8c84a",
  "G#": "#a0d8c8",
  A: "#e07050",
  "A#": "#b0a0e0",
  B: "#70c0c8",
};

const NOTE_INK_DARK = "#1a1b1e";
const NOTE_INK_LIGHT = "#f4f1ea";

/** Solid circle colors for a pitch-class label (e.g. "C", "F#"). */
export function noteMarkerColors(name: string): { fill: string; ink: string } {
  const fill = NOTE_FILL[name] ?? "#e9ddc3";
  // Light fills get dark text; deeper fills get light text.
  const light = new Set(["C", "C#", "D", "D#", "E", "F#", "G", "G#", "B", "A#"]);
  return { fill, ink: light.has(name) ? NOTE_INK_DARK : NOTE_INK_LIGHT };
}

export type ChordQuality = "maj" | "min" | "dim" | "aug" | "5";

export interface RelatedChord {
  /** Display symbol, e.g. "B", "C#m", "A#°". */
  symbol: string;
  /** Roman numeral, e.g. "I", "ii". */
  roman: string;
  /** Root pitch-class name (for color matching). */
  rootName: string;
  quality: ChordQuality;
}
/** Triad qualities per scale degree (index matches scale steps). */
const DEGREE_QUALITIES: Record<ScaleMode, ChordQuality[]> = {
  major: ["maj", "min", "min", "maj", "maj", "min", "dim"],
  minor: ["min", "dim", "maj", "min", "min", "maj", "maj"],
  "major-pentatonic": ["maj", "min", "min", "maj", "min"],
  "minor-pentatonic": ["min", "maj", "min", "min", "maj"],
  blues: ["min", "maj", "5", "5", "min", "maj"],
  "harmonic-minor": ["min", "dim", "aug", "min", "maj", "maj", "dim"],
  "melodic-minor": ["min", "min", "aug", "maj", "maj", "dim", "dim"],
  dorian: ["min", "min", "maj", "maj", "min", "dim", "maj"],
  mixolydian: ["maj", "min", "dim", "maj", "min", "min", "maj"],
  phrygian: ["min", "maj", "maj", "min", "dim", "maj", "min"],
  lydian: ["maj", "maj", "min", "dim", "maj", "min", "min"],
  locrian: ["dim", "maj", "min", "min", "maj", "maj", "min"],
};

const ROMANS_MAJOR = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const ROMANS_MINOR = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

function chordSymbol(rootName: string, q: ChordQuality): string {
  if (q === "maj") return rootName;
  if (q === "min") return `${rootName}m`;
  if (q === "dim") return `${rootName}°`;
  if (q === "aug") return `${rootName}+`;
  return `${rootName}5`;
}

function romanFor(mode: ScaleMode, degree: number, q: ChordQuality): string {
  if (mode === "major" || mode === "lydian" || mode === "mixolydian" || mode === "major-pentatonic") {
    return ROMANS_MAJOR[degree] ?? String(degree + 1);
  }
  if (mode === "minor" || mode === "dorian" || mode === "phrygian" || mode === "locrian"
    || mode === "harmonic-minor" || mode === "melodic-minor" || mode === "minor-pentatonic" || mode === "blues") {
    const base = ROMANS_MINOR[degree] ?? String(degree + 1);
    if (q === "aug") return base.replace(/[a-z]+$/, (m) => m.toUpperCase()) + "+";
    if (q === "5") return `${degree + 1}5`;
    return base;
  }
  return String(degree + 1);
}

/** Diatonic (or scale-tone) chords for the current root + scale, in degree order. */
export function relatedScaleChords(root: ScaleRoot, mode: ScaleMode): RelatedChord[] {
  const notes = scaleNoteNames(root, mode);
  const quals = DEGREE_QUALITIES[mode];
  const out: RelatedChord[] = [];
  for (let i = 0; i < notes.length && i < quals.length; i++) {
    const rootName = notes[i]!;
    const q = quals[i]!;
    out.push({
      symbol: chordSymbol(rootName, q),
      roman: romanFor(mode, i, q),
      rootName,
      quality: q,
    });
  }
  return out;
}
