import { midiAt } from "@/lib/music/guitar";
import type { ChordShape } from "@/lib/music/chordShapes";
import type { Sound } from "@/lib/theory/ear";
import { getTheoryPlayer } from "@/lib/theory/player";

/** Build a slow low→high strum from a chord box (frets are strings 6→1). */
export function shapeToStrumSound(shape: ChordShape, bpm = 96): Sound {
  const events: Sound["events"] = [];
  let beat = 0;
  for (let i = 0; i < 6; i++) {
    const fret = shape.frets[i];
    if (fret == null) continue;
    const string = 6 - i;
    events.push({
      kind: "pluck",
      midi: midiAt(string, fret),
      beat,
      beats: 2.4,
      velocity: 0.48 + (i % 3) * 0.05,
      timbre: string >= 4 ? "warm" : "normal",
    });
    beat += 0.07;
  }
  return { bpm, lengthBeats: Math.max(3, beat + 2.5), events };
}

/** Hear a chord shape as a strum. Stops any previous theory/ear sound. */
export async function playChordStrum(shape: ChordShape): Promise<void> {
  const sound = shapeToStrumSound(shape);
  await getTheoryPlayer().play(sound, () => undefined);
}

export function stopChordStrum(): void {
  getTheoryPlayer().stop();
}
