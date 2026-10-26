/**
 * Lead Solo Workshop content: an improvisation guide for adding lead solos.
 *
 * Pure data + helpers (no React, no audio). Licks use the app's own note format
 * (PlayableNote with technique / bend_semitones / slide_from_fret / vibrato / finger),
 * so articulation() + playLead() play them and noteToken() / layoutTab() write their TAB.
 *
 * Bend rule (same as backend/app/schemas.py): for "bend" the note's midi is the bent-to
 * pitch (fret pitch + bend_semitones); for "bend_release" midi is the fretted pitch.
 *
 * Location: frontend/src/lib/music/soloGuide.ts
 */
import { MAX_FRET, STANDARD_TUNING } from "@/lib/music/guitar";
import { midiToName, pitchClassName } from "@/lib/music/theory";
import { rootPc, scaleKindPcs, type ScaleMode, type ScaleRoot } from "@/lib/music/scaleFretmap";
import { BASS_ROOT, CHORD_VOICINGS, type BlockItem, type TheoryEvent, type TheoryExample } from "@/lib/theory/content";
import type { PlayableNote, Technique } from "@/lib/types";

/* ------------------------------------------------------------------ types */

export type BackingStyle = "rock" | "shuffle" | "pop";
export interface Lick {
  id: string;
  title: string;
  /** One line under the title: what to listen for. */
  sub: string;
  tags: string[];
  root: ScaleRoot;
  mode: ScaleMode;
  /** Pentatonic box to show with the lick (0 = whole neck). */
  box: number;
  bpm: number;
  notes: PlayableNote[];
  /** Backing chords: [chord, beats]. */
  backing: [chord: string, beats: number][];
  style: BackingStyle;
  /** Long lines (the full solo): no order badges or technique glyphs on the neck, just lit notes. */
  compact?: boolean;
}
export interface SoloTechnique {
  id: string;
  name: string;
  /** TAB symbol shown on the card, in the app's TAB notation. */
  symbol: string;
  what: string;
  how: string[];
  lick: Lick;
}

/* --------------------------------------------------------- lick builder */

type Tech = "" | "slide" | "h" | "p" | "bend" | "br" | "vib";
interface Spec { s: number; f: number; b: number; d: number; t: Tech; bend?: 1 | 2; vib?: boolean }
const N = (s: number, f: number, b: number, d: number, t: Tech = "", o: { bend?: 1 | 2; vib?: boolean } = {}): Spec => ({ s, f, b, d, t, ...o });

/** Converts compact specs to PlayableNotes. Fingers follow one-finger-per-fret from `fingerBase + 1`. */
export function buildLick(id: string, specs: Spec[], fingerBase = 4): PlayableNote[] {
  const last: Record<number, PlayableNote> = {};
  return specs.map((sp, i) => {
    const prev = last[sp.s];
    let technique: Technique | null = null;
    let bend: number | null = null;
    let slideFrom: number | null = null;
    if (sp.t === "slide") {
      if (!prev) throw new Error(`${id}[${i}]: a slide needs an earlier note on string ${sp.s}`);
      technique = sp.f > prev.fret ? "slide_up" : "slide_down";
      slideFrom = prev.fret;
    }
    if (sp.t === "h") technique = "hammer_on";
    if (sp.t === "p") technique = "pull_off";
    if (sp.t === "bend") { technique = "bend"; bend = sp.bend ?? 2; }
    if (sp.t === "br") { technique = "bend_release"; bend = sp.bend ?? 2; }
    const fretted = STANDARD_TUNING[sp.s] + sp.f;
    const midi = technique === "bend" ? fretted + bend! : fretted;
    const note: PlayableNote = {
      id: `${id}-${i}`, midi, name: midiToName(midi), start_beat: sp.b, duration_beats: sp.d,
      string: sp.s, fret: sp.f, finger: sp.f === 0 ? 0 : Math.min(4, Math.max(1, sp.f - fingerBase)),
      source: "riff", technique, bend_semitones: bend, slide_from_fret: slideFrom,
      vibrato: sp.t === "vib" || sp.vib === true || (sp.t === "bend" && sp.vib !== false),
    };
    // A note picked at the same moment on another string (double stop) doesn't end this string's note.
    last[sp.s] = note;
    return note;
  });
}

/* ------------------------------------------------------------ chords */

