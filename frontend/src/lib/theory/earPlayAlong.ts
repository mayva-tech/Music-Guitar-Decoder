/**
 * "Play it on the fretboard" for the by-ear guide: whole songs laid out as notes to pick and
 * chord shapes to strum, plus the logic that follows a player through them (taps or microphone).
 * Pure data and maths; components/ear/FretTrainer draws it.
 */
import { shapeForChord, type ChordShape } from "@/lib/music/chordShapes";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import { StablePitchTracker, judge } from "@/lib/audio/noteMatcher";
import { noteName, type TheoryEvent, type TheoryExample } from "./content";
import { AMAZING_GRACE_BARS, type EarBar, type Sound } from "./ear";

/** [string (1 = high e), fret, finger (0 = open)] for each melody pitch. */
type Pos = [string: number, fret: number, finger: number];

export interface PlaySongDef {
  id: string;
  title: string;
  meta: string;
  bpm: number;
  beatsPerBar: number;
  bars: EarBar[];
  positions: Record<number, Pos>;
  /** Where the fretting hand sits for the melody. */
  hand: { lo: number; hi: number; label: string };
  tip: string;
}

export interface PlayNote {
  i: number;
  midi: number;
  name: string;
  string: number;
  fret: number;
  finger: number;
  beat: number;
  beats: number;
  bar: number;
  /** Index into chords, or -1 for a pickup before the first chord. */
  chord: number;
}

export interface PlayChord {
  j: number;
  symbol: string;
  numeral: string;
  beat: number;
  beats: number;
  bar: number;
  shape: ChordShape;
  /** Pitch classes of the shape's notes. */
  pcs: number[];
}

export interface PlaySong extends Omit<PlaySongDef, "bars" | "positions"> {
  bars: { index: number; beat: number; beats: number }[];
  notes: PlayNote[];
  chords: PlayChord[];
  lengthBeats: number;
}

export const FINGER_WORD = ["open string", "index finger", "middle finger", "ring finger", "pinky", "thumb"];
export const STRING_WORD: Record<number, string> = { 1: "high e", 2: "B", 3: "G", 4: "D", 5: "A", 6: "low E" };

export const midiOf = (string: number, fret: number) => STANDARD_TUNING[string]! + fret;
const pc = (m: number) => ((m % 12) + 12) % 12;

export function chordShapeFor(symbol: string): ChordShape {
  const minor = /m$/.test(symbol);
  return shapeForChord(minor ? symbol.slice(0, -1) : symbol, minor ? "min" : "maj");
}

/** Strings 6→1 in the shape that are played, as [string, fret, finger]. */
export function shapeNotes(shape: ChordShape): Pos[] {
  const out: Pos[] = [];
  shape.frets.forEach((f, i) => { if (f != null) out.push([6 - i, f, shape.fingers[i] ?? 0]); });
  return out;
}

export function buildSong(def: PlaySongDef): PlaySong {
  const notes: PlayNote[] = [];
  const chords: PlayChord[] = [];
  const bars: PlaySong["bars"] = [];
  let t = 0;
  def.bars.forEach((bar, bi) => {
    const len = bar.length ?? def.beatsPerBar;
    bars.push({ index: bi, beat: t, beats: len });
    let c = 0;
    for (const [symbol, numeral, d] of bar.chords ?? []) {
      const shape = chordShapeFor(symbol);
      const pcs = [...new Set(shapeNotes(shape).map(([s, f]) => pc(midiOf(s, f))))];
      chords.push({ j: chords.length, symbol, numeral, beat: t + c, beats: d, bar: bi, shape, pcs });
      c += d;
    }
    let x = 0;
    for (const [midi, d] of bar.melody ?? []) {
      if (midi > 0) {
        const p = def.positions[midi];
        if (!p) throw new Error(`${def.id}: no fret position for MIDI ${midi}`);
        notes.push({ i: notes.length, midi, name: noteName(midi), string: p[0], fret: p[1], finger: p[2], beat: t + x, beats: d, bar: bi, chord: -1 });
      }
      x += d;
    }
    t += len;
  });
  for (const n of notes) {
    for (const ch of chords) if (ch.beat <= n.beat + 1e-6) n.chord = ch.j;
  }
  const { bars: _b, positions: _p, ...rest } = def;
  return { ...rest, bars, notes, chords, lengthBeats: t };
}

