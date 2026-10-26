// Pure editing operations on a detected melody (the user correcting the transcription).
import type { DetectedMelody, NoteEvent } from "../types";
import { midiToName } from "./theory";

const sorted = (notes: NoteEvent[]) => [...notes].sort((a, b) => a.start_beat - b.start_beat);

function edited(n: NoteEvent, patch: Partial<NoteEvent>): NoteEvent {
  const midi = patch.midi ?? n.midi;
  return { ...n, ...patch, midi, name: midiToName(midi), source: "edited", low_confidence: false, confidence: 1, cents_off: null, string: null, fret: null, finger: null };
}

export function transposeNote(m: DetectedMelody, id: string, semitones: number): DetectedMelody {
  return {
    ...m,
    notes: m.notes.map((n) => (n.id === id ? edited(n, { midi: Math.min(96, Math.max(28, n.midi + semitones)) }) : n)),
  };
}

export function setDuration(m: DetectedMelody, id: string, beats: number): DetectedMelody {
  const ns = sorted(m.notes);
  const i = ns.findIndex((n) => n.id === id);
  if (i < 0) return m;
  const room = i + 1 < ns.length ? ns[i + 1].start_beat - ns[i].start_beat : Infinity;
  const d = Math.max(0.5, Math.min(beats, room, 8));
  ns[i] = { ...ns[i], duration_beats: d, source: "edited" };
  return { ...m, notes: ns };
}

const snapHalf = (beats: number) => Math.round(beats * 2) / 2;

/** Move a note in time and/or pitch, and/or resize its length. Snaps to ½-beat and avoids overlaps. */
export function moveNote(
  m: DetectedMelody,
  id: string,
  patch: { start_beat?: number; midi?: number; duration_beats?: number },
): DetectedMelody {
  const ns = sorted(m.notes);
  const i = ns.findIndex((n) => n.id === id);
  if (i < 0) return m;
  const n = ns[i];
  const midi = Math.min(96, Math.max(28, Math.round(patch.midi ?? n.midi)));
  let start = snapHalf(patch.start_beat ?? n.start_beat);
  let dur = snapHalf(patch.duration_beats ?? n.duration_beats);

  const prevEnd = i > 0 ? ns[i - 1].start_beat + ns[i - 1].duration_beats : 0;
  const nextStart = i + 1 < ns.length ? ns[i + 1].start_beat : Infinity;
  start = Math.max(0, prevEnd, Math.min(start, Number.isFinite(nextStart) ? nextStart - 0.5 : start));
  const room = nextStart - start;
  dur = Math.max(0.5, Math.min(dur, room, 8));

  if (midi === n.midi && start === n.start_beat && dur === n.duration_beats) return m;
  const timingChanged = start !== n.start_beat || dur !== n.duration_beats;
  ns[i] = edited(n, {
    midi,
    start_beat: start,
    duration_beats: dur,
    ...(timingChanged ? { start_sec: null, duration_sec: null } : {}),
  });
  return { ...m, notes: ns };
}

export function deleteNote(m: DetectedMelody, id: string): DetectedMelody {
  return { ...m, notes: m.notes.filter((n) => n.id !== id) };
}

/** Insert a one-beat note after `id`, pushing later notes back by one beat. */
export function insertAfter(m: DetectedMelody, id: string): DetectedMelody {
  const ns = sorted(m.notes);
  const i = ns.findIndex((n) => n.id === id);
  if (i < 0) return m;
  const at = ns[i].start_beat + ns[i].duration_beats;
  const shifted = ns.map((n, k) => (k > i ? { ...n, start_beat: n.start_beat + 1 } : n));
  const fresh: NoteEvent = {
    id: `n_${Math.random().toString(16).slice(2, 14)}`, midi: ns[i].midi, name: midiToName(ns[i].midi), start_beat: at,
    duration_beats: 1, source: "edited", confidence: 1, low_confidence: false,
  };
  return { ...m, notes: sorted([...shifted, fresh]) };
}

export function canRequantize(m: DetectedMelody): boolean {
  return m.notes.length > 0 && m.notes.every((n) => n.start_sec != null && n.duration_sec != null);
}

export function totalBars(m: DetectedMelody): number {
  const end = Math.max(0, ...m.notes.map((n) => n.start_beat + n.duration_beats));
  return Math.max(1, Math.ceil(end / m.beats_per_bar - 1e-9));
}

export function hasOverlaps(m: DetectedMelody): boolean {
  const ns = sorted(m.notes);
  return ns.some((n, i) => i > 0 && n.start_beat < ns[i - 1].start_beat + ns[i - 1].duration_beats - 1e-6);
}