/** Theory map voicings plus the extra chords the jam tracks need. */
export const SOLO_VOICINGS: Record<string, number[]> = {
  ...CHORD_VOICINGS,
  D: [50, 57, 62, 66], // xx0232
  A7: [45, 52, 55, 61, 64], // x02020
  D7: [50, 57, 60, 66], // xx0212
  E7: [40, 47, 50, 56, 59, 64], // 020100
};
export const SOLO_BASS: Record<string, number> = { ...BASS_ROOT, D: 38, A7: 45, D7: 38, E7: 40 };
/** Pitch classes of each chord (root first). */
export const CHORD_TONES: Record<string, number[]> = {
  Am: [9, 0, 4], G: [7, 11, 2], F: [5, 9, 0], C: [0, 4, 7], Em: [4, 7, 11], D: [2, 6, 9],
  A7: [9, 1, 4, 7], D7: [2, 6, 9, 0], E7: [4, 8, 11, 2],
};

/* ------------------------------------------------------------ boxes */

export const BOX_MODES: ScaleMode[] = ["minor-pentatonic", "major-pentatonic", "blues"];
export interface NeckCell { string: number; fret: number }

/**
 * Pentatonic "box" n (1–5): 12 consecutive scale notes, two per string, low E to high e.
 * Box 1 starts on the root on the low E string. Blues adds the ♭5 wherever it falls inside the box.
 * Returns null for scales without boxes. Pass `nearFret` (e.g. a lick's lowest fret) to draw the
 * box in the octave closest to it; otherwise boxes climb the neck from box 1.
 */
export function pentatonicBox(root: ScaleRoot, mode: ScaleMode, n: number, nearFret?: number): NeckCell[] | null {
  if (!BOX_MODES.includes(mode) || n < 1 || n > 5) return null;
  const offs = mode === "major-pentatonic" ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10];
  const r0 = (rootPc(root) - 4 + 12) % 12; // root's fret on the low E string
  const base = STANDARD_TUNING[6] + r0;
  const start = base + offs[n - 1];
  const pitches: number[] = [];
  for (let p = start; pitches.length < 12; p++) if (offs.includes((((p - base) % 12) + 12) % 12)) pitches.push(p);
  let cells: NeckCell[] = [];
  for (let s = 6; s >= 1; s--) {
    const i = (6 - s) * 2;
    cells.push({ string: s, fret: pitches[i] - STANDARD_TUNING[s] }, { string: s, fret: pitches[i + 1] - STANDARD_TUNING[s] });
  }
  if (cells.some((c) => c.fret > MAX_FRET)) cells = cells.map((c) => ({ ...c, fret: c.fret - 12 }));
  if (nearFret != null) {
    const options = [-12, 0, 12].map((d) => cells.map((c) => ({ ...c, fret: c.fret + d })))
      .filter((o) => o.every((c) => c.fret >= 0 && c.fret <= MAX_FRET));
    cells = options.reduce((best, o) => (Math.abs(fretRange(o).lo - nearFret) < Math.abs(fretRange(best).lo - nearFret) ? o : best), options[0] ?? cells);
  }
  if (mode === "blues") {
    const { lo, hi } = fretRange(cells);
    const b5 = (rootPc(root) + 6) % 12;
    for (let s = 1; s <= 6; s++) for (let f = lo; f <= hi; f++) if ((STANDARD_TUNING[s] + f) % 12 === b5) cells.push({ string: s, fret: f });
  }
  return cells;
}
export function fretRange(cells: NeckCell[]): { lo: number; hi: number } {
  const fs = cells.map((c) => c.fret);
  return { lo: Math.min(...fs), hi: Math.max(...fs) };
}

/**
 * Where a chord's notes sit, for ringing on the neck. With a box: scale tones inside the box,
 * plus chord tones outside the scale (inScale false, drawn dashed) within the box's fret range.
 */
export function chordToneCells(chord: string, root: ScaleRoot, mode: ScaleMode, box = 0, maxFret = MAX_FRET, nearFret?: number): (NeckCell & { name: string; inScale: boolean })[] {
  const tones = CHORD_TONES[chord];
  if (!tones) return [];
  const pcs = scaleKindPcs(rootPc(root), mode);
  const cells = box ? pentatonicBox(root, mode, box, nearFret) : null;
  const range = cells ? fretRange(cells) : { lo: 0, hi: maxFret };
  const out: (NeckCell & { name: string; inScale: boolean })[] = [];
  for (let s = 1; s <= 6; s++) {
    for (let f = range.lo; f <= range.hi; f++) {
      const midi = STANDARD_TUNING[s] + f;
      const pc = midi % 12;
      if (!tones.includes(pc)) continue;
      const inScale = pcs.includes(pc);
      if (cells && inScale && !cells.some((c) => c.string === s && c.fret === f)) continue;
      out.push({ string: s, fret: f, name: pitchClassName(midi), inScale });
    }
  }
  return out;
}

/* ------------------------------------------------- lick layer geometry */

