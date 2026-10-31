import { describe, expect, it } from "vitest";
import { chordToneNames, shapeForChord, shapesForChord, shapeToHighlights } from "@/lib/music/chordShapes";
import { relatedScaleChords } from "@/lib/music/scaleFretmap";

describe("chordShapes", () => {
  it("builds the open E5 power chord like a classic chord box", () => {
    const shape = shapeForChord("E", "5");
    expect(shape.frets).toEqual([0, 2, 2, null, null, null]);
    expect(shape.fingers).toEqual([0, 1, 1, null, null, null]);
  });

  it("maps E5 frets to neck highlights for finger placement", () => {
    const marks = shapeToHighlights(shapeForChord("E", "5"));
    expect(marks).toEqual([
      { string: 6, fret: 0, finger: null },
      { string: 5, fret: 2, finger: 1 },
      { string: 4, fret: 2, finger: 1 },
      { string: 3, fret: 0, finger: null, muted: true },
      { string: 2, fret: 0, finger: null, muted: true },
      { string: 1, fret: 0, finger: null, muted: true },
    ]);
  });

  it("lists higher E5 voicings after the open shape", () => {
    const list = shapesForChord("E", "5");
    expect(list[0]!.label).toBe("Open");
    expect(list[0]!.shape.frets).toEqual([0, 2, 2, null, null, null]);
    expect(list.length).toBeGreaterThan(1);
    // Next shapes sit higher on the neck (A-string 7fr and/or octave E-string).
    expect(list.slice(1).every((v) => v.baseFret >= list[0]!.baseFret)).toBe(true);
    expect(list.some((v) => v.shape.frets[0] === 12)).toBe(true);
    expect(list.some((v) => v.shape.frets[1] === 7)).toBe(true);
  });

  it("prefers open C and Am shapes, with higher barre options", () => {
    expect(shapeForChord("C", "maj").frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect(shapeForChord("A", "min").frets).toEqual([null, 0, 2, 2, 1, 0]);
    const c = shapesForChord("C", "maj");
    expect(c[0]!.label).toBe("Open");
    expect(c.length).toBeGreaterThan(1);
    expect(c.map((v) => v.baseFret)).toEqual([...c.map((v) => v.baseFret)].sort((a, b) => a - b));
  });

  it("attaches quality so every related chord can resolve a diagram", () => {
    const chords = relatedScaleChords("E", "blues");
    expect(chords.some((c) => c.symbol === "E5" || c.quality === "5")).toBe(true);
    for (const c of relatedScaleChords("C", "major")) {
      const list = shapesForChord(c.rootName, c.quality);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0]!.shape.frets).toHaveLength(6);
      expect(list[0]!.shape.fingers).toHaveLength(6);
    }
  });

  it("lists the triad notes under a chord name (root · third · fifth)", () => {
    expect(chordToneNames("C")).toEqual(["C", "E", "G"]);
    expect(chordToneNames("Am")).toEqual(["A", "C", "E"]);
    expect(chordToneNames("Bdim")).toEqual(["B", "D", "F"]);
    expect(chordToneNames("E5")).toEqual(["E", "B"]);
    expect(chordToneNames("G7")).toEqual(["G", "B", "D"]);
    expect(chordToneNames("Bb")).toEqual(["Bb", "D", "F"]);
    expect(chordToneNames("F#m")).toEqual(["F#", "A", "C#"]);
  });

  it("falls back to unique pitches in the shape when the label is not a plain chord symbol", () => {
    const shape = shapeForChord("D", "maj");
    expect(chordToneNames("D triad (7th fret)", shape)).toEqual(["D", "F#", "A"]);
  });
});
