// Real-time monophonic pitch detection (YIN, de Cheveigné & Kawahara 2002) for live guitar feedback.
import { freqToMidi } from "../music/theory";

export interface PitchOptions {
  minFreq?: number;
  maxFreq?: number;
  threshold?: number; // YIN absolute threshold
  rmsGate?: number; // ignore frames quieter than this
}

export interface PitchResult {
  freq: number | null;
  clarity: number; // 0..1, 1 = perfectly periodic
  rms: number;
}

export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

// Scratch buffers reused between frames (no allocation per frame → no GC hiccups).
let scratch: { d: Float32Array; cmnd: Float32Array; half: Float32Array } | null = null;
function buffers(n: number) {
  if (!scratch || scratch.half.length < n) scratch = { d: new Float32Array(n), cmnd: new Float32Array(n), half: new Float32Array(n) };
  return scratch;
}

/**
 * YIN, optimised for live use:
 *  - at 44.1/48 kHz the frame is first halved by averaging sample pairs (guitar and voice
 *    fundamentals stay far below the new Nyquist), which quarters the work;
 *  - the difference function is computed lag by lag and stops just after the first dip
 *    below the threshold, instead of for every lag.
 */
export function detectPitch(input: Float32Array, sampleRate: number, opts: PitchOptions = {}): PitchResult {
  const { minFreq = 70, maxFreq = 1400, threshold = 0.15, rmsGate = 0.01 } = opts;
  const level = rms(input);
  if (level < rmsGate) return { freq: null, clarity: 0, rms: level };

  let buf = input;
  let sr = sampleRate;
  if (sampleRate > 30000) {
    const half = Math.floor(input.length / 2);
    const s = buffers(half).half;
    for (let i = 0; i < half; i++) s[i] = 0.5 * (input[2 * i] + input[2 * i + 1]);
    buf = s.subarray(0, half);
    sr = sampleRate / 2;
  }

  const n = buf.length;
  const tauMin = Math.max(2, Math.floor(sr / maxFreq));
  const tauMax = Math.min(Math.floor(sr / minFreq), Math.floor(n / 2));
  const w = n - tauMax;
  const { d, cmnd } = buffers(tauMax + 2);
  cmnd[0] = 1;
  let running = 0;
  let tauEst = -1;
  let computed = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < w; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
    running += sum;
    cmnd[tau] = running > 0 ? (sum * tau) / running : 1;
    computed = tau;
    if (tauEst < 0 && tau >= tauMin + 1 && cmnd[tau - 1] < threshold && cmnd[tau] >= cmnd[tau - 1]) {
      tauEst = tau - 1; // first local minimum under the threshold
      if (tau + 1 <= tauMax) continue; // compute one more lag for interpolation
    }
    if (tauEst >= 0 && tau >= tauEst + 1) break;
  }
  if (tauEst < 0) {
    let best = tauMin;
    for (let tau = tauMin; tau <= computed; tau++) if (cmnd[tau] < cmnd[best]) best = tau;
    if (cmnd[best] > 0.35) return { freq: null, clarity: 1 - cmnd[best], rms: level };
    tauEst = best;
  }
  let better = tauEst;
  if (tauEst > 1 && tauEst < computed) {
    const s0 = cmnd[tauEst - 1], s1 = cmnd[tauEst], s2 = cmnd[tauEst + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tauEst + (s2 - s0) / denom;
  }
  return { freq: sr / better, clarity: Math.max(0, Math.min(1, 1 - cmnd[tauEst])), rms: level };
}

export function toMidiFloat(r: PitchResult, a4 = 440): number | null {
  return r.freq ? freqToMidi(r.freq, a4) : null;
}