/* ------------------------------------------------------------------ songs */

const ODE_A: EarBar = { chords: [["C", "I", 4]], melody: [[64, 1], [64, 1], [65, 1], [67, 1]] };
const ODE_B: EarBar = { chords: [["G", "V", 4]], melody: [[67, 1], [65, 1], [64, 1], [62, 1]] };
const ODE_C: EarBar = { chords: [["C", "I", 4]], melody: [[60, 1], [60, 1], [62, 1], [64, 1]] };
const OPEN_POS: Record<number, Pos> = { 60: [2, 1, 1], 62: [2, 3, 3], 64: [1, 0, 0], 65: [1, 1, 1], 67: [1, 3, 3], 69: [1, 5, 4] };

const TW = {
  a: { chords: [["C", "I", 4]], melody: [[60, 1], [60, 1], [67, 1], [67, 1]] },
  b: { chords: [["F", "IV", 2], ["C", "I", 2]], melody: [[69, 1], [69, 1], [67, 2]] },
  c: { chords: [["F", "IV", 2], ["C", "I", 2]], melody: [[65, 1], [65, 1], [64, 1], [64, 1]] },
  d: { chords: [["G", "V", 2], ["C", "I", 2]], melody: [[62, 1], [62, 1], [60, 2]] },
  e: { chords: [["C", "I", 2], ["F", "IV", 2]], melody: [[67, 1], [67, 1], [65, 1], [65, 1]] },
  f: { chords: [["C", "I", 2], ["G", "V", 2]], melody: [[64, 1], [64, 1], [62, 2]] },
} satisfies Record<string, EarBar>;

export const PLAY_SONG_DEFS: PlaySongDef[] = [
  {
    id: "ode", title: "Ode to Joy", meta: "Beethoven, 1824 · C major · 4/4", bpm: 100, beatsPerBar: 4,
    bars: [ODE_A, ODE_B, ODE_C, { chords: [["C", "I", 2], ["G", "V", 2]], melody: [[64, 1.5], [62, 0.5], [62, 2]] },
      ODE_A, ODE_B, ODE_C, { chords: [["G", "V", 2], ["C", "I", 2]], melody: [[62, 1.5], [60, 0.5], [60, 2]] }],
    positions: OPEN_POS,
    hand: { lo: 1, hi: 4, label: "First position: index finger on fret 1" },
    tip: "Only five notes, all next to each other. A good first tune: it moves in steps almost all the way.",
  },
  {
    id: "twinkle", title: "Twinkle, Twinkle, Little Star", meta: "Traditional · C major · 4/4", bpm: 100, beatsPerBar: 4,
    bars: [TW.a, TW.b, TW.c, TW.d, TW.e, TW.f, TW.e, TW.f, TW.a, TW.b, TW.c, TW.d],
    positions: OPEN_POS,
    hand: { lo: 1, hi: 5, label: "First position: index on fret 1, pinky stretches to fret 5 for A" },
    tip: "The first leap, C up to G, is the hardest note to find by ear. After that it walks down one step at a time.",
  },
  {
    id: "amazing-grace", title: "Amazing Grace", meta: "Traditional · G major · 3/4", bpm: 84, beatsPerBar: 3,
    bars: [...AMAZING_GRACE_BARS, { chords: [["G", "I", 3]], melody: [[67, 3]] }],
    positions: { 62: [3, 7, 1], 64: [3, 9, 3], 67: [2, 8, 2], 69: [2, 10, 4], 71: [1, 7, 1], 74: [1, 10, 4] },
    hand: { lo: 7, hi: 10, label: "Position VII: index finger on fret 7" },
    tip: "Up the neck at fret 7, every note is under a finger without moving your hand. The chords stay at the nut.",
  },
];

export const PLAY_SONGS: PlaySong[] = PLAY_SONG_DEFS.map(buildSong);

