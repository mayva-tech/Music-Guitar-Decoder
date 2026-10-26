// CAGED system + the five pentatonic boxes, mapped on the whole neck.
// Pure data and maths; the page in app/learn/caged draws it.
import { MAX_FRET, STANDARD_TUNING } from "@/lib/music/guitar";
import { NOTE_NAMES_SHARP } from "@/lib/music/theory";
import type { TheoryEvent, TheoryExample } from "@/lib/theory/content";

export type CagedShapeId = "C" | "A" | "G" | "E" | "D";
export type KeyMode = "major" | "minor";
export type StringNo = 1 | 2 | 3 | 4 | 5 | 6;

/** The loop order up the neck. After D comes C again, an octave higher. */
export const CAGED_ORDER: CagedShapeId[] = ["C", "A", "G", "E", "D"];

export interface CagedShapeDef {
  id: CagedShapeId;
  /** Open-position chord, fret per string (missing = not played). */
  open: Partial<Record<StringNo, number>>;
  /** Pitch class of the open chord's root. */
  openRootPc: number;
  /** Fretting-hand fingers for the moved (barred) shape, per string. 1 = index. */
  fingers: Partial<Record<StringNo, number>>;
  /** Fingers for the open chord (open strings take none). */
  openFingers: Partial<Record<StringNo, number>>;
  /** Which strings carry the root. The lowest one is the shape's anchor. */
  rootStrings: StringNo[];
  /** Pentatonic box that wraps this shape (box 1 = minor root on low E). */
  box: 1 | 2 | 3 | 4 | 5;
  colour: string;
  /** One line on how to find it. */
  anchor: string;
}

export const CAGED_SHAPES: Record<CagedShapeId, CagedShapeDef> = {
  C: {
    id: "C", open: { 5: 3, 4: 2, 3: 0, 2: 1, 1: 0 }, openRootPc: 0,
    fingers: { 5: 4, 4: 3, 3: 1, 2: 2, 1: 1 }, openFingers: { 5: 3, 4: 2, 2: 1 }, rootStrings: [5, 2], box: 4, colour: "#e07a5f",
    anchor: "Root under your ring or pinky on the A string. The shape hangs back toward the nut.",
  },
  A: {
    id: "A", open: { 5: 0, 4: 2, 3: 2, 2: 2, 1: 0 }, openRootPc: 9,
    fingers: { 5: 1, 4: 3, 3: 3, 2: 3, 1: 1 }, openFingers: { 4: 1, 3: 2, 2: 3 }, rootStrings: [5, 3], box: 5, colour: "#f3ae3d",
    anchor: "Root under your index on the A string, three strings barred two frets up.",
  },
  G: {
    id: "G", open: { 6: 3, 5: 2, 4: 0, 3: 0, 2: 0, 1: 3 }, openRootPc: 7,
    fingers: { 6: 3, 5: 2, 4: 1, 3: 1, 2: 1, 1: 4 }, openFingers: { 6: 2, 5: 1, 1: 3 }, rootStrings: [6, 3, 1], box: 1, colour: "#e48aa8",
    anchor: "Root under your pinky on low E, and again on high e. The widest shape.",
  },
  E: {
    id: "E", open: { 6: 0, 5: 2, 4: 2, 3: 1, 2: 0, 1: 0 }, openRootPc: 4,
    fingers: { 6: 1, 5: 3, 4: 4, 3: 2, 2: 1, 1: 1 }, openFingers: { 5: 2, 4: 3, 3: 1 }, rootStrings: [6, 4, 1], box: 2, colour: "#6fa8dc",
    anchor: "Root under your index on low E. The classic full barre chord.",
  },
  D: {
    id: "D", open: { 4: 0, 3: 2, 2: 3, 1: 2 }, openRootPc: 2,
    fingers: { 4: 1, 3: 2, 2: 4, 1: 3 }, openFingers: { 3: 1, 2: 3, 1: 2 }, rootStrings: [4, 2], box: 3, colour: "#a68bd8",
    anchor: "Root under your index on the D string. Only the top four strings.",
  },
};

export const MAJOR_PENTA = [0, 2, 4, 7, 9] as const;
export const MINOR_PENTA = [0, 3, 5, 7, 10] as const;
const MAJOR_DEG: Record<number, string> = { 0: "R", 2: "2", 4: "3", 7: "5", 9: "6" };
const MINOR_DEG: Record<number, string> = { 0: "R", 3: "♭3", 5: "4", 7: "5", 10: "♭7" };

