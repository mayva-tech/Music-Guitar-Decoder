/**
 * Soloing aids for the backing tracks: chord voicings up the neck for every chord the loops use,
 * and a suggested lick written over each loop's own progression.
 *
 * The lick stays in one position (pentatonic box 1, or a five-fret window for seven-note scales),
 * lands on a chord tone at every chord change and leads into the next chord with a scale step,
 * so it shows *when* and *where* to move as the chords change.
 */
import { MAX_FRET, STANDARD_TUNING } from "./guitar";
import { BOX_MODES, buildLick, pentatonicBox } from "./soloGuide";
import { parseChord, type ChordQuality, type ParsedChord } from "./chordSymbol";
import { shapesForChord, type ChordShape, type ChordVoicing } from "./chordShapes";
import { rootPc, scaleKindPcs, type ChordQuality as ShapeQuality } from "./scaleFretmap";
import { NOTE_NAMES_SHARP } from "./theory";
import type { BackingTrack } from "./backingTracks";
import type { PlayableNote } from "@/lib/types";

/* ---------------------------------------------------------------- voicings */

type Template = (number | null)[]; // fret offsets from the root fret, strings 6 → 1

/** Root on the 6th string. */
const E_FORM: Partial<Record<ChordQuality, Template>> = {
  maj: [0, 2, 2, 1, 0, 0], min: [0, 2, 2, 0, 0, 0], "7": [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, null, 1, 1, 0, null], "6": [0, null, -1, 1, 0, null], m6: [0, null, -1, 0, 0, null],
  "9": [0, null, 0, 1, 0, 2], m9: [0, null, 0, 0, 0, 2], m7b5: [0, null, 0, 0, -1, null],
  sus4: [0, 2, 2, 2, 0, 0], "7sus4": [0, 2, 0, 2, 0, 0], "5": [0, 2, 2, null, null, null],
};
/** Root on the 5th string. */
const A_FORM: Partial<Record<ChordQuality, Template>> = {
  maj: [null, 0, 2, 2, 2, 0], min: [null, 0, 2, 2, 1, 0], "7": [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0],
  maj7: [null, 0, 2, 1, 2, 0], "6": [null, 0, 2, 2, 2, 2], m6: [null, 0, 2, 2, 1, 2], "9": [null, 0, -1, 0, 0, 0],
  m9: [null, 0, -2, 0, 0, 0], m7b5: [null, 0, 1, 0, 1, null], sus4: [null, 0, 2, 2, 3, 0], sus2: [null, 0, 2, 2, 0, 0],
  "7sus4": [null, 0, 2, 0, 3, 0], dim: [null, 0, 1, 2, 1, null], "5": [null, 0, 2, 2, null, null],
};
/** Root on the 4th string (small shapes on the top four strings). */
const D_FORM: Partial<Record<ChordQuality, Template>> = {
  maj: [null, null, 0, 2, 3, 2], min: [null, null, 0, 2, 3, 1], "7": [null, null, 0, 2, 1, 2],
  m7: [null, null, 0, 2, 1, 1], maj7: [null, null, 0, 2, 2, 2],
};
/** Open seventh shapes (the triads come from chordShapes.ts). */
const OPEN_SEVENTHS: Record<string, Template> = {
  E7: [0, 2, 0, 1, 0, 0], A7: [null, 0, 2, 0, 2, 0], D7: [null, null, 0, 2, 1, 2], G7: [3, 2, 0, 0, 0, 1],
  C7: [null, 3, 2, 3, 1, 0], B7: [null, 2, 1, 2, 0, 2], Am7: [null, 0, 2, 0, 1, 0], Em7: [0, 2, 0, 0, 0, 0],
  Dm7: [null, null, 0, 2, 1, 1], Cmaj7: [null, 3, 2, 0, 0, 0], Fmaj7: [null, null, 3, 2, 1, 0],
  Dmaj7: [null, null, 0, 2, 2, 2], Amaj7: [null, 0, 2, 1, 2, 0], Gmaj7: [3, null, 0, 0, 0, 2],
};
const TOP_FRET = Math.min(15, MAX_FRET);

function fingersFor(frets: Template): (number | null)[] {
  const fretted = frets.filter((f): f is number => f != null && f > 0);
  const low = fretted.length ? Math.min(...fretted) : 0;
  return frets.map((f) => (f == null ? null : f === 0 ? 0 : Math.min(4, Math.max(1, f - low + 1))));
}
const shapeOf = (frets: Template): ChordShape => ({ frets: [...frets], fingers: fingersFor(frets) });

