/** Chord recipes as semitone steps from the root (1 box = 1 fret). */

export type ChordRecipeTone = { step: number; label: string; kind: "structure" | "third" };

export interface ChordRecipe {
  name: string;
  symbol: string;
  recipe: string;
  tones: ChordRecipeTone[];
}

export const CHROMATIC_FROM_C = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "C"] as const;

export const CHORD_RECIPES: ChordRecipe[] = [
  {
    name: "Major", symbol: "C", recipe: "R +4 +3 · happy",
    tones: [
      { step: 0, label: "R", kind: "structure" },
      { step: 4, label: "3", kind: "third" },
      { step: 7, label: "5", kind: "structure" },
    ],
  },
  {
    name: "Minor", symbol: "Cm", recipe: "R +3 +4 · sad",
    tones: [
      { step: 0, label: "R", kind: "structure" },
      { step: 3, label: "b3", kind: "third" },
      { step: 7, label: "5", kind: "structure" },
    ],
  },
  {
    name: "Power", symbol: "C5", recipe: "R +7 · neutral",
    tones: [
      { step: 0, label: "R", kind: "structure" },
      { step: 7, label: "5", kind: "structure" },
      { step: 12, label: "R", kind: "structure" },
    ],
  },
  {
    name: "Seventh", symbol: "C7", recipe: "major + b7 · bluesy",
    tones: [
      { step: 0, label: "R", kind: "structure" },
      { step: 4, label: "3", kind: "third" },
      { step: 7, label: "5", kind: "structure" },
      { step: 10, label: "b7", kind: "structure" },
    ],
  },
];
