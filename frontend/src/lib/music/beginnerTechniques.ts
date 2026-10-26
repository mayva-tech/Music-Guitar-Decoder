// Beginner corner on the home page: how to strum, pick and pluck.
// Pure data + one builder that turns an exercise into a TheoryExample for the Theory player.
import { STANDARD_TUNING } from "@/lib/music/guitar";
import type { TheoryEvent, TheoryExample } from "@/lib/theory/content";

export type BeginnerTab = "strum" | "pick" | "fingers";
export type Finger = "p" | "i" | "m" | "a";

/** One eighth-note slot of an exercise. Empty `strings` = a rest (the hand still moves). */
export interface Slot {
  /** Count shown under the slot: 1 + 2 + … */
  count: string;
  /** Big mark: D / U for strums, ⊓ / V for pick strokes, p i m a for fingers, "" for a rest. */
  mark: string;
  /** Strings that sound (1 = high e … 6 = low E). */
  strings: number[];
  /** Fret per string; missing = open. */
  frets?: Partial<Record<number, number>>;
  dir?: "down" | "up";
  finger?: Finger;
  /** Small text under the mark, e.g. "A1" (string + fret) or "G". */
  note?: string;
}

export interface BeginnerExercise {
  title: string;
  sub: string;
  bpm: number;
  slots: Slot[];
}

export interface BeginnerLesson {
  id: BeginnerTab;
  tab: string;
  title: string;
  summary: string;
  steps: string[];
  tip: string;
  /** Caption under the illustration. */
  caption: string;
  exercise: BeginnerExercise;
}

const COUNTS = ["1", "+", "2", "+", "3", "+", "4", "+"];
const LETTER: Record<number, string> = { 1: "e", 2: "B", 3: "G", 4: "D", 5: "A", 6: "E" };

/** Open G (320003) and C (x32010), as fret per string. */
export const G_CHORD: Record<number, number> = { 6: 3, 5: 2, 4: 0, 3: 0, 2: 0, 1: 3 };
export const C_CHORD: Record<number, number> = { 5: 3, 4: 2, 3: 0, 2: 1, 1: 0 };

/** Which strings each picking-hand finger covers in basic fingerstyle. */
export const FINGER_STRINGS: Record<Finger, number[]> = { p: [6, 5, 4], i: [3], m: [2], a: [1] };
export const FINGER_NAMES: Record<Finger, string> = { p: "thumb", i: "index", m: "middle", a: "ring" };

/* Strum: the classic D, D U, U D U pattern over G, two bars. */
const STRUM_BAR: Slot[] = ["D", "", "D", "U", "", "U", "D", "U"].map((mark, k) => {
  const down = mark === "D", up = mark === "U";
  return {
    count: COUNTS[k],
    mark,
    strings: down ? [6, 5, 4, 3, 2, 1] : up ? [1, 2, 3, 4] : [],
    frets: G_CHORD,
    dir: down ? "down" : up ? "up" : undefined,
  };
});

/* Pick: one finger per fret, alternate picking. Bar 1 on A then D, bar 2 on G then B. */
const PICK_SLOTS: Slot[] = [5, 4, 3, 2].flatMap((s) =>
  [1, 2, 3, 4].map((f) => ({ s, f })),
).map(({ s, f }, k) => ({
  count: COUNTS[k % 8],
  mark: k % 2 === 0 ? "⊓" : "V",
  strings: [s],
  frets: { [s]: f },
  dir: k % 2 === 0 ? "down" : "up",
  note: `${LETTER[s]}${f}`,
}));

/* Fingers: p i m a m i m i over C, then over G. */
const FINGER_ORDER: Finger[] = ["p", "i", "m", "a", "m", "i", "m", "i"];
const fingerBar = (chord: Record<number, number>, bass: number): Slot[] =>
  FINGER_ORDER.map((finger, k) => {
    const string = finger === "p" ? bass : FINGER_STRINGS[finger][0];
    return { count: COUNTS[k], mark: finger, strings: [string], frets: chord, finger, note: LETTER[string] };
  });