function place(t: Template, rootString: 6 | 5 | 4, pc: number): Template[] {
  const minOff = Math.min(...t.filter((x): x is number => x != null));
  const out: Template[] = [];
  for (let r = (pc - STANDARD_TUNING[rootString] % 12 + 24) % 12; r <= TOP_FRET; r += 12) {
    if (r + minOff < 0) continue;
    const frets = t.map((x) => (x == null ? null : r + x));
    if (frets.every((f) => f == null || f <= TOP_FRET)) out.push(frets);
  }
  return out;
}

function voicingLabel(frets: Template): { label: string; baseFret: number } {
  const fretted = frets.filter((f): f is number => f != null && f > 0);
  const base = fretted.length ? Math.min(...fretted) : 0;
  const open = frets.some((f) => f === 0);
  return { label: open && base <= 3 ? "Open" : `${base}fr`, baseFret: open && base <= 3 ? 0 : base };
}

/** Every practical voicing of a chord symbol, low → high on the neck (for ◀ ▶ arrows). */
export function voicingsFor(symbol: string): ChordVoicing[] {
  const c = parseChord(symbol);
  if (!c) return [];
  const rootName = NOTE_NAMES_SHARP[c.root]!;
  const raw: Template[] = [];
  if (c.quality === "maj" || c.quality === "min" || c.quality === "5" || c.quality === "dim") {
    for (const v of shapesForChord(rootName, c.quality as ShapeQuality)) raw.push(v.shape.frets as Template);
  }
  const open = OPEN_SEVENTHS[symbol];
  if (open) raw.push(open);
  for (const [form, str] of [[E_FORM, 6], [A_FORM, 5], [D_FORM, 4]] as const) {
    const t = form[c.quality];
    if (t) raw.push(...place(t, str, c.root));
  }
  const seen = new Set<string>();
  const out: ChordVoicing[] = [];
  for (const frets of raw) {
    if (!isVoicingOf(frets, c)) continue;
    const key = frets.map((f) => (f == null ? "x" : f)).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ shape: shapeOf(frets), ...voicingLabel(frets) });
  }
  return out.sort((a, b) => a.baseFret - b.baseFret || maxFret(a.shape) - maxFret(b.shape));
}
const maxFret = (s: ChordShape) => Math.max(0, ...s.frets.filter((f): f is number => f != null));

/** True when every sounding note is a chord tone and the root (plus third and seventh, if any) are present. */
export function isVoicingOf(frets: Template, c: ParsedChord): boolean {
  const pcs = frets.map((f, i) => (f == null ? null : (STANDARD_TUNING[6 - i]! + f) % 12)).filter((x): x is number => x != null);
  if (pcs.length < 2) return false;
  if (!pcs.every((pc) => c.pcs.includes(pc))) return false;
  const need = [c.root, c.third != null ? (c.root + c.third) % 12 : null, c.seventh != null ? (c.root + c.seventh) % 12 : null];
  return need.every((pc) => pc == null || pcs.includes(pc));
}

/* ------------------------------------------------------------- lick position */

export interface NeckPos { string: number; fret: number; midi: number }
export interface SoloPosition {
  /** One playable note per pitch, low → high. */
  ladder: NeckPos[];
  /** Fret range to zoom the neck to. */
  window: { from: number; to: number };
  /** Pentatonic box number drawn on the neck (0 for seven-note scales). */
  box: number;
}

/** Where the suggested lick lives: pentatonic box 1, or a five-fret window at the root on the low E string. */
export function soloPosition(t: Pick<BackingTrack, "root" | "mode">): SoloPosition {
  const r0 = (rootPc(t.root) - 4 + 12) % 12;
  let cells: { string: number; fret: number }[];
  let box = 0;
  if (BOX_MODES.includes(t.mode)) {
    cells = pentatonicBox(t.root, t.mode, 1) ?? [];
    // Box 1 can reach below the nut (E major: G# at "fret -1" on the A string); play it an octave up.
    if (cells.some((c) => c.fret < 0)) cells = cells.map((c) => ({ ...c, fret: c.fret + 12 }));
    box = 1;
  } else {
    const pcs = scaleKindPcs(rootPc(t.root), t.mode);
    const lo = Math.max(0, r0 - 1);
    cells = [];
    for (let s = 6; s >= 1; s--) {
      for (let f = lo; f <= lo + 4; f++) if (pcs.includes((STANDARD_TUNING[s]! + f) % 12)) cells.push({ string: s, fret: f });
    }
  }
  const centre = cells.reduce((a, c) => a + c.fret, 0) / Math.max(1, cells.length);
  const byMidi = new Map<number, NeckPos>();
  for (const c of cells) {
    const midi = STANDARD_TUNING[c.string]! + c.fret;
    const cur = byMidi.get(midi);
    if (!cur || Math.abs(c.fret - centre) < Math.abs(cur.fret - centre)) byMidi.set(midi, { ...c, midi });
  }
  const ladder = [...byMidi.values()].sort((a, b) => a.midi - b.midi);
  const frets = ladder.map((p) => p.fret);
  const from = Math.max(0, Math.min(...frets) - 1);
  let to = Math.max(...frets) + 1;
  while (to - from < 6) to++;
  return { ladder, window: { from, to: Math.min(MAX_FRET, to) }, box };
}

