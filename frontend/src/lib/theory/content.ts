/**
 * Theory map content for Music Decoder.
 *
 * Pure data + small builders. No DOM, no audio, no React. Safe to import from
 * components, the player and unit tests. Suggested location:
 *   frontend/src/lib/theory/content.ts
 *
 * Time is in BEATS (quarter notes) relative to the example start; the player
 * converts with 60 / bpm. MIDI 60 = middle C (C4). Standard tuning:
 * string 1 = high E (64) ... string 6 = low E (40), matching TAB order.
 */

/* ------------------------------------------------------------------ types */

export type Lane = "pitch" | "chords" | "time" | "colour" | "song";
export type Timbre = "normal" | "bright" | "warm";
export type EventKind =
  | "pluck" // guitar note (use the app's guitar voice)
  | "bass" // bass note (warm pluck + sub)
  | "organ" // pure sine tone, no pluck (only the timbre demo)
  | "kick"
  | "snare"
  | "hat"
  | "click" // metronome; velocity >= 0.95 is the accented (higher) click
  | "highlight"; // silent: lights `highlight` for `beats`

export interface TheoryEvent {
  kind: EventKind;
  beat: number;
  beats: number;
  velocity: number; // 0..1
  midi?: number;
  timbre?: Timbre;
  /** id of the visual element(s) to light while this event sounds (data-hl). */
  highlight?: string;
}

export type StringNo = 1 | 2 | 3 | 4 | 5 | 6;
export type DotRole = "" | "root" | "third" | "seventh" | "blue";
export interface FretDot {
  string: StringNo;
  fret: number;
  midi: number;
  name: string;
  role: DotRole;
  /** Text shown in the dot instead of the note name (e.g. "R", "♭3"). */
  label?: string;
}

export interface GridCell {
  hit?: boolean;
  tie?: boolean;
  velocity?: number;
  highlight?: string;
  noteName?: string;
}
export interface GridRow {
  name: string;
  cells: GridCell[];
}
export interface BlockItem {
  beat: number;
  beats: number;
  label: string;
  sub?: string;
  highlight?: string;
  /** "sect" = dashed section label; "s-intro" | "s-verse" | "s-chorus" | "s-bridge" = form colours. */
  variant?: string;
}
export interface BlockRow {
  name: string;
  items: BlockItem[];
}

export type TheoryVisual =
  | {
      type: "fret";
      dots: FretDot[];
      fromFret?: number;
      toFret?: number;
      muted?: StringNo[];
      legend?: "default" | "chord" | "blue";
    }
  | { type: "grid"; stepsPerBeat: number; stepsPerBar: number; cols: number; rows: GridRow[] }
  | { type: "blocks"; lengthBeats: number; rows: BlockRow[] }
  | { type: "overview" };

export interface TheoryExample {
  label: string;
  sub: string;
  bpm: number;
  lengthBeats: number;
  events: TheoryEvent[];
  visual: TheoryVisual;
}

export interface TheoryTerm {
  id: string;
  name: string;
  /** Shorter label for the map node when `name` is long. */
  mapLabel?: string;
  lane: Lane;
  short: string;
  body: string;
  guitar?: string;
  /** One-line example for the glossary. */
  glossaryExample?: string;
  relates: string[];
  /** Indices into `examples` that the guided tour plays. */
  tour: number[];
  /** Spoken by the guided tour (Web Speech). Written to be read aloud: no symbols. */
  narration: string;
  examples: TheoryExample[];
  /** Static figure shown in the detail panel (song form timeline). */
  figure?: TheoryVisual;
}

/* ------------------------------------------------------------- note maths */

export const OPEN_STRING_MIDI: Record<StringNo, number> = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
export const noteName = (midi: number): string => NOTE_NAMES[((midi % 12) + 12) % 12];

const dot = (string: StringNo, fret: number, role: DotRole = "", label?: string): FretDot => {
  const midi = OPEN_STRING_MIDI[string] + fret;
  return { string, fret, midi, name: noteName(midi), role, label };
};

/** Open-position / simple voicings, low to high (MIDI). */
export const CHORD_VOICINGS: Record<string, number[]> = {
  C: [48, 52, 55, 60, 64], // x32010
  Cm: [48, 55, 60, 63, 67], // x35543
  C5: [48, 55, 60], // x355xx
  C7: [48, 52, 58, 60, 64], // x32310
  Cmaj7: [48, 52, 55, 59, 64], // x32000
  G: [43, 47, 50, 55, 59, 67], // 320003
  G7: [43, 47, 50, 55, 59, 65], // 320001
  F: [53, 57, 60, 65], // xx3211
  Am: [45, 52, 57, 60, 64], // x02210
  Dm: [50, 57, 62, 65], // xx0231
  Em: [40, 47, 52, 55, 59, 64], // 022000
};
export const BASS_ROOT: Record<string, number> = { C: 36, G: 43, G7: 43, Am: 45, F: 41, Em: 40, Dm: 38 };

/* --------------------------------------------------------------- builders */

/** Small deterministic humanising so tests are stable. */
const human = (k: number) => 0.85 + 0.15 * (((k * 37) % 10) / 10);

function strum(ev: TheoryEvent[], notes: number[], beat: number, beats: number, velocity: number, down = true) {
  const ns = down ? notes : notes.slice(-4).reverse();
  ns.forEach((midi, k) =>
    ev.push({ kind: "pluck", midi, beat: beat + k * 0.03, beats: Math.max(beats - k * 0.03, 0.25), velocity: velocity * 0.45 * human(k) }),
  );
}

type FretStep = [number | number[], number, number?]; // dot index (or indices = chord), beats, velocity
interface FretOpts {
  timbre?: Timbre;
  organ?: boolean;
  from?: number;
  to?: number;
  muted?: StringNo[];
  legend?: "default" | "chord" | "blue";
  strumBeats?: number;
}

/** Notes played from fretboard dots. Lights `d<index>` while each dot sounds. */
export function fretExample(label: string, sub: string, dots: FretDot[], script: FretStep[], bpm = 90, o: FretOpts = {}): TheoryExample {
  const events: TheoryEvent[] = [];
  let t = 0;
  for (const [idx, beats, vel] of script) {
    const ids = Array.isArray(idx) ? idx : [idx];
    ids.forEach((i, k) => {
      const off = ids.length > 1 ? k * (o.strumBeats ?? 0.06) : 0;
      events.push({
        kind: o.organ ? "organ" : "pluck",
        midi: dots[i].midi,
        beat: t + off,
        beats: Math.max(beats - off, 0.25),
        velocity: (vel ?? 0.9) * (ids.length > 2 ? 0.7 : 1),
        timbre: o.timbre ?? "normal",
        highlight: `d${i}`,
      });
    });
    t += beats;
  }
  return { label, sub, bpm, lengthBeats: t, events, visual: { type: "fret", dots, fromFret: o.from, toFret: o.to, muted: o.muted, legend: o.legend } };
}
const ascending = (n: number, beats: number, last: number): FretStep[] => Array.from({ length: n }, (_, i) => [i, i === n - 1 ? last : beats]);