export const BEGINNER_LESSONS: BeginnerLesson[] = [
  {
    id: "strum",
    tab: "Strum",
    title: "Strum chords",
    summary: "Brush across the strings with a pick, or the side of your thumb, to play a whole chord at once.",
    steps: [
      "Hold the pick between your thumb pad and the side of your index finger. Leave about 2–3 mm of the tip showing.",
      "Strum over the sound hole, moving from the wrist like shaking water off your hand. Keep your elbow relaxed.",
      "Down strums (D) sweep from low E to high e. Up strums (U) only need the top three or four strings.",
      "Keep your hand moving down and up on every half beat, even when you skip the strings. That keeps the rhythm steady.",
    ],
    tip: "Loose grip, loose wrist. If the pick snags in the strings, hold it a little lighter and tilt it slightly.",
    caption: "Your view looking down at the guitar: low E is the string nearest your face.",
    exercise: { title: "D · D U · U D U", sub: "The most-used strumming pattern, on a G chord.", bpm: 80, slots: [...STRUM_BAR, ...STRUM_BAR] },
  },
  {
    id: "pick",
    tab: "Pick",
    title: "Pick single notes",
    summary: "Hit one string at a time with small, controlled pick strokes. This is how riffs and solos are played.",
    steps: [
      "Rest the side of your picking hand lightly on the bridge. It steadies your hand and quiets the strings you aren't playing.",
      "Use tiny movements: push the pick just through the string and stop. Big swings make you miss the next string.",
      "Alternate: down (⊓), then up (V), then down again. Down on the beat, up between beats.",
      "Start slowly and evenly. Speed comes from staying relaxed, not from pressing harder.",
    ],
    tip: "Angle the pick slightly, about 10–20 degrees, so it glides off the string instead of snagging.",
    caption: "⊓ = down stroke, V = up stroke. The side of your palm rests on the bridge.",
    exercise: { title: "One finger per fret", sub: "Frets 1–2–3–4 on the A, D, G and B strings, alternate picking.", bpm: 76, slots: PICK_SLOTS },
  },
  {
    id: "fingers",
    tab: "Fingers",
    title: "Pluck with your fingers",
    summary: "Fingerstyle: your thumb plays the bass strings and three fingers play the top strings, so bass and melody happen together.",
    steps: [
      "Thumb (p) takes the low strings: E, A and D. Index (i) plays G, middle (m) plays B, ring (a) plays high e.",
      "Rest each fingertip on its string before you play. Every finger has its own string, so it never has to search.",
      "The thumb pushes down through its string. The fingers pull up into your palm, like closing a loose fist.",
      "Let every note ring, and pluck one string at a time in a steady pattern.",
    ],
    tip: "p, i, m and a come from the Spanish names pulgar, índice, medio and anular. You'll see them in fingerstyle music.",
    caption: "Thumb on the bass strings, one finger per top string.",
    exercise: { title: "p i m a m i m i", sub: "A gentle arpeggio over C, then G.", bpm: 84, slots: [...fingerBar(C_CHORD, 5), ...fingerBar(G_CHORD, 6)] },
  },
];

/** Midi for a string in a slot (fretted or open). */
export function slotMidi(slot: Slot, string: number): number {
  return STANDARD_TUNING[string] + (slot.frets?.[string] ?? 0);
}

/**
 * Exercise → TheoryExample (eighth notes). Highlight ids:
 * `slot-<i>` pattern cell · `str-<n>` string in the illustration · `dir-down` / `dir-up` · `fin-<p|i|m|a>`.
 */
export function exerciseExample(ex: BeginnerExercise, speed = 1): TheoryExample {
  const events: TheoryEvent[] = [];
  const step = 0.5;
  ex.slots.forEach((slot, i) => {
    const beat = i * step;
    const hl = (id: string, beats = step) => events.push({ kind: "highlight", beat, beats, velocity: 0, highlight: id });
    hl(`slot-${i}`);
    if (!slot.strings.length) return;
    const isStrum = slot.strings.length > 1;
    // Down strums sound low → high, up strums high → low.
    const order = slot.dir === "up" ? [...slot.strings].sort((a, b) => a - b) : [...slot.strings].sort((a, b) => b - a);
    order.forEach((s, k) => {
      events.push({
        kind: "pluck",
        midi: slotMidi(slot, s),
        beat: beat + (isStrum ? k * 0.035 : 0),
        beats: isStrum ? 1.1 : slot.finger ? 1.5 : 0.48,
        velocity: isStrum ? (slot.dir === "up" ? 0.42 : 0.55) : 0.85,
        timbre: slot.finger ? "warm" : "normal",
      });
      hl(`str-${s}`, isStrum ? 0.35 : 0.45);
    });
    if (slot.dir) hl(`dir-${slot.dir}`, 0.4);
    if (slot.finger) hl(`fin-${slot.finger}`, 0.45);
  });
  const len = ex.slots.length * step;
  return {
    label: ex.title, sub: ex.sub, bpm: Math.round(ex.bpm * speed), lengthBeats: len, events,
    visual: { type: "blocks", lengthBeats: len, rows: [] },
  };
}