export interface LickMarker { string: number; fret: number; name: string; noteIndices: number[]; order: number }
export type LickGlyph =
  | { kind: "slide"; dir: "up" | "down"; string: number; fromFret: number; toFret: number; noteIndex: number }
  | { kind: "hammer_on" | "pull_off"; string: number; fromFret: number; toFret: number; noteIndex: number }
  | { kind: "bend" | "bend_release"; string: number; fret: number; label: "full" | "½"; noteIndex: number }
  | { kind: "vibrato"; string: number; fret: number; noteIndex: number }
  | { kind: "double_stop"; strings: [number, number]; frets: [number, number]; noteIndex: number };

/** Everything the neck's lick layer draws: one marker per position (with play order) and technique glyphs. */
export function lickOverlay(notes: PlayableNote[]): { markers: LickMarker[]; glyphs: LickGlyph[] } {
  const byPos = new Map<string, LickMarker>();
  const glyphs: LickGlyph[] = [];
  const prevOn: Record<number, PlayableNote | undefined> = {};
  notes.forEach((n, i) => {
    const key = `${n.string}-${n.fret}`;
    const m = byPos.get(key);
    if (m) m.noteIndices.push(i);
    else byPos.set(key, { string: n.string, fret: n.fret, name: pitchClassName(STANDARD_TUNING[n.string] + n.fret), noteIndices: [i], order: i + 1 });
    const prev = prevOn[n.string];
    if ((n.technique === "slide_up" || n.technique === "slide_down") && n.slide_from_fret != null)
      glyphs.push({ kind: "slide", dir: n.technique === "slide_up" ? "up" : "down", string: n.string, fromFret: n.slide_from_fret, toFret: n.fret, noteIndex: i });
    if ((n.technique === "hammer_on" || n.technique === "pull_off") && prev)
      glyphs.push({ kind: n.technique, string: n.string, fromFret: prev.fret, toFret: n.fret, noteIndex: i });
    if (n.technique === "bend" || n.technique === "bend_release")
      glyphs.push({ kind: n.technique, string: n.string, fret: n.fret, label: (n.bend_semitones ?? 2) >= 2 ? "full" : "½", noteIndex: i });
    if (n.vibrato) glyphs.push({ kind: "vibrato", string: n.string, fret: n.fret, noteIndex: i });
    const pair = notes.find((o, j) => j !== i && o.start_beat === n.start_beat && o.string === n.string + 1);
    if (pair) glyphs.push({ kind: "double_stop", strings: [n.string, pair.string], frets: [n.fret, pair.fret], noteIndex: i });
    prevOn[n.string] = n;
  });
  return { markers: [...byPos.values()], glyphs };
}
/** Frets to show for a lick in a small diagram (at least 6 frets wide). */
export function lickWindow(notes: PlayableNote[], pad = 1): { from: number; to: number } {
  const fs = notes.map((n) => n.fret);
  let from = Math.max(0, Math.min(...fs) - pad);
  let to = Math.min(MAX_FRET, Math.max(...fs) + pad);
  if (from === 1) from = 0;
  while (to - from < 5) { if (to < MAX_FRET) to++; else from--; }
  return { from, to };
}

/* ------------------------------------------------------- backing tracks */

/** One bar of drums, bass and chords as Theory player events, starting at `beat`. */
export function backingBar(chord: string, style: BackingStyle, beat: number, beats = 4, vol = 0.85): TheoryEvent[] {
  const ev: TheoryEvent[] = [];
  const at = (x: number) => beat + (style === "shuffle" && x % 1 ? Math.floor(x) + 2 / 3 : x);
  const hit = (kind: TheoryEvent["kind"], x: number, v: number, d = 0.25) => ev.push({ kind, beat: at(x), beats: d, velocity: v * vol });
  for (let x = 0; x < beats; x += 0.5) hit("hat", x, x % 1 ? 0.3 : 0.5);
  hit("kick", 0, 0.9);
  if (beats >= 4) { hit("kick", 2, 0.8); hit("snare", 1, 0.75); hit("snare", 3, 0.8); }
  const root = SOLO_BASS[chord];
  if (style === "shuffle") {
    [0, 1, 2, 3].slice(0, beats).forEach((x) => {
      ev.push({ kind: "bass", midi: root, beat: beat + x, beats: 0.66, velocity: 0.8 * vol });
      ev.push({ kind: "bass", midi: root + [0, 4, 7, 9][x], beat: beat + x + 2 / 3, beats: 0.3, velocity: 0.5 * vol });
    });
  } else {
    [[0, 1.4, 0.85], [1.5, 0.4, 0.55], [2, 1.4, 0.8], [3.5, 0.4, 0.55]].filter(([x]) => x < beats)
      .forEach(([x, d, v]) => ev.push({ kind: "bass", midi: root, beat: beat + x, beats: d, velocity: v * vol }));
  }
  const ns = SOLO_VOICINGS[chord];
  const strum = (x: number, d: number, v: number, down = true, notes = ns) =>
    (down ? notes : notes.slice(-4).reverse()).forEach((midi, k) => ev.push({ kind: "pluck", midi, beat: at(x) + k * 0.03, beats: Math.max(d - k * 0.03, 0.2), velocity: v * 0.45 * vol }));
  if (style === "pop") ([[0, 1, 1], [1, 0.5, 1], [1.5, 0.5, 0], [2.5, 0.5, 0], [3, 0.5, 1], [3.5, 0.6, 0]] as const).forEach(([x, d, dn]) => x < beats && strum(x, d, 0.9, dn === 1));
  else if (style === "shuffle") [0, 1, 2, 3].slice(0, beats).forEach((x) => strum(x + 0.5, 0.3, 0.85, true, ns.slice(-3)));
  else { strum(0, Math.min(beats, 1.8), 1); if (beats >= 4) strum(2, 1.8, 0.85); }
  return ev;
}

