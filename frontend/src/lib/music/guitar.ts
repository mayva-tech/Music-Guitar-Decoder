// Guitar data model. String 1 = thinnest (high e), string 6 = thickest (low E).
// MIDI_NOTE = OPEN_STRING_MIDI + FRET_NUMBER. Views never change this data.
import { midiToName } from "./theory";

export const STANDARD_TUNING: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
export const STRING_LABELS: Record<number, string> = { 6: "E", 5: "A", 4: "D", 3: "G", 2: "B", 1: "e" };
export const STRINGS = [1, 2, 3, 4, 5, 6] as const;
export const MAX_FRET = 22;

export function midiAt(string: number, fret: number): number {
  if (!(string in STANDARD_TUNING)) throw new RangeError(`Invalid string: ${string}`);
  if (!Number.isInteger(fret) || fret < 0 || fret > MAX_FRET) throw new RangeError(`Invalid fret: ${fret}`);
  return STANDARD_TUNING[string] + fret;
}

export function positionsForMidi(midi: number, maxFret = MAX_FRET): { string: number; fret: number }[] {
  const out: { string: number; fret: number }[] = [];
  for (const s of STRINGS) {
    const f = midi - STANDARD_TUNING[s];
    if (f >= 0 && f <= maxFret) out.push({ string: s, fret: f });
  }
  return out;
}

export function positionMatches(n: { midi: number; string?: number | null; fret?: number | null }): boolean {
  if (n.string == null || n.fret == null) return false;
  return STANDARD_TUNING[n.string] + n.fret === n.midi;
}

export const FINGER_NAMES: Record<number, string> = {
  0: "no finger (open string)",
  1: "index finger",
  2: "middle finger",
  3: "ring finger",
  4: "pinky finger",
};

const STRING_WORDS: Record<number, string> = {
  1: "the thinnest string",
  2: "the second-thinnest string",
  3: "the third-thinnest string",
  4: "the third-thickest string",
  5: "the second-thickest string",
  6: "the thickest string",
};

export function stringWords(s: number): string {
  return STRING_WORDS[s];
}

const ORDINALS = ["open", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
  "nineteenth", "twentieth", "twenty-first", "twenty-second"];

export function fretWords(f: number): string {
  return ORDINALS[f] ?? `${f}th`;
}

export function noteLabel(midi: number): string {
  return midiToName(midi);
}