const mod12 = (n: number) => ((n % 12) + 12) % 12;
export const pcName = (pc: number) => NOTE_NAMES_SHARP[mod12(pc)]!;
export const pcOf = (name: string) => {
  const i = NOTE_NAMES_SHARP.indexOf(name);
  if (i < 0) throw new Error(`Unknown note: ${name}`);
  return i;
};

export interface CagedKey {
  tonic: number;
  mode: KeyMode;
  /** The major key whose chord shapes are mapped (relative major in minor mode). */
  majorPc: number;
  /** Relative minor root: box 1 starts here on low E. */
  minorPc: number;
  name: string;
  /** "C major", "A minor". */
  partner: string;
}

export function cagedKey(tonic: number, mode: KeyMode): CagedKey {
  const t = mod12(tonic);
  const majorPc = mode === "major" ? t : mod12(t + 3);
  const minorPc = mod12(majorPc - 3);
  return {
    tonic: t, mode, majorPc, minorPc,
    name: `${pcName(t)} ${mode}`,
    partner: mode === "major" ? `${pcName(minorPc)} minor` : `${pcName(majorPc)} major`,
  };
}

/** Degree label for a pitch class in this key's pentatonic, or null if it isn't in it. */
export function pentaDegree(key: CagedKey, pc: number): string | null {
  const iv = mod12(pc - key.tonic);
  return (key.mode === "major" ? MAJOR_DEG : MINOR_DEG)[iv] ?? null;
}

export function pentaPcs(key: CagedKey): number[] {
  return MAJOR_PENTA.map((s) => mod12(key.majorPc + s));
}

export interface NeckNote {
  string: StringNo;
  fret: number;
  midi: number;
  name: string;
}

const STRINGS: StringNo[] = [6, 5, 4, 3, 2, 1];
const midiAt = (s: StringNo, f: number) => STANDARD_TUNING[s] + f;
const note = (s: StringNo, f: number): NeckNote => ({ string: s, fret: f, midi: midiAt(s, f), name: pcName(midiAt(s, f)) });

/** Every pentatonic note on the neck, open string to the last fret. */
export function pentaNeck(key: CagedKey, maxFret = MAX_FRET): NeckNote[] {
  const pcs = new Set(pentaPcs(key));
  const out: NeckNote[] = [];
  for (const s of STRINGS) for (let f = 0; f <= maxFret; f++) if (pcs.has(mod12(midiAt(s, f)))) out.push(note(s, f));
  return out;
}

export interface ChordTone extends NeckNote {
  /** R, 3 or 5 of the major chord. */
  degree: "R" | "3" | "5";
  finger: number;
}

export interface CagedPosition {
  shape: CagedShapeId;
  /** Fret where the open shape's nut now sits (the barre fret, 0 = open chord). */
  offset: number;
  chord: ChordTone[];
  box: NeckNote[];
  boxNo: 1 | 2 | 3 | 4 | 5;
  /** Lowest and highest fret the shape and its box cover. */
  lo: number;
  hi: number;
}

function chordTones(def: CagedShapeDef, offset: number, majorPc: number): ChordTone[] {
  const out: ChordTone[] = [];
  for (const s of STRINGS) {
    const f = def.open[s];
    if (f === undefined) continue;
    const n = note(s, f + offset);
    const iv = mod12(n.midi - majorPc);
    const degree = iv === 0 ? "R" : iv === 4 ? "3" : "5";
    // At the nut it's the open chord; moved up, the index barres what were open strings.
    const finger = offset === 0 ? def.openFingers[s] ?? 0 : def.fingers[s] ?? 1;
    out.push({ ...n, degree, finger });
  }
  return out;
}

/**
 * Pentatonic box n: twelve scale notes in a row, two per string from low E.
 * Box 1 starts on the minor root, box 2 on ♭3, box 3 on 4, box 4 on 5, box 5 on ♭7.
 * `startFret` picks which octave on the low E string.
 */
export function pentaBox(key: CagedKey, boxNo: 1 | 2 | 3 | 4 | 5, startFret: number): NeckNote[] {
  const startPc = mod12(key.minorPc + MINOR_PENTA[boxNo - 1]);
  const fret0 = mod12(startPc - STANDARD_TUNING[6]) + 12 * Math.round((startFret - mod12(startPc - STANDARD_TUNING[6])) / 12);
  const pcs = new Set(pentaPcs(key));
  const pitches: number[] = [];
  for (let m = STANDARD_TUNING[6] + fret0; pitches.length < 12; m++) if (pcs.has(mod12(m))) pitches.push(m);
  return pitches.map((m, i) => {
    const s = STRINGS[Math.floor(i / 2)]!;
    return note(s, m - STANDARD_TUNING[s]);
  });
}

