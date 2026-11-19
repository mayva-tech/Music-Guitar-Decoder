/**
 * Acoustic drum one-shots for backing tracks.
 *
 * Each hit is a short sample (pitch-swept kick, snare shell + wires, metallic
 * cymbals) played from a small round-robin pool so hats and rides can overlap.
 * When the audio context is not available (unit tests), the caller keeps the
 * old synth voices.
 */

export type AcousticHit = "kick" | "snare" | "hat" | "ohat" | "ride" | "rim" | "crash";

const SR = 44100;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(data: Float32Array, peak = 0.92) {
  let m = 0;
  for (let i = 0; i < data.length; i++) m = Math.max(m, Math.abs(data[i]!));
  if (m < 1e-6) return data;
  const g = peak / m;
  for (let i = 0; i < data.length; i++) data[i] = Math.tanh(data[i]! * g);
  return data;
}

/** Kick: beater click, pitch drop into a low body. */
export function renderKick(sampleRate = SR): Float32Array {
  const n = Math.floor(sampleRate * 0.46);
  const out = new Float32Array(n);
  const noise = rng(11);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const freq = 46 + 155 * Math.exp(-t * 32) + 18 * Math.exp(-t * 8);
    phase += (2 * Math.PI * freq) / sampleRate;
    const body = Math.sin(phase) * Math.exp(-t * 6.2);
    const sub = Math.sin(2 * Math.PI * 52 * t) * Math.exp(-t * 5.4) * 0.45;
    const click = (noise() * 2 - 1) * Math.exp(-t * 420) * 0.55;
    const beater = Math.sin(2 * Math.PI * 980 * t) * Math.exp(-t * 180) * 0.22;
    out[i] = body * 0.85 + sub + click + beater;
  }
  return normalize(out, 0.95);
}

/**
 * Snare: short pitch-drop body + band-passed wire noise.
 * Pure sustained sines read as a "ting"; real snares are mostly noise with a thump.
 */
export function renderSnare(sampleRate = SR): Float32Array {
  const n = Math.floor(sampleRate * 0.34);
  const out = new Float32Array(n);
  const noise = rng(29);
  // One-pole band-ish noise: HP then soft LP so wires sit in the mid/high, not a bell ping.
  let hp = 0;
  let prev = 0;
  let lp = 0;
  let bodyPhase = 0;
  let air = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    // Head/shell: mini kick that falls from ~220 → ~140 Hz and dies fast (no ringing tone).
    const freq = 145 + 95 * Math.exp(-t * 55);
    bodyPhase += (2 * Math.PI * freq) / sampleRate;
    const bodyEnv = Math.exp(-t * 28);
    const body = Math.sin(bodyPhase) * bodyEnv * 0.55
      + Math.sin(bodyPhase * 1.68) * Math.exp(-t * 48) * 0.12;

    const white = noise() * 2 - 1;
    hp = white - prev + 0.72 * hp;
    prev = white;
    lp += 0.22 * (hp - lp); // soft ~3–5 kHz shelf
    // Wires: loud early snap, then a short rattle — the main snare character.
    const wireEnv = Math.exp(-t * 16) * 0.95 + Math.exp(-t * 7) * 0.35;
    const wires = lp * wireEnv;

    // Stick on head: broadband click, not a sine ping.
    const stick = (noise() * 2 - 1) * Math.exp(-t * 380) * 0.55;
    // A little air/room so it isn't a dry toy click.
    air = air * 0.965 + out[Math.max(0, i - 1)]! * 0.04;
    const room = air * Math.exp(-t * 5) * 0.35;

    out[i] = body + wires + stick + room;
  }
  return normalize(out, 0.92);
}

/** Rim click: dry stick-on-rim wood, not a high sine ting. */
export function renderRim(sampleRate = SR): Float32Array {
  const n = Math.floor(sampleRate * 0.07);
  const out = new Float32Array(n);
  const noise = rng(7);
  let hp = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const white = noise() * 2 - 1;
    hp = white - prev + 0.55 * hp;
    prev = white;
    // Short woody thud + filtered noise — avoids the 1–2 kHz sine "ting".
    const wood = Math.sin(2 * Math.PI * (210 + 40 * Math.exp(-t * 80)) * t) * Math.exp(-t * 95) * 0.55;
    const click = hp * Math.exp(-t * 220) * 0.85;
    out[i] = wood + click;
  }
  return normalize(out, 0.82);
}

/**
 * Closed / open hats and ride as filtered noise — no sine partials.
 * Metallic oscillators were the thin "tin can ting" on every beat.
 */
function renderNoiseCymbal(
  sampleRate: number,
  seconds: number,
  decay: number,
  hpAmt: number,
  seed: number,
  stick = 0.25,
): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  const noise = rng(seed);
  let hp = 0;
  let prev = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const white = noise() * 2 - 1;
    // High-pass for air, then gentle low-pass so it isn't a piercing can.
    hp = white - prev + hpAmt * hp;
    prev = white;
    lp += 0.35 * (hp - lp);
    const env = Math.exp(-t * decay);
    const body = lp * env;
    const tip = (noise() * 2 - 1) * Math.exp(-t * 220) * stick;
    out[i] = body + tip;
  }
  return normalize(out, 0.72);
}

