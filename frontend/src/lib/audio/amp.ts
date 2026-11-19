/**
 * Adjustable guitar amp: model (LeadTone) + knobs.
 * Knobs are 0–10; 5 is the centre. Tone presets load a starting set of knobs.
 * Users can also save named presets (tone + knobs) and click one to make it active.
 */
import { DEFAULT_LEAD_TONE, normalizeLeadTone, type LeadTone } from "./leadTone";

export interface AmpKnobs {
  /** Drive / input gain. */
  gain: number;
  bass: number;
  mid: number;
  treble: number;
  presence: number;
  /** Delay mix (echo). */
  delay: number;
  /** Delay feedback / repeats. */
  feedback: number;
  /** Reverb / room. */
  reverb: number;
  /** Palm mute / chug intensity (metal angst). */
  mute: number;
  /** Output level. */
  master: number;
}

export type AmpKnobId = keyof AmpKnobs;

/** A named amp snapshot the user can click to activate. */
export interface SavedAmpPreset {
  id: string;
  name: string;
  tone: LeadTone;
  amp: AmpKnobs;
}

export const MAX_SAVED_AMP_PRESETS = 12;

export const AMP_KNOB_META: { id: AmpKnobId; label: string }[] = [
  { id: "gain", label: "Gain" },
  { id: "bass", label: "Bass" },
  { id: "mid", label: "Mid" },
  { id: "treble", label: "Treble" },
  { id: "presence", label: "Presence" },
  { id: "delay", label: "Delay" },
  { id: "feedback", label: "Feedback" },
  { id: "reverb", label: "Reverb" },
  { id: "mute", label: "Palm" },
  { id: "master", label: "Master" },
];

export const DEFAULT_AMP: AmpKnobs = {
  gain: 5, bass: 5, mid: 5, treble: 5, presence: 5,
  delay: 2, feedback: 2, reverb: 2.5, mute: 0, master: 5,
};

/** Starting knob positions for each amp model. */
export const AMP_PRESETS: Record<LeadTone, AmpKnobs> = {
  clean: { gain: 2.5, bass: 6, mid: 5, treble: 4, presence: 3.5, delay: 2.5, feedback: 2, reverb: 3.5, mute: 0, master: 6.5 },
  crunch: { gain: 7, bass: 5.5, mid: 6, treble: 5, presence: 5.5, delay: 3, feedback: 3, reverb: 2.5, mute: 2, master: 5 },
  distortion: { gain: 9.5, bass: 6.5, mid: 3.5, treble: 5.5, presence: 6.5, delay: 1.5, feedback: 1.5, reverb: 1.5, mute: 5.5, master: 3.5 },
  blues: { gain: 5.5, bass: 6.5, mid: 5.5, treble: 4, presence: 4.5, delay: 3.5, feedback: 3, reverb: 4, mute: 0, master: 5.5 },
  wah: { gain: 6.5, bass: 5, mid: 6.5, treble: 5.5, presence: 6.5, delay: 4, feedback: 3.5, reverb: 3, mute: 1, master: 5 },
};

function clampKnob(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

export function normalizeAmp(raw: unknown): AmpKnobs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<AmpKnobs>;
  return {
    gain: clampKnob(r.gain, DEFAULT_AMP.gain),
    bass: clampKnob(r.bass, DEFAULT_AMP.bass),
    mid: clampKnob(r.mid, DEFAULT_AMP.mid),
    treble: clampKnob(r.treble, DEFAULT_AMP.treble),
    presence: clampKnob(r.presence, DEFAULT_AMP.presence),
    delay: clampKnob(r.delay, DEFAULT_AMP.delay),
    feedback: clampKnob(r.feedback, DEFAULT_AMP.feedback),
    reverb: clampKnob(r.reverb, DEFAULT_AMP.reverb),
    mute: clampKnob(r.mute, DEFAULT_AMP.mute),
    master: clampKnob(r.master, DEFAULT_AMP.master),
  };
}

/** Compact signature so the lead rig rebuilds when knobs change. */
export function ampSignature(tone: LeadTone, amp: AmpKnobs): string {
  const a = normalizeAmp(amp);
  return `${tone}|${[a.gain, a.bass, a.mid, a.treble, a.presence, a.delay, a.feedback, a.reverb, a.mute, a.master].join(",")}`;
}

/** 0–10 Palm knob → 0..1 mute intensity for lead chugs. */
export function muteFromAmp(amp: AmpKnobs): number {
  return knobUnit(amp.mute);
}

