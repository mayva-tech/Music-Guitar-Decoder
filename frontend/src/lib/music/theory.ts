// Note names, MIDI and frequency helpers. MIDI 60 = C4 (middle C).

export const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const NAME_TO_PC: Record<string, number> = {};
NOTE_NAMES_SHARP.forEach((n, i) => (NAME_TO_PC[n] = i));
NOTE_NAMES_FLAT.forEach((n, i) => (NAME_TO_PC[n] = i));

export function midiToName(midi: number, preferFlats = false): string {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new RangeError(`MIDI note out of range: ${midi}`);
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function nameToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`Invalid note name: ${name}`);
  const pc = NAME_TO_PC[m[1].toUpperCase() + m[2]];
  const midi = (parseInt(m[3], 10) + 1) * 12 + pc;
  if (midi < 0 || midi > 127) throw new RangeError(`Note out of range: ${name}`);
  return midi;
}

export function pitchClassName(midi: number, preferFlats = false): string {
  return (preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[((midi % 12) + 12) % 12];
}

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq: number, a4 = 440): number {
  if (freq <= 0) throw new RangeError("Frequency must be positive");
  return 69 + 12 * Math.log2(freq / a4);
}

/** Signed distance in cents from `midiFloat` to the target note. */
export function centsFrom(midiFloat: number, target: number): number {
  return (midiFloat - target) * 100;
}

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export function scalePcs(tonic: number, mode: "major" | "minor"): number[] {
  return (mode === "major" ? MAJOR_SCALE : MINOR_SCALE).map((s) => (tonic + s) % 12);
}

export function chordPcs(root: number, quality: string): number[] {
  const iv: Record<string, number[]> = { maj: [0, 4, 7], min: [0, 3, 7], "5": [0, 7], dim: [0, 3, 6], "7": [0, 4, 7, 10] };
  return (iv[quality] ?? iv.maj).map((i) => (root + i) % 12);
}

/** Triad quality implied by a roman numeral (power chords keep their harmonic function). */
export function triadQualityFromRoman(roman: string): "maj" | "min" {
  const core = roman.replace(/^b/, "");
  return core[0] === core[0].toLowerCase() ? "min" : "maj";
}

const DEGREE_WORDS: Record<string, string> = {
  R: "root", b2: "flat 2nd", "2": "2nd", b3: "flat 3rd", "3": "3rd", "4": "4th", b5: "flat 5th (the blue note)",
  "5": "5th", b6: "flat 6th", "6": "6th", b7: "flat 7th", "7": "7th",
};

/** "3" → "3rd" — how far a note sits above the chord's root. */
export function degreeWords(d: string): string {
  return DEGREE_WORDS[d] ?? d;
}

/** Chord tones (R, 3rds, 5) sound "inside" the chord; others add colour or tension. */
export function isChordTone(d: string, seventh = false): boolean {
  return ["R", "3", "b3", "5"].includes(d) || (seventh && d === "b7");
}
