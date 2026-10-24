/** Plain-language minor-pentatonic “box 1” guides. */

import { NOTE_NAMES_SHARP } from "@/lib/music/theory";

/** Semitone steps from the root: R · ♭3 · 4 · 5 · ♭7 */
export const MINOR_PENTATONIC_STEPS = [0, 3, 5, 7, 10] as const;
export const MINOR_PENTATONIC_DEGREES = ["R", "b3", "4", "5", "b7"] as const;

/** Natural minor / Aeolian — seven notes before we drop two. */
export const NATURAL_MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10] as const;

/**
 * Box 1 shape: frets relative to the root fret on each string
 * (string 1 = thin e … 6 = thick E). Two notes per string, ~4 frets wide.
 */
export const MINOR_PENTA_BOX: ReadonlyArray<{
  string: number;
  /** Frets offset from the box root fret. */
  offsets: readonly number[];
  degrees: readonly string[];
}> = [
  { string: 6, offsets: [0, 3], degrees: ["R", "b3"] },
  { string: 5, offsets: [0, 2], degrees: ["4", "5"] },
  { string: 4, offsets: [0, 2], degrees: ["b7", "R"] },
  { string: 3, offsets: [0, 2], degrees: ["b3", "4"] },
  { string: 2, offsets: [0, 3], degrees: ["5", "b7"] },
  { string: 1, offsets: [0, 3], degrees: ["R", "b3"] },
];

export interface PentatonicGuide {
  id: string;
  /** e.g. "A minor pentatonic" */
  name: string;
  root: string;
  /** Fret where the box root sits on string 6 (and 1). */
  rootFret: number;
  /** The five scale notes. */
  notes: string[];
  /** Relative major that shares the same five notes. */
  relativeMajor: string;
  tip: string;
}

function pcOf(name: string): number {
  const i = NOTE_NAMES_SHARP.indexOf(name);
  if (i < 0) throw new Error(`Unknown note: ${name}`);
  return i;
}

function noteAt(root: string, step: number): string {
  return NOTE_NAMES_SHARP[(pcOf(root) + step) % 12]!;
}

export function minorPentatonicNotes(root: string): string[] {
  return MINOR_PENTATONIC_STEPS.map((s) => noteAt(root, s));
}

export function naturalMinorNotes(root: string): string[] {
  return NATURAL_MINOR_STEPS.map((s) => noteAt(root, s));
}

/** Relative major = three semitones up from minor root (A minor ↔ C major). */
export function relativeMajorRoot(minorRoot: string): string {
  return noteAt(minorRoot, 3);
}

export const PENTATONIC_GUIDES: PentatonicGuide[] = [
  {
    id: "a-minor",
    name: "A minor pentatonic",
    root: "A",
    rootFret: 5,
    notes: minorPentatonicNotes("A"),
    relativeMajor: "C major pentatonic",
    tip: "The classic rock / blues box — root on the 5th fret of the thick E string.",
  },
  {
    id: "e-minor",
    name: "E minor pentatonic",
    root: "E",
    rootFret: 0,
    notes: minorPentatonicNotes("E"),
    relativeMajor: "G major pentatonic",
    tip: "Open-position friendly — many riffs live here (think Smoke on the Water neighbourhood).",
  },
  {
    id: "d-minor",
    name: "D minor pentatonic",
    root: "D",
    rootFret: 10,
    notes: minorPentatonicNotes("D"),
    relativeMajor: "F major pentatonic",
    tip: "Same box shape as A minor — just slide the whole pattern to the 10th fret.",
  },
];

export function pentatonicGuideById(id: string): PentatonicGuide | undefined {
  return PENTATONIC_GUIDES.find((g) => g.id === id);
}
