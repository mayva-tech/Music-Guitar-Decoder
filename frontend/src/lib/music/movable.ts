/**
 * Solo in any key: one movable hand frame, its variations, and melodic arpeggios.
 *
 * The frame is a four-fret hand position anchored on the root: on the 6th or the 5th string,
 * under the index finger (minor frame) or the middle finger (major frame). One finger per fret,
 * one fret of stretch either side for seven-note scales. Slide the frame so the root sits on a
 * new fret and every shape, variation and arpeggio moves with it, so the same fingers work in
 * all twelve keys and over any chord.
 *
 * Arpeggio "devices" turn a chord's tones in the frame into short melodic lines (skips, turns,
 * approach notes, enclosures, passing tones, space) instead of running the arpeggio straight up
 * and down. Lines are voice-led: each bar starts on the chord tone nearest the last note played.
 *
 * Pure data and maths (no React, no audio). Notes use the app's PlayableNote format, so the
 * Theory player, LickTab and the highlight helpers work on them unchanged.
 *
 * Location: frontend/src/lib/music/movable.ts
 */
import { MAX_FRET, STANDARD_TUNING } from "./guitar";
import { NOTE_NAMES_FLAT, NOTE_NAMES_SHARP, midiToName } from "./theory";
import { parseChord, type ChordQuality, type ParsedChord } from "./chordSymbol";
import { voicingsFor } from "./backingSolo";
import { backingBar, SOLO_BASS, SOLO_VOICINGS, type BackingStyle, type ChordSound } from "./soloGuide";
import type { TheoryEvent } from "@/lib/theory/content";
import type { LeadSound } from "@/lib/theory/player";
import type { PlayableNote } from "@/lib/types";

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

/* ------------------------------------------------------------- spelling */

const FLAT_MAJOR = new Set([5, 10, 3, 8, 1]); // F B♭ E♭ A♭ D♭
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]); // d g c f b♭ e♭