export interface GridRowSpec {
  name: string;
  kind: EventKind;
  /** `.` rest, `=` tie (extends previous hit), `X` 1.0, `x` 0.72, `o` 0.38, `1`-`9` = n/9. Spaces ignored. */
  pattern: string;
  midi?: number;
  notes?: number[]; // cycles per hit
  timbre?: Timbre;
  showNoteNames?: boolean;
}
/** Step-sequencer example. Lights `g<row>_<col>` (ties share their head's id). */
export function gridExample(label: string, sub: string, bpm: number, stepsPerBeat: number, rows: GridRowSpec[], o: { stepsPerBar?: number; loops?: number; swing?: boolean } = {}): TheoryExample {
  const base: TheoryEvent[] = [];
  const vrows: GridRow[] = [];
  let cols = 0;
  rows.forEach((r, ri) => {
    const p = r.pattern.replace(/\s+/g, "");
    cols = Math.max(cols, p.length);
    const cells: GridCell[] = [];
    let last: TheoryEvent | null = null;
    let hit = 0;
    for (let ci = 0; ci < p.length; ci++) {
      const ch = p[ci];
      if (ch === ".") { cells.push({}); last = null; continue; }
      if (ch === "=") {
        if (last) { last.beats += 1 / stepsPerBeat; cells.push({ tie: true, velocity: last.velocity, highlight: last.highlight }); }
        else cells.push({});
        continue;
      }
      const velocity = ch === "X" ? 1 : ch === "x" ? 0.72 : ch === "o" ? 0.38 : /[1-9]/.test(ch) ? Number(ch) / 9 : 0.7;
      let beat = ci / stepsPerBeat;
      if (o.swing && stepsPerBeat === 2 && ci % 2 === 1) beat = Math.floor(ci / 2) + 2 / 3;
      const midi = r.notes ? r.notes[hit % r.notes.length] : r.midi;
      hit++;
      const e: TheoryEvent = { kind: r.kind, midi, beat, beats: 1 / stepsPerBeat, velocity, timbre: r.timbre, highlight: `g${ri}_${ci}` };
      base.push(e);
      last = e;
      cells.push({ hit: true, velocity, highlight: e.highlight, noteName: r.showNoteNames && midi ? noteName(midi) : undefined });
    }
    vrows.push({ name: r.name, cells });
  });
  const len = cols / stepsPerBeat;
  const loops = o.loops ?? 1;
  const events: TheoryEvent[] = [];
  for (let L = 0; L < loops; L++) base.forEach((e) => events.push({ ...e, beat: e.beat + L * len }));
  return { label, sub, bpm, lengthBeats: len * loops, events, visual: { type: "grid", stepsPerBeat, stepsPerBar: o.stepsPerBar ?? stepsPerBeat * 4, cols, rows: vrows } };
}

type ProgItem = [chord: string, numeral: string, beats: number];
/** Strummed chord sequence shown as blocks. Lights `b_<index>` for each chord. */
export function progressionExample(label: string, sub: string, items: ProgItem[], bpm = 92, o: { every?: number; topNote?: number } = {}): TheoryExample {
  const events: TheoryEvent[] = [];
  const blocks: BlockItem[] = [];
  const every = o.every ?? 2;
  let t = 0;
  items.forEach(([c, num, beats], i) => {
    const highlight = `b_${i}`;
    for (let s = 0; s < beats - 0.01; s += every) {
      const last = s + every >= beats - 0.01;
      strum(events, CHORD_VOICINGS[c], t + s, Math.min(every, beats - s) + (last ? 0.6 : 0), s === 0 ? 1 : 0.75);
    }
    events.push({ kind: "highlight", beat: t, beats, velocity: 0, highlight });
    if (o.topNote) events.push({ kind: "pluck", midi: o.topNote, beat: t + 0.02, beats, velocity: 1, timbre: "bright" });
    blocks.push({ beat: t, beats, label: c, sub: num, highlight });
    t += beats;
  });
  const rows: BlockRow[] = [{ name: "Chords", items: blocks }];
  if (o.topNote) rows.unshift({ name: "Melody", items: blocks.map((b) => ({ beat: b.beat, beats: b.beats, label: noteName(o.topNote!), highlight: b.highlight })) });
  return { label, sub, bpm, lengthBeats: t, events, visual: { type: "blocks", lengthBeats: t, rows } };
}

/* ---- multi-layer songs (one bar = 4 beats) ---- */
export interface Bar {
  chord: string;
  numeral?: string;
  melody: [midi: number, beats: number][];
  counter?: [midi: number, beats: number][];
}
type PerBar<T> = T | ((bar: number) => T);
const at = <T,>(v: PerBar<T>, bar: number): T => (typeof v === "function" ? (v as (b: number) => T)(bar) : v);
type DrumStyle = "rock" | "soft" | "end" | "none";
type ChordStyle = "whole" | "half" | "pop";
type BassStyle = "drive" | "whole";
interface Layer {
  name: string;
  on?: number[]; // 1 = plays in that bar
  gen: (bar: Bar, i: number, beat: number) => TheoryEvent[];
  label: (bar: Bar) => string;
}

function drumBar(style: DrumStyle, t: number): TheoryEvent[] {
  const ev: TheoryEvent[] = [];
  const a = (kind: EventKind, x: number, velocity: number) => ev.push({ kind, beat: t + x, beats: 0.25, velocity });
  if (style === "none") return ev;
  if (style === "end") { a("kick", 0, 0.95); a("hat", 0, 0.5); return ev; }
  if (style === "soft") { for (let x = 0; x < 4; x++) a("hat", x, 0.32); a("kick", 0, 0.55); a("kick", 2, 0.45); return ev; }
  for (let x = 0; x < 4; x += 0.5) a("hat", x, x % 1 ? 0.28 : 0.5);
  a("kick", 0, 0.95); a("kick", 2, 0.85); a("kick", 2.5, 0.45); a("snare", 1, 0.85); a("snare", 3, 0.9);
  return ev;
}
function bassBar(b: Bar, t: number, style: BassStyle): TheoryEvent[] {
  const midi = BASS_ROOT[b.chord];
  const ev: TheoryEvent[] = [];
  const p = (x: number, beats: number, velocity: number) => ev.push({ kind: "bass", midi, beat: t + x, beats, velocity });
  if (style === "whole") { p(0, 4, 0.9); return ev; }
  p(0, 1.5, 0.95); p(1.5, 0.5, 0.6); p(2, 1.5, 0.85); p(3.5, 0.5, 0.6);
  return ev;
}
function chordBar(b: Bar, t: number, style: ChordStyle, vel = 1): TheoryEvent[] {
  const ns = CHORD_VOICINGS[b.chord];
  const ev: TheoryEvent[] = [];
  if (style === "whole") strum(ev, ns, t, 4.3, 0.8 * vel);
  else if (style === "half") { strum(ev, ns, t, 2, 0.75 * vel); strum(ev, ns, t + 2, 2.3, 0.62 * vel); }
  else
    // D . D U . U D U  (pop strum)
    ([[0, 1, 1, 0.85], [1, 0.5, 1, 0.6], [1.5, 0.5, 0, 0.45], [2.5, 0.5, 0, 0.5], [3, 0.5, 1, 0.65], [3.5, 0.6, 0, 0.45]] as const).forEach(
      ([x, d, dn, v]) => strum(ev, ns, t + x, d, v * vel, dn === 1),
    );
  return ev;
}
function lineBar(notes: [number, number][], t: number, velocity = 1): TheoryEvent[] {
  const ev: TheoryEvent[] = [];
  let x = 0;
  for (const [midi, beats] of notes) { if (midi > 0) ev.push({ kind: "pluck", midi, beat: t + x, beats, velocity, timbre: "bright" }); x += beats; }
  return ev;
}
const melodyLayer = (vel?: (bar: number) => number, on?: number[]): Layer => ({
  name: "Melody", on,
  gen: (b, i, t) => lineBar(b.melody, t, vel ? vel(i) : 1),
  label: (b) => b.melody.filter((n) => n[0] > 0).map((n) => noteName(n[0])).join(" "),
});
const counterLayer = (): Layer => ({ name: "Counter", gen: (b, _i, t) => lineBar(b.counter ?? [], t, 0.85), label: (b) => (b.counter ?? []).map((n) => noteName(n[0])).join(" ") });
const chordLayer = (style: PerBar<ChordStyle> = "half", vel?: (bar: number) => number, on?: number[]): Layer => ({
  name: "Chords", on,
  gen: (b, i, t) => chordBar(b, t, at(style, i), vel ? vel(i) : 1),
  label: (b) => b.chord + (b.numeral ? ` · ${b.numeral}` : ""),
});
const drumLayer = (style: PerBar<DrumStyle> = "rock", on?: number[]): Layer => ({ name: "Drums", on, gen: (_b, i, t) => drumBar(at(style, i), t), label: () => "" });
const bassLayer = (style: PerBar<BassStyle> = "drive", on?: number[]): Layer => ({ name: "Bass", on, gen: (b, i, t) => bassBar(b, t, at(style, i)), label: (b) => noteName(BASS_ROOT[b.chord]) });

