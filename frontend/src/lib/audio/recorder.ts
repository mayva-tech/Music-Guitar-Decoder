// Microphone recording for humming/whistling, with a live analyser for the waveform.
import { requestMicrophone, stopStream } from "./mic";

export const MAX_RECORDING_SEC = 15;
export const SUPPORTED_UPLOAD_TYPES = [".wav", ".mp3", ".m4a", ".mp4", ".aac", ".ogg", ".oga", ".opus", ".webm", ".flac"];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function pickMimeType(isSupported: (t: string) => boolean): string | undefined {
  const prefs = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
  return prefs.find((t) => isSupported(t));
}

export function extensionFor(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Validate an uploaded file before sending it (the server validates again). */
export function validateUpload(file: { name: string; size: number }): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!SUPPORTED_UPLOAD_TYPES.includes(ext)) return `That file type isn't supported. Use one of: ${SUPPORTED_UPLOAD_TYPES.join(", ")}.`;
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "That file is larger than 15 MB. Trim it to 5–15 seconds.";
  return null;
}

export interface ActiveRecording {
  analyser: AnalyserNode;
  mimeType: string;
  stop: () => Promise<Blob>;
  cancel: () => void;
}

export async function startRecording(): Promise<ActiveRecording> {
  const stream = await requestMicrophone();
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const mimeType = pickMimeType((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(250);
  const cleanup = () => {
    stopStream(stream);
    ctx.close().catch(() => undefined);
  };
  return {
    analyser,
    mimeType: rec.mimeType || mimeType || "audio/webm",
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          cleanup();
          resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
        };
        rec.state !== "inactive" ? rec.stop() : rec.onstop?.(new Event("stop"));
      }),
    cancel: () => {
      if (rec.state !== "inactive") rec.stop();
      cleanup();
    },
  };
}
