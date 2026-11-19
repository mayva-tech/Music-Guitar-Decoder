/**
 * Electric guitar strings as a physical model, rendered once into samples.
 *
 * The oscillator voices in guitarTone.ts add up harmonics that are perfectly in tune and all fade
 * at one rate, behind a filter that closes in a fifth of a second. An electric piano works that
 * way, and that is what they sound like.
 *
 * A string is a loop: the pluck travels down the string, reflects, and comes back a little duller
 * each trip. `renderString` runs that loop (extended Karplus-Strong), so the tone starts bright
 * and loses its top gradually, high notes die sooner than low ones, and two slightly detuned
 * loops give the slow shimmer of a real string. The pluck shape comes from where the pick and the
 * pickup sit on the string, which is what makes it an electric guitar and not a harp.
 *
 * `mountStrings` plays those samples through Tone: chords and melodies on `PolyStrings`, the lead
 * line on `LeadString`, which bends, slides and adds vibrato by changing playback speed. It
 * returns null when there is no audio context (unit tests); callers keep the oscillator voices.
 */
import { midiToFreq } from "../music/theory";

type ToneModule = typeof import("tone");

/* ------------------------------------------------------------------ model */

const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];
/** Pick and pickup distance from the bridge, as a fraction of the open string. */
const PICK_AT = 0.14;
const PICKUP_AT = 0.17;

/** Fret a pitch is most likely played at (lowest position). Sets pick and pickup geometry. */
export function likelyFret(midi: number): number {
  let open = OPEN_STRINGS[0]!;
  for (const o of OPEN_STRINGS) if (o <= midi) open = o;
  return Math.max(0, midi - open);
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Loop {
  /** Starting amplitude of harmonic k (signed). */
  amp: (k: number) => number;
  /** Seconds for the fundamental to fall 60 dB. */
  t60: number;
  /** Extra loss at 3 kHz, dB per second: how fast the brightness goes. */
  hfDecay: number;
}

/**
 * One string loop, added into `out`. The delay line holds one period; each trip round it passes a
 * three-tap low-pass (the string's losses) and an all-pass that makes up the fraction of a sample
 * the integer delay cannot, so the note is in tune.
 */
function addLoop(out: Float32Array, sampleRate: number, hz: number, loop: Loop, level: number): void {
  const period = sampleRate / hz;
  const delay = Math.floor(period - 0.2);
  const frac = period - delay; // all-pass delay, 0.2 to 1.2 samples
  const w0 = (2 * Math.PI * hz) / sampleRate;
  const c = Math.sin(((1 - frac) * w0) / 2) / Math.sin(((1 + frac) * w0) / 2);
  const w3k = (2 * Math.PI * Math.min(3000, sampleRate * 0.4)) / sampleRate;
  const a = Math.min(0.25, (1 - 10 ** (-loop.hfDecay / (20 * hz))) / (2 * (1 - Math.cos(w3k))));
  const mid = 1 - 2 * a;
  const rho = 10 ** (-3 / (hz * loop.t60));

  const size = delay + 1;
  const line = new Float32Array(size);
  const top = Math.max(1, Math.floor(Math.min(sampleRate * 0.45, 11000) / hz));
  for (let k = 1; k <= top; k++) {
    const amp = loop.amp(k);
    if (Math.abs(amp) < 1e-5) continue;
    const step = (2 * Math.PI * k) / period;
    for (let i = 0; i < size; i++) line[i] = line[i]! + amp * Math.sin(step * i);
  }

  let w = 0;
  let apIn = 0;
  let apOut = 0;
  for (let n = 0; n < out.length; n++) {
    const i0 = w + 1 < size ? w + 1 : w + 1 - size;
    const i1 = w + 2 < size ? w + 2 : w + 2 - size;
    const x = line[i0]!;
    const y = rho * (a * (line[w]! + line[i1]!) + mid * x);
    const ap = c * y + apIn - c * apOut;
    apIn = y;
    apOut = ap;
    line[w] = ap;
    out[n] = out[n]! + level * x;
    w = w + 1 < size ? w + 1 : 0;
  }
}

/** Resonant low-pass, in place: the pickup's peak and roll-off. */
function pickupFilter(x: Float32Array, sampleRate: number, hz: number, q: number): void {
  const w = (2 * Math.PI * Math.min(hz, sampleRate * 0.45)) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const cw = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 - cw) / 2 / a0;
  const b1 = (1 - cw) / a0;
  const a1 = (-2 * cw) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
}

export interface StringOptions {
  /** Palm-muted: the hand on the bridge soaks up the ring. */
  muted?: boolean;
  seconds?: number;
}