/** Layered band example shown as rows of bar blocks. Lights `L<layer>_<bar>`. */
export function songExample(label: string, sub: string, bpm: number, bars: Bar[], layers: Layer[], o: { sections?: [startBar: number, bars: number, label: string][] } = {}): TheoryExample {
  const events: TheoryEvent[] = [];
  const rows: BlockRow[] = [];
  const lengthBeats = bars.length * 4;
  if (o.sections) rows.push({ name: "Section", items: o.sections.map(([s, n, l]) => ({ beat: s * 4, beats: n * 4, label: l, variant: "sect" })) });
  layers.forEach((L, li) => {
    const items: BlockItem[] = [];
    bars.forEach((b, bi) => {
      if (L.on && !L.on[bi]) return;
      const t = bi * 4;
      const highlight = `L${li}_${bi}`;
      events.push(...L.gen(b, bi, t), { kind: "highlight", beat: t, beats: 4, velocity: 0, highlight });
      items.push({ beat: t, beats: 4, highlight, label: L.label(b) });
    });
    rows.push({ name: L.name, items });
  });
  return { label, sub, bpm, lengthBeats, events, visual: { type: "blocks", lengthBeats, rows } };
}

/* --------------------------------------------------------- shared material */

const C_MAJOR = [dot(5, 3, "root"), dot(5, 5), dot(4, 2), dot(4, 3), dot(4, 5), dot(3, 2), dot(3, 4), dot(3, 5, "root")];
const A_MINOR = [dot(6, 5, "root"), dot(6, 7), dot(6, 8), dot(5, 5), dot(5, 7), dot(5, 8), dot(4, 5), dot(4, 7, "root")];
const A_PENTA = [dot(6, 5, "root"), dot(6, 8), dot(5, 5), dot(5, 7), dot(4, 5), dot(4, 7, "root"), dot(3, 5), dot(3, 7), dot(2, 5), dot(2, 8), dot(1, 5, "root"), dot(1, 8)];
const A_BLUES = [dot(6, 5, "root"), dot(6, 8), dot(5, 5), dot(5, 6, "blue"), dot(5, 7), dot(4, 5), dot(4, 7, "root"), dot(3, 5), dot(3, 7), dot(3, 8, "blue"), dot(2, 5), dot(2, 8), dot(1, 5, "root")];
const ODE_DOTS = [dot(2, 1, "root"), dot(2, 3), dot(1, 0), dot(1, 1), dot(1, 3)]; // C D E F G
const ODE: FretStep[] = [[2, 1], [2, 1], [3, 1], [4, 1], [4, 1], [3, 1], [2, 1], [1, 1], [0, 1], [0, 1], [1, 1], [2, 1], [2, 1.5], [1, 0.5], [1, 2]];
const ODE_BARS: Bar[] = [
  { chord: "C", numeral: "I", melody: [[64, 1], [64, 1], [65, 1], [67, 1]] },
  { chord: "G", numeral: "V", melody: [[67, 1], [65, 1], [64, 1], [62, 1]] },
  { chord: "C", numeral: "I", melody: [[60, 1], [60, 1], [62, 1], [64, 1]] },
  { chord: "G", numeral: "V", melody: [[64, 1.5], [62, 0.5], [62, 2]] },
];
export const MINI_SONG_BARS: Bar[] = [
  { chord: "C", numeral: "I", melody: [[64, 1], [67, 1], [72, 2]], counter: [[55, 2], [52, 2]] },
  { chord: "G", numeral: "V", melody: [[74, 1], [71, 1], [67, 2]], counter: [[50, 2], [55, 2]] },
  { chord: "Am", numeral: "vi", melody: [[69, 1], [72, 1], [69, 2]], counter: [[57, 2], [52, 2]] },
  { chord: "F", numeral: "IV", melody: [[69, 1], [67, 1], [65, 2]], counter: [[53, 2], [57, 2]] },
  { chord: "C", numeral: "I", melody: [[64, 1], [67, 1], [72, 2]] },
  { chord: "G", numeral: "V", melody: [[74, 1], [71, 1], [67, 2]] },
  { chord: "F", numeral: "IV", melody: [[72, 1], [69, 1], [65, 2]] },
  { chord: "G", numeral: "V", melody: [[67, 1], [71, 1], [74, 2]] },
  { chord: "C", numeral: "I", melody: [[72, 4]] },
];
const FOUR = MINI_SONG_BARS.slice(0, 4);
const VERSE: Bar[] = [
  { chord: "Am", numeral: "vi", melody: [[64, 1], [64, 1], [60, 2]] },
  { chord: "F", numeral: "IV", melody: [[60, 1], [62, 1], [57, 2]] },
  { chord: "C", numeral: "I", melody: [[64, 1], [67, 1], [64, 2]] },
  { chord: "G", numeral: "V", melody: [[62, 4]] },
];
const CHORUS: Bar[] = [
  { chord: "C", numeral: "I", melody: [[67, 1], [72, 1], [72, 2]] },
  { chord: "G", numeral: "V", melody: [[71, 1], [74, 1], [71, 2]] },
  { chord: "Am", numeral: "vi", melody: [[72, 1], [69, 1], [69, 2]] },
  { chord: "F", numeral: "IV", melody: [[69, 1], [67, 1], [65, 2]] },
];
const drums = (hat: string, snare: string, kick: string): GridRowSpec[] => [
  { name: "Hi-hat", kind: "hat", pattern: hat },
  { name: "Snare", kind: "snare", pattern: snare },
  { name: "Kick", kind: "kick", pattern: kick },
];
const ROCK_BEAT = drums("xoxoxoxoxoxoxoxo", "..x...x...x...x.", "x...x...x...x...");
const BEAT_8THS: GridRowSpec = { name: "Beat", kind: "click", pattern: "o.o.o.o.o.o.o.o." };
const RIFF = [45, 45, 52, 45];
const PHRASE = [57, 60, 62, 64, 67, 64, 62, 60];
const TIMBRE_DOTS = [dot(2, 5), dot(2, 8), dot(1, 5, "root"), dot(1, 8)];
const TIMBRE_SCRIPT: FretStep[] = [[0, 0.5], [1, 0.5], [2, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 2]];
const MOTIF_DOTS = [dot(2, 1, "root"), dot(2, 3), dot(1, 0), dot(1, 3), dot(1, 5), dot(1, 8)]; // C D E G A C
const MOTIF_A: FretStep[] = [[2, 0.5], [3, 0.5], [4, 1], [3, 2]];
const MOTIF_B: FretStep[] = [[2, 0.5], [3, 0.5], [4, 1], [5, 2]];
const MOTIF_HOME: FretStep[] = [[2, 0.5], [3, 0.5], [1, 1], [0, 2]];
const interval = (fret: number, role: DotRole = "") => [dot(5, 3, "root"), dot(5, fret, role)];
const INTERVAL_SCRIPT: FretStep[] = [[0, 1], [1, 1], [0, 1], [1, 2]]; // same string, so played one after another
const CHORD_SCRIPT: FretStep[] = [[[0, 1, 2, 3, 4], 2], [0, 0.5], [1, 0.5], [2, 0.5], [3, 0.5], [4, 2]];

const FORM_SECTIONS: [string, number, string][] = [
  ["Intro", 4, "s-intro"], ["Verse", 8, "s-verse"], ["Chorus", 8, "s-chorus"], ["Verse", 8, "s-verse"],
  ["Chorus", 8, "s-chorus"], ["Bridge", 4, "s-bridge"], ["Chorus", 8, "s-chorus"], ["Outro", 4, "s-intro"],
];
const FORM_FIGURE: TheoryVisual = (() => {
  let t = 0;
  const items = FORM_SECTIONS.map(([label, bars, variant]) => { const it = { beat: t, beats: bars, label, sub: `${bars} bars`, variant }; t += bars; return it; });
  return { type: "blocks", lengthBeats: t, rows: [{ name: "Section", items }] }; // units are bars here; only proportions matter
})();

/* ------------------------------------------------------------------ terms */