/** Map 0–10 → roughly −dB..+dB (centre 5 = 0). */
export function knobToDb(knob: number, span = 10): number {
  return ((clampKnob(knob, 5) - 5) / 5) * span;
}

/** 0–10 → 0..1 */
export function knobUnit(knob: number): number {
  return clampKnob(knob, 5) / 10;
}

/**
 * Drive numbers for the Tone.js stack, shaped by model + Gain knob.
 * Gain is intentionally aggressive — post gain pulls level back so dense licks don't clip the bus.
 */
export function driveFromAmp(tone: LeadTone, amp: AmpKnobs): {
  pre: number;
  distortion: number;
  post: number;
  stage2?: number;
  stage3?: number;
  softClean: boolean;
} {
  const g = knobUnit(amp.gain);
  if (tone === "clean") {
    return {
      pre: 1.2 + g * 2.6,
      distortion: 0.05 + g * 0.32,
      post: 0.82 - g * 0.28,
      softClean: true,
    };
  }
  if (tone === "blues") {
    return { pre: 1.6 + g * 4.2, distortion: 0.2 + g * 0.48, post: 0.72 - g * 0.32, softClean: false };
  }
  if (tone === "crunch" || tone === "wah") {
    return { pre: 2 + g * 5.8, distortion: 0.3 + g * 0.58, post: 0.62 - g * 0.34, softClean: false };
  }
  // distortion — triple stack, gain opens all stages hard
  return {
    pre: 4.5 + g * 12,
    distortion: 0.72 + g * 0.28,
    post: 0.16 - g * 0.06,
    stage2: 0.72 + g * 0.28,
    stage3: 0.62 + g * 0.35,
    softClean: false,
  };
}

/** Delay + reverb settings from the FX knobs (kept mild so dense licks stay clear). */
export function spaceFromAmp(amp: AmpKnobs): {
  delayWet: number;
  delayTime: number;
  feedback: number;
  reverbWet: number;
  roomSize: number;
  dampening: number;
} {
  const d = knobUnit(amp.delay);
  const f = knobUnit(amp.feedback);
  const r = knobUnit(amp.reverb);
  return {
    delayWet: d * 0.55,
    delayTime: 0.2 + d * 0.32,
    // Feedback only bites when delay is up; hard-cap to avoid runaway.
    feedback: Math.min(0.7, f * 0.68 * (0.25 + d * 0.75)),
    reverbWet: r * 0.48,
    roomSize: 0.35 + r * 0.55,
    dampening: 0.55 + (1 - r) * 0.3,
  };
}

/** Master knob → synth volume in dB. */
export function masterDb(tone: LeadTone, amp: AmpKnobs): number {
  const base = tone === "distortion" ? -14 : tone === "wah" ? -6 : tone === "clean" ? -4 : -5;
  return base + knobToDb(amp.master, 8);
}

export function presetForTone(tone: LeadTone = DEFAULT_LEAD_TONE): AmpKnobs {
  return { ...AMP_PRESETS[tone] };
}

function newPresetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `amp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAmpPreset(name: string, tone: LeadTone, amp: AmpKnobs): SavedAmpPreset {
  const trimmed = name.trim().slice(0, 28) || "My amp";
  return {
    id: newPresetId(),
    name: trimmed,
    tone: normalizeLeadTone(tone),
    amp: normalizeAmp(amp),
  };
}

/**
 * Next auto name for a tone dial-in: crunch → crunch1, crunch2, …
 * Skips numbers already used (case-insensitive) among saved presets.
 */
export function nextTonePresetName(tone: LeadTone, presets: SavedAmpPreset[]): string {
  const t = normalizeLeadTone(tone);
  const re = new RegExp(`^${t}(\\d+)$`, "i");
  let max = 0;
  for (const p of presets) {
    const m = re.exec(p.name.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${t}${max + 1}`;
}

export function normalizeAmpPresets(raw: unknown): SavedAmpPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedAmpPreset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<SavedAmpPreset>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 28) : "";
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 64) : newPresetId();
    if (!name) continue;
    out.push({
      id,
      name,
      tone: normalizeLeadTone(r.tone),
      amp: normalizeAmp(r.amp),
    });
    if (out.length >= MAX_SAVED_AMP_PRESETS) break;
  }
  return out;
}

/** True when the live amp matches this saved preset (tone + knobs). */
export function ampPresetMatches(preset: SavedAmpPreset, tone: LeadTone, amp: AmpKnobs): boolean {
  return ampSignature(preset.tone, preset.amp) === ampSignature(tone, amp);
}
