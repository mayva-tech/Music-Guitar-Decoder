import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_TONE, isLeadTone, LEAD_TONES, normalizeLeadTone } from "@/lib/audio/leadTone";

describe("leadTone", () => {
  it("lists the practice amp tones", () => {
    expect(LEAD_TONES.map((t) => t.id)).toEqual(["clean", "crunch", "distortion", "wah", "blues"]);
  });

  it("normalizes unknown values to clean", () => {
    expect(normalizeLeadTone("crunch")).toBe("crunch");
    expect(normalizeLeadTone("wah")).toBe("wah");
    expect(normalizeLeadTone("nope")).toBe(DEFAULT_LEAD_TONE);
    expect(normalizeLeadTone(undefined)).toBe(DEFAULT_LEAD_TONE);
    expect(isLeadTone("blues")).toBe(true);
    expect(isLeadTone("fuzz")).toBe(false);
  });
});