export const TERMS: Record<string, TheoryTerm> = {
  note: {
    id: "note", name: "Note", lane: "pitch",
    short: "One musical sound with a fixed pitch and a name.",
    body: "Music uses just 12 note names: C, C♯, D, E♭, E, F, F♯, G, A♭, A, B♭ and B. After B the names start again at C, one octave higher. Same name, higher sound.",
    guitar: "Each fret raises a note by one semitone. Fret 12 is the open string's note, one octave up.",
    glossaryExample: "C, then C again at fret 12", relates: ["interval", "scale", "melody"], tour: [0, 1],
    narration: "Everything starts with a note: one sound with a fixed pitch. There are only twelve note names. On the guitar every fret is the next one, and after twelve frets the names repeat, one octave higher.",
    examples: [
      fretExample("12 notes on the A string", "One fret is one semitone. At fret 12 the names start again.", Array.from({ length: 13 }, (_, f) => dot(5, f, f === 0 || f === 12 ? "root" : "")), ascending(13, 0.5, 2), 120, { from: 0, to: 12 }),
      fretExample("Octave: C and C", "Same name, twice the frequency. They blend into one sound.", [dot(5, 3, "root"), dot(3, 5, "root")], [[0, 1], [1, 1], [[0, 1], 2.5]], 90, { from: 0, to: 7 }),
    ],
  },
  interval: {
    id: "interval", name: "Interval", lane: "pitch",
    short: "The distance between two notes, counted in semitones. On guitar: frets.",
    body: "Intervals carry the emotion. A major 3rd (4 frets) sounds bright, a minor 3rd (3 frets) sounds dark, a perfect 5th (7 frets) sounds strong and open, and the tritone (6 frets) sounds tense and unstable.",
    guitar: "Count frets along one string from the first note to the second. That count is the interval.",
    glossaryExample: "C → E = major 3rd, 4 frets", relates: ["note", "chord", "scale", "tension"], tour: [0, 1],
    narration: "The distance between two notes is an interval. Count it in frets. Four frets, a major third, sounds bright. Three frets, a minor third, sounds darker.",
    examples: [
      fretExample("Major 3rd: 4 frets", "Bright and happy. C up to E.", interval(7, "third"), INTERVAL_SCRIPT, 90, { from: 0, to: 12 }),
      fretExample("Minor 3rd: 3 frets", "Darker and sadder. C up to E♭.", interval(6, "third"), INTERVAL_SCRIPT, 90, { from: 0, to: 12 }),
      fretExample("Perfect 5th: 7 frets", "Strong and open. The core of a power chord.", interval(10), INTERVAL_SCRIPT, 90, { from: 0, to: 12 }),
      fretExample("Tritone: 6 frets", "Tense and restless. It wants to move.", interval(9, "blue"), INTERVAL_SCRIPT, 90, { from: 0, to: 12 }),
    ],
  },
  scale: {
    id: "scale", name: "Scale", lane: "pitch",
    short: "A ladder of notes chosen from the 12, played in order.",
    body: "A scale is a recipe of steps. The major scale goes whole, whole, half, whole, whole, whole, half (whole = 2 frets, half = 1 fret) and sounds bright and complete. The natural minor sounds serious or sad. The pentatonic keeps only 5 notes, so almost nothing clashes. That's why most solos start there.",
    guitar: "Learn each scale as a shape. Slide the same shape to another fret and you are in a new key.",
    glossaryExample: "C D E F G A B", relates: ["interval", "key", "chord", "melody"], tour: [0, 2],
    narration: "Pick some of the twelve notes, play them in order, and you have a scale. The major scale sounds bright. The minor pentatonic has only five notes, and it is where most guitar solos live.",
    examples: [
      fretExample("C major", "Whole, whole, half, whole, whole, whole, half. Bright.", C_MAJOR, ascending(8, 0.5, 2), 112),
      fretExample("A natural minor", "Same notes as C major, but home is A. Serious, a little sad.", A_MINOR, ascending(8, 0.5, 2), 112),
      fretExample("A minor pentatonic box", "5 notes, 2 per string, one finger per fret. The solo shape.", A_PENTA, ascending(12, 0.5, 2), 126),
      fretExample("A blues scale", "The pentatonic plus one extra note, the ♭5: the blue note.", A_BLUES, ascending(13, 0.5, 2), 126, { legend: "blue" }),
    ],
  },
  key: {
    id: "key", name: "Key", lane: "pitch",
    short: "The home note plus its scale. It tells you which notes and chords belong.",
    body: "In C major, C is home and the notes are C D E F G A B. Melodies and chords are pulled back towards home, so stopping anywhere else sounds unfinished. Changing key moves the whole song up or down without changing its character.",
    guitar: "A capo changes the key while your chord shapes stay the same.",
    glossaryExample: "C major: home is C", relates: ["scale", "progression", "melody", "cadence"], tour: [0, 1],
    narration: "A key is a scale with a home note, and everything pulls towards home. Hear how stopping on B feels unfinished, and how stepping up to C feels like arriving.",
    examples: [
      fretExample("Stop on B: unfinished", "The 7th note leans hard towards home. Stopping here leaves you hanging.", C_MAJOR, [[0, 0.5], [1, 0.5], [2, 0.5], [3, 0.5], [4, 0.5], [5, 0.5], [6, 2.5]], 112),
      fretExample("Step up to C: home", "Land on C and the scale feels complete.", C_MAJOR, ascending(8, 0.5, 2.5), 112),
    ],
  },
  chord: {
    id: "chord", name: "Chord", lane: "chords",
    short: "Three or more notes played together.",
    body: "Build a chord by stacking every other note of the scale: the 1st, 3rd and 5th. The 3rd sets the mood. Four frets above the root makes it major and happy, three frets makes it minor and sad. Adding the 7th gives colour. A power chord keeps only the root and the 5th.",
    guitar: "Every chord shape is one of these stacks spread across the strings. The dots show R, 3, 5 and 7.",
    glossaryExample: "C = C E G", relates: ["interval", "scale", "progression", "harmony"], tour: [0, 1, 2],
    narration: "Stack notes from the scale, skipping one each time, and you get a chord. The third decides the mood. C major sounds happy. C minor sounds sad. The power chord has no third at all, so it just sounds strong.",
    examples: [
      fretExample("C major", "R, 3 and 5. The 3rd is 4 frets above the root: happy.", [dot(5, 3, "root", "R"), dot(4, 2, "third", "3"), dot(3, 0, "", "5"), dot(2, 1, "root", "R"), dot(1, 0, "third", "3")], CHORD_SCRIPT, 92, { muted: [6], legend: "chord" }),
      fretExample("C minor", "Lower the 3rd by one fret and the chord turns sad.", [dot(5, 3, "root", "R"), dot(4, 5, "", "5"), dot(3, 5, "root", "R"), dot(2, 4, "third", "♭3"), dot(1, 3, "", "5")], CHORD_SCRIPT, 92, { muted: [6], legend: "chord" }),
      fretExample("C5 power chord", "Root and 5th only. No 3rd, so neither happy nor sad.", [dot(5, 3, "root", "R"), dot(4, 5, "", "5"), dot(3, 5, "root", "R")], [[[0, 1, 2], 2], [0, 0.5], [1, 0.5], [2, 2]], 92, { muted: [6, 2, 1], legend: "chord" }),
      fretExample("C7", "Add the ♭7. Bluesy, and it wants to move.", [dot(5, 3, "root", "R"), dot(4, 2, "third", "3"), dot(3, 3, "seventh", "♭7"), dot(2, 1, "root", "R"), dot(1, 0, "third", "3")], CHORD_SCRIPT, 92, { muted: [6], legend: "chord" }),
      fretExample("Cmaj7", "Add the major 7th. Soft and dreamy.", [dot(5, 3, "root", "R"), dot(4, 2, "third", "3"), dot(3, 0, "", "5"), dot(2, 0, "seventh", "7"), dot(1, 0, "third", "3")], CHORD_SCRIPT, 92, { muted: [6], legend: "chord" }),
    ],
  },
  progression: {
    id: "progression", name: "Chord progression", mapLabel: "Progression", lane: "chords",
    short: "A sequence of chords that repeats under a song.",
    body: "Each chord in a key gets a Roman numeral from its place in the scale. In C: I = C, IV = F, V = G, vi = Am. Upper case is major, lower case is minor. Because the numbers work in every key, one progression can be played anywhere.",
    guitar: "Learn progressions as numbers, not letter names, and you can move them to any key.",
    glossaryExample: "C G Am F (I–V–vi–IV)", relates: ["key", "chord", "cadence", "harmony", "form"], tour: [1],
    narration: "Chords in a row make a progression. We name them by number: one, four, five, six. One, five, six, four is the famous pop progression, used in thousands of songs.",
    examples: [
      progressionExample("I – IV – V – I", "The oldest story: home, away, tension, home.", [["C", "I", 4], ["F", "IV", 4], ["G", "V", 4], ["C", "I", 4]], 100),
      progressionExample("I – V – vi – IV", "The four-chord pop loop.", [["C", "I", 4], ["G", "V", 4], ["Am", "vi", 4], ["F", "IV", 4]], 100),
      progressionExample("vi – IV – I – V", "The same four chords starting on Am. Moodier.", [["Am", "vi", 4], ["F", "IV", 4], ["C", "I", 4], ["G", "V", 4]], 100),
      progressionExample("i – ♭VII – ♭VI – ♭VII", "A classic rock move in A minor.", [["Am", "i", 4], ["G", "♭VII", 4], ["F", "♭VI", 4], ["G", "♭VII", 4]], 100),
    ],
  },
  cadence: {
    id: "cadence", name: "Cadence", lane: "chords",
    short: "The chord move that ends a phrase. Music's punctuation.",
    body: "V → I sounds like a full stop. Ending on V sounds like a comma or a question. V → vi is a surprise, called the deceptive cadence. IV → I is the soft amen ending of hymns.",
    guitar: "End your song on the I chord, approached from V, and it will sound finished.",
    glossaryExample: "G → C, a full stop", relates: ["progression", "key", "tension"], tour: [0, 1],
    narration: "The last two chords of a phrase are its punctuation. Five to one is a full stop. Ending on five sounds like a question, waiting for an answer.",
    examples: [
      progressionExample("Full stop: V → I", "Ends at home. Finished.", [["C", "I", 2], ["F", "IV", 2], ["G", "V", 2], ["C", "I", 4]], 96),
      progressionExample("Question: ending on V", "Hangs in the air, waiting for an answer.", [["C", "I", 2], ["F", "IV", 2], ["C", "I", 2], ["G", "V", 4]], 96),
      progressionExample("Surprise: V → vi", "You expect C and get A minor.", [["C", "I", 2], ["F", "IV", 2], ["G", "V", 2], ["Am", "vi", 4]], 96),
      progressionExample("Amen: IV → I", "A soft, gentle ending.", [["C", "I", 2], ["G", "V", 2], ["F", "IV", 2], ["C", "I", 4]], 96),
    ],
  },
  beat: {
    id: "beat", name: "Beat", lane: "time",
    short: "The steady pulse you tap your foot to.",
    body: "Every note is placed against the beat: on it, or between it. The beat doesn't have to be played out loud. The band feels it together, and a listener's body finds it on its own.",
    guitar: "Practise with a metronome. It is the beat made audible.",
    glossaryExample: "Foot taps at 90 BPM", relates: ["tempo", "meter", "rhythm"], tour: [0],
    narration: "Now, time. The beat is the steady pulse you tap your foot to. Everything else lines up against it.",
    examples: [
      gridExample("Pulse at 90 BPM", "Tap your foot on every click.", 90, 1, [{ name: "Beat", kind: "click", pattern: "xxxxxxxx" }], { stepsPerBar: 4 }),
      gridExample("Beat under a tune", "The tune moves, the beat stays steady.", 100, 2, [BEAT_8THS, { name: "Tune", kind: "pluck", timbre: "bright", showNoteNames: true, notes: [64, 64, 65, 67, 67, 65, 64, 62], pattern: "x=x=x=x=x=x=x=x=" }]),
    ],
  },
  tempo: {
    id: "tempo", name: "Tempo", lane: "time",
    short: "How fast the beat goes, in beats per minute (BPM).",
    body: "60 BPM is one beat per second. Slow tempos feel calm or heavy; fast tempos feel urgent and exciting. The same song changes mood just by changing tempo.",
    guitar: "Learn a part slowly, then raise the metronome a few BPM at a time.",
    glossaryExample: "70 ballad, 120 rock, 170 punk", relates: ["beat", "groove"], tour: [0, 2],
    narration: "Tempo is the speed of the beat, measured in beats per minute. Here is the same drum beat at seventy, then at a hundred and seventy.",
    examples: [
      gridExample("70 BPM: ballad", "Slow and relaxed.", 70, 2, ROCK_BEAT),
      gridExample("120 BPM: pop and rock", "The most common tempo range.", 120, 2, ROCK_BEAT, { loops: 2 }),
      gridExample("170 BPM: punk", "Fast and urgent.", 170, 2, ROCK_BEAT, { loops: 3 }),
    ],
  },
  meter: {
    id: "meter", name: "Meter", lane: "time",
    short: "How beats are grouped into bars, with the strongest beat on 1. Written as a time signature.",
    body: "4/4 counts ONE two three four and covers most rock and pop. 3/4 counts ONE two three: the waltz. 6/8 counts ONE two three FOUR five six and rolls like a boat.",
    guitar: "Count out loud while you play. Chords usually change on beat 1, so you'll feel each bar begin.",
    glossaryExample: "4/4, 3/4, 6/8", relates: ["beat", "rhythm", "groove"], tour: [0, 1],
    narration: "Meter groups the beats into bars. Four four counts one, two, three, four. Three four counts one, two, three, like a waltz.",
    examples: [
      gridExample("4/4", "ONE two three four. Most rock and pop.", 100, 1, [{ name: "Click", kind: "click", pattern: "9444 9444" }, { name: "Bass", kind: "bass", midi: 36, pattern: "x... x..." }], { stepsPerBar: 4, loops: 2 }),
      gridExample("3/4", "ONE two three. A waltz.", 132, 1, [{ name: "Click", kind: "click", pattern: "944 944 944 944" }, { name: "Bass", kind: "bass", midi: 36, pattern: "x.. x.. x.. x.." }], { stepsPerBar: 3 }),
      gridExample("6/8", "ONE two three FOUR five six. It rolls.", 200, 1, [{ name: "Click", kind: "click", pattern: "944744 944744" }, { name: "Bass", kind: "bass", midi: 36, pattern: "x..x.. x..x.." }], { stepsPerBar: 6, loops: 2 }),
    ],
  },
  rhythm: {
    id: "rhythm", name: "Rhythm", lane: "time",
    short: "The pattern of long and short notes laid over the beat.",
    body: "Rhythm is what you'd clap if you clapped the tune. Even notes feel steady, eighth notes drive, syncopation (accents between the beats) feels funky, and a shuffle (long-short, long-short) swings.",
    guitar: "Strumming patterns are rhythms. Keep your hand moving down and up with the beat, and only hit the strings where the rhythm says.",
    glossaryExample: "Long-short shuffle", relates: ["beat", "meter", "melody", "groove"], tour: [1, 2],
    narration: "Rhythm is the pattern of long and short notes on top of the beat. Straight eighth notes drive. Syncopation, hitting between the beats, makes it groove.",
    examples: [
      gridExample("Quarter notes", "One note per beat. Steady.", 96, 2, [BEAT_8THS, { name: "Guitar", kind: "pluck", notes: RIFF, pattern: "x=x=x=x=x=x=x=x=" }]),
      gridExample("Eighth notes", "Two per beat. Driving.", 96, 2, [BEAT_8THS, { name: "Guitar", kind: "pluck", notes: RIFF, pattern: "xxxxxxxxxxxxxxxx" }]),
      gridExample("Syncopation", "Some notes land between the beats. Funky.", 96, 2, [BEAT_8THS, { name: "Guitar", kind: "pluck", notes: RIFF, pattern: "x==x==x=x==x==x=" }]),
      gridExample("Shuffle", "Long-short, long-short. It swings.", 96, 2, [BEAT_8THS, { name: "Guitar", kind: "pluck", notes: RIFF, pattern: "XxXxXxXxXxXxXxXx" }], { swing: true }),
    ],
  },
  texture: {
    id: "texture", name: "Texture", lane: "colour",
    short: "How many layers play at once, and how they relate.",
    body: "A melody alone is thin (monophonic). Melody with chords underneath is the usual song texture (homophonic). Two independent melodies at once is polyphonic, like a guitar line answering the vocal.",
    guitar: "Play a riff alone, then add a second guitar under it, and you have changed the texture.",
    glossaryExample: "Melody alone vs with chords", relates: ["harmony", "arrangement", "melody"], tour: [0, 1],
    narration: "Texture is how many layers play at once. A melody alone sounds thin. Add chords underneath, and it fills out.",
    examples: [
      songExample("Monophonic: one line", "A melody alone. Clear but thin.", 100, FOUR, [melodyLayer()]),
      songExample("Homophonic: melody + chords", "The usual song texture.", 100, FOUR, [melodyLayer(), chordLayer("half")]),
      songExample("Polyphonic: two melodies", "A second line moves on its own under the tune.", 100, FOUR, [melodyLayer(), counterLayer()]),
    ],
  },
  timbre: {
    id: "timbre", name: "Timbre", lane: "colour",
    short: "The colour of a sound. It's why a guitar and a piano differ on the same note.",
    body: "Timbre comes from the mix of overtones in a sound. On guitar you shape it by where you pick, which pickup you use, and effects like distortion. Bright tones cut through a band; warm tones sit behind it.",
    guitar: "Pick near the bridge for bright and twangy, near the neck for warm and round.",
    glossaryExample: "Bridge pick vs neck pick", relates: ["arrangement", "texture"], tour: [0, 2],
    narration: "Timbre is the colour of a sound. Picked near the bridge, these notes sound bright. As a pure tone with no pluck, the same notes sound like an organ.",
    examples: [
      fretExample("Bright: pick near the bridge", "Sharp and twangy. Cuts through.", TIMBRE_DOTS, TIMBRE_SCRIPT, 100, { timbre: "bright" }),
      fretExample("Warm: pick near the neck", "Round and soft.", TIMBRE_DOTS, TIMBRE_SCRIPT, 100, { timbre: "warm" }),
      fretExample("Pure tone: no pluck", "The same notes with no attack. Sounds like an organ.", TIMBRE_DOTS, TIMBRE_SCRIPT, 100, { organ: true }),
    ],
  },
  dynamics: {
    id: "dynamics", name: "Dynamics", lane: "colour",
    short: "How loud or soft the music is, and how that changes.",
    body: "One volume all the way through sounds flat. A crescendo (getting louder) builds excitement, a sudden drop makes listeners lean in, and accents make single notes stand out.",
    guitar: "Dig in with the pick for loud. Use a lighter touch, or your thumb, for soft.",
    glossaryExample: "Soft → loud (crescendo)", relates: ["groove", "arrangement", "contrast"], tour: [2],
    narration: "Dynamics means loud and soft. A crescendo, getting gradually louder, builds energy.",
    examples: [
      gridExample("Soft", "Light touch. Intimate.", 100, 2, [{ name: "Guitar", kind: "pluck", notes: PHRASE, pattern: "3333333333333333" }]),
      gridExample("Loud", "Dig in. Powerful.", 100, 2, [{ name: "Guitar", kind: "pluck", notes: PHRASE, pattern: "9999999999999999" }]),
      gridExample("Crescendo", "Getting louder builds energy.", 100, 2, [{ name: "Guitar", kind: "pluck", notes: PHRASE, pattern: "1122334455667799" }]),
      gridExample("Accents", "Some notes louder than others give the phrase a shape.", 100, 2, [{ name: "Guitar", kind: "pluck", notes: PHRASE, pattern: "9333933393339333" }]),
    ],
  },
  melody: {
    id: "melody", name: "Melody", lane: "song",
    short: "A tune: notes from the scale, placed in a rhythm.",
    body: "Melody is pitch plus rhythm. Good melodies mostly move by small steps, with an occasional leap for drama, and they come back to the home note at the end. The shape (rising, falling, arching) carries the feeling.",
    guitar: "When you hum a tune, you are singing its melody. Find it on one or two strings first.",
    glossaryExample: "E E F G G F E D", relates: ["scale", "key", "rhythm", "harmony"], tour: [0],
    narration: "Combine pitch and time and you get a melody: notes from the scale, placed in a rhythm. This one, Ode to Joy, moves almost entirely in small steps.",
    examples: [
      fretExample("Ode to Joy", "Almost every move is a step to the next note. Beethoven, 1824.", ODE_DOTS, ODE, 112),
      fretExample("Same notes, new rhythm", "Change only the rhythm and the tune gets a new character.", ODE_DOTS, [[2, 1.5], [2, 0.5], [3, 1], [4, 1], [4, 0.5], [3, 0.5], [2, 1], [1, 2], [0, 1.5], [0, 0.5], [1, 1], [2, 1], [2, 1], [1, 1], [1, 2]], 112),
    ],
  },
  harmony: {
    id: "harmony", name: "Harmony", lane: "song",
    short: "The chords sounding under the melody, giving it support and mood.",
    body: "Harmony is the progression doing its job under a tune. The same melody feels different over different chords: a high C over C major is at rest, over A minor it turns wistful, over F it sounds hopeful.",
    guitar: "When you strum while someone sings, you are the harmony.",
    glossaryExample: "Ode to Joy over C – G – C – G", relates: ["chord", "progression", "melody", "texture"], tour: [1, 2],
    narration: "Harmony is the chords underneath the melody. Listen to the tune with chords, then hear one note change its mood as the chord beneath it changes.",
    examples: [
      songExample("Melody alone", "Ode to Joy by itself.", 108, ODE_BARS, [melodyLayer()]),
      songExample("Melody with chords", "C – G – C – G underneath. Fuller, and you can hear where it's going.", 108, ODE_BARS, [melodyLayer(), chordLayer("half")]),
      progressionExample("One note, three moods", "The same high C over C, then Am, then F.", [["C", "I", 4], ["Am", "vi", 4], ["F", "IV", 4]], 84, { topNote: 72, every: 4 }),
    ],
  },
  groove: {
    id: "groove", name: "Groove", lane: "song",
    short: "The feel that makes you move: rhythm, accents and timing locked together.",
    body: "Groove comes from the drums and bass agreeing on a pattern, with accents in the right places. In rock and pop, the snare on beats 2 and 4 (the backbeat) is the heart of the groove.",
    guitar: "Lock your strum to the snare. Accent beats 2 and 4 and you'll sound tighter straight away.",
    glossaryExample: "Snare on 2 and 4", relates: ["rhythm", "tempo", "dynamics", "arrangement"], tour: [0, 1],
    narration: "Groove is the feel that makes you move. Even hits with no accents sound mechanical. Put the snare on two and four, the backbeat, and it comes alive.",
    examples: [
      gridExample("No accents", "Every hit the same. Mechanical.", 100, 2, drums("xxxxxxxxxxxxxxxx", "................", "x.x.x.x.x.x.x.x."), { loops: 2 }),
      gridExample("Backbeat", "Snare on 2 and 4, hi-hat accents on the beat.", 100, 2, drums("7373737373737373", "..X...X...X...X.", "X..xX...X..xX..."), { loops: 2 }),
      gridExample("Backbeat + bass", "The bass locks in with the kick drum.", 100, 2, [...drums("7373737373737373", "..X...X...X...X.", "X..xX...X..xX..."), { name: "Bass", kind: "bass", notes: [36, 36, 36, 41, 41, 41, 43], pattern: "X=.xX=..X=.xX=.x" }], { loops: 2 }),
    ],
  },
  arrangement: {
    id: "arrangement", name: "Arrangement", lane: "song",
    short: "Deciding who plays what, and when.",
    body: "An arrangement spreads the parts across instruments and across the song. Adding layers builds energy; taking them away makes a breakdown. Leaving room for the vocal is part of the job.",
    guitar: "If another instrument plays low chords, play higher up the neck so you don't crowd it.",
    glossaryExample: "Drums → bass → chords → melody", relates: ["texture", "timbre", "groove", "form"], tour: [0],
    narration: "Arrangement decides who plays what, and when. Here the parts enter one at a time: drums, then bass, then chords, then melody.",
    examples: [
      songExample("Build-up", "The parts enter one bar at a time.", 100, FOUR, [drumLayer("rock"), bassLayer("drive", [0, 1, 1, 1]), chordLayer("pop", undefined, [0, 0, 1, 1]), melodyLayer(undefined, [0, 0, 0, 1])]),
      songExample("Breakdown", "Full band, then only the chords, then everyone back in.", 100, FOUR, [drumLayer("rock", [1, 1, 0, 1]), bassLayer("drive", [1, 1, 0, 1]), chordLayer("pop"), melodyLayer(undefined, [1, 1, 0, 1])]),
    ],
  },
  form: {
    id: "form", name: "Song form", lane: "song",
    short: "The order of a song's sections: intro, verse, chorus, bridge, outro.",
    body: "Verses tell the story with new words each time. The chorus repeats the hook and is usually higher, louder and fuller. A bridge brings something new before the last chorus.",
    guitar: "Give each section its own chord progression. Different progressions make the sections easy to tell apart.",
    figure: FORM_FIGURE, glossaryExample: "Verse – chorus – bridge", relates: ["arrangement", "progression", "contrast", "repetition"], tour: [0, 1],
    narration: "Song form is the order of the sections. The verse holds back. The chorus lifts: higher, louder and fuller.",
    examples: [
      songExample("Verse", "Low melody, soft chords, light drums. It tells the story.", 96, VERSE, [drumLayer("soft"), chordLayer("whole", () => 0.6), melodyLayer(() => 0.8)]),
      songExample("Chorus", "Higher melody, full band, louder. The hook.", 96, CHORUS, [drumLayer("rock"), bassLayer("drive"), chordLayer("pop"), melodyLayer()]),
      progressionExample("Bridge: IV – V – iii – vi", "New chords refresh the ear before the last chorus.", [["F", "IV", 4], ["G", "V", 4], ["Em", "iii", 4], ["Am", "vi", 4]], 96),
    ],
  },
};

