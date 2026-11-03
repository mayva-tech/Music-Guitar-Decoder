/**
 * Lead / practice amp tones for licks and guided solos.
 * Prefs + Theory player lead rig share these ids.
 */

export const LEAD_TONES = [
  { id: "clean", label: "Clean", blurb: "Clear amp, no drive." },
  { id: "crunch", label: "Crunch", blurb: "Mild amp breakup." },
  { id: "distortion", label: "Distortion", blurb: "Heavy metal wall: saturated high-gain stack." },
  { id: "wah", label: "Wah", blurb: "Auto-wah sweep on the lead." },
  { id: "blues", label: "Blues", blurb: "Warm, soft overdrive." },
] as const;

export type LeadTone = (typeof LEAD_TONES)[number]["id"];

export const DEFAULT_LEAD_TONE: LeadTone = "clean";

export function isLeadTone(v: unknown): v is LeadTone {
  return typeof v === "string" && LEAD_TONES.some((t) => t.id === v);
}

export function normalizeLeadTone(v: unknown): LeadTone {
  return isLeadTone(v) ? v : DEFAULT_LEAD_TONE;
}

export function leadToneBlurb(id: LeadTone): string {
  return LEAD_TONES.find((t) => t.id === id)?.blurb ?? LEAD_TONES[0]!.blurb;
}
