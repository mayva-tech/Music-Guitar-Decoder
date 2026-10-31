/**
 * Parses chord symbols such as "Am", "F#m7", "Bb", "E5", "Cmaj7", "G7sus4" into a root and its chord tones.
 * Used by the backing tracks (bass lines follow the chord) and the fretboard map's chord-tone rings.
 */

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export type ChordQuality =
  | "maj" | "min" | "5" | "7" | "m7" | "maj7" | "6" | "m6" | "9" | "m9"
  | "sus2" | "sus4" | "7sus4" | "dim" | "m7b5" | "add9";

/** Intervals above the root, in the order root, third (or sus note), fifth, seventh/extension. */
const QUALITY_STEPS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  "5": [0, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "9": [0, 4, 7, 10, 2],
  m9: [0, 3, 7, 10, 2],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  dim: [0, 3, 6],
  m7b5: [0, 3, 6, 10],
  add9: [0, 4, 7, 2],
};

/** Suffix as written after the root → quality. Longest suffixes are matched first. */
const SUFFIXES: [string, ChordQuality][] = (
  [
    ["maj7", "maj7"], ["M7", "maj7"], ["m7b5", "m7b5"], ["7sus4", "7sus4"], ["add9", "add9"],
    ["sus2", "sus2"], ["sus4", "sus4"], ["sus", "sus4"], ["dim", "dim"], ["m7", "m7"], ["m6", "m6"],
    ["m9", "m9"], ["min", "min"], ["m", "min"], ["7", "7"], ["9", "9"], ["6", "6"], ["5", "5"], ["", "maj"],
  ] as [string, ChordQuality][]
).sort((a, b) => b[0].length - a[0].length);

export interface ParsedChord {
  symbol: string;
  /** Pitch class of the root, 0 = C. */
  root: number;
  quality: ChordQuality;
  /** Pitch classes, root first. */
  pcs: number[];
  /** Semitones above the root. */
  third: number | null;
  fifth: number;
  seventh: number | null;
  minor: boolean;
}

export function parseChord(symbol: string): ParsedChord | null {
  const m = /^([A-G])([#b]?)(.*)$/.exec(symbol.trim());
  if (!m) return null;
  const root = (LETTER_PC[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  const rest = m[3]!;
  const hit = SUFFIXES.find(([s]) => rest === s);
  if (!hit) return null;
  const quality = hit[1];
  const steps = QUALITY_STEPS[quality];
  const third = steps.find((s) => s === 3 || s === 4) ?? null;
  const fifth = steps.find((s) => s === 6 || s === 7) ?? 7;
  const seventh = steps.find((s) => s === 10 || s === 11) ?? null;
  return {
    symbol,
    root,
    quality,
    pcs: steps.map((s) => (root + s) % 12),
    third,
    fifth,
    seventh,
    minor: third === 3,
  };
}

/** Chord-tone pitch classes for a symbol, or null if it can't be read. */
export function chordSymbolPcs(symbol: string): number[] | null {
  return parseChord(symbol)?.pcs ?? null;
}