/* ------------------------------------------------------------- principles */

export const PRINCIPLES: Record<string, TheoryTerm> = {
  tension: {
    id: "tension", name: "Tension and release", lane: "song",
    short: "Build a feeling of not yet, then resolve it.",
    body: "Every element can build tension: a clashing interval, the V7 chord, a rising melody, a drum fill, getting louder. Resolving it (the home chord, the downbeat, the chorus) is what feels satisfying. Too little tension is boring. Tension that never resolves is tiring.",
    relates: ["interval", "cadence", "dynamics", "key"], tour: [0, 1],
    narration: "Now, what makes music good? First, tension and release. The G seven chord wants to move. Hold it, and you feel the pull. Resolve it to C, and you feel the relief.",
    examples: [
      progressionExample("Tension: G7 held", "Its F rubs against its B. The chord wants to move.", [["G7", "V7", 6]], 80, { every: 6 }),
      progressionExample("Release: G7 → C", "F falls to E, B rises to C. Relief.", [["G7", "V7", 4], ["C", "I", 4]], 80, { every: 4 }),
    ],
  },
  repetition: {
    id: "repetition", name: "Repetition and variation", lane: "song",
    short: "Repeat an idea so it sticks, then change it so it stays interesting.",
    body: "Listeners love recognising things, so a short idea (a motif, or hook) that comes back makes a song memorable. Exact repeats get dull, though. Change one thing the third time: the ending, the rhythm, or how high it goes. Same, same, different, same is a classic shape.",
    relates: ["melody", "rhythm", "form"], tour: [0, 1],
    narration: "Second, repetition and variation. Repeat an idea four times unchanged and it gets dull. Repeat it, change it, then bring it home, and it becomes a hook.",
    examples: [
      fretExample("Same × 4", "The idea four times, unchanged. It gets dull.", MOTIF_DOTS, [...MOTIF_A, ...MOTIF_A, ...MOTIF_A, ...MOTIF_A], 112),
      fretExample("Same, same, different, home", "Repeat, change the top note, then resolve to C.", MOTIF_DOTS, [...MOTIF_A, ...MOTIF_A, ...MOTIF_B, ...MOTIF_HOME], 112),
    ],
  },
  contrast: {
    id: "contrast", name: "Contrast", lane: "song",
    short: "Make sections different so each one feels fresh.",
    body: "A chorus hits hard because the verse held back. Contrast can come from register (low vs high), density (few vs many instruments), dynamics (soft vs loud) or mood (minor vs major).",
    relates: ["dynamics", "arrangement", "form", "texture"], tour: [0],
    narration: "Third, contrast. A chorus only feels big if the verse was smaller. Here a quiet, low verse opens into a full, loud chorus.",
    examples: [
      songExample("Verse into chorus", "Low and sparse, then high and full.", 96, [VERSE[0], VERSE[1], CHORUS[0], CHORUS[1]],
        [drumLayer((b) => (b < 2 ? "soft" : "rock")), bassLayer("drive", [0, 0, 1, 1]), chordLayer((b) => (b < 2 ? "whole" : "pop"), (b) => (b < 2 ? 0.55 : 1)), melodyLayer((b) => (b < 2 ? 0.75 : 1))],
        { sections: [[0, 2, "Verse"], [2, 2, "Chorus"]] }),
      songExample("No contrast", "Everything at one level the whole time.", 96, VERSE, [drumLayer("rock"), bassLayer("drive"), chordLayer("pop"), melodyLayer()], { sections: [[0, 4, "One level throughout"]] }),
    ],
  },
  fit: {
    id: "fit", name: "Melody that fits the chords", lane: "song",
    short: "Land on chord notes on the strong beats.",
    body: "Notes that belong to the current chord sound stable. Other notes sound like they are passing through. Put chord notes on beats 1 and 3, and use the other notes on the weak beats to move between them.",
    relates: ["chord", "harmony", "melody", "rhythm"], tour: [0, 1],
    narration: "Fourth, fit the melody to the chords. Chord notes on the strong beats sound right. A note outside the chord, held on the downbeat, rubs.",
    examples: [
      songExample("Chord notes on strong beats", "E, C, G and E land on beats 1 and 3. D and F pass between.", 84,
        [{ chord: "C", numeral: "I", melody: [[64, 1.5], [62, 0.5], [60, 2]] }, { chord: "C", numeral: "I", melody: [[67, 1], [65, 1], [64, 2]] }], [chordLayer("whole"), melodyLayer()]),
      songExample("Clash on the strong beat", "F is held against the chord's E, then B. It rubs.", 84,
        [{ chord: "C", numeral: "I", melody: [[65, 3], [64, 1]] }, { chord: "C", numeral: "I", melody: [[65, 2], [71, 2]] }], [chordLayer("whole"), melodyLayer()]),
    ],
  },
  space: {
    id: "space", name: "Space and timing", lane: "song",
    short: "A few notes played in time beat many notes played loosely.",
    body: "Rests let a phrase breathe and give the listener time to take it in. A simple part locked to the beat sounds better than a busy one. When in doubt, play less.",
    relates: ["rhythm", "groove", "beat", "arrangement"], tour: [0, 1],
    narration: "Fifth, leave space. A constant stream of notes is tiring. Fewer notes, with rests between them, sound confident.",
    examples: [
      gridExample("Busy", "A note on every eighth. Nowhere to breathe.", 92, 2, [{ name: "Hi-hat", kind: "hat", pattern: "o.o.o.o.o.o.o.o." }, { name: "Guitar", kind: "pluck", timbre: "bright", showNoteNames: true, notes: [57, 60, 62, 64, 67, 64, 62, 60, 57, 60, 62, 64, 67, 69, 67, 64], pattern: "xxxxxxxxxxxxxxxx" }]),
      gridExample("Spacious", "Fewer notes and a rest. Each one counts.", 92, 2, [{ name: "Hi-hat", kind: "hat", pattern: "o.o.o.o.o.o.o.o." }, { name: "Guitar", kind: "pluck", timbre: "bright", showNoteNames: true, notes: [69, 67, 64, 57], pattern: "X=x=x===....x===" }]),
    ],
  },
};