/** Does this key use flats (B♭, E♭…) rather than sharps? */
export function usesFlats(tonic: number, minor: boolean): boolean {
  return (minor ? FLAT_MINOR : FLAT_MAJOR).has(mod12(tonic));
}
/** ASCII note name ("Bb", "F#"), as chord symbols are written. */
export function noteName(pc: number, flats: boolean): string {
  return (flats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[mod12(pc)]!;
}
/** "Bbm7b5" → "B♭m7♭5" for display. */
export function pretty(s: string): string {
  return s.replace(/([A-G])b/g, "$1♭").replace(/#/g, "♯").replace(/b5/g, "♭5");
}
/** Name of a key for the key picker: sharps or flats as that key is usually written. */
export function keyLabel(tonic: number, minor: boolean): string {
  return pretty(noteName(tonic, usesFlats(tonic, minor)));
}

/* ---------------------------------------------------------------- frame */

export type Family = "minor" | "major";
export type Anchor = 6 | 5;

export interface FamilyDef {
  label: string;
  /** Finger on the root: 1 = index, 2 = middle. */
  rootFinger: 1 | 2;
  /** Frame frets relative to the root fret (index finger on `lo`). */
  lo: number;
  hi: number;
  hint: string;
}

export const FAMILIES: Record<Family, FamilyDef> = {
  minor: {
    label: "Minor frame",
    rootFinger: 1,
    lo: 0,
    hi: 3,
    hint: "The frame covers the root fret and the three frets above it.",
  },
  major: {
    label: "Major frame",
    rootFinger: 2,
    lo: -1,
    hi: 2,
    hint: "The frame starts one fret below the root and covers four frets.",
  },
};

export interface Frame {
  tonic: number;
  family: Family;
  anchor: Anchor;
  /** Fret of the root on the anchor string. */
  rootFret: number;
  /** First and last fret of the four-fret frame (index finger on `lo`). */
  lo: number;
  hi: number;
  /** Pitch of the root on the anchor string. */
  rootMidi: number;
}

export function makeFrame(tonic: number, family: Family, anchor: Anchor, rootFret: number): Frame {
  const f = FAMILIES[family];
  return {
    tonic: mod12(tonic),
    family,
    anchor,
    rootFret,
    lo: rootFret + f.lo,
    hi: rootFret + f.hi,
    rootMidi: STANDARD_TUNING[anchor]! + rootFret,
  };
}

/** Every playable placement (the frame needs a fret of room below for an index stretch). */
export function frameChoices(tonic: number, family: Family, anchor: Anchor, maxFret = 17): Frame[] {
  const out: Frame[] = [];
  for (let r = mod12(tonic - STANDARD_TUNING[anchor]!); r <= maxFret; r += 12) {
    const fr = makeFrame(tonic, family, anchor, r);
    if (fr.lo >= 1 && fr.hi + 1 <= maxFret) out.push(fr);
  }
  return out;
}

/** The lowest playable placement: where you'd first learn the frame in this key. */
export function defaultFrame(tonic: number, family: Family, anchor: Anchor): Frame {
  return frameChoices(tonic, family, anchor)[0]!;
}

/** The placement (either anchor) whose first fret is closest to `nearLo`: the shortest hand move. */
export function nearestFrame(tonic: number, family: Family, nearLo: number, anchors: Anchor[] = [6, 5]): Frame {
  const all = anchors.flatMap((a) => frameChoices(tonic, family, a));
  return all.reduce((best, f) => (Math.abs(f.lo - nearLo) < Math.abs(best.lo - nearLo) ? f : best), all[0]!);
}

/* ------------------------------------------------------------- degrees */

const DEGREES = ["R", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];

/** Interval (0–11 semitones above the root) → degree name. `sharp4` writes 6 as ♯4 (Lydian). */
export function degreeLabel(iv: number, sharp4 = false): string {
  const i = mod12(iv);
  return i === 6 && sharp4 ? "♯4" : DEGREES[i]!;
}

/* ------------------------------------------------------------ placement */

export interface FrameNote {
  string: number;
  fret: number;
  midi: number;
  /** Semitones above the frame's tonic (0–11). */
  interval: number;
  /** 0 = open string, 1 = index … 4 = pinky. */
  finger: number;
  /** Played by reaching one fret outside the frame. */
  stretch: boolean;
}

const pcAt = (s: number, f: number) => mod12(STANDARD_TUNING[s]! + f);

/**
 * The notes of a scale (intervals above the frame's tonic) inside the frame. Every pitch appears
 * once: inside the four frets where possible, otherwise one fret outside (a stretch), choosing the
 * stretches that keep the hand narrowest. Fingers go one per fret and always rise along a string.
 */
export function placeInFrame(frame: Frame, intervals: readonly number[]): FrameNote[] {
  const pcs = new Set(intervals.map((i) => mod12(frame.tonic + i)));
  const base: { s: number; f: number; stretch: boolean }[] = [];
  for (let s = 6; s >= 1; s--) {
    for (let f = frame.lo; f <= frame.hi; f++) if (pcs.has(pcAt(s, f))) base.push({ s, f, stretch: false });
  }
  const placed = new Set(base.map((c) => STANDARD_TUNING[c.s]! + c.f));
  // Only fill gaps between the frame's lowest and highest notes: no extra notes hung off either end.
  const minM = Math.min(...placed);
  const maxM = Math.max(...placed);

  const build = (preferHigh: boolean) => {
    const cells = [...base];
    for (let m = minM; m <= maxM; m++) {
      if (!pcs.has(mod12(m)) || placed.has(m)) continue;
      const cands: { s: number; f: number; stretch: boolean }[] = [];
      for (let s = 6; s >= 1; s--) {
        const f = m - STANDARD_TUNING[s]!;
        if ((f === frame.hi + 1 || f === frame.lo - 1) && f >= 0 && f <= MAX_FRET) cands.push({ s, f, stretch: true });
      }
      if (!cands.length) continue;
      cands.sort((a, b) => (preferHigh ? b.f - a.f : a.f - b.f));
      cells.push(cands[0]!);
    }
    return cells;
  };
  const span = (cells: { f: number }[]) => Math.max(...cells.map((c) => c.f)) - Math.min(...cells.map((c) => c.f));
  const a = build(true);
  const b = build(false);
  const cells = span(b) < span(a) ? b : a;

  // Fingers: one per fret from the index on `lo`; stretches take the index (below) or pinky (above).
  const out: FrameNote[] = [];
  for (let s = 6; s >= 1; s--) {
    const row = cells.filter((c) => c.s === s).sort((x, y) => x.f - y.f);
    const fingers = row.map((c) =>
      c.f === 0 ? 0 : c.f < frame.lo ? 1 : c.f > frame.hi ? 4 : Math.min(4, Math.max(1, c.f - frame.lo + 1)),
    );
    for (let i = 1; i < row.length; i++) {
      if (fingers[i] !== 0 && fingers[i]! <= fingers[i - 1]!) fingers[i] = fingers[i - 1]! + 1;
    }
    for (let i = row.length - 1; i >= 0; i--) {
      if (fingers[i]! > 4) fingers[i] = 4;
      if (i < row.length - 1 && fingers[i] !== 0 && fingers[i]! >= fingers[i + 1]!) fingers[i] = fingers[i + 1]! - 1;
    }
    row.forEach((c, i) => {
      const midi = STANDARD_TUNING[s]! + c.f;
      out.push({ string: s, fret: c.f, midi, interval: mod12(midi - frame.tonic), finger: Math.max(0, fingers[i]!), stretch: c.stretch });
    });
  }
  return out.sort((x, y) => x.midi - y.midi);
}

/** Finger for any fret in or next to a frame (approach notes, passing notes). */
export function fingerFor(frame: Frame, fret: number): number {
  if (fret === 0) return 0;
  return Math.min(4, Math.max(1, fret - frame.lo + 1));
}

/* ----------------------------------------------------------- variations */

export interface Variation {
  id: string;
  family: Family;
  name: string;
  /** Semitones above the root. */
  intervals: number[];
  /** Notes this variation adds to the family's core pentatonic. */
  adds: number[];
  /** Chord quality to hear it over. */
  vamp: ChordQuality;
  useOver: string;
  text: string;
  /** Two-bar phrase showing its sound; see `compileMotif`. */
  motif: string;
  /** Write the ♭5 as ♯4. */
  sharp4?: boolean;
  /** Arpeggio (chord tones only) rather than a scale. */
  arpeggio?: boolean;
}

export const VARIATIONS: Variation[] = [
  {
    id: "minor-pent", family: "minor", name: "Minor pentatonic", intervals: [0, 3, 5, 7, 10], adds: [], vamp: "min",
    useOver: "Minor chords and keys, blues, rock",
    text: "The core frame: five notes, two per string, four frets. Nothing in it clashes with a minor chord.",
    motif: "5:.5 b7:.5 'R:1 b7:.5 5:.5 b3:1 | 4:.5 5:.5 b7:1 5:.5 b3:.5 R:1~",
  },
  {
    id: "blues", family: "minor", name: "Blues scale", intervals: [0, 3, 5, 6, 7, 10], adds: [6], vamp: "7",
    useOver: "Blues, dominant 7 and minor chords",
    text: "Add the ♭5 between 4 and 5. Pass through it on the way somewhere; don't stop on it.",
    motif: "R:.5 b3:.5 4:.5 b5:.5 5:1 b3:1 | b7:.5 5:.5 b5:.5 4:.5 b3:1 R:1~",
  },
  {
    id: "minor-add9", family: "minor", name: "Minor pentatonic + 2", intervals: [0, 2, 3, 5, 7, 10], adds: [2], vamp: "min",
    useOver: "Any minor chord",
    text: "Add the 2 (the 9th) one fret above or below the ♭3. Softer and more vocal; it fits every minor chord.",
    motif: "R:.5 2:.5 b3:1 5:.5 4:.5 b3:.5 2:.5 | 5:.5 b7:.5 'R:.5 '2:.5 'b3:2~",
  },
  {
    id: "dorian", family: "minor", name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10], adds: [2, 9], vamp: "m7",
    useOver: "m7 chords, funk, Latin rock, minor jams with a major IV chord",
    text: "Add the 2 and the major 6. A bright, hopeful minor; the 6 is the note to lean on.",
    motif: "R:.5 b3:.5 5:.5 6:1 5:.5 b3:1 | 'R:.5 b7:.5 6:1 4:.5 5:.5 6:1~",
  },
  {
    id: "aeolian", family: "minor", name: "Natural minor", intervals: [0, 2, 3, 5, 7, 8, 10], adds: [2, 8], vamp: "min",
    useOver: "Minor-key rock and pop (i – ♭VI – ♭VII)",
    text: "Add the 2 and the ♭6. Darker and sadder; the ♭6 wants to fall to the 5.",
    motif: "5:.5 b6:.5 5:1 b3:.5 4:.5 5:1 | b6:1 5:.5 b3:.5 4:.5 2:.5 R:1~",
  },
  {
    id: "harmonic", family: "minor", name: "Harmonic minor", intervals: [0, 2, 3, 5, 7, 8, 11], adds: [2, 8, 11], vamp: "min",
    useOver: "The V7 chord in a minor key (E7 in A minor)",
    text: "Natural minor with a raised 7th, a half step under the root. Over the V7 chord it pulls hard back home.",
    motif: "5:.5 b6:.5 7:1 'R:1 b6:.5 5:.5 | b3:.5 2:.5 b3:.5 5:.5 7:1 'R:1~",
  },
  {
    id: "m7-arp", family: "minor", name: "m7 arpeggio", intervals: [0, 3, 7, 10], adds: [], vamp: "m7", arpeggio: true,
    useOver: "m7 chords, or any minor chord when you want to sound sure",
    text: "Strip the frame back to R, ♭3, 5 and ♭7. These notes can't miss over the chord; play them out of order.",
    motif: "R:.5 5:.5 b3:.5 b7:.5 5:1 'b3:1 | 'R:.5 b7:.5 'b3:.5 5:.5 b7:2~",
  },
  {
    id: "major-pent", family: "major", name: "Major pentatonic", intervals: [0, 2, 4, 7, 9], adds: [], vamp: "maj",
    useOver: "Major chords and keys, country, pop",
    text: "The core major frame: the same five-note shape as the minor one, three frets lower with the root under the middle finger.",
    motif: "3:.5 5:.5 6:1 5:.5 3:.5 2:1 | 5:.5 6:.5 'R:1 6:.5 'R:.5 '2:1~",
  },
  {
    id: "major-blues", family: "major", name: "Major blues", intervals: [0, 2, 3, 4, 7, 9], adds: [3], vamp: "7",
    useOver: "Blues-rock, country, dominant 7 chords",
    text: "Add the ♭3 and hammer it into the 3. That little bend in the line is the whole sound.",
    motif: "R:.5 2:.5 b3:.5 h3:.5 5:1 3:1 | 6:.5 5:.5 b3:.5 h3:.5 R:2~",
  },
  {
    id: "ionian", family: "major", name: "Major scale", intervals: [0, 2, 4, 5, 7, 9, 11], adds: [5, 11], vamp: "maj",
    useOver: "Major keys, maj7 chords, ballads",
    text: "Add the 4 and the 7. Both pull: the 4 down to the 3, the 7 up to the root.",
    motif: "3:.5 4:.5 5:1 7:.5 'R:.5 5:1 | 6:.5 4:.5 3:.5 2:.5 3:2~",
  },
  {
    id: "mixolydian", family: "major", name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10], adds: [5, 10], vamp: "7",
    useOver: "Dominant 7 chords, blues-rock, jam bands",
    text: "Major scale with a ♭7. Over a 7 chord, R 3 5 ♭7 are all inside the frame.",
    motif: "R:.5 3:.5 5:.5 b7:1 6:.5 5:1 | 4:.5 3:.5 5:.5 b7:.5 'R:2~",
  },
  {
    id: "lydian", family: "major", name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11], adds: [6, 11], vamp: "maj7", sharp4: true,
    useOver: "maj7 chords, film and dreamy pop",
    text: "Major scale with a ♯4. It floats instead of pulling down to the 3.",
    motif: "R:.5 2:.5 3:.5 #4:1 5:.5 3:1 | 7:.5 5:.5 #4:.5 5:.5 3:2~",
  },
  {
    id: "dom7-arp", family: "major", name: "7 arpeggio", intervals: [0, 4, 7, 10], adds: [], vamp: "7", arpeggio: true,
    useOver: "Dominant 7 chords (blues, funk, the V chord)",
    text: "R, 3, 5 and ♭7 only. The 3 and ♭7 are the chord's identity; aim for them.",
    motif: "R:.5 5:.5 3:.5 b7:.5 5:1 'R:1 | '3:.5 'R:.5 b7:.5 5:.5 3:2~",
  },
  {
    id: "maj7-arp", family: "major", name: "maj7 arpeggio", intervals: [0, 4, 7, 11], adds: [], vamp: "maj7", arpeggio: true,
    useOver: "maj7 chords, soft pop and jazz ballads",
    text: "R, 3, 5 and 7. The 7 sits a half step under the root, so leap to it rather than walking.",
    motif: "R:.5 5:.5 3:.5 7:.5 5:1 'R:1 | '3:.5 7:.5 'R:.5 5:.5 7:2~",
  },
];