/* -------------------------------------------------------------- the lick */

export type LickStyle = "long" | "beat" | "phrase";
export const LICK_STYLES: { id: LickStyle; label: string; hint: string }[] = [
  { id: "long", label: "Long notes", hint: "Hold a chord tone through each chord, then step into the next one." },
  { id: "beat", label: "On the beat", hint: "One note per beat: chord tones on the strong beats, scale steps between." },
  { id: "phrase", label: "Phrased", hint: "Short eighth-note phrases that call and answer, with space between." },
];

type Role = "T" | "s" | "c" | "A";
type Slot = [beat: number, dur: number, role: Role];

function template(style: LickStyle, len: number, k: number): Slot[] {
  const L = len >= 4 ? 4 : len >= 3 ? 3 : 2;
  const T: Record<LickStyle, Record<2 | 3 | 4, Slot[]>> = {
    long: {
      4: [[0, 2, "T"], [2, 1.5, "c"], [3.5, 0.5, "A"]],
      3: [[0, 2, "T"], [2, 1, "A"]],
      2: [[0, 1.5, "T"], [1.5, 0.5, "A"]],
    },
    beat: {
      4: [[0, 1, "T"], [1, 1, "s"], [2, 1, "c"], [3, 1, "A"]],
      3: [[0, 1, "T"], [1, 1, "s"], [2, 1, "A"]],
      2: [[0, 1, "T"], [1, 1, "A"]],
    },
    phrase: k % 2 === 0
      ? {
        4: [[0, 0.5, "T"], [0.5, 0.5, "s"], [1, 0.5, "s"], [1.5, 1, "c"], [3.5, 0.5, "A"]],
        3: [[0, 0.5, "T"], [0.5, 0.5, "s"], [1, 1, "c"], [2.5, 0.5, "A"]],
        2: [[0, 0.5, "T"], [0.5, 0.5, "s"], [1, 0.5, "c"], [1.5, 0.5, "A"]],
      }
      : {
        4: [[0, 1.5, "T"], [2, 0.5, "s"], [2.5, 0.5, "s"], [3, 0.5, "c"], [3.5, 0.5, "A"]],
        3: [[0, 1.5, "T"], [2, 0.5, "s"], [2.5, 0.5, "A"]],
        2: [[0, 0.5, "T"], [0.5, 0.5, "s"], [1, 0.5, "c"], [1.5, 0.5, "A"]],
      },
  };
  return T[style][L as 2 | 3 | 4];
}

export interface ChordSegment { chord: string; start: number; len: number; bar: number }

/** The loop as chord segments in beats (two chords in a bar split it evenly). */
export function chordSegments(t: BackingTrack): ChordSegment[] {
  const beats = t.drums.beats;
  const out: ChordSegment[] = [];
  t.bars.forEach((bar, bi) => {
    const names = bar.split(/\s+/);
    names.forEach((chord, k) => out.push({ chord, start: bi * beats + (k * beats) / names.length, len: beats / names.length, bar: bi }));
  });
  return out;
}

/** Swing the off-beat eighths on shuffle / swing / 12/8 grooves. */
function swingBeat(x: number, triplet: boolean): number {
  if (!triplet) return x;
  const whole = Math.floor(x + 1e-9);
  const frac = x - whole;
  return Math.abs(frac - 0.5) < 1e-6 ? whole + 2 / 3 : x;
}

/**
 * A lick over the whole loop: lands on a chord tone at every change (a guide tone — 3rd or 7th — in the
 * "Long notes" style), moves by scale steps, and approaches the next chord's target from a step away.
 * Notes are ordered in time; start beats are relative to the start of the loop.
 */
