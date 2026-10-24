"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Notice, PageTitle } from "@/components/AppShell";
import { IconHeadphones, IconMic, IconStop, IconUpload } from "@/components/Icons";
import { ApiError, STAGE_LABELS, api, waitForJob } from "@/lib/api";
import { MicError } from "@/lib/audio/mic";
import { MAX_RECORDING_SEC, SUPPORTED_UPLOAD_TYPES, extensionFor, startRecording, validateUpload, type ActiveRecording } from "@/lib/audio/recorder";
import { getLastRecording, setLastRecording } from "@/lib/session";
import { useApp } from "@/lib/store";

type Phase = "idle" | "recording" | "ready" | "analyzing" | "error";
const PIPELINE = ["decoding", "detecting_pitch", "segmenting", "estimating_tempo", "finding_key"];

export default function RecordPage() {
  const router = useRouter();
  const setMelody = useApp((s) => s.setMelody);
  const favorite = useApp((s) => s.prefs.favoriteSong);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>("queued");
  const [audio, setAudio] = useState<{ blob: Blob; url: string; name: string; source: "recording" | "upload" } | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [title, setTitle] = useState(favorite || "My tune");
  const rec = useRef<ActiveRecording | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  const t0 = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    rec.current?.cancel();
  }, []);

  const drawLive = useCallback(() => {
    const c = canvas.current, r = rec.current;
    if (!c || !r) return;
    const ctx = c.getContext("2d")!;
    const buf = new Float32Array(r.analyser.fftSize);
    r.analyser.getFloatTimeDomainData(buf);
    const { width: w, height: h } = c;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#e9ddc3";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < buf.length; i += 4) {
      const x = (i / buf.length) * w;
      const y = h / 2 + buf[i] * h * 0.9;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    const secs = (performance.now() - t0.current) / 1000;
    setElapsed(secs);
    if (secs >= MAX_RECORDING_SEC) {
      void stop();
      return;
    }
    raf.current = requestAnimationFrame(drawLive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = async () => {
    setError(null);
    setPeaks(null);
    try {
      rec.current = await startRecording();
      t0.current = performance.now();
      setPhase("recording");
      raf.current = requestAnimationFrame(drawLive);
    } catch (e) {
      setPhase("error");
      setError(e instanceof MicError ? `${e.message} You can also upload an audio file instead.` : String(e));
    }
  };

  const stop = async () => {
    cancelAnimationFrame(raf.current);
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    const blob = await r.stop();
    const secs = (performance.now() - t0.current) / 1000;
    if (blob.size === 0 || secs < 0.6) {
      setPhase("error");
      setError("That recording was too short. Press record, hum for 5–15 seconds, then press stop.");
      return;
    }
    await accept(blob, `recording.${extensionFor(r.mimeType)}`, "recording");
  };

  const accept = async (blob: Blob, name: string, source: "recording" | "upload") => {
    setLastRecording(blob, name);
    const url = getLastRecording()!.url;
    setAudio({ blob, url, name, source });
    setPhase("ready");
    try {
      const ctx = new AudioContext();
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      const data = buf.getChannelData(0);
      const n = 120, step = Math.floor(data.length / n);
      const p: number[] = [];
      for (let i = 0; i < n; i++) {
        let m = 0;
        for (let j = i * step; j < (i + 1) * step; j++) m = Math.max(m, Math.abs(data[j]));
        p.push(m);
      }
      const max = Math.max(...p, 1e-6);
      setPeaks(p.map((v) => v / max));
      setElapsed(buf.duration);
      ctx.close();
      if (buf.duration > 30) {
        setError("This recording is longer than 30 seconds. Please trim it to 5–15 seconds.");
        setPhase("error");
      }
    } catch {
      setPeaks(null); // the server can still decode formats the browser can't preview
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const problem = validateUpload(f);
    if (problem) {
      setError(problem);
      setPhase("error");
      return;
    }
    setError(null);
    await accept(f, f.name, "upload");
  };

  const analyze = async () => {
    if (!audio) return;
    setPhase("analyzing");
    setStage("queued");
    setError(null);
    try {
      const job = await api.startTranscription(audio.blob, audio.name, audio.source, title.trim() || "My tune");
      const melody = await waitForJob(job.id, setStage);
      setMelody(melody);
      router.push("/decoder");
    } catch (e) {
      setPhase("ready");
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  const tryDemo = async () => {
    try {
      setMelody(await api.demo());
      router.push("/decoder");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stageIdx = PIPELINE.indexOf(stage);

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Record a melody" lead="Hum, whistle or sing one note at a time, for 5–15 seconds. A quiet room helps." />

      <section className="surface p-5 md:p-8">
        <div className="flex flex-col items-center gap-5">
          <div className="relative h-36 w-full overflow-hidden rounded-2xl bg-tolex" aria-label="Audio waveform">
            {phase === "recording" ? (
              <canvas ref={canvas} width={900} height={144} className="h-full w-full" />
            ) : peaks ? (
              <div className="flex h-full items-center gap-[2px] px-3" data-testid="waveform">
                {peaks.map((p, i) => <span key={i} className="flex-1 rounded-full bg-maple/80" style={{ height: `${Math.max(3, p * 92)}%` }} />)}
              </div>
            ) : (
              <p className="flex h-full items-center justify-center text-faint">
                {audio ? "Recording ready" : "Your waveform will appear here"}
              </p>
            )}
          </div>

          <p className="display text-4xl tabular-nums" aria-live="polite" data-testid="timer">
            {elapsed.toFixed(1)}<span className="text-lg text-muted"> s</span>
          </p>

          {phase === "recording" ? (
            <button onClick={stop} className="btn h-20 w-20 rounded-full bg-bad text-tolex" aria-label="Stop recording">
              <IconStop width={30} height={30} />
            </button>
          ) : (
            <button onClick={begin} disabled={phase === "analyzing"} className="btn h-20 w-20 rounded-full bg-maple text-tolex" aria-label={audio ? "Record again" : "Start recording"}>
              <IconMic width={30} height={30} />
            </button>
          )}
          <p className="text-sm text-muted">
            {phase === "recording" ? `Recording… stops automatically at ${MAX_RECORDING_SEC} s` : audio ? "Press the microphone to record again" : "Press the microphone to start"}
          </p>
        </div>

        {audio && phase !== "recording" && (
          <div className="mt-6 grid gap-4 border-t border-line pt-6">
            <audio controls src={audio.url} className="w-full" data-testid="playback" />
            <label className="grid gap-1.5">
              <span className="text-sm text-muted">Name your tune</span>
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
            </label>
            <button className="btn btn-primary" onClick={analyze} disabled={phase === "analyzing"}>
              {phase === "analyzing" ? "Decoding…" : "Decode my tune"}
            </button>
          </div>
        )}

        {phase === "analyzing" && (
          <ol className="mt-6 grid gap-2" aria-live="polite" data-testid="job-stages">
            {PIPELINE.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 ${i < stageIdx ? "text-ok" : i === stageIdx ? "text-ink" : "text-faint"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${i < stageIdx ? "bg-ok" : i === stageIdx ? "bg-maple animate-pulse" : "bg-line"}`} aria-hidden />
                {STAGE_LABELS[s]}
              </li>
            ))}
          </ol>
        )}

        {error && <div className="mt-6"><Notice tone="error">{error}</Notice></div>}
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-3">
        <input ref={fileInput} type="file" accept={SUPPORTED_UPLOAD_TYPES.join(",") + ",audio/*"} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="upload-input" />
        <button className="btn btn-ghost" onClick={() => fileInput.current?.click()} disabled={phase === "recording" || phase === "analyzing"}>
          <IconUpload /> Upload audio
        </button>
        <button className="btn btn-ghost" onClick={tryDemo} disabled={phase === "recording" || phase === "analyzing"}>Use the demo tune instead</button>
      </section>
      <p className="mt-4 flex items-start gap-2 text-sm text-muted">
        <IconHeadphones className="mt-0.5 shrink-0" width={18} height={18} />
        Supported files: WAV, MP3, M4A, OGG, WebM, FLAC (up to 15 MB). Your browser asks before using the microphone.
      </p>
    </div>
  );
}