/**
 * Backing + highlights for a lick, as a TheoryExample for the Theory player.
 * The lead line itself is passed separately (lick.notes → playLead), see the Cursor prompt.
 * Highlight ids: `n<i>` = lick note i, `b_<i>` = backing bar i.
 */
export function lickExample(lick: Lick): TheoryExample {
  const events: TheoryEvent[] = [];
  const items: BlockItem[] = [];
  let t = 0;
  lick.backing.forEach(([chord, beats], i) => {
    events.push(...backingBar(chord, lick.style, t, beats));
    events.push({ kind: "highlight", beat: t, beats, velocity: 0, highlight: `b_${i}` });
    items.push({ beat: t, beats, label: chord, sub: CHORD_TONES[chord].map((pc) => pitchClassName(pc + 60)).join(" "), highlight: `b_${i}` });
    t += beats;
  });
  lick.notes.forEach((n, i) => events.push({ kind: "highlight", beat: n.start_beat, beats: n.duration_beats, velocity: 0, highlight: `n${i}` }));
  const end = Math.max(t, ...lick.notes.map((n) => n.start_beat + n.duration_beats));
  return { label: lick.title, sub: lick.sub, bpm: lick.bpm, lengthBeats: end, events, visual: { type: "blocks", lengthBeats: end, rows: [{ name: "Chords", items }] } };
}

/* ---------------------------------------------------------------- licks */

const AMP = { root: "A" as ScaleRoot, mode: "minor-pentatonic" as ScaleMode, box: 1 };
const lick = (o: Omit<Lick, "notes" | "root" | "mode" | "box" | "bpm" | "style" | "tags" | "backing"> & Partial<Lick> & { specs: Spec[] }): Lick => {
  const { specs, ...rest } = o;
  return { ...AMP, bpm: 88, style: "rock", tags: [], backing: [], ...rest, notes: buildLick(o.id, specs) };
};

