// "Finger GPS": plain-language playing instructions derived from string/fret/finger data.
import { FINGER_NAMES, fretWords, stringWords } from "./guitar";

export interface Placement {
  string: number;
  fret: number;
  finger: number;
  technique?: string | null;
  bend_semitones?: number | null;
  slide_from_fret?: number | null;
  vibrato?: boolean;
}

const BEND_WORDS: Record<number, string> = { 1: "a half step (one fret's worth)", 2: "a whole step (two frets' worth)" };

/** Step-by-step instructions, including how to play a technique. */
export function fingerInstructions(p: Placement): string[] {
  const where = `Play ${stringWords(p.string)}.`;
  if (p.fret === 0) return [where, "No finger needed. Just pluck this string."];
  const finger = `Use your ${FINGER_NAMES[p.finger]}.`;
  switch (p.technique) {
    case "slide_up":
    case "slide_down":
      return [
        where,
        `Keep your ${FINGER_NAMES[p.finger]} pressed and slide it ${p.technique === "slide_up" ? "up" : "down"} from fret ${p.slide_from_fret} to fret ${p.fret}.`,
        "Don't pick again — the slide makes the sound.",
        ...(p.vibrato ? [VIBRATO_LINE] : []),
      ];
    case "hammer_on":
      return [where, `Hammer your ${FINGER_NAMES[p.finger]} down onto the ${fretWords(p.fret)} fret.`, "Don't pick — tap firmly so the note rings."];
    case "pull_off":
      return [where, `Keep a finger ready on the ${fretWords(p.fret)} fret.`, "Flick the higher finger off the string sideways — don't pick."];
    case "bend":
      return [
        where, `Press the ${fretWords(p.fret)} fret. ${finger}`,
        `Pick, then push the string towards the ceiling by ${BEND_WORDS[p.bend_semitones ?? 2]}.`,
        "Put your other fingers behind it on the same string to help push.",
        ...(p.vibrato ? [VIBRATO_LINE] : []),
      ];
    case "bend_release":
      return [where, `Press the ${fretWords(p.fret)} fret. ${finger}`, `Pick, bend up ${BEND_WORDS[p.bend_semitones ?? 2]}, then let it come back down while it rings.`];
    default:
      return [where, `Press the ${fretWords(p.fret)} fret.`, finger, p.vibrato ? VIBRATO_LINE : "Pluck the string gently."];
  }
}

const VIBRATO_LINE = "Let it ring and wiggle the string slightly up and down (vibrato).";

export const TECHNIQUE_NAMES: Record<string, string> = {
  slide_up: "Slide up", slide_down: "Slide down", hammer_on: "Hammer-on", pull_off: "Pull-off",
  bend: "Bend", bend_release: "Bend and release", vibrato: "Vibrato",
};

/** If a bend target is missed, the pitch usually sits between the fretted note and the target. */
export function bendFeedback(playedMidi: number, target: number, bend: number): string | null {
  const fretted = target - bend;
  if (playedMidi > fretted - 0.4 && playedMidi < target - 0.4) return "Push the string further — keep bending until it matches the target note.";
  if (playedMidi > target + 0.4 && playedMidi < target + 1.2) return "That bend went a little too far — ease off slightly.";
  return null;
}

export function spokenInstruction(p: Placement): string {
  return fingerInstructions(p).join(" ");
}

export function wrongNoteHint(p: Placement): string {
  if (p.fret === 0) return `Try ${stringWords(p.string)} with no finger pressed.`;
  return `Try the ${fretWords(p.fret)} fret on ${stringWords(p.string)}.`;
}

export const FEEDBACK = {
  correct: "Great! That's the right note.",
  silence: "I couldn't hear the string. Try plucking again.",
  octave: "Right note name, but in a different octave.",
} as const;

/** Describe how far off a played pitch is, without claiming to know where it was played. */
export function pitchDirection(cents: number): string {
  if (Math.abs(cents) < 30) return "";
  return cents > 0 ? "That sounded a little high." : "That sounded a little low.";
}