export const VARIATIONS_BY_ID: Record<string, Variation> = Object.fromEntries(VARIATIONS.map((v) => [v.id, v]));
export const variationsFor = (family: Family) => VARIATIONS.filter((v) => v.family === family);
export const coreVariation = (family: Family) => VARIATIONS_BY_ID[family === "minor" ? "minor-pent" : "major-pent"]!;

/* -------------------------------------------------------------- chords */

export const QUALITY_SUFFIX: Partial<Record<ChordQuality, string>> = {
  maj: "", min: "m", "7": "7", m7: "m7", maj7: "maj7", m7b5: "m7b5", "6": "6", m6: "m6", "9": "9", m9: "m9", "5": "5",
  sus2: "sus2", sus4: "sus4", "7sus4": "7sus4", dim: "dim", add9: "add9",
};
/** Qualities offered in the chord picker. */
export const PICK_QUALITIES: { id: ChordQuality; label: string }[] = [
  { id: "maj", label: "major" },
  { id: "min", label: "minor" },
  { id: "7", label: "7" },
  { id: "m7", label: "m7" },
  { id: "maj7", label: "maj7" },
  { id: "m7b5", label: "m7♭5" },
];

export function chordSymbol(rootPc: number, quality: ChordQuality, flats: boolean): string {
  return `${noteName(rootPc, flats)}${QUALITY_SUFFIX[quality] ?? ""}`;
}

