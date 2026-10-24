/**
 * Open and movable guitar shapes (strings 6→1), with higher-fret variations
 * so players can flip left/right through different ways to play the same chord.
 */
import { MAX_FRET, STANDARD_TUNING } from "@/lib/music/guitar";
import type { ChordDiagram } from "@/lib/types";
import type { ChordQuality } from "@/lib/music/scaleFretmap";
import { NOTE_NAMES_SHARP } from "@/lib/music/theory";

export interface ChordShape extends ChordDiagram {}

/** One playable voicing of a chord, ordered low → high on the neck. */
export interface ChordVoicing {
  shape: ChordShape;
  /** Short label, e.g. "Open", "7fr", "12fr". */
  label: string;
  /** Lowest fretted fret (0 when open strings only / nut). */
  baseFret: number;
}

type OpenKey = `${number}:${string}`;
type MajMin = "maj" | "min";

const OPEN: Record<OpenKey, ChordShape> = {
  "0:maj": { frets: [null, 3, 2, 0, 1, 0], fingers: [null, 3, 2, 0, 1, 0] }, // C
  "2:maj": { frets: [null, null, 0, 2, 3, 2], fingers: [null, null, 0, 1, 3, 2] }, // D
  "4:maj": { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] }, // E
  "5:maj": { frets: [null, null, 3, 2, 1, 1], fingers: [null, null, 3, 2, 1, 1] }, // F
  "7:maj": { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] }, // G
  "9:maj": { frets: [null, 0, 2, 2, 2, 0], fingers: [null, 0, 1, 2, 3, 0] }, // A
  "11:maj": { frets: [null, 2, 4, 4, 4, 2], fingers: [null, 1, 2, 3, 4, 1] }, // B (A-shape)
  "9:min": { frets: [null, 0, 2, 2, 1, 0], fingers: [null, 0, 2, 3, 1, 0] }, // Am
  "4:min": { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] }, // Em
  "2:min": { frets: [null, null, 0, 2, 3, 1], fingers: [null, null, 0, 2, 3, 1] }, // Dm
  "0:min": { frets: [null, 3, 5, 5, 4, 3], fingers: [null, 1, 3, 4, 2, 1] }, // Cm
  "5:min": { frets: [null, null, 3, 1, 1, 1], fingers: [null, null, 3, 1, 1, 1] }, // Fm
  "7:min": { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1] }, // Gm
  "11:min": { frets: [null, 2, 4, 4, 3, 2], fingers: [null, 1, 3, 4, 2, 1] }, // Bm
};

const E_SHAPE: Record<MajMin, { frets: number[]; fingers: number[] }> = {
  maj: { frets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1] },
  min: { frets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1] },
};

const A_SHAPE: Record<MajMin, { frets: (number | null)[]; fingers: (number | null)[] }> = {
  maj: { frets: [null, 0, 2, 2, 2, 0], fingers: [null, 1, 3, 3, 3, 1] },
  min: { frets: [null, 0, 2, 2, 1, 0], fingers: [null, 1, 3, 4, 2, 1] },
};

/** Keep shapes within a comfortable stretch of the neck. */
const MAX_SHAPE_FRET = Math.min(15, MAX_FRET);

function pcOf(name: string): number {
  const i = NOTE_NAMES_SHARP.indexOf(name);
  if (i < 0) throw new Error(`Unknown note: ${name}`);
  return i;
}

function fretOn(string: number, pc: number, minFret = 0): number {
  let f = (pc - STANDARD_TUNING[string]!) % 12;
  if (f < 0) f += 12;
  while (f < minFret) f += 12;
  return f;
}

function baseFretOf(shape: ChordShape): number {
  const fretted = shape.frets.filter((f): f is number => f != null && f > 0);
  return fretted.length ? Math.min(...fretted) : 0;
}

function maxFretOf(shape: ChordShape): number {
  const fretted = shape.frets.filter((f): f is number => f != null && f > 0);
  return fretted.length ? Math.max(...fretted) : 0;
}

function shapeKey(shape: ChordShape): string {
  return shape.frets.map((f) => (f == null ? "x" : String(f))).join(",");
}

function hasOpen(shape: ChordShape): boolean {
  return shape.frets.some((f) => f === 0);
}

function labelFor(shape: ChordShape): string {
  if (hasOpen(shape) && baseFretOf(shape) <= 3) return "Open";
  const base = baseFretOf(shape);
  return base <= 0 ? "Open" : `${base}fr`;
}

function eBarre(rootPc: number, q: MajMin, minFret: number): ChordShape {
  const f6 = fretOn(6, rootPc, minFret);
  const t = E_SHAPE[q];
  return { frets: t.frets.map((r) => f6 + r), fingers: [...t.fingers] };
}

function aBarre(rootPc: number, q: MajMin, minFret: number): ChordShape {
  const f5 = fretOn(5, rootPc, minFret);
  const t = A_SHAPE[q];
  return {
    frets: t.frets.map((r) => (r == null ? null : f5 + r)),
    fingers: [...t.fingers],
  };
}