export const TECHNIQUES: SoloTechnique[] = [
  { id: "slide", name: "Slide", symbol: "5/7",
    what: "Pick once, then glide the same finger to a new fret while pressing. The note smears up (or down) like a voice.",
    how: ["Keep pressure on the string the whole way.", "Stop exactly on the target fret.", "/ means slide up, \\ means slide down."],
    lick: lick({ id: "t-slide", title: "Slide", sub: "C slides up to D, then E with vibrato.", bpm: 84, specs: [N(3, 5, 0, 0.5), N(3, 7, 0.5, 1.5, "slide"), N(2, 5, 2, 2, "vib")] }) },
  { id: "hammer", name: "Hammer-on", symbol: "5h7",
    what: "Pick a note, then slam another finger down on a higher fret. The second note sounds without picking.",
    how: ["Hit with the fingertip, close to the fret wire.", "Keep the first finger down.", "Great for fast, smooth runs."],
    lick: lick({ id: "t-hammer", title: "Hammer-on", sub: "Two hammer-ons up the box.", bpm: 84, specs: [N(4, 5, 0, 0.5), N(4, 7, 0.5, 0.5, "h"), N(3, 5, 1, 0.5), N(3, 7, 1.5, 1.5, "h")] }) },
  { id: "pull", name: "Pull-off", symbol: "8p5",
    what: "The opposite of a hammer-on. With both fingers down, flick the higher one off sideways so the lower note sounds.",
    how: ["Put the lower finger in place first.", "Pull slightly down across the string, not straight up.", "Pairs well with hammer-ons: 5h7p5."],
    lick: lick({ id: "t-pull", title: "Pull-off", sub: "Two pull-offs on the top strings.", bpm: 84, specs: [N(1, 8, 0, 0.5), N(1, 5, 0.5, 0.5, "p"), N(2, 8, 1, 0.5), N(2, 5, 1.5, 1.5, "p")] }) },
  { id: "bend", name: "Bend", symbol: "7b9",
    what: "Push the string across the fretboard to raise its pitch. A full bend lands on the note two frets higher; a half bend on the next fret.",
    how: ["Use two or three fingers behind the bending finger.", "Push from the wrist, not just the finger.", "Check the target: play fret 9 first, then bend 7 up to match it."],
    lick: lick({ id: "t-bend", title: "Bend", sub: "D bent up a whole step to E, then high A.", bpm: 80, specs: [N(3, 7, 0, 2, "bend", { bend: 2 }), N(1, 5, 2, 2, "vib")] }) },
  { id: "release", name: "Bend and release", symbol: "8b10r8",
    what: "Bend up, then let the string come back down to the starting note while it still rings. Sounds like a sigh.",
    how: ["Pick once; the whole move happens on one pick.", "Release slowly and in time.", "↺ in the diagram means up and back."],
    lick: lick({ id: "t-release", title: "Bend and release", sub: "G up to A and back.", bpm: 80, specs: [N(2, 8, 0, 2, "br", { bend: 2 }), N(2, 5, 2, 0.5), N(3, 7, 2.5, 1.5, "vib")] }) },
  { id: "vibrato", name: "Vibrato", symbol: "5~",
    what: "Wobble the pitch slightly while a note rings. It turns a plain note into a sung one. Listen to the second A.",
    how: ["Small, even bends back and forth, from the wrist.", "Keep it in time with the song.", "Add it to the last note of a phrase."],
    lick: lick({ id: "t-vibrato", title: "Vibrato", sub: "A plain, then A with vibrato.", bpm: 80, specs: [N(1, 5, 0, 2), N(1, 5, 2, 3, "vib")] }) },
  { id: "double-stop", name: "Double stops", symbol: "5+5",
    what: "Two notes at once on neighbouring strings. Fuller than a single note, lighter than a chord. A classic rock and blues sound.",
    how: ["Flatten one finger across two strings, or use two fingers.", "Pick both strings in one stroke.", "Mute the strings you aren't playing."],
    lick: lick({ id: "t-double", title: "Double stops", sub: "E+A, G+C, E+A.", bpm: 84, specs: [N(2, 5, 0, 1), N(1, 5, 0, 1), N(2, 8, 1, 1), N(1, 8, 1, 1), N(2, 5, 2, 2), N(1, 5, 2, 2, "vib")] }) },
  { id: "space", name: "Space", symbol: "rest",
    what: "Silence is a technique. A short phrase followed by a rest gives the listener time to hear it, and gives your next phrase something to answer.",
    how: ["Count the rests like notes.", "Try two bars of playing, two bars of silence.", "Never fill every beat."],
    lick: lick({ id: "t-space", title: "Space", sub: "Phrase, a bar of rest, an answer.", bpm: 92, backing: [["Am", 4], ["Am", 4]],
      specs: [N(4, 7, 0, 0.5), N(3, 5, 0.5, 0.5), N(3, 7, 1, 1, "vib"), N(3, 7, 4, 0.5), N(3, 5, 4.5, 0.5), N(4, 7, 5, 2, "vib")] }) },
];