/* -------------------------------------------------------------- teaching */

/** "Up 2 frets — a step" style hint for finding the next note by ear. */
export function moveHint(prev: { midi: number } | null | undefined, cur: { midi: number }): string {
  if (!prev) return "It's the first note. Try home, the 3rd or the 5th first.";
  const d = cur.midi - prev.midi;
  if (d === 0) return "Same note as the last one.";
  const size = Math.abs(d);
  return `${d > 0 ? "Up" : "Down"} ${size} fret${size > 1 ? "s" : ""} from ${noteName(prev.midi)}: a ${size <= 2 ? "step" : "leap"}.`;
}

/** Whether a melody note belongs to the chord under it. */
export function inChord(song: PlaySong, n: PlayNote): boolean | null {
  const ch = song.chords[n.chord];
  return ch ? ch.pcs.includes(pc(n.midi)) : null;
}

/** Plain-language fingering for a chord shape. */
export function shapeSteps(shape: ChordShape): string[] {
  const notes = shapeNotes(shape);
  const byFinger = new Map<number, Pos[]>();
  for (const p of notes) if (p[2] > 0) byFinger.set(p[2], [...(byFinger.get(p[2]) ?? []), p]);
  const steps = [...byFinger.entries()].sort((a, b) => a[0] - b[0]).map(([f, ps]) => {
    const where = ps.map(([s, fr]) => `${STRING_WORD[s]} string fret ${fr}`).join(" and ");
    const label = f === 5 ? "Thumb over the neck (T)" : `${FINGER_WORD[f]![0]!.toUpperCase()}${FINGER_WORD[f]!.slice(1)} (${f})`;
    return `${label}: ${where}${ps.length > 1 ? " (lay the finger flat)" : ""}.`;
  });
  const open = notes.filter((p) => p[1] === 0).map((p) => STRING_WORD[p[0]]);
  const muted = [6, 5, 4, 3, 2, 1].filter((s) => shape.frets[6 - s] == null).map((s) => STRING_WORD[s]);
  if (open.length) steps.push(`Let ${open.join(", ")} ring open.`);
  if (muted.length) steps.push(`Don't play ${muted.join(" or ")}.`);
  return steps;
}

/* ------------------------------------------------------------------ sound */

export const noteHl = (i: number) => `ef-n-${i}`;
export const chordHl = (j: number) => `ef-c-${j}`;

export function noteSound(midi: number): Sound {
  return { bpm: 120, lengthBeats: 2.2, events: [{ kind: "pluck", midi, beat: 0, beats: 2, velocity: 0.95, timbre: "bright" }] };
}