/** Which frame a chord lives in: minor-type chords (with a ♭3) in the minor frame, the rest in the major frame. */
export function familyOf(quality: ChordQuality): Family {
  return ["min", "m7", "m6", "m9", "m7b5", "dim"].includes(quality) ? "minor" : "major";
}

/** Scales and arpeggios to try over a chord, best first, plus why. */
export const SUGGEST: Partial<Record<ChordQuality, { ids: string[]; why: string; extra?: number[] }>> = {
  maj: { ids: ["major-pent", "ionian", "lydian"], why: "Major pentatonic is safe; the major scale adds the 4 and 7 for colour." },
  min: { ids: ["minor-pent", "minor-add9", "aeolian", "dorian"], why: "Minor pentatonic is safe; add the 2, then choose ♭6 (darker) or 6 (brighter)." },
  "7": { ids: ["mixolydian", "dom7-arp", "major-blues"], why: "Mixolydian holds every chord tone, including the ♭7; major blues adds grit." },
  m7: { ids: ["dorian", "minor-pent", "m7-arp"], why: "Dorian is the classic m7 sound; minor pentatonic always works." },
  maj7: { ids: ["ionian", "lydian", "maj7-arp"], why: "Use the major scale or Lydian; the 7 is a chord tone here, so lean on it." },
  m7b5: { ids: ["m7-arp"], why: "Use the m7 arpeggio with its 5 lowered a half step (the ♭5 is ringed). Locrian is the matching scale.", extra: [6] },
};

/** Scale intervals (above the chord root) for passing notes over a chord on its own. */
export function chordScale(quality: ChordQuality): number[] {
  if (quality === "m7b5") return [0, 1, 3, 5, 6, 8, 10];
  const id = SUGGEST[quality]?.ids.find((i) => VARIATIONS_BY_ID[i]?.intervals.length === 7) ?? (familyOf(quality) === "minor" ? "aeolian" : "ionian");
  return VARIATIONS_BY_ID[id]!.intervals;
}

/** Bass note and strummed chord for any chord symbol (uses the solo tables when they have it). */
export function chordSound(symbol: string): ChordSound {
  if (SOLO_BASS[symbol] != null && SOLO_VOICINGS[symbol]) return { bass: SOLO_BASS[symbol]!, voicing: SOLO_VOICINGS[symbol]! };
  const c = parseChord(symbol);
  if (!c) return { bass: 45, voicing: [57, 64, 69] };
  const bass = 36 + c.root;
  const v = voicingsFor(symbol).find((x) => x.baseFret <= 8) ?? voicingsFor(symbol)[0];
  if (v) {
    const voicing = v.shape.frets.flatMap((f, i) => (f == null ? [] : [STANDARD_TUNING[6 - i]! + f]));
    if (voicing.length >= 3) return { bass, voicing };
  }
  const low = 48 + c.root;
  return { bass, voicing: c.pcs.map((pc) => low + mod12(pc - c.root)) };
}

/* -------------------------------------------------------------- motifs */