/** How long an open (unmuted) sample runs. Low strings ring longer. */
export function ringSeconds(midi: number): number {
  if (midi <= 52) return 4;
  if (midi <= 64) return 3.6;
  if (midi <= 76) return 3.2;
  return 3;
}

/** One plucked note, mono, peak 0.9. */
export function renderString(midi: number, sampleRate = 44100, opts: StringOptions = {}): Float32Array {
  const muted = !!opts.muted;
  const hz = midiToFreq(midi);
  const n = Math.max(64, Math.floor(sampleRate * (opts.seconds ?? (muted ? 0.5 : ringSeconds(midi)))));
  const out = new Float32Array(n);
  const rand = rng(9001 + Math.round(midi * 16) + (muted ? 5 : 0));

  const stretch = 2 ** (likelyFret(midi) / 12);
  const pick = Math.min(0.36, PICK_AT * stretch);
  const pickup = Math.min(0.4, PICKUP_AT * stretch);
  const pickHz = muted ? 1500 : 4800; // how hard the pick edge is
  const amp = (k: number) =>
    (Math.sin(k * Math.PI * pick) * Math.sin(k * Math.PI * pickup)) / k / Math.sqrt(1 + ((k * hz) / pickHz) ** 4);

  const t60 = muted ? 0.3 : Math.max(3.5, Math.min(8.5, 8.5 - (midi - 40) * 0.1));
  const hfDecay = muted ? 600 : 30;
  // Two polarisations of one string: a hair apart in pitch, the second dying sooner.
  addLoop(out, sampleRate, hz * 2 ** (-0.2 / 1200), { amp, t60, hfDecay }, 1);
  addLoop(out, sampleRate, hz * 2 ** (0.5 / 1200), {
    amp: (k) => amp(k) * (0.75 + 0.5 * rand()),
    t60: t60 * 0.5,
    hfDecay: hfDecay * 1.3,
  }, 0.4);

  // Pick click: a few milliseconds of band-passed noise on top of the first period.
  let ref = 0;
  const firstPeriod = Math.min(n, Math.ceil((2 * sampleRate) / hz));
  for (let i = 0; i < firstPeriod; i++) ref = Math.max(ref, Math.abs(out[i]!));
  const clickLen = Math.min(n, Math.floor(sampleRate * 0.02));
  let hp = 0;
  let prev = 0;
  let lp = 0;
  for (let i = 0; i < clickLen; i++) {
    const white = rand() * 2 - 1;
    hp = white - prev + 0.6 * hp;
    prev = white;
    lp += 0.45 * (hp - lp);
    out[i] = out[i]! + lp * ref * (muted ? 0.3 : 0.16) * Math.exp(-i / (sampleRate * 0.0035));
  }

  pickupFilter(out, sampleRate, muted ? 2200 : 4200, muted ? 0.9 : 1.5);

  // Level, then a little amp compression: the attack is held back, the ring comes up.
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const drive = 1.4;
  const norm = peak > 1e-9 ? 1 / peak : 0;
  const ceiling = 0.9 / Math.tanh(drive);
  const fadeIn = Math.min(n, Math.max(8, Math.floor(sampleRate * 0.0004)));
  const fadeOut = Math.floor(n * 0.22);
  for (let i = 0; i < n; i++) {
    let v = Math.tanh(out[i]! * norm * drive) * ceiling;
    if (i < fadeIn) v *= i / fadeIn;
    const left = n - 1 - i;
    if (left < fadeOut) v *= 0.5 - 0.5 * Math.cos((Math.PI * left) / fadeOut);
    out[i] = v;
  }
  return out;
}

/* ------------------------------------------------------------ sample bank */

/** Sampled pitches: every third semitone, so no note is repitched by more than one. */
export const SAMPLE_LOW = 37;
export const SAMPLE_HIGH = 91;
export const SAMPLE_STEP = 3;

/** The sampled pitch nearest a (possibly fractional) MIDI note. */
export function sampleMidi(midi: number): number {
  const k = Math.round((midi - SAMPLE_LOW) / SAMPLE_STEP);
  const last = (SAMPLE_HIGH - SAMPLE_LOW) / SAMPLE_STEP;
  return SAMPLE_LOW + SAMPLE_STEP * Math.max(0, Math.min(last, k));
}

function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(Math.max(1, hz) / 440);
}

interface Bank {
  sampleRate: number;
  open: Map<number, AudioBuffer>;
  muted: Map<number, AudioBuffer>;
}

let bank: Bank | null = null;

interface RawContext {
  sampleRate: number;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
}