/** Two notes in a row: the one you know, then the one to find. */
export function moveSound(prev: number | null, midi: number): Sound {
  if (prev == null) return noteSound(midi);
  return { bpm: 96, lengthBeats: 3.2, events: [
    { kind: "pluck", midi: prev, beat: 0, beats: 0.95, velocity: 0.85, timbre: "bright" },
    { kind: "pluck", midi, beat: 1, beats: 2, velocity: 0.95, timbre: "bright" },
  ] };
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Bass root between C2 and B2 for a chord symbol like "F", "Am", "F#m", "Bb". */
export function bassRoot(symbol: string): number {
  const m = /^([A-G])([#♯b♭]?)/.exec(symbol);
  if (!m) throw new Error(`Bad chord symbol: ${symbol}`);
  const acc = m[2] === "#" || m[2] === "♯" ? 1 : m[2] ? -1 : 0;
  return 36 + pc(LETTER_PC[m[1]]! + acc);
}

export interface PlayAlongOpts {
  speed?: number;
  melody?: boolean;
  chords?: boolean;
  bass?: boolean;
  /** Start from this bar (count-in bar first). */
  fromBar?: number;
}

/**
 * The song with a one-bar count-in. Lights `ef-n-<i>` per melody note and `ef-c-<j>` per chord.
 * Chords are strummed from the same shapes the neck shows.
 */
export function playAlongExample(song: PlaySong, o: PlayAlongOpts = {}): TheoryExample {
  const { speed = 1, melody = true, chords = true, bass = true, fromBar = 0 } = o;
  const start = song.bars[Math.min(fromBar, song.bars.length - 1)]!.beat;
  const lead = song.beatsPerBar;
  const at = (b: number) => b - start + lead;
  const events: TheoryEvent[] = [];
  for (let k = 0; k < lead; k++) events.push({ kind: "click", beat: k, beats: 0.2, velocity: k === 0 ? 1 : 0.6, highlight: `ef-count-${k}` });
  for (const n of song.notes) {
    if (n.beat < start - 1e-6) continue;
    if (melody) events.push({ kind: "pluck", midi: n.midi, beat: at(n.beat), beats: n.beats * 0.95, velocity: 1, timbre: "bright" });
    events.push({ kind: "highlight", beat: at(n.beat), beats: n.beats * 0.9, velocity: 0, highlight: noteHl(n.i) });
  }
  for (const ch of song.chords) {
    if (ch.beat < start - 1e-6) continue;
    const notes = shapeNotes(ch.shape).map(([s, f]) => midiOf(s, f));
    const strumAt = (b: number, len: number, v: number, top = false) => (top ? notes.slice(-3) : notes).forEach((m, k) =>
      events.push({ kind: "pluck", midi: m, beat: at(b) + k * 0.03, beats: Math.max(len - k * 0.03, 0.3), velocity: v * 0.42, timbre: "normal" }));
    if (chords) {
      if (song.beatsPerBar === 3) {
        for (let x = 1; x < ch.beats; x++) strumAt(ch.beat + x, 1, 0.6, true);
      } else {
        for (let x = 0; x < ch.beats; x += 2) strumAt(ch.beat + x, Math.min(2, ch.beats - x) + 0.2, x === 0 ? 0.85 : 0.65);
      }
    }
    if (bass) events.push({ kind: "bass", midi: bassRoot(ch.symbol), beat: at(ch.beat), beats: ch.beats * 0.95, velocity: 0.8 });
    events.push({ kind: "highlight", beat: at(ch.beat), beats: ch.beats, velocity: 0, highlight: chordHl(ch.j) });
  }
  const lengthBeats = song.lengthBeats - start + lead;
  return {
    label: song.title, sub: "Play along", bpm: Math.round(song.bpm * speed), lengthBeats, events,
    visual: { type: "blocks", lengthBeats, rows: [] },
  };
}

/* -------------------------------------------------------------- listening */

export type FollowEvent = { kind: "hit" } | { kind: "octave" | "miss"; heard: number };

/**
 * Turns microphone frames into "you played the right note" events.
 * Repeated notes need a fresh pluck (a silence or a jump in level), so a ringing note doesn't count twice,
 * and the previous note still ringing never counts as a wrong note.
 */
export class NoteFollower {
  private tracker: StablePitchTracker;
  private target = 0;
  private prev: number | null = null;
  private armed = true;
  private low = Infinity;
  private lastMiss: number | null = null;

  constructor(clarityMin = 0.8) {
    this.tracker = new StablePitchTracker(4, 45, clarityMin);
  }

  setTarget(target: number, prev: number | null) {
    this.target = target;
    this.prev = prev;
    this.tracker.reset();
    this.armed = prev == null || prev !== target;
    this.low = Infinity;
    this.lastMiss = null;
  }

  push(f: { midi: number | null; clarity: number; rms: number }): FollowEvent | null {
    if (!this.armed) {
      this.low = Math.min(this.low, f.rms);
      if (f.midi == null || f.rms > this.low * 1.6 + 0.002) {
        this.armed = true;
        this.tracker.reset();
      } else return null;
    }
    const st = this.tracker.push(f);
    if (!st) return null;
    const { verdict } = judge(st.midi, this.target);
    if (verdict === "correct") {
      this.armed = false;
      this.low = f.rms;
      return { kind: "hit" };
    }
    const heard = Math.round(st.midi);
    if (heard === this.prev || heard === this.lastMiss) return null;
    this.lastMiss = heard;
    return { kind: verdict === "octave" ? "octave" : "miss", heard };
  }
}
