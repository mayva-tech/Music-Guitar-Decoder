// Guitar-like tone for the playback synths.
//
// A plucked string (not an organ) needs:
//   1. Harmonic recipe: strong low partials for body/punch, rolled-off highs so it isn't tinny.
//   2. Envelope: near-instant attack, then a decaying ring — no long sustain plateau.
//   3. Filter snaps open on the pluck then settles warm so the attack hits, the ring stays woody.

/**
 * Relative amplitudes of the first `count` harmonics of a plucked string (fundamental = 1).
 * `pick` is the pluck point as a fraction of the string length from the bridge (≈0.09 near the
 * bridge for a sharp attack). `rolloff` is the exponent k: lower keeps more upper harmonics
 * (stringier); higher sounds rounder / more organ-like.
 */
export function pluckedPartials(count = 28, pick = 0.09, rolloff = 0.9): number[] {
  const raw = Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return Math.abs(Math.sin(n * Math.PI * pick)) / Math.pow(n, rolloff);
  });
  return raw.map((a) => Math.round((a / raw[0]) * 1e4) / 1e4);
}

/** Legacy bright recipe (kept for tests / comparison). B / high-e now share the G voice. */
export const CLEAN_PARTIALS = pluckedPartials(28, 0.09, 0.9);
/** Driven parts: still rich, slightly less extreme so distortion doesn't fizz. */
export const DRIVEN_PARTIALS = pluckedPartials(24, 0.11, 1.0);
/** Thick E / A / D: weight in 2nd–4th, soft highs — punch without tin. */
export const BASS_STRING_PARTIALS = (() => {
  const p = pluckedPartials(16, 0.18, 1.35);
  if (p[1] != null) p[1] = Math.min(1, p[1] * 1.45);
  if (p[2] != null) p[2] = Math.min(1, p[2] * 1.3);
  if (p[3] != null) p[3] = Math.min(1, p[3] * 1.15);
  for (let i = 6; i < p.length; i++) {
    if (p[i] != null) p[i] = p[i]! * 0.72;
  }
  return p;
})();

/**
 * G / B / high-e: neck-ish pick (rounder), strong body harmonics, tamed upper odds so the
 * tone punches instead of ringing like a tin can.
 */
export const G_STRING_PARTIALS = (() => {
  const p = pluckedPartials(20, 0.16, 1.25);
  if (p[1] != null) p[1] = Math.min(1, p[1] * 1.4);
  if (p[2] != null) p[2] = Math.min(1, p[2] * 1.28);
  if (p[3] != null) p[3] = Math.min(1, p[3] * 1.12);
  // Soften the metallic upper band that reads as “tin can”.
  for (let i = 5; i < p.length; i++) {
    if (p[i] != null) p[i] = p[i]! * (i % 2 === 0 ? 0.78 : 0.62);
  }
  return p;
})();

/** Midis below open B (59) — fallback when string number isn't known. */
export const BASS_STRING_MIDI = 58;

export type WarmToneKind = "bass" | "g" | "bright";

/**
 * Which voice to use. Prefer string when known:
 * 6/5/4 → bass, 3/2/1 (G/B/e) → G-family (less twang, fuller tone).
 * MIDI fallback: below open B → bass, otherwise → g.
 */
export function warmToneKind(string?: number | null, midi?: number): WarmToneKind {
  if (string === 1 || string === 2 || string === 3) return "g";
  if (string === 4 || string === 5 || string === 6) return "bass";
  if (midi != null && midi < BASS_STRING_MIDI) return "bass";
  return "g";
}

/** True for low-string MIDI range (open D and below), independent of B/e voicing. */
export function isBassStringMidi(midi: number): boolean {
  return midi < BASS_STRING_MIDI;
}

type Curve = "linear" | "exponential";
export interface PluckVoice {
  oscillator: { type: "custom"; partials: number[] };
  envelope: { attack: number; decay: number; sustain: number; release: number; decayCurve: Curve };
  filter: { type: "lowpass"; rolloff: -12 | -24; Q: number };
  filterEnvelope: { attack: number; decay: number; sustain: number; release: number; baseFrequency: number; octaves: number };
}

