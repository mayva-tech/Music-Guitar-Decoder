"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch, toMidiFloat } from "./pitch";
import { MicError, classifyMicError, requestMicrophone, stopStream } from "./mic";

export interface LiveFrame {
  midi: number | null;
  clarity: number;
  rms: number;
  at: number; // performance.now() ms
}

export interface MicPitchOptions {
  a4: number;
  noiseGate: number;
  clarityThreshold: number;
}

/** Listens to the microphone and reports a pitch frame ~25 times per second. */
export function useMicPitch(opts: MicPitchOptions, onFrame: (f: LiveFrame) => void) {
  const [state, setState] = useState<"off" | "starting" | "on" | "error">("off");
  const [error, setError] = useState<MicError | null>(null);
  const [level, setLevel] = useState(0);
  const refs = useRef<{ stream?: MediaStream; ctx?: AudioContext; timer?: ReturnType<typeof setInterval> }>({});
  const cb = useRef(onFrame);
  const optRef = useRef(opts);
  cb.current = onFrame;
  optRef.current = opts;

  const stop = useCallback(() => {
    const r = refs.current;
    if (r.timer) clearInterval(r.timer);
    stopStream(r.stream);
    r.ctx?.close().catch(() => undefined);
    refs.current = {};
    setState("off");
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (refs.current.stream) return true;
    setState("starting");
    setError(null);
    try {
      const stream = await requestMicrophone();
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 4096;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const timer = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        const o = optRef.current;
        const r = detectPitch(buf, ctx.sampleRate, { rmsGate: o.noiseGate, minFreq: 70, maxFreq: 1400 });
        const midi = r.clarity >= o.clarityThreshold ? toMidiFloat(r, o.a4) : null;
        setLevel(r.rms);
        cb.current({ midi, clarity: r.clarity, rms: r.rms, at: performance.now() });
      }, 40);
      refs.current = { stream, ctx, timer };
      setState("on");
      return true;
    } catch (e) {
      setError(classifyMicError(e));
      setState("error");
      return false;
    }
  }, []);

  /** Measure the room's background level for ~1.5 s and suggest a noise gate. */
  const measureNoise = useCallback(async (): Promise<number | null> => {
    const ok = refs.current.stream ? true : await start();
    if (!ok) return null;
    const samples: number[] = [];
    const prev = cb.current;
    await new Promise<void>((resolve) => {
      cb.current = (f) => {
        samples.push(f.rms);
        prev(f);
      };
      setTimeout(resolve, 1500);
    });
    cb.current = onFrame;
    if (!samples.length) return null;
    samples.sort((a, b) => a - b);
    const p90 = samples[Math.floor(samples.length * 0.9)];
    return Math.min(0.08, Math.max(0.004, p90 * 2.5));
  }, [start, onFrame]);

  useEffect(() => stop, [stop]);

  return { state, error, level, start, stop, measureNoise };
}