function bankFor(raw: RawContext): Bank {
  // Nothing in a guitar sits above 11 kHz, so 48 kHz is plenty. On a 96 kHz device the browser
  // resamples on playback, and the bank takes half the time and memory to make.
  const sampleRate = Math.min(raw.sampleRate || 44100, 48000);
  if (bank && bank.sampleRate === sampleRate) return bank;
  const make = (midi: number, muted: boolean): AudioBuffer => {
    const data = renderString(midi, sampleRate, { muted });
    const buffer = raw.createBuffer(1, data.length, sampleRate);
    buffer.getChannelData(0).set(data);
    return buffer;
  };
  const next: Bank = { sampleRate, open: new Map(), muted: new Map() };
  for (let m = SAMPLE_LOW; m <= SAMPLE_HIGH; m += SAMPLE_STEP) {
    next.open.set(m, make(m, false));
    next.muted.set(m, make(m, true));
  }
  bank = next;
  return next;
}

/* ----------------------------------------------------------------- voices */

type Source = InstanceType<ToneModule["ToneBufferSource"]>;
type GainNode = InstanceType<ToneModule["Gain"]>;

interface Strike {
  muted?: boolean;
  /** Seconds into the sample to start from (skips the pick click on hammer-ons). */
  offset?: number;
  fadeIn?: number;
  fadeOut: number;
  /** Seconds until release; omitted = rings until stopped. */
  duration?: number;
}

function strike(
  Tone: ToneModule, b: Bank, out: GainNode, live: Set<Source>, hz: number, at: number, gain: number, s: Strike,
  onEnd?: (src: Source) => void,
): { src: Source; base: number } {
  const key = sampleMidi(hzToMidi(hz));
  const base = midiToFreq(key);
  const src = new Tone.ToneBufferSource({
    url: (s.muted ? b.muted : b.open).get(key)!,
    playbackRate: hz / base,
    fadeIn: s.fadeIn ?? 0,
    fadeOut: s.fadeOut,
    curve: "exponential",
    onended: (ended) => {
      live.delete(ended as Source);
      onEnd?.(ended as Source);
    },
  });
  src.connect(out);
  live.add(src);
  src.start(at, s.offset ?? 0, s.duration, Math.max(0, gain));
  return { src, base };
}

function outGain(Tone: ToneModule, dest: unknown, db: number): { node: GainNode; volume: { value: number } } {
  const node = new Tone.Gain(10 ** (db / 20));
  node.connect(dest as import("tone").InputNode);
  let level = db;
  return {
    node,
    volume: {
      get value() { return level; },
      set value(v: number) {
        level = v;
        node.gain.value = 10 ** (v / 20);
      },
    },
  };
}

export interface VoiceOptions {
  /** Level in dB. */
  db?: number;
  /** Fade when a note is let go (a finger lifting off), seconds. */
  release?: number;
}

/** Any number of notes at once: strummed chords, melodies, fret taps. */
export class PolyStrings {
  readonly volume: { value: number };
  private readonly out: GainNode;
  private readonly live = new Set<Source>();
  private readonly release: number;

  constructor(private readonly Tone: ToneModule, private readonly b: Bank, dest: unknown, opts: VoiceOptions = {}) {
    const o = outGain(Tone, dest, opts.db ?? 0);
    this.out = o.node;
    this.volume = o.volume;
    this.release = opts.release ?? 0.25;
  }

  triggerAttackRelease(notes: number | number[], duration: number, time?: number, velocity = 1): this {
    const at = time ?? this.Tone.now();
    for (const hz of Array.isArray(notes) ? notes : [notes]) {
      strike(this.Tone, this.b, this.out, this.live, hz, at, velocity, { fadeOut: this.release, duration: Math.max(0.02, duration) });
    }
    return this;
  }

  releaseAll(): this {
    const now = this.Tone.now();
    for (const src of [...this.live]) {
      try { src.stop(now); } catch { /* already ended */ }
    }
    return this;
  }

  dispose(): this {
    for (const src of [...this.live]) {
      try { src.dispose(); } catch { /* already gone */ }
    }
    this.live.clear();
    try { this.out.dispose(); } catch { /* already gone */ }
    return this;
  }
}

export interface LeadAttack {
  /** Hammer-on, pull-off or slide: no new pick stroke. */
  legato?: boolean;
  /** 0..1 palm mute; from 0.3 up the muted string is used. */
  mute?: number;
}

/** What `playLead` needs from a lead voice. Tone.MonoSynth fits it too. */
export interface LeadSynth {
  frequency: {
    cancelScheduledValues(time: number): unknown;
    setValueAtTime(hz: number, time: number): unknown;
    exponentialRampToValueAtTime(hz: number, time: number): unknown;
    linearRampToValueAtTime(hz: number, time: number): unknown;
    getValueAtTime(time: number): number | string;
  };
  triggerAttack(hz: number, time?: number, velocity?: number, attack?: LeadAttack): unknown;
  triggerRelease(time?: number): unknown;
  dispose(): unknown;
  volume: { value: number };
}

