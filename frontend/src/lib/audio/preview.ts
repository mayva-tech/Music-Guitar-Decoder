// Quick previews in the decoder: the detected melody alone, or melody + a candidate chord progression.
import type { ChordCandidate, DetectedMelody } from "../types";
import type { Schedule, ScheduledEvent } from "./timeline";

export function melodyPreview(m: DetectedMelody, chords?: ChordCandidate[]): Schedule {
  const spb = 60 / m.tempo_bpm;
  const events: ScheduledEvent[] = m.notes.map((n) => ({
    track: "melody", time: n.start_beat * spb, duration: n.duration_beats * spb * 0.95, midis: [n.midi], velocity: 0.8, eventId: n.id,
  }));
  let end = Math.max(0, ...m.notes.map((n) => n.start_beat + n.duration_beats));
  if (chords) {
    for (const c of chords) {
      for (let b = c.start_beat; b < c.start_beat + c.duration_beats - 1e-6; b += 1) {
        const strong = Math.abs(b % m.beats_per_bar) < 1e-6;
        events.push({ track: "backing", time: b * spb, duration: spb * 0.9, midis: c.voicing_midis, velocity: strong ? 0.8 : 0.5 });
      }
      const root = 28 + ((c.root_pc - 4 + 12) % 12);
      events.push({ track: "bass", time: c.start_beat * spb, duration: c.duration_beats * spb * 0.95, midis: [root], velocity: 0.8 });
      end = Math.max(end, c.start_beat + c.duration_beats);
    }
  }
  events.sort((a, b) => a.time - b.time);
  return {
    events, secondsPerBeat: spb, countInSec: 0, durationSec: end * spb, partNotes: [],
    beatToTime: (b) => b * spb, timeToBeat: (t) => t / spb,
  };
}
