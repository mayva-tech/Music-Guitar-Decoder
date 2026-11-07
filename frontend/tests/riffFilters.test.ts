import { describe, expect, it } from "vitest";
import { chordLine, matchesType } from "@/lib/riffFilters";
import type { RiffInfo } from "@/lib/types";

const riff = (over: Partial<RiffInfo>): RiffInfo => ({
  id: "x", title: "X", credit: "", source: "original", year: null, genre: "rock", vibe: "", difficulty: 1, focus: [], tips: [],
  tempo_bpm: 100, key_name: "A minor", bars: 4, note_count: 1, techniques: [], tab_preview: "", ...over,
});

describe("riff type filter", () => {
  const classic = riff({ source: "public_domain", year: 1824 });
  const technique = riff({});
  const modern = riff({ vibe: "Grunge" });
  const bluesRock = riff({ vibe: "Shuffle riff", collection: "blues_rock" });
  const all = [classic, technique, modern, bluesRock];
  it("gives every riff exactly one type", () => {
    for (const r of all) {
      const types = (["public_domain", "original", "modern", "blues_rock"] as const).filter((t) => matchesType(r, t));
      expect(types).toHaveLength(1);
    }
  });
  it("keeps the blues-rock set out of Modern styles", () => {
    expect(all.filter((r) => matchesType(r, "modern"))).toEqual([modern]);
    expect(all.filter((r) => matchesType(r, "blues_rock"))).toEqual([bluesRock]);
  });
});

describe("chord line", () => {
  it("collapses repeats and brackets half-bar changes", () => {
    expect(chordLine(["E7", "E7", "E7", "E7", "A7", "A7", "E7", "E7", "B7", "A7", "E7", "B7"]))
      .toBe("E7 ×4 · A7 ×2 · E7 ×2 · B7 · A7 · E7 · B7");
    expect(chordLine(["E5", "G5 A5", "B5"])).toBe("E5 · (G5 A5) · B5");
  });
});