/** All five CAGED positions (plus repeats an octave up) that fit on the neck, low to high. */
export function cagedPositions(key: CagedKey, maxFret = MAX_FRET): CagedPosition[] {
  const out: CagedPosition[] = [];
  for (const id of CAGED_ORDER) {
    const def = CAGED_SHAPES[id];
    const base = mod12(key.majorPc - def.openRootPc);
    for (let offset = base; offset + Math.max(...Object.values(def.open)) <= maxFret; offset += 12) {
      const chord = chordTones(def, offset, key.majorPc);
      // The matching box always starts on low E at the shape's barre fret.
      const box = pentaBox(key, def.box, offset);
      if (box.some((n) => n.fret > maxFret || n.fret < 0)) continue;
      const frets = [...chord, ...box].map((n) => n.fret);
      out.push({ shape: id, offset, chord, box, boxNo: def.box, lo: Math.min(...frets), hi: Math.max(...frets) });
    }
  }
  return out.sort((a, b) => a.offset - b.offset || a.lo - b.lo);
}

/* ------------------------------------------------------------- memorising */

/** Octave shapes: from a root on one string, the same note two strings higher. */
export const OCTAVE_RULES: { from: StringNo; to: StringNo; frets: number; say: string }[] = [
  { from: 6, to: 4, frets: 2, say: "Low E → D string: skip a string, two frets up." },
  { from: 5, to: 3, frets: 2, say: "A → G string: skip a string, two frets up." },
  { from: 4, to: 2, frets: 3, say: "D → B string: skip a string, three frets up (the B string shifts it)." },
  { from: 3, to: 1, frets: 3, say: "G → high e: skip a string, three frets up." },
];

/** Root frets of a pitch class on one string. */
export function rootFrets(pc: number, string: StringNo, maxFret = MAX_FRET): number[] {
  const out: number[] = [];
  for (let f = mod12(pc - STANDARD_TUNING[string]); f <= maxFret; f += 12) out.push(f);
  return out;
}

export const MEMORY_STEPS: { title: string; body: string }[] = [
  {
    title: "Learn one box cold",
    body: "Start with box 1. Play it up and down, saying the degrees out loud: R ♭3 · 4 5 · ♭7 R. Don't move on until you can play it with your eyes shut.",
  },
  {
    title: "Hang each box on a chord",
    body: "Every box wraps a CAGED chord shape. Play the chord, then the box around it. The chord tones are the strong notes to land on.",
  },
  {
    title: "Find the roots first",
    body: "Before you play, find the root on the low E or A string, then its octave two strings up. The box builds itself around those dots.",
  },
  {
    title: "Link the neighbours",
    body: "The right edge of one box is the left edge of the next. Play box 1, then slide on the G string into box 2 and keep going.",
  },
  {
    title: "Say C-A-G-E-D",
    body: "The shapes always come in this order going up the neck. After D comes C again, twelve frets higher. Know one, and you know where the next one is.",
  },
];

/* ------------------------------------------------------------- audio */

export const noteHl = (s: number, f: number) => `n-${s}-${f}`;

/** Play a box up and back down in eighth notes, lighting each dot as it sounds. */
export function boxExample(box: NeckNote[], label: string, bpm = 92): TheoryExample {
  const seq = [...box, ...box.slice(0, -1).reverse()];
  const events: TheoryEvent[] = [];
  seq.forEach((n, i) => {
    const beat = i * 0.5;
    events.push({ kind: "pluck", beat, beats: 0.6, velocity: 0.8, midi: n.midi, timbre: "normal" });
    events.push({ kind: "highlight", beat, beats: 0.45, velocity: 0, highlight: noteHl(n.string, n.fret) });
  });
  const len = seq.length * 0.5;
  return { label, sub: "Up and back down", bpm, lengthBeats: len, events, visual: { type: "blocks", lengthBeats: len, rows: [] } };
}

/** Strum the chord shape low to high, then play the box, so you hear the chord inside the scale. */
export function shapeExample(pos: CagedPosition, label: string, bpm = 92): TheoryExample {
  const events: TheoryEvent[] = [];
  pos.chord.forEach((n, k) => {
    events.push({ kind: "pluck", beat: k * 0.06, beats: 1.8, velocity: 0.55, midi: n.midi, timbre: "normal" });
    events.push({ kind: "highlight", beat: 0, beats: 1.8, velocity: 0, highlight: noteHl(n.string, n.fret) });
  });
  const box = boxExample(pos.box, label, bpm);
  for (const e of box.events) events.push({ ...e, beat: e.beat + 2 });
  const len = box.lengthBeats + 2;
  return { label, sub: "Chord, then the box around it", bpm, lengthBeats: len, events, visual: { type: "blocks", lengthBeats: len, rows: [] } };
}
