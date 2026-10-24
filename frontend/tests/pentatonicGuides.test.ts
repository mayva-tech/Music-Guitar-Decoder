import { describe, expect, it } from "vitest";
import {
  MINOR_PENTA_BOX,
  PENTATONIC_GUIDES,
  minorPentatonicNotes,
  naturalMinorNotes,
  relativeMajorRoot,
} from "@/lib/music/pentatonicGuides";
import { LESSONS } from "@/lib/music/lessons";

describe("pentatonic guides", () => {
  it("links the Progress lesson to the full guide page", () => {
    const lesson = LESSONS.find((l) => l.id === "pentatonic");
    expect(lesson?.detailHref).toBe("/progress/pentatonic-box");
    expect(lesson?.body[1]).toMatch(/full guide|A.*E.*D/i);
  });

  it("builds A minor pentatonic and its relative major", () => {
    expect(naturalMinorNotes("A")).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(minorPentatonicNotes("A")).toEqual(["A", "C", "D", "E", "G"]);
    expect(relativeMajorRoot("A")).toBe("C");
  });

  it("ships A / E / D examples with a six-string box shape", () => {
    expect(PENTATONIC_GUIDES.map((g) => g.root)).toEqual(["A", "E", "D"]);
    expect(MINOR_PENTA_BOX).toHaveLength(6);
    for (const row of MINOR_PENTA_BOX) {
      expect(row.offsets).toHaveLength(2);
      expect(row.degrees).toHaveLength(2);
    }
    const a = PENTATONIC_GUIDES.find((g) => g.id === "a-minor")!;
    expect(a.rootFret).toBe(5);
    expect(a.notes[0]).toBe("A");
  });
});