export function guideLick(t: BackingTrack, style: LickStyle): PlayableNote[] {
  const pos = soloPosition(t);
  const L = pos.ladder;
  const n = L.length;
  const segs = chordSegments(t);
  const chords = segs.map((s) => parseChord(s.chord)!);

  const tonesOf = (c: ParsedChord, guide: boolean): number[] => {
    const guidePcs = [c.third, c.seventh].filter((x): x is number => x != null).map((x) => (c.root + x) % 12);
    const pick = (pcs: number[]) => L.map((p, i) => (pcs.includes(p.midi % 12) ? i : -1)).filter((i) => i > 0 && i < n - 1);
    const g = guide ? pick(guidePcs) : [];
    if (g.length) return g;
    const all = pick(c.pcs);
    if (all.length) return all;
    // No chord tone in this position: the scale note nearest the chord's root.
    let best = 1;
    for (let i = 1; i < n - 1; i++) {
      const d = (pc: number) => Math.min((pc - c.root + 12) % 12, (c.root - pc + 12) % 12);
      if (d(L[i]!.midi % 12) < d(L[best]!.midi % 12)) best = i;
    }
    return [best];
  };
  const nearest = (cands: number[], from: number, avoid?: number): number => {
    const sorted = [...cands].sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || a - b);
    const alt = sorted.find((i) => i !== avoid && Math.abs(i - from) <= 3);
    return avoid != null && alt != null ? alt : sorted[0]!;
  };

  // Targets for every chord segment, voice-led from the middle of the position.
  const start = Math.round((n - 1) * 0.45);
  const targets: number[] = [];
  segs.forEach((_, i) => {
    const prev = i === 0 ? start : targets[i - 1]!;
    targets.push(nearest(tonesOf(chords[i]!, style === "long"), prev, i === 0 ? undefined : prev));
  });

  const triplet = t.drums.triplet;
  const specs: { s: number; f: number; b: number; d: number; t: "" | "h" | "p" | "vib" }[] = [];
  let p = targets[0]!;
  segs.forEach((seg, i) => {
    const next = targets[(i + 1) % segs.length]!;
    const slots = template(style, seg.len, i);
    slots.forEach(([b, d, role], k) => {
      let idx: number;
      if (role === "T") idx = targets[i]!;
      else if (role === "A") idx = p < next ? next - 1 : p > next ? next + 1 : Math.min(n - 1, next + 1);
      else if (role === "c") {
        // A chord tone within three scale steps (towards the next target if possible), else just a step.
        const tones = tonesOf(chords[i]!, false).filter((x) => x !== p && Math.abs(x - p) <= 3);
        const towards = tones.filter((x) => (next >= p ? x > p : x < p));
        idx = tones.length ? nearest(towards.length ? towards : tones, p) : p + (next > p ? 1 : next < p ? -1 : p > n / 2 ? -1 : 1);
      } else idx = p + (next > p ? 1 : next < p ? -1 : p > n / 2 ? -1 : 1);
      idx = Math.max(0, Math.min(n - 1, idx));
      const at = L[idx]!;
      const startB = swingBeat(seg.start + b, triplet);
      const endB = swingBeat(seg.start + b + d, triplet);
      const prevSpec = specs[specs.length - 1];
      let tech: "" | "h" | "p" | "vib" = "";
      if (d >= 1.5) tech = "vib";
      else if (prevSpec && k > 0 && prevSpec.s === at.string && d <= 0.5 && startB - prevSpec.b <= 0.7 && prevSpec.f !== at.fret) {
        tech = at.fret > prevSpec.f ? "h" : "p";
      }
      specs.push({ s: at.string, f: at.fret, b: startB, d: Math.max(0.2, (endB - startB) * 0.95), t: tech });
      p = idx;
    });
  });

  const fingerBase = Math.max(0, pos.window.from);
  return buildLick(`lick-${t.id}-${style}`, specs, fingerBase);
}

/** The lick notes that start in progression bar `bar`, with start beats relative to that bar. */
export function lickBar(notes: PlayableNote[], bar: number, beats: number): { notes: PlayableNote[]; first: number } {
  const lo = bar * beats;
  const hi = lo + beats;
  const first = notes.findIndex((nt) => nt.start_beat >= lo - 1e-6 && nt.start_beat < hi - 1e-6);
  if (first < 0) return { notes: [], first: 0 };
  const out: PlayableNote[] = [];
  for (let i = first; i < notes.length && notes[i]!.start_beat < hi - 1e-6; i++) out.push({ ...notes[i]!, start_beat: notes[i]!.start_beat - lo });
  return { notes: out, first };
}

/** Beats until the chord changes (to a different chord), from beat position `at` in the loop. */
export function nextChange(t: BackingTrack, at: number): { chord: string; inBeats: number; current: string } {
  const segs = chordSegments(t);
  const total = t.bars.length * t.drums.beats;
  const curIdx = Math.max(0, segs.findIndex((s) => at >= s.start - 1e-6 && at < s.start + s.len - 1e-6));
  const current = segs[curIdx]!.chord;
  for (let k = 1; k <= segs.length; k++) {
    const s = segs[(curIdx + k) % segs.length]!;
    if (s.chord !== current) {
      const start = s.start + (curIdx + k >= segs.length ? total : 0);
      return { chord: s.chord, inBeats: Math.round((start - at) * 1000) / 1000, current };
    }
  }
  return { chord: current, inBeats: Infinity, current };
}