export const LICKS: Lick[] = [
  lick({ id: "call", title: "The call", tags: ["Phrasing", "Rock"], sub: "Rises with hammer-ons and stops on D, a question.", backing: [["Am", 4]],
    specs: [N(5, 5, 0, 0.5), N(5, 7, 0.5, 0.5, "h"), N(4, 5, 1, 0.5), N(4, 7, 1.5, 0.5, "h"), N(3, 5, 2, 0.5), N(3, 7, 2.5, 1.5, "h")] }),
  lick({ id: "answer", title: "The answer", tags: ["Phrasing", "Resolve"], sub: "Bends D up to E, then walks down to the root, A.", backing: [["Am", 4]],
    specs: [N(3, 7, 0, 1, "bend", { bend: 2, vib: false }), N(2, 5, 1, 0.5), N(3, 7, 1.5, 0.5), N(3, 5, 2, 0.5), N(4, 7, 2.5, 1.5, "vib")] }),
  lick({ id: "blue-curl", title: "Blue curl", tags: ["Blues"], sub: "A half bend on C nudges the minor 3rd towards major.", backing: [["A7", 4]], style: "shuffle", mode: "blues",
    specs: [N(2, 8, 0, 1, "bend", { bend: 1, vib: false }), N(2, 5, 1, 0.5), N(3, 7, 1.5, 0.5), N(3, 5, 2, 0.5), N(4, 7, 2.5, 1.5, "vib")] }),
  lick({ id: "blue-note", title: "Through the blue note", tags: ["Blues", "Legato"], sub: "Hammer up through E♭ (the ♭5) and pull back down.", backing: [["A7", 4]], style: "shuffle", mode: "blues",
    specs: [N(3, 5, 0, 0.5), N(3, 7, 0.5, 0.5, "h"), N(3, 8, 1, 0.5, "h"), N(3, 7, 1.5, 0.5, "p"), N(3, 5, 2, 0.5, "p"), N(4, 7, 2.5, 1.5, "vib")] }),
  lick({ id: "stabs", title: "Double-stop stabs", tags: ["Rock", "Rhythm"], sub: "Short, punchy pairs on the top two strings.", backing: [["Am", 4]],
    specs: [N(2, 5, 0, 0.5), N(1, 5, 0, 0.5), N(2, 5, 0.75, 0.5), N(1, 5, 0.75, 0.5), N(2, 8, 1.5, 1), N(1, 8, 1.5, 1), N(2, 5, 2.5, 1.5), N(1, 5, 2.5, 1.5, "vib")] }),
  lick({ id: "climb", title: "Climb to the peak", tags: ["Build-up"], sub: "Up the box in eighths, ending on a held bend.", backing: [["F", 4]],
    specs: [N(4, 7, 0, 0.5), N(3, 5, 0.5, 0.5), N(3, 7, 1, 0.5), N(2, 5, 1.5, 0.5), N(2, 8, 2, 0.5), N(1, 5, 2.5, 0.5), N(1, 8, 3, 1, "bend", { bend: 2 })] }),
  lick({ id: "cascade", title: "Cascade home", tags: ["Resolve", "Legato"], sub: "Pull-offs down three strings to the root.", backing: [["Am", 4]],
    specs: [N(1, 8, 0, 0.5), N(1, 5, 0.5, 0.5, "p"), N(2, 8, 1, 0.5), N(2, 5, 1.5, 0.5, "p"), N(3, 7, 2, 0.5), N(3, 5, 2.5, 0.5, "p"), N(4, 7, 3, 1, "vib")] }),
  lick({ id: "major", title: "Same box, major sound", tags: ["Pop", "Major"], sub: "Over C, these notes are C major pentatonic. End on C.", backing: [["C", 4]], style: "pop", root: "C", mode: "major-pentatonic", box: 5,
    specs: [N(3, 5, 0, 0.5), N(3, 7, 0.5, 1, "slide"), N(2, 5, 1.5, 0.5), N(2, 8, 2, 0.5), N(1, 5, 2.5, 0.5), N(1, 8, 3, 1, "vib")] }),
];

export const BOX_RUN: Lick = lick({
  id: "box1", title: "Box 1, up and down", sub: "Two notes per string, one finger per fret.", bpm: 104,
  specs: (() => {
    const up: [number, number][] = [[6, 5], [6, 8], [5, 5], [5, 7], [4, 5], [4, 7], [3, 5], [3, 7], [2, 5], [2, 8], [1, 5], [1, 8]];
    const seq = [...up, ...up.slice(0, -1).reverse()];
    return seq.map(([s, f], i) => N(s, f, i * 0.5, i === seq.length - 1 ? 1.5 : 0.5));
  })(),
});

/* -------------------------------------------------- chord-tone targeting */

export const TARGET_PROGRESSION: [string, number][] = [["Am", 4], ["G", 4], ["F", 4], ["G", 4]];
export const TARGET_CHORDS = ["Am", "G", "F"];
export const TARGET_TEXT: Record<string, string> = {
  Am: "All three are in the box. A, the root, is the strongest.",
  G: "B is outside the pentatonic (dashed), so aim for G or D.",
  F: "F itself isn't in the pentatonic (dashed), but A and C are right there in the box.",
};
export const TARGETING: Lick = lick({
  id: "targeting", title: "Targeting", sub: "Every bar starts on a note of its chord.", bpm: 92, backing: TARGET_PROGRESSION,
  specs: [N(4, 7, 0, 1.5), N(3, 5, 1.5, 0.5), N(3, 7, 2, 1), N(2, 5, 3, 1), N(2, 8, 4, 1.5), N(2, 5, 5.5, 0.5), N(3, 7, 6, 2, "vib"),
    N(3, 5, 8, 1.5), N(3, 7, 9.5, 0.5, "h"), N(4, 7, 10, 2, "vib"), N(4, 5, 12, 1), N(4, 7, 13, 0.5, "h"), N(3, 5, 13.5, 0.5), N(3, 7, 14, 2, "vib")],
});
export const WANDERING: Lick = lick({
  id: "wandering", title: "Wandering", sub: "Same box, but bars start on notes outside the chord.", bpm: 92, backing: TARGET_PROGRESSION,
  specs: [N(3, 7, 0, 1.5), N(3, 5, 1.5, 0.5), N(4, 7, 2, 1), N(4, 5, 3, 1), N(3, 5, 4, 2), N(2, 5, 6, 1), N(3, 7, 7, 1),
    N(2, 5, 8, 2), N(2, 8, 10, 1), N(3, 7, 11, 1), N(1, 5, 12, 2), N(2, 8, 14, 2, "vib")],
});