const NAMED: Record<string, number> = {
  R: 0, b2: 1, "2": 2, b3: 3, "3": 4, "4": 5, b5: 6, "#4": 6, "5": 7, b6: 8, "6": 9, b7: 10, "7": 11,
};
const MOTIF_TOKEN = /^(h)?('{0,2}|,)?(R|b2|2|b3|3|4|b5|#4|5|b6|6|b7|7)(~)?:([\d.]+)(~)?$/;

export interface Placed { notes: PlayableNote[]; roles: NoteRole[] }
export type NoteRole = "chord" | "scale" | "chromatic";

/**
 * A two-bar motif in degree names, placed in the frame. Tokens: `5:.5` = the 5th for half a beat,
 * `'R` = root an octave up (`''` two octaves, `,` one down), `h3` = hammer-on, `b7~` = vibrato,
 * `-:1` = rest, `|` = bar line (checked). Degrees are measured from the frame's root.
 */
export function compileMotif(id: string, text: string, frame: Frame, chordPcs: number[]): Placed {
  const notes: PlayableNote[] = [];
  const roles: NoteRole[] = [];
  let beat = 0;
  let prev: Pos | null = null;
  for (const tok of text.trim().split(/\s+/)) {
    if (tok === "|") {
      if (Math.abs(beat % 4) > 1e-9) throw new Error(`${id}: bar line at beat ${beat}`);
      continue;
    }
    if (tok.startsWith("-:")) { beat += Number(tok.slice(2)); continue; }
    const m = MOTIF_TOKEN.exec(tok);
    if (!m) throw new Error(`${id}: bad token "${tok}"`);
    const [, ham, oct, deg, vib1, durS, vib2] = m;
    const vib = vib1 ?? vib2;
    const octave = oct === "," ? -1 : (oct ?? "").length;
    const midi = frame.rootMidi + NAMED[deg!]! + 12 * octave;
    const pos = posFor(midi, frame, prev, ham ? prev?.string : undefined);
    if (!pos) throw new Error(`${id}: ${tok} has no place in the frame at fret ${frame.lo}`);
    const dur = Number(durS);
    const legato = !!ham && prev != null && prev.string === pos.string && pos.fret > prev.fret;
    notes.push(note(`${id}-${notes.length}`, pos, beat, dur, frame, legato ? "hammer_on" : null, !!vib));
    roles.push(chordPcs.includes(mod12(midi)) ? "chord" : "scale");
    prev = pos;
    beat += dur;
  }
  return { notes, roles };
}

/* --------------------------------------------------------- positioning */

interface Pos { string: number; fret: number; midi: number }

/**
 * Where to play a pitch near a frame: inside the four frets if possible, then one fret out,
 * then two; nearest to the previous note (or on `preferString`).
 */
export function posFor(midi: number, frame: Frame, prev: Pos | null, preferString?: number): Pos | null {
  for (const reach of [0, 1, 2]) {
    const cands: Pos[] = [];
    for (let s = 6; s >= 1; s--) {
      const f = midi - STANDARD_TUNING[s]!;
      if (f < 0 || f > MAX_FRET || f < frame.lo - reach || f > frame.hi + reach) continue;
      cands.push({ string: s, fret: f, midi });
    }
    if (!cands.length) continue;
    const cost = (c: Pos) =>
      (preferString != null && c.string !== preferString ? 10 : 0) +
      (prev ? Math.abs(c.string - prev.string) + 0.5 * Math.abs(c.fret - prev.fret) : 0);
    cands.sort((a, b) => cost(a) - cost(b) || b.string - a.string);
    return cands[0]!;
  }
  return null;
}

function note(
  id: string, p: Pos, beat: number, dur: number, frame: Frame,
  technique: PlayableNote["technique"] = null, vibrato = false,
): PlayableNote {
  return {
    id, midi: p.midi, name: midiToName(p.midi), start_beat: beat, duration_beats: dur,
    string: p.string, fret: p.fret, finger: fingerFor(frame, p.fret), source: "riff",
    technique, bend_semitones: null, slide_from_fret: null, vibrato,
  } as PlayableNote;
}

/* -------------------------------------------------------- arpeggio devices */

export type DeviceId = "robot" | "skip" | "roll" | "approach" | "enclose" | "passing" | "neighbor" | "space" | "guide";

/** One step of a device. `k` counts chord tones from the starting one (mirrored when the line goes down). */
type Op =
  | { t: "ct"; k: number; d: number }
  | { t: "app"; k: number; d: number } // a half step below the chord tone (above, going down)
  | { t: "over"; k: number; d: number } // the scale note above it (below, going down)
  | { t: "nb"; k: number; d: number } // the scale note below it (above, going down)
  | { t: "pass"; k: number; d: number } // a scale note between chord tone k and the next one
  | { t: "rest"; d: number }
  | { t: "guide"; d: number }
  | { t: "lead"; d: number };

export interface Device {
  id: DeviceId;
  name: string;
  /** One-line contour, in chord-tone numbers (1 = the chord tone you start on). */
  shape: string;
  idea: string;
  tips: string[];
  ops: Op[];
}

export const DEVICES: Device[] = [
  {
    id: "robot", name: "Straight up and down", shape: "1 2 3 4 5 4 3 2",
    idea: "The arpeggio in order, even eighths, up and back. Correct notes, but it sounds like an exercise: this is what the other ideas fix.",
    tips: ["Use it to learn where the chord tones are, then stop playing it this way."],
    ops: [0, 1, 2, 3, 4, 3, 2, 1].map((k) => ({ t: "ct" as const, k, d: 0.5 })),
  },
  {
    id: "skip", name: "Skip and turn back", shape: "1 ↗ 3 ↘ 2 ↗ 4 ↘ 3",
    idea: "Leap over the next chord tone, then step back to it. The line still climbs, but it zig-zags like a melody.",
    tips: ["Hold the first and last notes longer than the middle ones.", "Try it starting from the 3rd or 5th, not only the root."],
    ops: [{ t: "ct", k: 0, d: 1 }, { t: "ct", k: 2, d: 0.5 }, { t: "ct", k: 1, d: 0.5 }, { t: "ct", k: 3, d: 1 }, { t: "ct", k: 2, d: 1 }],
  },
  {
    id: "roll", name: "Rolling triads", shape: "1 2 3 ↘ 2 ↗ 3 4 5",
    idea: "Three chord tones up, one back, then on up from there. Each group of three is the chord in a new inversion, so the arpeggio rolls up the neck.",
    tips: ["Keep each group of three in one hand shape.", "Let the top note ring with vibrato."],
    ops: [{ t: "ct", k: 0, d: 0.5 }, { t: "ct", k: 1, d: 0.5 }, { t: "ct", k: 2, d: 0.5 }, { t: "ct", k: 1, d: 0.5 }, { t: "ct", k: 2, d: 0.5 }, { t: "ct", k: 3, d: 0.5 }, { t: "ct", k: 4, d: 1 }],
  },
  {
    id: "approach", name: "Half-step approach", shape: "1 · (fret below) 3 · (fret below) 2",
    idea: "Slip into chord tones from a fret below. The note in between is outside the key for an instant, which makes the landing sound deliberate.",
    tips: ["Play the approach note short and on the off-beat.", "Hammer on from the approach note when it's on the same string."],
    ops: [{ t: "ct", k: 0, d: 1 }, { t: "app", k: 2, d: 0.5 }, { t: "ct", k: 2, d: 1 }, { t: "app", k: 1, d: 0.5 }, { t: "ct", k: 1, d: 1 }],
  },
  {
    id: "enclose", name: "Enclosure", shape: "1 · (above, below) 3",
    idea: "Surround the target: the scale note above it, a half step below it, then the target itself. Jazz players and blues players both use this to land on the 3rd.",
    tips: ["Aim the target for a strong beat.", "Works best on the 3rd or 7th of the chord."],
    ops: [{ t: "ct", k: 0, d: 1 }, { t: "over", k: 2, d: 0.5 }, { t: "app", k: 2, d: 0.5 }, { t: "ct", k: 2, d: 2 }],
  },
  {
    id: "passing", name: "Passing notes", shape: "1 (p) 2 ↗ 4 (p) 3",
    idea: "Fill the gap between two chord tones with a scale note, leap, then fill on the way down. Chord tones fall on the beats; scale notes go in between.",
    tips: ["Passing notes are short; chord tones are where you rest.", "The scale is the frame's: change variation to change the colour."],
    ops: [{ t: "ct", k: 0, d: 0.5 }, { t: "pass", k: 0, d: 0.5 }, { t: "ct", k: 1, d: 1 }, { t: "ct", k: 3, d: 0.5 }, { t: "pass", k: 2, d: 0.5 }, { t: "ct", k: 2, d: 1 }],
  },
  {
    id: "neighbor", name: "Neighbour-note sequence", shape: "1 (n) 2 (n) 3 (n) 4",
    idea: "Same little cell on each chord tone: play it, dip to the scale note below, jump to the next chord tone. Repeating a cell is what makes a line sound composed.",
    tips: ["Accent the chord tones, play the dips lightly.", "Reverse it going down: the dip becomes a note above."],
    ops: [{ t: "ct", k: 0, d: 0.5 }, { t: "nb", k: 0, d: 0.5 }, { t: "ct", k: 1, d: 0.5 }, { t: "nb", k: 1, d: 0.5 }, { t: "ct", k: 2, d: 0.5 }, { t: "nb", k: 2, d: 0.5 }, { t: "ct", k: 3, d: 1 }],
  },
  {
    id: "space", name: "Call and answer", shape: "3 2 4 · rest · (step above) 1",
    idea: "A short call, a breath, then an answer that leans on the note above the starting chord tone and settles onto it. The rest is part of the phrase.",
    tips: ["Count the rest; don't fill it.", "Answer from a scale step above, so the last note sounds like it resolves."],
    ops: [{ t: "ct", k: 2, d: 0.5 }, { t: "ct", k: 1, d: 0.5 }, { t: "ct", k: 3, d: 1 }, { t: "rest", d: 1 }, { t: "over", k: 0, d: 0.5 }, { t: "ct", k: 0, d: 0.5 }],
  },
  {
    id: "guide", name: "Guide tones", shape: "3rd or 7th, held · step to the next chord",
    idea: "Hold the chord's 3rd or 7th, then step toward the nearest 3rd or 7th of the next chord. Two notes a bar, and you can hear every chord change.",
    tips: ["This is the skeleton under a jazz or soul solo: decorate it later.", "Over one chord it moves between the 3rd and the 7th."],
    ops: [{ t: "guide", d: 3 }, { t: "lead", d: 1 }],
  },
];
export const DEVICES_BY_ID: Record<DeviceId, Device> = Object.fromEntries(DEVICES.map((d) => [d.id, d])) as Record<DeviceId, Device>;
/** The melodic devices (everything but the straight-up-and-down reference). */
export const MELODIC_DEVICES = DEVICES.filter((d) => d.id !== "robot");
/** "Mix" cycles these bar by bar. */
export const MIX: DeviceId[] = ["skip", "approach", "passing", "space", "enclose", "neighbor", "roll", "guide"];

/* ------------------------------------------------------------- lines */

export interface BarSpec {
  chord: string;
  frame: Frame;
}

export interface ArpLine {
  notes: PlayableNote[];
  roles: NoteRole[];
  /** Degree of each note against its bar's chord ("R", "3", "♭7"…). */
  degrees: string[];
  bars: (BarSpec & { device: DeviceId; startDegree: string })[];
}

const reflect = (i: number, n: number) => {
  if (n <= 1) return 0;
  const p = 2 * (n - 1);
  const m = ((i % p) + p) % p;
  return m < n ? m : p - m;
};

/** Chord tones of a chord inside a frame (one place per pitch), low to high. */
export function chordTonesIn(frame: Frame, chord: ParsedChord): FrameNote[] {
  return placeInFrame(frame, chord.pcs.map((pc) => mod12(pc - frame.tonic)));
}

function scaleStep(midi: number, dir: 1 | -1, scalePcs: Set<number>): number {
  for (let m = midi + dir; Math.abs(m - midi) <= 3; m += dir) if (scalePcs.has(mod12(m))) return m;
  return midi + dir;
}

/**
 * Turns chords into a melodic line, one bar each, voice-led: every bar starts on the chord tone
 * nearest the previous note and runs its device up or down, whichever has room in the frame.
 * `scale` is the pitch-class set used for passing and neighbour notes.
 */
export function arpeggioLine(
  bars: BarSpec[],
  devices: DeviceId[],
  scale: (bar: number) => number[],
  idPrefix = "arp",
): ArpLine {
  const notes: PlayableNote[] = [];
  const roles: NoteRole[] = [];
  const degrees: string[] = [];
  const outBars: ArpLine["bars"] = [];
  let prev: PlayableNote | null = null;

  bars.forEach((bar, b) => {
    const chord = parseChord(bar.chord);
    if (!chord) throw new Error(`Unknown chord ${bar.chord}`);
    const frame = bar.frame;
    const cts: Pos[] = chordTonesIn(frame, chord).map((n) => ({ string: n.string, fret: n.fret, midi: n.midi }));
    const scalePcs = new Set(scale(b).map(mod12));
    const device = DEVICES_BY_ID[devices[b % devices.length]!];
    const ref = prev?.midi ?? frame.rootMidi;
    const nearest = <T extends { midi: number }>(pool: T[], to: number) =>
      pool.reduce((best, c) => (Math.abs(c.midi - to) < Math.abs(best.midi - to) ? c : best), pool[0]!);
    const isGuide = (c: { midi: number }, ch: ParsedChord) => {
      const iv = mod12(c.midi - ch.root);
      return iv === ch.third || iv === ch.seventh || (ch.third == null && iv === ch.fifth);
    };

    // Voice leading: start on a chord tone close to the last note (within a fifth); the device then
    // runs up or down from there. The nearest start wins unless it would carry on a run.
    const close = cts.filter((c) => Math.abs(c.midi - ref) <= 7);
    const starts = (close.length ? close : [nearest(cts, ref)]).map((c) => cts.indexOf(c));
    const i0Nearest = cts.indexOf(nearest(cts, ref));
    const maxK = Math.max(0, ...device.ops.map((o) => ("k" in o ? o.k : 0)));

    // Guide-tone targets.
    const guides = cts.filter((c) => isGuide(c, chord));
    const g = guides.length ? nearest(guides, ref) : cts[i0Nearest]!;
    const nextChord = parseChord(bars[(b + 1) % bars.length]!.chord) ?? chord;
    const nextFrame = bars[(b + 1) % bars.length]!.frame;
    const nextGuides = chordTonesIn(nextFrame, nextChord).filter((c) => isGuide(c, nextChord) && c.midi !== g.midi);
    const ng = nextGuides.length ? nearest(nextGuides, g.midi) : null;

    /** The bar with the device running up (+1) or down (-1) from the starting chord tone. */
    const render = (i0: number, sign: 1 | -1) => {
      const ct = (k: number) => cts[reflect(i0 + sign * k, cts.length)]!;
      const out: { note: PlayableNote; role: NoteRole; degree: string }[] = [];
      let beat = b * 4;
      let last: Pos | null = prev;
      let lastApproach: Pos | null = null;
      for (const op of device.ops) {
        if (op.t === "rest") { beat += op.d; lastApproach = null; continue; }
        let midi: number;
        let target: Pos | null = null;
        let role: NoteRole = "chord";
        if (op.t === "ct") {
          target = ct(op.k);
          midi = target.midi;
        } else if (op.t === "guide") {
          target = g;
          midi = g.midi;
        } else if (op.t === "lead") {
          midi = scaleStep(g.midi, ng ? (ng.midi >= g.midi ? 1 : -1) : 1, scalePcs);
          role = "scale";
        } else if (op.t === "app") {
          midi = ct(op.k).midi - sign;
          role = "chromatic";
        } else if (op.t === "over") {
          midi = scaleStep(ct(op.k).midi, sign, scalePcs);
          role = "scale";
        } else if (op.t === "nb") {
          midi = scaleStep(ct(op.k).midi, sign === 1 ? -1 : 1, scalePcs);
          role = "scale";
        } else {
          const a = ct(op.k).midi;
          const z = ct(op.k + 1).midi;
          const dir: 1 | -1 = z >= a ? 1 : -1;
          midi = scaleStep(a, dir, scalePcs);
          if ((dir === 1 && midi >= z) || (dir === -1 && midi <= z)) midi = a + dir;
          role = "scale";
        }
        const anchorFor = op.t === "app" ? ct(op.k) : null;
        let pos = target ?? posFor(midi, frame, anchorFor ?? last, anchorFor?.string);
        if (!pos && op.t !== "ct" && op.t !== "guide") {
          // Off the end of the neck (below open low E): take the same step from the other side.
          const pivot = op.t === "lead" ? g.midi : ct("k" in op ? op.k : 0).midi;
          midi = 2 * pivot - midi;
          pos = posFor(midi, frame, anchorFor ?? last, anchorFor?.string);
        }
        if (!pos) throw new Error(`${idPrefix}: no place for ${midi} near fret ${frame.lo}`);
        if (role !== "chromatic" && chord.pcs.includes(mod12(pos.midi))) role = "chord";
        else if (role === "chromatic" && scalePcs.has(mod12(pos.midi))) role = "scale";
        const legato: PlayableNote["technique"] =
          lastApproach && lastApproach.string === pos.string && lastApproach.fret !== pos.fret && Math.abs(lastApproach.fret - pos.fret) <= 2
            ? (pos.fret > lastApproach.fret ? "hammer_on" : "pull_off")
            : null;
        out.push({
          note: note(`${idPrefix}-${notes.length + out.length}`, pos, beat, op.d, frame, legato, op.d >= 1.5),
          role,
          degree: degreeLabel(mod12(pos.midi - chord.root)),
        });
        lastApproach = op.t === "app" || op.t === "over" ? pos : null;
        last = pos;
        beat += op.d;
      }
      return out;
    };

    // Try each start and direction that fits in the frame: never carry on a run from the bar before
    // (the line turns at the bar line instead), otherwise stay closest to the last note.
    const robot = device.id === "robot";
    const tryStarts = (from: number[]) => from.flatMap((i0) => {
      const fitsUp = i0 + maxK <= cts.length - 1;
      const fitsDown = i0 - maxK >= 0;
      return ([1, -1] as const)
        .filter((sg) => (sg === 1 ? fitsUp : fitsDown) || (!fitsUp && !fitsDown && sg === 1))
        .map((sg) => {
          const r = render(i0, sg);
          const run = longestRun([...notes.slice(-4), ...r.map((x) => x.note)]);
          const dist = Math.abs(cts[i0]!.midi - ref);
          // The straight up-and-down reference is played as it is: nearest start, upward when it fits.
          const score = robot ? dist * 2 + (sg === 1 ? 0 : 1) : (run > 3 ? 1000 : 0) + 2 * dist + run;
          return { r, score };
        });
    });
    let options = tryStarts(robot ? [i0Nearest] : starts);
    // Boxed in at the end of the frame: allow a leap to any chord tone rather than a run.
    if (!robot && options.every((o) => o.score >= 1000)) options = tryStarts(cts.map((_, i) => i));
    const best = options.reduce((a, o) => (o.score < a.score ? o : a), options[0]!).r;

    for (const x of best) {
      notes.push(x.note);
      roles.push(x.role);
      degrees.push(x.degree);
    }
    prev = best[best.length - 1]?.note ?? prev;
    outBars.push({ ...bar, device: device.id, startDegree: best[0]?.degree ?? "" });
  });
  return { notes, roles, degrees, bars: outBars };
}

/* --------------------------------------------------------- progressions */

export interface Progression {
  id: string;
  name: string;
  minor: boolean;
  /** [semitones above the key's tonic, quality], one chord per bar. */
  chords: [number, ChordQuality][];
  romans: string[];
  style: BackingStyle;
  bpm: number;
  text: string;
}

export const PROGRESSIONS: Progression[] = [
  { id: "pop", name: "Pop four", minor: false, chords: [[0, "maj"], [7, "maj"], [9, "min"], [5, "maj"]], romans: ["I", "V", "vi", "IV"], style: "pop", bpm: 92,
    text: "The most common progression in pop. Every chord is in the major key, so the major frame never has to move." },
  { id: "doowop", name: "Fifties", minor: false, chords: [[0, "maj"], [9, "min"], [5, "maj"], [7, "maj"]], romans: ["I", "vi", "IV", "V"], style: "pop", bpm: 84,
    text: "The same four chords in a different order: the V at the end pulls you back to the top." },
  { id: "blues", name: "Blues turn", minor: false, chords: [[0, "7"], [5, "7"], [0, "7"], [7, "7"]], romans: ["I7", "IV7", "I7", "V7"], style: "shuffle", bpm: 96,
    text: "Three dominant 7 chords. Watch the 3rd of each chord: it moves while the frame stays." },
  { id: "jazz", name: "ii – V – I", minor: false, chords: [[2, "m7"], [7, "7"], [0, "maj7"], [0, "maj7"]], romans: ["ii7", "V7", "Imaj7", "Imaj7"], style: "pop", bpm: 96,
    text: "The jazz cadence. Guide tones move by a half step or stay put from chord to chord: the smoothest line there is." },
  { id: "rock-minor", name: "Minor rock", minor: true, chords: [[0, "min"], [10, "maj"], [8, "maj"], [10, "maj"]], romans: ["i", "♭VII", "♭VI", "♭VII"], style: "rock", bpm: 96,
    text: "Natural minor's big rock move. All three chords sit in the minor frame." },
  { id: "minor-cadence", name: "Minor with V7", minor: true, chords: [[0, "min"], [5, "min"], [7, "7"], [0, "min"]], romans: ["i", "iv", "V7", "i"], style: "rock", bpm: 84,
    text: "The V7 brings a note from outside the key (its 3rd, the raised 7th). The frame finds it a fret away; that's harmonic minor." },
  { id: "minor-jazz", name: "Minor ii – V – i", minor: true, chords: [[2, "m7b5"], [7, "7"], [0, "m7"], [0, "m7"]], romans: ["iiø7", "V7", "im7", "im7"], style: "pop", bpm: 88,
    text: "A darker cadence: the m7♭5 and the V7 both lean on notes outside natural minor, then settle on im7." },
];
export const PROGRESSIONS_BY_ID: Record<string, Progression> = Object.fromEntries(PROGRESSIONS.map((p) => [p.id, p]));

export type FrameMode = "stay" | "follow";

export interface ProgressionPlan {
  key: string;
  bars: BarSpec[];
  /** Pitch classes of the key's scale (natural minor or major). */
  scale: number[];
}

/**
 * Chords and frames for a progression in a key. "stay" keeps the key's frame for every chord;
 * "follow" moves the frame to each chord's root, using whichever anchor string is closest.
 */
export function planProgression(prog: Progression, tonic: number, mode: FrameMode, anchor: Anchor): ProgressionPlan {
  const flats = usesFlats(tonic, prog.minor);
  const family: Family = prog.minor ? "minor" : "major";
  const keyFrame = defaultFrame(tonic, family, anchor);
  const scaleIv = prog.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  let prevLo = keyFrame.lo;
  const bars = prog.chords.map(([semis, q]) => {
    const root = mod12(tonic + semis);
    const chord = chordSymbol(root, q, flats);
    if (mode === "stay") return { chord, frame: keyFrame };
    const frame = nearestFrame(root, familyOf(q), prevLo);
    prevLo = frame.lo;
    return { chord, frame };
  });
  return {
    key: `${keyLabel(tonic, prog.minor)} ${prog.minor ? "minor" : "major"}`,
    bars,
    scale: scaleIv.map((i) => mod12(tonic + i)),
  };
}

/* ------------------------------------------------------------- sounds */

export interface SoundOptions {
  bpm: number;
  style: BackingStyle;
  /** One bar of clicks before the backing starts. */
  countIn?: boolean;
  /** Backing only, no lead line. */
  backingOnly?: boolean;
}

/**
 * One pass for the Theory player: backing for each bar, the lead line and silent highlights
 * (`n<i>` = note i, `b_<i>` = bar i, `count_<k>` = count-in click).
 */
export function lineSound(chords: string[], notes: PlayableNote[], opts: SoundOptions): LeadSound {
  const off = opts.countIn ? 4 : 0;
  const events: TheoryEvent[] = [];
  for (let k = 0; k < off; k++) {
    events.push({ kind: "click", beat: k, beats: 0.2, velocity: k === 0 ? 1 : 0.6 });
    events.push({ kind: "highlight", beat: k, beats: 0.8, velocity: 0, highlight: `count_${k}` });
  }
  chords.forEach((chord, b) => {
    const t = off + b * 4;
    events.push(...backingBar(chord, opts.style, t, 4, 0.75, chordSound(chord)));
    events.push({ kind: "highlight", beat: t, beats: 4, velocity: 0, highlight: `b_${b}` });
  });
  const lead = opts.backingOnly ? [] : notes.map((n) => ({ ...n, start_beat: n.start_beat + off }));
  lead.forEach((n, i) => events.push({ kind: "highlight", beat: n.start_beat, beats: n.duration_beats, velocity: 0, highlight: `n${i}` }));
  return { bpm: opts.bpm, lengthBeats: off + chords.length * 4, events, lead };
}

/**
 * The frame note by note, low string to high, for learning the shape (with a quiet vamp under it).
 */
export function frameWalk(frame: Frame, v: Variation, flats: boolean): { notes: PlayableNote[]; chords: string[] } {
  const ns = placeInFrame(frame, v.intervals);
  const notes = ns.map((n, i) => note(`walk-${i}`, n, i * 0.5, 0.5, frame));
  const bars = Math.max(1, Math.ceil((ns.length * 0.5) / 4));
  const chord = chordSymbol(frame.tonic, v.vamp, flats);
  return { notes, chords: Array.from({ length: bars }, () => chord) };
}

/**
 * Longest stretch of quick notes (under 1½ beats) moving the same way without a break: 4+ sounds
 * like a run or an exercise. Rests, repeated notes and long notes break a stretch.
 */
export function longestRun(notes: PlayableNote[]): number {
  let best = 0;
  let run = 0;
  let dir = 0;
  for (let i = 1; i < notes.length; i++) {
    const a = notes[i - 1]!;
    const b = notes[i]!;
    const touching = Math.abs(a.start_beat + a.duration_beats - b.start_beat) < 1e-6;
    const quick = a.duration_beats < 1.5 && b.duration_beats < 1.5;
    const d = Math.sign(b.midi - a.midi);
    if (!touching || !quick || d === 0) { run = 0; dir = 0; continue; }
    run = d === dir ? run + 1 : 1;
    dir = d;
    best = Math.max(best, run);
  }
  return best;
}

/** Root frets on the 6th and 5th strings for each of the 12 keys (the "where to put the frame" chart). */
export function rootChart(): { pc: number; low: number; a: number }[] {
  return Array.from({ length: 12 }, (_, pc) => ({
    pc,
    low: mod12(pc - STANDARD_TUNING[6]!),
    a: mod12(pc - STANDARD_TUNING[5]!),
  }));
}

/** Practice routine. */
export const ROUTINE: string[] = [
  "Learn the minor frame in one key: play it slowly and say the finger numbers out loud.",
  "Move it: pick three keys, find the root on the 6th string, drop the same fingers there.",
  "Switch the anchor: same key, root on the 5th string. Now you have two places for every key.",
  "Add one variation at a time, and play its phrase until you can hear what the new note does.",
  "Pick a chord, find its tones in the frame, play one arpeggio idea over it. Then another.",
  "Over a progression, stay in one frame and make each bar start on the nearest chord tone.",
];