export const ALL_TERMS: Record<string, TheoryTerm> = { ...TERMS, ...PRINCIPLES };

export const LANE_LABEL: Record<Lane, string> = { pitch: "Pitch", chords: "Chords", time: "Time", colour: "Sound colour", song: "Putting it together" };

/* ------------------------------------------------- mini song + recipe */

export const MINI_SONG: TheoryExample = songExample("Mini song", "C major, 100 BPM. Calm phrase, fuller phrase, V → I ending.", 100, MINI_SONG_BARS, [
  drumLayer((b) => (b < 4 ? "soft" : b < 8 ? "rock" : "end")),
  bassLayer((b) => (b === 8 ? "whole" : "drive"), [0, 0, 0, 0, 1, 1, 1, 1, 1]),
  chordLayer((b) => (b < 4 ? "half" : b < 8 ? "pop" : "whole"), (b) => (b < 4 ? 0.6 : 1)),
  melodyLayer((b) => (b < 4 ? 0.85 : 1)),
], { sections: [[0, 4, "Phrase 1: calm"], [4, 4, "Phrase 2: builds"], [8, 1, "Home"]] });

export const RECIPE: { title: string; example: string; terms: string[] }[] = [
  { title: "Pick a key and a tempo", example: "C major, 100 BPM", terms: ["key", "tempo"] },
  { title: "Choose a progression", example: "C G Am F", terms: ["progression", "chord"] },
  { title: "Lay down a groove", example: "Snare on 2 and 4", terms: ["beat", "rhythm", "groove"] },
  { title: "Write a melody on chord notes", example: "E G C over C", terms: ["melody", "scale", "interval"] },
  { title: "Arrange with contrast", example: "Calm phrase, then full", terms: ["arrangement", "dynamics", "form"] },
  { title: "End with tension and release", example: "G → C", terms: ["cadence", "tension"] },
];

