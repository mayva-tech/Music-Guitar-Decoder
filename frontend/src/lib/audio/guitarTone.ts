// Guitar-like tone for the playback synths.
//
// A plucked string (not an organ) needs:
//   1. Harmonic recipe: bridge-ish pick + many partials with a gentle rolloff so the note stays
//      sharp/stringy while it rings, instead of collapsing to a blunt fundamental.
//   2. Envelope: near-instant attack, then a decaying ring — no long sustain plateau.
//   3. Brightness decays slower than amplitude so upper harmonics keep the guitar character.

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
/** Thick E / A / D strings: round and low — strong 2nd/3rd for body punch, soft highs. */
export const BASS_STRING_PARTIALS = (() => {
  const p = pluckedPartials(14, 0.2, 1.45);
  // Emphasize the first overtones so the pluck hits with weight, not a dull thud.
  if (p[1] != null) p[1] = Math.min(1, p[1] * 1.35);
  if (p[2] != null) p[2] = Math.min(1, p[2] * 1.2);
  return p;
})();

/** G / B / high-e: mid body + punch — rounder tone, less bridge twang. */
export const G_STRING_PARTIALS = (() => {
  const p = pluckedPartials(16, 0.18, 1.35);
  if (p[1] != null) p[1] = Math.min(1, p[1] * 1.4);
  if (p[2] != null) p[2] = Math.min(1, p[2] * 1.25);
  if (p[3] != null) p[3] = Math.min(1, p[3] * 1.1);
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
 * `ring`: amp decay. `hold`: amp sustain (keep low — high hold = organ). `bright`: filter open at the
 * pluck; filter sustain stays relatively high so harmonics linger while the note dies away.
 */
export function pluckVoice({
  partials = CLEAN_PARTIALS, ring = 9, hold = 0, release = 0.55, base = 1100, bright = 3.4,
  attack = 0.004, filterQ = 0.7, filterSustain = 0.4, filterDecay,
}: {
  partials?: number[]; ring?: number; hold?: number; release?: number; base?: number; bright?: number;
  attack?: number; filterQ?: number; filterSustain?: number; filterDecay?: number;
} = {}): PluckVoice {
  return {
    oscillator: { type: "custom", partials },
    // Softer attack + longer release: near-zero attack through drive is the main crack source.
    envelope: { attack, decay: ring, sustain: hold, release, decayCurve: "exponential" },
    filter: { type: "lowpass", rolloff: -12, Q: filterQ },
    filterEnvelope: {
      attack: Math.max(0.003, attack),
      decay: filterDecay ?? Math.min(1.1, ring * 0.45),
      sustain: filterSustain,
      release: Math.max(release, 0.45),
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
    // Filter sits in guitar body range (~400 Hz+), not sub-bass like a bass amp.
    base: opts.base ?? 420,
    bright: opts.bright ?? 2.2,
    attack: 0.004,
    filterQ: 0.85,
    filterSustain: 0.28,
    filterDecay: 0.28,
  });
}

/** G string: same punch family as D, voiced a little higher in the mid-bass. */
function gStringVoice(opts: {
  ring: number; hold?: number; release?: number;
}): ReturnType<typeof pluckVoice> {
  return bassStringVoice({
    partials: G_STRING_PARTIALS,
    ring: opts.ring,
    hold: opts.hold,
    release: opts.release ?? 0.42,
    base: 520,
    bright: 2.3,
  });
}

/** Settings per playback part. Bright slots keep a milder driven recipe as fallback. */
export const TONES = {
  // Fallback bright path — softened; B/e normally use *G voices instead.
  melody: pluckVoice({ partials: G_STRING_PARTIALS, ring: 9, hold: 0, base: 560, bright: 2.4, filterSustain: 0.3 }),
  /** Low E/A/D — normal guitar low strings, not a bass guitar. */
  melodyLow: bassStringVoice({ ring: 9, release: 0.45, base: 400, bright: 2.3 }),
  /** G / B / high-e — mid-range body, shared for less twang. */
  melodyG: gStringVoice({ ring: 8.5, release: 0.42 }),
  // Keep solo/lead rings short enough for full Play (long rings stacked dozens of notes → audio crash).
  solo: pluckVoice({ partials: G_STRING_PARTIALS, ring: 2.4, hold: 0.1, release: 0.5, base: 620, bright: 2.4, filterSustain: 0.26 }),
  soloLow: bassStringVoice({ ring: 2.6, hold: 0.08, release: 0.5, base: 440, bright: 2.1 }),
  soloG: gStringVoice({ ring: 2.5, hold: 0.08, release: 0.48 }),
  lead: pluckVoice({ partials: G_STRING_PARTIALS, ring: 2.2, hold: 0.12, release: 0.48, base: 640, bright: 2.4, filterSustain: 0.26 }),
  leadLow: bassStringVoice({ ring: 2.4, hold: 0.1, release: 0.5, base: 460, bright: 2.2 }),
  leadG: gStringVoice({ ring: 2.3, hold: 0.1, release: 0.48 }),
  // Rhythm: short chug, but release long enough that drive doesn't click when notes stop.
  backing: bassStringVoice({ ring: 0.28, hold: 0.04, release: 0.22, base: 480, bright: 2.0 }),
} as const;