/** Tight closed hat: short hush, sits under the groove without a ping. */
export function renderHat(sampleRate = SR): Float32Array {
  return renderNoiseCymbal(sampleRate, 0.055, 95, 0.55, 41, 0.18);
}

/** Open hat: longer wash, still noise-only. */
export function renderOpenHat(sampleRate = SR): Float32Array {
  return renderNoiseCymbal(sampleRate, 0.28, 14, 0.62, 43, 0.22);
}

/** Ride: soft stick + dark wash (no bell ping). */
export function renderRide(sampleRate = SR): Float32Array {
  return renderNoiseCymbal(sampleRate, 0.55, 5.5, 0.7, 53, 0.3);
}

/** Crash routes to snare in playback; keep a soft wash if anything still asks for it. */
export function renderCrash(sampleRate = SR): Float32Array {
  return renderNoiseCymbal(sampleRate, 0.9, 3.2, 0.68, 67, 0.2);
}

const RENDER: Record<AcousticHit, (sr: number) => Float32Array> = {
  kick: renderKick,
  snare: renderSnare,
  hat: renderHat,
  ohat: renderOpenHat,
  ride: renderRide,
  rim: renderRim,
  crash: renderCrash,
};

const SAMPLE_REV = 3; // bump when a render* changes so live kits rebuild
const rendered = new Map<string, Float32Array>();

export function acousticSamples(kind: AcousticHit, sampleRate = SR): Float32Array {
  const key = `${SAMPLE_REV}:${kind}:${sampleRate}`;
  const hit = rendered.get(key);
  if (hit) return hit;
  const data = RENDER[kind](sampleRate);
  rendered.set(key, data);
  return data;
}

/** Mean absolute level, used by tests to check that hits actually decay. */
export function windowEnergy(data: Float32Array, from: number, to: number): number {
  const a = Math.max(0, from);
  const b = Math.min(data.length, to);
  if (b <= a) return 0;
  let s = 0;
  for (let i = a; i < b; i++) s += Math.abs(data[i]!);
  return s / (b - a);
}

interface SampleContext {
  createBuffer(channels: number, length: number, sampleRate: number): {
    copyToChannel?(source: Float32Array, channel: number): void;
    getChannelData(channel: number): Float32Array;
    sampleRate: number;
    length: number;
  };
  sampleRate: number;
}

type ToneLike = {
  getContext?: () => { rawContext?: SampleContext };
  Player?: new (...args: any[]) => {
    connect(dest: unknown): unknown;
    start(time?: number): void;
    dispose(): void;
    volume: { value: number; setValueAtTime?: (v: number, t: number) => void; cancelScheduledValues?: (t: number) => void };
  };
};

export interface DrumShot {
  triggerAttackRelease(...args: number[]): void;
  dispose(): void;
  volume: { value: number };
}

/**
 * Polyphonic one-shot. `triggerAttackRelease` accepts both MembraneSynth
 * (freq, dur, time, vel) and NoiseSynth (dur, time, vel) argument lists.
 * Returns null when samples cannot be mounted.
 */
export function mountAcousticHit(Tone: ToneLike, dest: unknown, kind: AcousticHit, gainDb: number): DrumShot | null {
  try {
    const raw = Tone.getContext?.()?.rawContext;
    if (!raw || typeof raw.createBuffer !== "function" || typeof Tone.Player !== "function") return null;
    const data = acousticSamples(kind, raw.sampleRate || SR);
    const buffer = raw.createBuffer(1, data.length, raw.sampleRate || SR);
    if (typeof buffer.copyToChannel === "function") buffer.copyToChannel(data, 0);
    else buffer.getChannelData(0).set(data);
    const pool = Array.from({ length: 8 }, () => {
      const p = new Tone.Player!(buffer);
      p.connect(dest);
      p.volume.value = gainDb;
      return p;
    });
    let i = 0;
    return {
      volume: { value: gainDb },
      dispose() {
        for (const p of pool) {
          try { p.dispose(); } catch { /* ignore */ }
        }
      },
      triggerAttackRelease(...args: number[]) {
        const time = args.length >= 4 ? args[2]! : args.length >= 2 ? args[1]! : 0;
        const vel = args.length >= 4 ? (args[3] ?? 1) : args.length >= 3 ? (args[2] ?? 1) : 1;
        const p = pool[i++ % pool.length]!;
        const db = gainDb + (Math.max(0.12, Math.min(1, vel)) - 1) * 16;
        try {
          p.volume.cancelScheduledValues?.(time);
          p.volume.setValueAtTime?.(db, time);
        } catch {
          p.volume.value = db;
        }
        p.start(time);
      },
    };
  } catch {
    return null;
  }
}
