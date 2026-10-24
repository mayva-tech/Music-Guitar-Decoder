// Typed client for the FastAPI backend (proxied at /api by Next.js).
import type {
  Arrangement, ArrangementSummary, DetectedMelody, Harmonization, HarmonizeResponse, KeyCandidate, PracticeResult,
  PracticeSessionRecord, ProgressSummary, Recommendation, RiffInfo, SkillLevel, Style, TechniquesMode,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, "Can't reach the Music Decoder server. Is the backend running on port 8000?");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      if (res.status >= 500) msg = "Can't reach the Music Decoder server. Is the backend running on port 8000?";
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export interface Job {
  id: string;
  status: "queued" | "running" | "done" | "error";
  stage: string;
  result: DetectedMelody | null;
  error: string | null;
  stages?: string[];
}

export const STAGE_LABELS: Record<string, string> = {
  queued: "Waiting to start",
  decoding: "Reading your recording",
  detecting_pitch: "Listening for the notes",
  segmenting: "Splitting it into notes",
  estimating_tempo: "Finding the beat",
  finding_key: "Finding the key",
  done: "Done",
};

export const api = {
  health: () => call<{ ok: boolean }>("/api/health"),
  startTranscription: (audio: Blob, filename: string, source: "recording" | "upload", title = "My tune") => {
    const fd = new FormData();
    fd.append("file", audio, filename);
    fd.append("source", source);
    fd.append("title", title);
    return call<Job>("/api/transcribe", { method: "POST", body: fd });
  },
  job: (id: string) => call<Job>(`/api/jobs/${id}`),
  demo: () => call<DetectedMelody>("/api/demo"),
  quantize: (melody: DetectedMelody, bpm: number, beat_offset: number) => call<DetectedMelody>("/api/quantize", json({ melody, bpm, beat_offset })),
  refresh: (melody: DetectedMelody) => call<DetectedMelody>("/api/melody/refresh", json({ melody })),
  harmonize: (melody: DetectedMelody, style: Style, skill_level: SkillLevel, key?: KeyCandidate) =>
    call<HarmonizeResponse>("/api/harmonize", json({ melody, style, skill_level, key })),
  generateSolo: (melody: DetectedMelody, harmonization: Harmonization, skill_level: SkillLevel, style: Style, title?: string, techniques: TechniquesMode = "auto") =>
    call<Arrangement>("/api/generate-solo", json({ melody, harmonization, skill_level, style, title, techniques })),
  arrangement: (id: string) => call<Arrangement>(`/api/arrangement/${id}`),
  riffs: () => call<RiffInfo[]>("/api/riffs"),
  riffArrangement: (id: string, skill_level: SkillLevel, techniques: TechniquesMode = "auto", save = true) =>
    call<Arrangement>(`/api/riffs/${encodeURIComponent(id)}/arrangement`, json({ skill_level, techniques, save })),
  arrangements: () => call<ArrangementSummary[]>("/api/arrangements"),
  rename: (id: string, title: string) =>
    call<Arrangement>(`/api/arrangement/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }),
  remove: (id: string) => call<{ deleted: string }>(`/api/arrangement/${id}`, { method: "DELETE" }),
  practiceResult: (r: PracticeResult) =>
    call<{ session: PracticeSessionRecord; progress: ProgressSummary; recommendations: Recommendation[] }>("/api/practice-result", json(r)),
  progress: (arrangementId?: string) =>
    call<{ progress: ProgressSummary; history: PracticeSessionRecord[]; recommendations?: Recommendation[] }>(
      `/api/progress${arrangementId ? `?arrangement_id=${encodeURIComponent(arrangementId)}` : ""}`,
    ),
};

/** Poll a transcription job until it finishes, reporting each real stage. */
export async function waitForJob(id: string, onStage: (stage: string) => void, intervalMs = 300, timeoutMs = 120_000): Promise<DetectedMelody> {
  const t0 = Date.now();
  for (;;) {
    const j = await api.job(id);
    onStage(j.stage);
    if (j.status === "done" && j.result) return j.result;
    if (j.status === "error") throw new ApiError(422, j.error ?? "Analysis failed");
    if (Date.now() - t0 > timeoutMs) throw new ApiError(408, "Analysis is taking too long. Try a shorter recording.");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