/** A chord or melody voice. Tone.PolySynth fits it too. */
export interface PolyVoice {
  triggerAttackRelease(notes: number | number[], duration: number, time?: number, velocity?: number): unknown;
  releaseAll(): unknown;
  dispose(): unknown;
  volume: { value: number };
}

/**
 * One string for the lead line. `frequency` moves the note that was struck last, which is how
 * `playLead` writes bends, slides and vibrato: it strikes, then schedules the pitch.
 */
export class LeadString implements LeadSynth {
  readonly volume: { value: number };
  readonly frequency: LeadSynth["frequency"];
  private readonly out: GainNode;
  private readonly live = new Set<Source>();
  private readonly release: number;
  private cur: { src: Source; base: number; stopAt: number } | null = null;
  private lastHz = 440;

  constructor(private readonly Tone: ToneModule, private readonly b: Bank, dest: unknown, opts: VoiceOptions = {}) {
    const o = outGain(Tone, dest, opts.db ?? 0);
    this.out = o.node;
    this.volume = o.volume;
    this.release = opts.release ?? 0.07;
    this.frequency = {
      cancelScheduledValues: (time) => { this.cur?.src.playbackRate.cancelScheduledValues(time); },
      setValueAtTime: (hz, time) => {
        this.lastHz = hz;
        if (this.cur) this.cur.src.playbackRate.setValueAtTime(hz / this.cur.base, time);
      },
      exponentialRampToValueAtTime: (hz, time) => {
        this.lastHz = hz;
        if (this.cur) this.cur.src.playbackRate.exponentialRampToValueAtTime(hz / this.cur.base, time);
      },
      linearRampToValueAtTime: (hz, time) => {
        this.lastHz = hz;
        if (this.cur) this.cur.src.playbackRate.linearRampToValueAtTime(hz / this.cur.base, time);
      },
      getValueAtTime: (time) => (this.cur ? Number(this.cur.src.playbackRate.getValueAtTime(time)) * this.cur.base : this.lastHz),
    };
  }

  triggerAttack(hz: number, time?: number, velocity = 1, attack?: LeadAttack): this {
    const at = time ?? this.Tone.now();
    // One string holds one note: a new one on a note still ringing stops it.
    const prev = this.cur;
    if (prev && at < prev.stopAt - 1e-4) {
      try {
        prev.src.fadeOut = 0.012;
        prev.src.stop(at);
      } catch { /* already ended */ }
    }
    const legato = !!attack?.legato;
    // playLead sends hammer-ons at about half level, right for an oscillator with no pick sound
    // to lose. Here the pick click is already skipped, so most of that level is given back.
    const gain = legato ? Math.min(1, velocity * 1.35) : velocity;
    const { src, base } = strike(this.Tone, this.b, this.out, this.live, hz, at, gain, {
      muted: (attack?.mute ?? 0) >= 0.3,
      offset: legato ? 0.016 : 0,
      fadeIn: legato ? 0.005 : 0,
      fadeOut: this.release,
    }, (ended) => {
      if (this.cur?.src === ended) this.cur = null;
    });
    this.cur = { src, base, stopAt: Infinity };
    this.lastHz = hz;
    return this;
  }

  triggerRelease(time?: number): this {
    if (time == null) {
      const now = this.Tone.now();
      for (const src of [...this.live]) {
        try { src.stop(now); } catch { /* already ended */ }
      }
      if (this.cur) this.cur.stopAt = now;
      return this;
    }
    if (!this.cur) return this;
    try { this.cur.src.stop(time); } catch { /* already ended */ }
    this.cur.stopAt = time;
    return this;
  }

  dispose(): this {
    for (const src of [...this.live]) {
      try { src.dispose(); } catch { /* already gone */ }
    }
    this.live.clear();
    this.cur = null;
    try { this.out.dispose(); } catch { /* already gone */ }
    return this;
  }
}

export interface StringRig {
  poly(dest: unknown, opts?: VoiceOptions): PolyStrings;
  lead(dest: unknown, opts?: VoiceOptions): LeadString;
}

/** String voices on Tone's audio context, or null when there is none to render into. */
export function mountStrings(Tone: ToneModule): StringRig | null {
  try {
    const raw = Tone.getContext().rawContext as unknown as RawContext;
    if (!raw || typeof raw.createBuffer !== "function") return null;
    if (typeof Tone.ToneBufferSource !== "function" || typeof Tone.Gain !== "function") return null;
    const b = bankFor(raw);
    return {
      poly: (dest, opts) => new PolyStrings(Tone, b, dest, opts),
      lead: (dest, opts) => new LeadString(Tone, b, dest, opts),
    };
  } catch {
    return null;
  }
}