function powerOn6(rootPc: number, minFret: number): ChordShape {
  const f6 = fretOn(6, rootPc, minFret);
  if (f6 === 0) return { frets: [0, 2, 2, null, null, null], fingers: [0, 1, 1, null, null, null] };
  return { frets: [f6, f6 + 2, f6 + 2, null, null, null], fingers: [1, 3, 4, null, null, null] };
}

function powerOn5(rootPc: number, minFret: number): ChordShape {
  const f5 = fretOn(5, rootPc, minFret);
  if (f5 === 0) return { frets: [null, 0, 2, 2, null, null], fingers: [null, 0, 1, 1, null, null] };
  return { frets: [null, f5, f5 + 2, f5 + 2, null, null], fingers: [null, 1, 3, 4, null, null] };
}

function dimAt(rootPc: number, minFret: number): ChordShape {
  const r = fretOn(5, rootPc, Math.max(1, minFret));
  return { frets: [null, r, r + 1, r + 2, r + 1, null], fingers: [null, 1, 2, 4, 3, null] };
}

function augAt(rootPc: number, minFret: number): ChordShape {
  const f6 = fretOn(6, rootPc, Math.max(1, minFret));
  return { frets: [f6, f6 + 2, f6 + 2, f6 + 1, f6 + 1, f6], fingers: [1, 3, 4, 2, 2, 1] };
}

function collectOctaves(
  build: (minFret: number) => ChordShape,
  startMin = 0,
): ChordShape[] {
  const out: ChordShape[] = [];
  let minFret = startMin;
  for (let i = 0; i < 3; i++) {
    const shape = build(minFret);
    if (maxFretOf(shape) > MAX_SHAPE_FRET) break;
    out.push(shape);
    // Next candidate must be a full octave higher on that string form.
    minFret += 12;
  }
  return out;
}

function finalize(shapes: ChordShape[]): ChordVoicing[] {
  const seen = new Set<string>();
  const unique: ChordShape[] = [];
  for (const s of shapes) {
    if (maxFretOf(s) > MAX_SHAPE_FRET) continue;
    const key = shapeKey(s);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  unique.sort((a, b) => baseFretOf(a) - baseFretOf(b) || maxFretOf(a) - maxFretOf(b));
  return unique.map((shape) => ({
    shape,
    label: labelFor(shape),
    baseFret: baseFretOf(shape),
  }));
}

/**
 * All practical voicings for a chord, low → high (open first, then higher frets).
 * Use with left/right arrows to browse how the same chord is played differently.
 */
export function shapesForChord(rootName: string, quality: ChordQuality): ChordVoicing[] {
  const rootPc = pcOf(rootName);
  const candidates: ChordShape[] = [];

  if (quality === "5") {
    candidates.push(...collectOctaves((m) => powerOn6(rootPc, m), 0));
    candidates.push(...collectOctaves((m) => powerOn5(rootPc, m), 0));
    return finalize(candidates);
  }

  if (quality === "dim") {
    candidates.push(...collectOctaves((m) => dimAt(rootPc, m), 1));
    return finalize(candidates);
  }

  if (quality === "aug") {
    candidates.push(...collectOctaves((m) => augAt(rootPc, m), 1));
    return finalize(candidates);
  }

  const q: MajMin = quality === "min" ? "min" : "maj";
  const open = OPEN[`${rootPc}:${q}` as OpenKey];
  if (open) candidates.push(open);

  // Barre / movable forms start at fret 1 so open shapes stay distinct when present.
  const eStart = open && hasOpen(open) && fretOn(6, rootPc) === 0 ? 12 : 1;
  const aStart = open && hasOpen(open) && fretOn(5, rootPc) === 0 ? 12 : 1;
  candidates.push(...collectOctaves((m) => eBarre(rootPc, q, m), eStart));
  candidates.push(...collectOctaves((m) => aBarre(rootPc, q, m), aStart));

  return finalize(candidates);
}

/**
 * Prefer open / lowest shape (first of {@link shapesForChord}).
 */
export function shapeForChord(rootName: string, quality: ChordQuality): ChordShape {
  const list = shapesForChord(rootName, quality);
  return list[0]?.shape ?? { frets: [null, null, null, null, null, null], fingers: [null, null, null, null, null, null] };
}

/** Convert diagram (strings 6→1) into neck highlight dots. */
export function shapeToHighlights(shape: ChordShape): {
  string: number;
  fret: number;
  finger: number | null;
  muted?: boolean;
}[] {
  const out: { string: number; fret: number; finger: number | null; muted?: boolean }[] = [];
  for (let i = 0; i < 6; i++) {
    const string = 6 - i;
    const fret = shape.frets[i] ?? null;
    const finger = shape.fingers[i] ?? null;
    if (fret === null) {
      out.push({ string, fret: 0, finger: null, muted: true });
    } else {
      out.push({ string, fret, finger: finger === 0 ? null : finger });
    }
  }
  return out;
}
