// Hidden music theory: short, friendly explanations computed from the learner's own notes.
import type { ChordCandidate, KeyCandidate, NoteEvent } from "../types";
import { chordPcs, pitchClassName, scalePcs, triadQualityFromRoman } from "./theory";

export interface Insight {
  id: string;
  headline: string;
  why: string;
}

function chordName(c: ChordCandidate, flats: boolean): string {
  const q = triadQualityFromRoman(c.roman);
  return `${pitchClassName(c.root_pc, flats)} ${q === "maj" ? "major" : "minor"}`;
}

export function phraseInsight(
  notes: NoteEvent[],
  chord: ChordCandidate | undefined,
  key: KeyCandidate,
  opts: { isLastPhrase: boolean; previous?: NoteEvent[] },
): Insight {
  const flats = /b/.test(key.name.split(" ")[0]);
  const pcs = notes.map((n) => n.midi % 12);
  const tonicName = pitchClassName(key.tonic, flats);

  if (opts.isLastPhrase && pcs.length && pcs[pcs.length - 1] === key.tonic) {
    return {
      id: "home-note",
      headline: `You landed on the home note, ${tonicName}. That's why it sounds finished!`,
      why: `Every song has a "home" note that the music keeps wanting to return to. Your tune's home is ${tonicName}. Ending on it gives the satisfying feeling of arriving — try stopping on a different note and listen to how unfinished it feels.`,
    };
  }

  const bent = notes.find((n) => n.technique === "bend" || n.technique === "bend_release");
  if (bent && bent.bend_semitones === 1 && ((bent.midi - 1 - key.tonic + 12) % 12) === 3) {
    return {
      id: "blue-curl",
      headline: "That half-step bend from the ♭3 is the sound of the blues!",
      why: "The flat 3rd sits between minor and major. Bending it halfway up lets the note slide towards the chord's major 3rd without quite arriving — that tension is the 'blue' in blues.",
    };
  }
  if (bent) {
    return {
      id: "bend",
      headline: `You bent the string up to ${bent.name.replace(/-?\d+$/, "")} — that's how a guitar sings.`,
      why: "A bend reaches a note by pushing the string instead of moving to another fret. Players bend up to an important chord note so the melody glides into it like a voice, then hold it with vibrato.",
    };
  }
  if (notes.some((n) => n.technique === "slide_up" || n.technique === "slide_down")) {
    return {
      id: "slide",
      headline: "You slid into that note instead of picking it — smooth!",
      why: "A slide joins two notes without a gap, a bit like a singer scooping between words. Landing a slide on a beat makes the target note stand out.",
    };
  }

  if (chord) {
    const triad = chordPcs(chord.root_pc, triadQualityFromRoman(chord.roman));
    const distinct = [...new Set(pcs)];
    if (distinct.length >= 2 && distinct.every((pc) => triad.includes(pc))) {
      const names = distinct.map((pc) => pitchClassName(pc, flats)).join(", ");
      const count = distinct.length === 2 ? "two" : distinct.length === 3 ? "three" : String(distinct.length);
      return {
        id: "chord-tones",
        headline: `You just played ${count} notes from a ${chordName(chord, flats)} chord!`,
        why: `A chord is a small group of notes that sound good together. ${chordName(chord, flats)} is built from ${triad
          .map((pc) => pitchClassName(pc, flats))
          .join(", ")}. You played ${names} while the band played that chord, so everything blended.`,
      };
    }
  }

  if (opts.previous && opts.previous.length === notes.length && opts.previous.length > 1) {
    const same = opts.previous.slice(0, 2).every((p, i) => p.midi === notes[i].midi);
    if (same) {
      return {
        id: "repetition",
        headline: "You played a pattern that appears in lots of rock songs.",
        why: "Rock solos love repetition: play an idea, then play it again with a small change. Listeners recognise the idea the second time, and the change keeps it interesting.",
      };
    }
  }

  const steps = notes.slice(1).map((n, i) => Math.abs(n.midi - notes[i].midi));
  const scale = scalePcs(key.tonic, key.mode);
  if (notes.length >= 3 && steps.every((s) => s > 0 && s <= 2) && pcs.every((pc) => scale.includes(pc))) {
    return {
      id: "scale-walk",
      headline: "You just walked along a scale.",
      why: `A scale is a ladder of notes that belong together. Your tune uses the ${key.name} scale (${scale
        .map((pc) => pitchClassName(pc, flats))
        .join(" ")}). Moving to the next rung up or down always sounds smooth.`,
    };
  }

  return {
    id: "fits-chord",
    headline: "This group of notes works well over your backing chord.",
    why: "The notes that land on the strong beats (1 and 3) come from the chord the band is playing. Notes in between can wander a little — they just pass through on the way to the next strong beat.",
  };
}