/**
 * Options for a Tone.MonoSynth (also usable as the voice of a PolySynth) that behaves like a plucked string.
 * Filter snaps open briefly for pick punch, then settles to a warm body shelf (not a bright tin ring).
 */
export function pluckVoice({
  partials = CLEAN_PARTIALS, ring = 9, hold = 0, release = 0.55, base = 900, bright = 2.6,
  attack = 0.0012, filterQ = 1.35, filterSustain = 0.28, filterDecay,
}: {
  partials?: number[]; ring?: number; hold?: number; release?: number; base?: number; bright?: number;
  attack?: number; filterQ?: number; filterSustain?: number; filterDecay?: number;
} = {}): PluckVoice {
  return {
    oscillator: { type: "custom", partials },
    envelope: { attack, decay: ring, sustain: hold, release, decayCurve: "exponential" },
    filter: { type: "lowpass", rolloff: -12, Q: filterQ },
    filterEnvelope: {
      attack: Math.max(0.0008, attack * 0.5),
      // Fast filter decay = audible pick thump, then woody body.
      decay: filterDecay ?? Math.min(0.28, Math.max(0.12, ring * 0.12)),
      sustain: filterSustain,
      release: Math.max(release, 0.4),
      baseFrequency: base,
      octaves: bright,
    },
  };
}

/** Low E/A/D as guitar strings (not bass guitar): warm mids, controlled lows. */
function bassStringVoice(opts: {
  ring: number; hold?: number; release?: number; base?: number; bright?: number;
  partials?: number[];
}): ReturnType<typeof pluckVoice> {
  return pluckVoice({
    partials: opts.partials ?? BASS_STRING_PARTIALS,
    ring: opts.ring,
    hold: opts.hold ?? 0,
    release: opts.release ?? 0.55,
    base: opts.base ?? 380,
    bright: opts.bright ?? 2.35,
    attack: 0.0014,
    filterQ: 1.45,
    filterSustain: 0.26,
    filterDecay: 0.22,
  });
}

/** G / B / e: same punch family, slightly brighter open, still dark settle. */
function gStringVoice(opts: {
  ring: number; hold?: number; release?: number;
}): ReturnType<typeof pluckVoice> {
  return bassStringVoice({
    partials: G_STRING_PARTIALS,
    ring: opts.ring,
    hold: opts.hold,
    release: opts.release ?? 0.42,
    base: 460,
    bright: 2.55,
  });
}

/** Settings per playback part. */
export const TONES = {
  melody: pluckVoice({ partials: G_STRING_PARTIALS, ring: 9, hold: 0, base: 480, bright: 2.6, filterSustain: 0.28 }),
  /** Low E/A/D — normal guitar low strings, not a bass guitar. */
  melodyLow: bassStringVoice({ ring: 9, release: 0.45, base: 360, bright: 2.3 }),
  /** G / B / high-e — body punch, not bridge tin. */
  melodyG: gStringVoice({ ring: 8.5, release: 0.42 }),
  // Keep solo/lead rings short enough for full Play (long rings stacked dozens of notes → audio crash).
  solo: pluckVoice({ partials: G_STRING_PARTIALS, ring: 2.4, hold: 0.06, release: 0.5, base: 520, bright: 2.65, filterSustain: 0.26 }),
  soloLow: bassStringVoice({ ring: 2.6, hold: 0.05, release: 0.5, base: 390, bright: 2.25 }),
  soloG: gStringVoice({ ring: 2.5, hold: 0.05, release: 0.48 }),
  lead: pluckVoice({ partials: G_STRING_PARTIALS, ring: 2.2, hold: 0.08, release: 0.48, base: 540, bright: 2.7, filterSustain: 0.26 }),
  leadLow: bassStringVoice({ ring: 2.4, hold: 0.06, release: 0.5, base: 410, bright: 2.35 }),
  leadG: gStringVoice({ ring: 2.3, hold: 0.06, release: 0.48 }),
  backing: bassStringVoice({ ring: 0.28, hold: 0.04, release: 0.22, base: 430, bright: 2.2 }),
} as const;
