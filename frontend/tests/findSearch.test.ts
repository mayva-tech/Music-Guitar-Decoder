import { describe, expect, it } from "vitest";
import { findSearch, parseChordQuery, parseNoteQuery } from "@/lib/music/findSearch";
import { shapesForChord } from "@/lib/music/chordShapes";

describe("findSearch", () => {
  it("parses Bdim and returns diminished voicings", () => {
    const c = parseChordQuery("Bdim");
    expect(c).toEqual({ rootName: "B", quality: "dim", symbol: "B°", query: "Bdim" });
    const voicings = shapesForChord("B", "dim");
    expect(voicings.length).toBeGreaterThan(0);
    expect(voicings[0]!.shape.frets).toHaveLength(6);
    const hit = findSearch("Bdim");
    expect(hit.chord?.symbol).toBe("B°");
    expect(hit.voicings.length).toBeGreaterThan(0);
  });

  it("parses Am, G5, C#° and Bb major aliases", () => {
    expect(parseChordQuery("Am")?.quality).toBe("min");
    expect(parseChordQuery("G5")?.symbol).toBe("G5");
    expect(parseChordQuery("C#°")?.symbol).toBe("C#°");
    expect(parseChordQuery("Bb")?.rootName).toBe("A#");
    expect(parseChordQuery("Bb")?.quality).toBe("maj");
  });

  it("parses a lone note", () => {
    const n = parseNoteQuery("F#");
    expect(n?.name).toBe("F#");
    expect(n?.positions.length).toBeGreaterThan(0);
    expect(parseNoteQuery("Bdim")).toBeNull();
  });

  it("finds theory topics by name", () => {
    const r = findSearch("tempo");
    expect(r.topics.some((t) => t.id === "tempo")).toBe(true);
    expect(findSearch("chord").topics.some((t) => t.id === "chord")).toBe(true);
  });
});
