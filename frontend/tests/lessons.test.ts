import { describe, expect, it } from "vitest";
import { CHORD_RECIPES, CHROMATIC_FROM_C } from "@/lib/music/chordRecipes";
import { KEY_GUIDES } from "@/lib/music/keyGuides";
import { LESSONS, lessonSpeakText } from "@/lib/music/lessons";

describe("building-chords lesson", () => {
  const lesson = LESSONS.find((l) => l.id === "building-chords");

  it("is in the lesson list and unlocked from the start", () => {
    expect(lesson).toBeDefined();
    expect(lesson!.title).toBe("From tune to chords");
    expect(lesson!.unlockedBy).toBeNull();
  });

  it("points to a full guide page instead of dense inline diagrams", () => {
    expect(lesson!.detailHref).toBe("/progress/building-chords");
    expect(lesson!.body.length).toBeGreaterThanOrEqual(2);
    expect(lesson!.body[0]).toMatch(/home note/i);
    expect(lesson!.body[1]).toMatch(/C major|D major|full guide/i);
    expect(lesson!.diagrams).toBeUndefined();
    expect(lesson!.quickRef!.map((r) => r.principle)).toEqual([
      "Home note", "Scale", "Chord", "Power chord",
    ]);
  });

  it("builds a speakable string for auto read aloud", () => {
    const spoken = lessonSpeakText(lesson!);
    expect(spoken).toContain("From tune to chords");
    expect(spoken).toContain("Home note.");
    expect(spoken).toContain(lesson!.body[0]!);
  });
});

describe("key guides (C / D / G major)", () => {
  it("ships C, D and G with scale, family, and power chords", () => {
    expect(KEY_GUIDES.map((k) => k.id)).toEqual(["c-major", "d-major", "g-major"]);
    for (const g of KEY_GUIDES) {
      expect(g.scale).toHaveLength(7);
      expect(g.chords).toHaveLength(7);
      expect(g.chords[0]!.roman).toBe("I");
      expect(g.chords[0]!.notes).toHaveLength(3);
      expect(g.powerChords.length).toBeGreaterThanOrEqual(6);
      expect(g.powerChords[0]!.notes).toHaveLength(2);
    }
  });

  it("builds C major home as C E G and D major home as D F# A", () => {
    const c = KEY_GUIDES.find((k) => k.id === "c-major")!;
    const d = KEY_GUIDES.find((k) => k.id === "d-major")!;
    expect(c.scale).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    expect(c.chords[0]!.notes).toEqual(["C", "E", "G"]);
    expect(c.powerChords.map((p) => p.symbol)).toContain("C5");
    expect(c.powerChords.map((p) => p.symbol)).toContain("G5");
    expect(d.scale).toEqual(["D", "E", "F#", "G", "A", "B", "C#"]);
    expect(d.chords[0]!.notes).toEqual(["D", "F#", "A"]);
    expect(d.powerChords.map((p) => p.symbol)).toContain("D5");
  });
});

describe("chord recipe diagram data", () => {
  it("spans one octave plus the top C (13 boxes)", () => {
    expect(CHROMATIC_FROM_C).toHaveLength(13);
    expect(CHROMATIC_FROM_C[0]).toBe("C");
    expect(CHROMATIC_FROM_C[12]).toBe("C");
  });

  it("places major, minor, power and seventh tones on the correct frets", () => {
    const steps = (symbol: string) => CHORD_RECIPES.find((r) => r.symbol === symbol)!.tones.map((t) => [t.step, t.label]);
    expect(steps("C")).toEqual([[0, "R"], [4, "3"], [7, "5"]]);
    expect(steps("Cm")).toEqual([[0, "R"], [3, "b3"], [7, "5"]]);
    expect(steps("C5")).toEqual([[0, "R"], [7, "5"], [12, "R"]]);
    expect(steps("C7")).toEqual([[0, "R"], [4, "3"], [7, "5"], [10, "b7"]]);
  });

  it("marks only the 3rd as the happy/sad tone", () => {
    for (const row of CHORD_RECIPES) {
      for (const t of row.tones) {
        if (t.label === "3" || t.label === "b3") expect(t.kind).toBe("third");
        else expect(t.kind).toBe("structure");
      }
    }
  });
});