/* ------------------------------------------------------------- full solo */

export const SOLO: Lick = lick({
  id: "solo", title: "Full solo", sub: "Nine bars over Am – G – F – G.", bpm: 88, box: 0, compact: true,
  backing: [["Am", 4], ["G", 4], ["F", 4], ["G", 4], ["Am", 4], ["G", 4], ["F", 4], ["G", 4], ["Am", 4]],
  specs: [
    N(4, 7, 0, 1, "vib"), N(3, 5, 1.5, 0.5), N(3, 7, 2, 1, "h"), N(2, 5, 3, 1),
    N(2, 8, 4, 1, "vib"), N(2, 5, 5, 0.5), N(3, 7, 5.5, 1.5),
    N(3, 5, 8, 1, "vib"), N(3, 7, 9, 0.5, "h"), N(3, 5, 9.5, 0.5, "p"), N(4, 7, 10, 2, "vib"),
    N(4, 5, 12, 0.5), N(4, 7, 12.5, 0.5, "h"), N(3, 5, 13, 0.5), N(3, 7, 13.5, 2.5, "bend", { bend: 2 }),
    N(1, 5, 16, 1.5, "vib"), N(1, 8, 17.5, 0.5), N(1, 5, 18, 0.5, "p"), N(2, 8, 18.5, 0.5), N(2, 5, 19, 1),
    N(2, 8, 20, 2, "br", { bend: 2 }), N(2, 5, 22, 0.5), N(3, 7, 22.5, 1.5, "vib"),
    N(2, 6, 24, 1), N(1, 8, 24, 1), N(2, 5, 25, 1), N(1, 5, 25, 1), N(1, 8, 26, 2, "bend", { bend: 2 }),
    N(2, 8, 28, 0.5), N(2, 5, 28.5, 0.5, "p"), N(3, 7, 29, 0.5), N(3, 5, 29.5, 0.5, "p"), N(4, 7, 30, 0.5), N(4, 5, 30.5, 1.5, "p"),
    N(4, 7, 32, 4, "vib"),
  ],
});
export const SOLO_SECTIONS: [startBar: number, bars: number, label: string][] = [
  [0, 2, "Call: low and simple"], [2, 2, "Answer, then tension into bar 5"], [4, 3, "Climb an octave, peak with a bend"], [7, 2, "Cascade home to A"],
];
export const SOLO_NOTES: [title: string, text: string][] = [
  ["Bars 1–2", "Short phrase, a rest, then an answer that lands on G over the G chord."],
  ["Bars 3–4", "Hammer-on and pull-off on C, then a bend into the next Am. Tension before the loop."],
  ["Bars 5–7", "Same box an octave higher. Bend-release on G, double stops over F, a held peak bend."],
  ["Bars 8–9", "Pull-offs down the box, G leads up a step to the root A with vibrato."],
];

/* ------------------------------------------------- plan, scales, jam */

export type PlanAction =
  | { kind: "play"; label: string; lickId: string }
  | { kind: "playSequence"; label: string; lickIds: string[] }
  | { kind: "map"; label: string; root: ScaleRoot; mode: ScaleMode; box: number; lickId?: string }
  | { kind: "jump"; label: string; anchor: string };
export const PLAN: { title: string; text: string; actions: PlanAction[] }[] = [
  { title: "Find the key and pick the scale", text: "Find the song's home note (the ear guide shows how). In a minor key, or for rock and blues, use the minor pentatonic from that note. A major-key song? Use the minor pentatonic 3 frets lower and it becomes major pentatonic.",
    actions: [{ kind: "map", label: "Show A minor pentatonic", root: "A", mode: "minor-pentatonic", box: 0 }] },
  { title: "Learn one box first", text: "Box 1 sits under four fingers with two notes per string. For A it starts at fret 5. Learn it up and down before you move anywhere else on the neck.",
    actions: [{ kind: "play", label: "Hear box 1", lickId: "box1" }, { kind: "map", label: "Show box 1", root: "A", mode: "minor-pentatonic", box: 1, lickId: "box1" }] },
  { title: "Land on chord tones", text: "When the chord changes, land on one of its notes on beat 1. Everything in between can move freely.",
    actions: [{ kind: "jump", label: "Try it below", anchor: "#target" }] },
  { title: "Phrase like a singer", text: "Play a short phrase, then leave space. Ask a question (end away from the root), then answer it (end on the root).",
    actions: [{ kind: "playSequence", label: "Hear call and answer", lickIds: ["call", "answer"] }] },
  { title: "Add expression", text: "Slides, hammer-ons, pull-offs, bends and vibrato change how notes start, move and end. One or two per phrase is plenty.",
    actions: [{ kind: "jump", label: "See the techniques", anchor: "#techniques" }] },
  { title: "Shape the whole solo", text: "Start low and simple, climb as it goes on, hit a peak (often a high bend), then come back down and end on the root.",
    actions: [{ kind: "play", label: "Hear the full solo", lickId: "solo" }, { kind: "map", label: "Follow on fretboard", root: "A", mode: "minor-pentatonic", box: 0, lickId: "solo" }] },
];