/* ------------------------------------------------------------- map layout */

/** Node centres in a 1030 × 492 SVG viewBox. Lanes are rows; the combined column and song form sit on the right. */
export const MAP_VIEWBOX = { width: 1030, height: 492 };
export const MAP_NODES: Record<string, [x: number, y: number]> = {
  note: [180, 80], interval: [320, 80], scale: [460, 80], key: [600, 80],
  chord: [320, 185], progression: [460, 185], cadence: [600, 185],
  beat: [180, 300], tempo: [320, 300], meter: [460, 300], rhythm: [600, 300],
  texture: [180, 410], timbre: [320, 410], dynamics: [460, 410],
  melody: [790, 105], harmony: [790, 210], groove: [790, 315], arrangement: [790, 425],
  form: [950, 265],
};
export const MAP_LANES: { lane: Lane; label: string; hint: string; y: number }[] = [
  { lane: "pitch", label: "Pitch", hint: "high or low", y: 80 },
  { lane: "chords", label: "Chords", hint: "notes together", y: 185 },
  { lane: "time", label: "Time", hint: "when it happens", y: 300 },
  { lane: "colour", label: "Sound colour", hint: "how it sounds", y: 410 },
];
/** h = right side to left side, v = bottom to top, bus = drop to a shared line at y=470, then up into the target. */
export const MAP_EDGES: [from: string, to: string, route: "h" | "v" | "bus"][] = [
  ["note", "interval", "h"], ["interval", "scale", "h"], ["scale", "key", "h"],
  ["interval", "chord", "v"], ["scale", "chord", "v"], ["key", "progression", "v"],
  ["chord", "progression", "h"], ["progression", "cadence", "h"],
  ["beat", "tempo", "h"], ["tempo", "meter", "h"], ["meter", "rhythm", "h"],
  ["key", "melody", "h"], ["rhythm", "melody", "h"], ["cadence", "harmony", "h"],
  ["rhythm", "groove", "h"], ["dynamics", "groove", "h"],
  ["texture", "arrangement", "bus"], ["timbre", "arrangement", "bus"], ["dynamics", "arrangement", "bus"],
  ["melody", "form", "h"], ["harmony", "form", "h"], ["groove", "form", "h"], ["arrangement", "form", "h"],
];
export function nodeBox(id: string) {
  const [x, y] = MAP_NODES[id];
  const wide = ["melody", "harmony", "groove", "arrangement", "form"].includes(id);
  const w = wide ? 148 : 128;
  const h = id === "form" ? 72 : 50;
  return { x, y, w, h, left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
}
/** SVG path for an edge; leaves a 6px gap before the target for the arrowhead. */
export function edgePath([a, b, route]: [string, string, "h" | "v" | "bus"]): string {
  const A = nodeBox(a), B = nodeBox(b);
  if (route === "bus") return `M${A.x} ${A.bottom} V470 H${B.x} V${B.bottom + 6}`;
  if (route === "v") {
    const x1 = A.x, y1 = A.bottom, x2 = B.x, y2 = B.top - 6, my = (y1 + y2) / 2;
    return x1 === x2 ? `M${x1} ${y1} V${y2}` : `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
  }
  const x1 = A.right, y1 = A.y, x2 = B.left - 6, y2 = B.y, mx = (x1 + x2) / 2;
  return y1 === y2 ? `M${x1} ${y1} H${x2}` : `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

/** Everything a term links to: its own `relates`, map edges, and terms that list it. */
export function connections(id: string): string[] {
  const s = new Set(ALL_TERMS[id]?.relates ?? []);
  for (const [a, b] of MAP_EDGES) { if (a === id) s.add(b); if (b === id) s.add(a); }
  for (const t of Object.values(ALL_TERMS)) if (t.relates.includes(id)) s.add(t.id);
  s.delete(id);
  return [...s];
}

/* ------------------------------------------------------------ guided tour */

export interface TourStep {
  termId?: string;
  lane: Lane;
  eyebrow: string;
  title: string;
  definition: string;
  narration: string;
  examples: TheoryExample[];
}
export const TOUR_ORDER = ["note", "interval", "scale", "key", "chord", "progression", "cadence", "beat", "tempo", "meter", "rhythm", "melody", "harmony", "dynamics", "timbre", "texture", "groove", "arrangement", "form"];
export const TOUR: TourStep[] = [
  {
    lane: "song", eyebrow: "Overview", title: "How music fits together",
    definition: "Music is sound organised in two dimensions: pitch (how high or low) and time (when, and for how long).",
    narration: "Music is organised sound, and it has two dimensions: pitch, how high or low, and time, when and for how long. Every term in this tour lives in one of those, or combines them. Let's build up from a single note.",
    examples: [],
  },
  ...TOUR_ORDER.map((id): TourStep => {
    const t = TERMS[id];
    return { termId: id, lane: t.lane, eyebrow: LANE_LABEL[t.lane], title: t.name, definition: t.short, narration: t.narration, examples: t.tour.map((i) => t.examples[i]) };
  }),
  ...Object.values(PRINCIPLES).map((p, i): TourStep => ({
    termId: p.id, lane: "song", eyebrow: `What makes it good · ${i + 1} of 5`, title: p.name, definition: p.short, narration: p.narration, examples: p.tour.map((k) => p.examples[k]),
  })),
  {
    lane: "song", eyebrow: "Finale", title: "Putting it all together",
    definition: "A key and tempo, a progression, a groove, a melody on chord notes, contrast between two phrases, and a V → I ending.",
    narration: "Put it all together. A key and a tempo. A chord progression. A groove. A melody that lands on chord notes. A calm phrase, then a fuller one. And a five to one ending. Here it is.",
    examples: [MINI_SONG],
  },
];
