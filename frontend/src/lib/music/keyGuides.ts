/** Plain-language key guides for the “From tune to chords” page. */

export type ChordQuality = "major" | "minor" | "dim";

export interface KeyChord {
  roman: string;
  name: string;
  quality: ChordQuality;
  /** Stacked notes (1–3–5). */
  notes: string[];
  /** One-word job in the song. */
  job: string;
}

export interface KeyPowerChord {
  symbol: string;
  /** Root + 5th. */
  notes: [string, string];
}

export interface KeyGuide {
  id: string;
  /** e.g. "C major" */
  name: string;
  home: string;
  /** Seven scale notes (no octave repeat). */
  scale: string[];
  chords: KeyChord[];
  powerChords: KeyPowerChord[];
  /** Short tune tip. */
  tip: string;
}

export const KEY_GUIDES: KeyGuide[] = [
  {
    id: "c-major",
    name: "C major",
    home: "C",
    scale: ["C", "D", "E", "F", "G", "A", "B"],
    tip: "No sharps or flats — the friendliest place to start.",
    chords: [
      { roman: "I", name: "C", quality: "major", notes: ["C", "E", "G"], job: "Home" },
      { roman: "ii", name: "Dm", quality: "minor", notes: ["D", "F", "A"], job: "Soft step" },
      { roman: "iii", name: "Em", quality: "minor", notes: ["E", "G", "B"], job: "Soft step" },
      { roman: "IV", name: "F", quality: "major", notes: ["F", "A", "C"], job: "Away" },
      { roman: "V", name: "G", quality: "major", notes: ["G", "B", "D"], job: "Tension" },
      { roman: "vi", name: "Am", quality: "minor", notes: ["A", "C", "E"], job: "Sad home" },
      { roman: "vii°", name: "Bdim", quality: "dim", notes: ["B", "D", "F"], job: "Unstable" },
    ],
    powerChords: [
      { symbol: "C5", notes: ["C", "G"] },
      { symbol: "D5", notes: ["D", "A"] },
      { symbol: "E5", notes: ["E", "B"] },
      { symbol: "F5", notes: ["F", "C"] },
      { symbol: "G5", notes: ["G", "D"] },
      { symbol: "A5", notes: ["A", "E"] },
    ],
  },
  {
    id: "d-major",
    name: "D major",
    home: "D",
    scale: ["D", "E", "F#", "G", "A", "B", "C#"],
    tip: "Same ladder shape as C — just start on D. Two sharps: F# and C#.",
    chords: [
      { roman: "I", name: "D", quality: "major", notes: ["D", "F#", "A"], job: "Home" },
      { roman: "ii", name: "Em", quality: "minor", notes: ["E", "G", "B"], job: "Soft step" },
      { roman: "iii", name: "F#m", quality: "minor", notes: ["F#", "A", "C#"], job: "Soft step" },
      { roman: "IV", name: "G", quality: "major", notes: ["G", "B", "D"], job: "Away" },
      { roman: "V", name: "A", quality: "major", notes: ["A", "C#", "E"], job: "Tension" },
      { roman: "vi", name: "Bm", quality: "minor", notes: ["B", "D", "F#"], job: "Sad home" },
      { roman: "vii°", name: "C#dim", quality: "dim", notes: ["C#", "E", "G"], job: "Unstable" },
    ],
    powerChords: [
      { symbol: "D5", notes: ["D", "A"] },
      { symbol: "E5", notes: ["E", "B"] },
      { symbol: "F#5", notes: ["F#", "C#"] },
      { symbol: "G5", notes: ["G", "D"] },
      { symbol: "A5", notes: ["A", "E"] },
      { symbol: "B5", notes: ["B", "F#"] },
    ],
  },
  {
    id: "g-major",
    name: "G major",
    home: "G",
    scale: ["G", "A", "B", "C", "D", "E", "F#"],
    tip: "One sharp (F#). Common on guitar — open G, C, D, Em sit under the fingers.",
    chords: [
      { roman: "I", name: "G", quality: "major", notes: ["G", "B", "D"], job: "Home" },
      { roman: "ii", name: "Am", quality: "minor", notes: ["A", "C", "E"], job: "Soft step" },
      { roman: "iii", name: "Bm", quality: "minor", notes: ["B", "D", "F#"], job: "Soft step" },
      { roman: "IV", name: "C", quality: "major", notes: ["C", "E", "G"], job: "Away" },
      { roman: "V", name: "D", quality: "major", notes: ["D", "F#", "A"], job: "Tension" },
      { roman: "vi", name: "Em", quality: "minor", notes: ["E", "G", "B"], job: "Sad home" },
      { roman: "vii°", name: "F#dim", quality: "dim", notes: ["F#", "A", "C"], job: "Unstable" },
    ],
    powerChords: [
      { symbol: "G5", notes: ["G", "D"] },
      { symbol: "A5", notes: ["A", "E"] },
      { symbol: "B5", notes: ["B", "F#"] },
      { symbol: "C5", notes: ["C", "G"] },
      { symbol: "D5", notes: ["D", "A"] },
      { symbol: "E5", notes: ["E", "B"] },
    ],
  },
];

export function keyGuideById(id: string): KeyGuide | undefined {
  return KEY_GUIDES.find((k) => k.id === id);
}