export const SCALE_CHOICES: { song: string; use: string; example: string; root: ScaleRoot; mode: ScaleMode; box: number; chords: string[] }[] = [
  { song: "Rock or pop in a minor key", use: "Minor pentatonic from the key note", example: "Am – G – F – G → A minor pentatonic", root: "A", mode: "minor-pentatonic", box: 1, chords: ["Am", "G", "F"] },
  { song: "Blues: 12 bars, 7th chords", use: "Blues scale from the I chord", example: "A7 – D7 – E7 → A blues", root: "A", mode: "blues", box: 1, chords: ["A7", "D7", "E7"] },
  { song: "Pop or country in a major key", use: "Major pentatonic from the key note", example: "C – G – Am – F → C major pentatonic", root: "C", mode: "major-pentatonic", box: 1, chords: ["C", "G", "Am", "F"] },
  { song: "Minor key, and you want more notes", use: "Natural minor (adds 2 and ♭6)", example: "Am – F – G → A minor", root: "A", mode: "minor", box: 0, chords: ["Am", "F", "G"] },
  { song: "Funky or jazzy minor (i – IV major)", use: "Dorian (natural minor with a major 6)", example: "Am – D → A Dorian", root: "A", mode: "dorian", box: 0, chords: ["Am", "D"] },
  { song: "Rock with a ♭VII chord (I – ♭VII – IV)", use: "Mixolydian (major with a ♭7)", example: "A – G – D → A Mixolydian", root: "A", mode: "mixolydian", box: 0, chords: ["G", "D"] },
];

export interface JamTrack { id: string; name: string; description: string; bars: string[]; style: BackingStyle; bpm: number; root: ScaleRoot; mode: ScaleMode; box: number }
export const JAM_TRACKS: JamTrack[] = [
  { id: "rock", name: "Rock in A minor", description: "Am – G – F – G · minor pentatonic", bars: ["Am", "G", "F", "G"], style: "rock", bpm: 92, root: "A", mode: "minor-pentatonic", box: 1 },
  { id: "blues", name: "12-bar blues in A", description: "A7 D7 E7 shuffle · blues scale", bars: ["A7", "A7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "E7"], style: "shuffle", bpm: 84, root: "A", mode: "blues", box: 1 },
  { id: "pop", name: "Pop in C", description: "C – G – Am – F · major pentatonic", bars: ["C", "G", "Am", "F"], style: "pop", bpm: 100, root: "C", mode: "major-pentatonic", box: 1 },
  { id: "em", name: "Minor groove in E", description: "Em – D – C – D · minor pentatonic", bars: ["Em", "D", "C", "D"], style: "rock", bpm: 96, root: "E", mode: "minor-pentatonic", box: 1 },
];
export const JAM_IDEAS = [
  "Use only three notes for a whole chorus. Make them interesting with rhythm.",
  "Play two bars, then rest for two. Answer your own phrase.",
  "Land on a ringed chord tone every time the chord changes.",
  "One bend per bar, no more.",
  "Leave a whole bar empty. Then come back higher.",
];
/** One loop of a jam track for the Theory player (loop it). Highlights: `b_<bar>` per bar and `beat_<0-3>` per beat. */
export function jamExample(track: JamTrack, bpm = track.bpm): TheoryExample {
  const events: TheoryEvent[] = [];
  const items: BlockItem[] = [];
  track.bars.forEach((c, i) => {
    const t = i * 4;
    events.push(...backingBar(c, track.style, t, 4, 1), { kind: "highlight", beat: t, beats: 4, velocity: 0, highlight: `b_${i}` });
    for (let x = 0; x < 4; x++) events.push({ kind: "highlight", beat: t + x, beats: 0.9, velocity: 0, highlight: `beat_${x}` });
    items.push({ beat: t, beats: 4, label: c, highlight: `b_${i}` });
  });
  const len = track.bars.length * 4;
  return { label: track.name, sub: track.description, bpm, lengthBeats: len, events, visual: { type: "blocks", lengthBeats: len, rows: [{ name: "Chords", items }] } };
}

/** Every lick by id (plan actions and deep links use these). */
export const LICKS_BY_ID: Record<string, Lick> = Object.fromEntries(
  [...TECHNIQUES.map((t) => t.lick), ...LICKS, BOX_RUN, TARGETING, WANDERING, SOLO].map((l) => [l.id, l]),
);
