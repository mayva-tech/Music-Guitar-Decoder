// Convert an Arrangement (beats) into one synchronized schedule (seconds) for all tracks.
// Everything — sound, highlighting and live scoring — reads times from here.
import type { Arrangement, Part, PlayableNote } from "../types";

export type TrackName = "melody" | "solo" | "lead" | "backing" | "bass" | "drums" | "click";

export interface TrackToggles {
  melody: boolean;
  solo: boolean;
  lead: boolean;
  backing: boolean;
  bass: boolean;
  drums: boolean;
}

export const DEFAULT_TRACKS: TrackToggles = { melody: false, solo: true, lead: false, backing: true, bass: true, drums: true };

/** How a lead note is played, for the synth (bends glide up, slides glide from the previous fret). */
export interface Articulation {
  bendSemitones?: number;
  release?: boolean;
  slideFromMidi?: number;
  legato?: boolean; // hammer-on / pull-off: no new pick attack
  vibrato?: boolean;
}

/** Shuffle feel: the off-beat eighth is played late (written straight, played long-short). */
export function swingBeat(beat: number, swing = 0.5): number {
  if (swing === 0.5) return beat;
  const whole = Math.floor(beat + 1e-9);
  const frac = beat - whole;
  if (Math.abs(frac - 0.5) < 1e-6) return whole + swing;
  return beat;
}

export interface ScheduledEvent {
  track: TrackName;
  time: number; // seconds from playback start
  duration: number;
  midis: number[];
  /** Guitar string 1–6 when known (drives warm vs bright tone). */
  string?: number;
  drum?: "kick" | "snare" | "hat" | "crash";
  velocity: number;
  eventId?: string;
  art?: Articulation;
}

export interface ScheduleOptions {
  tempoFactor?: number; // 1 = original tempo
  countInBeats?: number;
  part?: Part;
  fromBeat?: number; // loop/phrase start
  toBeat?: number; // exclusive
}

export interface Schedule {
  events: ScheduledEvent[];
  secondsPerBeat: number;
  countInSec: number;
  durationSec: number;
  /** timing of the learner's part (the notes they play), for highlighting & scoring */
  partNotes: { id: string; start: number; end: number; note: PlayableNote }[];
  beatToTime: (beat: number) => number;
  timeToBeat: (t: number) => number;
}

export function partNotes(arr: Arrangement, part: Part): PlayableNote[] {
  if (part === "lead") return arr.lead?.notes ?? arr.solo.notes;
  return part === "solo" ? arr.solo.notes : arr.melody_guitar;
}

export function articulation(n: PlayableNote, prev?: PlayableNote): Articulation | undefined {
  const a: Articulation = {};
  if (n.technique === "bend") a.bendSemitones = n.bend_semitones ?? 2;
  if (n.technique === "bend_release") { a.bendSemitones = n.bend_semitones ?? 2; a.release = true; }
  if ((n.technique === "slide_up" || n.technique === "slide_down") && n.slide_from_fret != null)
    a.slideFromMidi = n.midi - (n.fret - n.slide_from_fret);
  if (n.technique === "hammer_on" || n.technique === "pull_off" || (a.slideFromMidi != null && prev)) a.legato = true;
  if (n.vibrato) a.vibrato = true;
  return Object.keys(a).length ? a : undefined;
}

export function buildSchedule(arr: Arrangement, opts: ScheduleOptions = {}): Schedule {
  const tempoFactor = opts.tempoFactor ?? 1;
  if (!(tempoFactor > 0)) throw new RangeError("tempoFactor must be positive");
  const spb = 60 / (arr.tempo_bpm * tempoFactor);
  const countIn = opts.countInBeats ?? 0;
  const countInSec = countIn * spb;
  const total = arr.total_bars * arr.beats_per_bar;
  const from = opts.fromBeat ?? 0;
  const to = Math.min(opts.toBeat ?? total, total);
  const swing = arr.theory?.swing ?? 0.5;
  const inRange = (b: number) => b >= from - 1e-9 && b < to - 1e-9;
  const t = (beat: number) => countInSec + (swingBeat(beat, swing) - from) * spb;
  const clip = (start: number, dur: number) => {
    const end = Math.min(start + dur, to);
    return Math.max(0.03, (swingBeat(end, swing) - swingBeat(start, swing)) * spb);
  };

  const events: ScheduledEvent[] = [];
  for (let i = 0; i < countIn; i++) {
    events.push({ track: "click", time: i * spb, duration: 0.05, midis: [], drum: "hat", velocity: i === 0 ? 0.9 : 0.6 });
  }
  for (const n of arr.solo.notes) if (inRange(n.start_beat))
    events.push({ track: "solo", time: t(n.start_beat), duration: clip(n.start_beat, n.duration_beats), midis: [n.midi], string: n.string, velocity: 0.85, eventId: n.id });
  const lead = arr.lead?.notes ?? [];
  lead.forEach((n, i) => {
    if (inRange(n.start_beat))
      events.push({ track: "lead", time: t(n.start_beat), duration: clip(n.start_beat, n.duration_beats), midis: [n.midi], string: n.string, velocity: 0.85, eventId: n.id, art: articulation(n, lead[i - 1]) });
  });
  for (const n of arr.melody_guitar) if (inRange(n.start_beat))
    events.push({ track: "melody", time: t(n.start_beat), duration: clip(n.start_beat, n.duration_beats), midis: [n.midi], string: n.string, velocity: 0.75, eventId: n.id });
  for (const b of arr.backing) if (inRange(b.start_beat))
    events.push({ track: "backing", time: t(b.start_beat), duration: clip(b.start_beat, b.duration_beats), midis: b.midis, velocity: b.velocity });
  for (const n of arr.bass) if (inRange(n.start_beat))
    events.push({ track: "bass", time: t(n.start_beat), duration: clip(n.start_beat, n.duration_beats), midis: [n.midi], velocity: 0.8 });
  for (const d of arr.drums) if (inRange(d.start_beat))
    events.push({ track: "drums", time: t(d.start_beat), duration: 0.1, midis: [], drum: d.kind, velocity: d.velocity });
  events.sort((a, b) => a.time - b.time);

  const learner = partNotes(arr, opts.part ?? "solo")
    .filter((n) => inRange(n.start_beat))
    .map((n) => ({ id: n.id, start: t(n.start_beat), end: t(n.start_beat) + clip(n.start_beat, n.duration_beats), note: n }));

  return {
    events, secondsPerBeat: spb, countInSec, durationSec: countInSec + (to - from) * spb, partNotes: learner,
    beatToTime: t, timeToBeat: (sec: number) => from + (sec - countInSec) / spb, // approximate under swing
  };
}

/** Index of the learner note sounding at time t (or the last one started), -1 before the first. */
export function activeNoteIndex(s: Schedule, time: number): number {
  let idx = -1;
  for (let i = 0; i < s.partNotes.length; i++) {
    if (s.partNotes[i].start <= time + 1e-6) idx = i;
    else break;
  }
  return idx;
}

export function barAndBeat(beat: number, beatsPerBar: number): { bar: number; beat: number } {
  const b = Math.max(0, beat);
  return { bar: Math.floor(b / beatsPerBar) + 1, beat: Math.floor(b % beatsPerBar) + 1 };
}

export function chordAtBeat<T extends { start_beat: number; duration_beats: number }>(chords: T[], beat: number): T | undefined {
  return chords.find((c) => beat >= c.start_beat - 1e-6 && beat < c.start_beat + c.duration_beats - 1e-6);
}
