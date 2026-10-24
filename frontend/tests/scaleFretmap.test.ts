import { describe, expect, it } from "vitest";
import { MAX_FRET } from "@/lib/music/guitar";
import {
  SCALE_KINDS,
  buildFretmap,
  noteMarkerColors,
  relatedScaleChords,
  scaleDisplayName,
  scaleNoteNames,
} from "@/lib/music/scaleFretmap";

describe("scale fretmap", () => {
  it("lists C major and A minor note names", () => {
    expect(scaleNoteNames("C", "major")).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
    expect(scaleNoteNames("A", "minor")).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("covers every string × fret and marks C major correctly", () => {
    const cells = buildFretmap("C", "major");
    expect(cells).toHaveLength(6 * (MAX_FRET + 1));

    const openLowE = cells.find((c) => c.string === 6 && c.fret === 0)!;
    expect(openLowE.name).toBe("E");
    expect(openLowE.inScale).toBe(true);
    expect(openLowE.isRoot).toBe(false);

    const cOnA = cells.find((c) => c.string === 5 && c.fret === 3)!;
    expect(cOnA.name).toBe("C");
    expect(cOnA.isRoot).toBe(true);
    expect(cOnA.inScale).toBe(true);

    const csOnA = cells.find((c) => c.string === 5 && c.fret === 4)!;
    expect(csOnA.name).toBe("C#");
    expect(csOnA.inScale).toBe(false);
  });

  it("highlights D major roots on the neck", () => {
    const roots = buildFretmap("D", "major").filter((c) => c.isRoot);
    expect(roots.every((c) => c.name === "D")).toBe(true);
    expect(roots.length).toBeGreaterThan(3);
  });

  it("includes pentatonic, blues, and common modes", () => {
    expect(SCALE_KINDS.map((k) => k.id)).toEqual([
      "major", "minor", "major-pentatonic", "minor-pentatonic", "blues",
      "harmonic-minor", "melodic-minor", "dorian", "mixolydian", "phrygian", "lydian", "locrian",
    ]);
    expect(scaleNoteNames("A", "minor-pentatonic")).toEqual(["A", "C", "D", "E", "G"]);
    expect(scaleNoteNames("A", "blues")).toEqual(["A", "C", "D", "D#", "E", "G"]);
    expect(scaleNoteNames("C", "major-pentatonic")).toEqual(["C", "D", "E", "G", "A"]);
    expect(scaleNoteNames("G", "mixolydian")).toEqual(["G", "A", "B", "C", "D", "E", "F"]);
    expect(scaleDisplayName("B", "minor")).toBe("B Minor");
  });

  it("marks the blue note on the blues map", () => {
    const cells = buildFretmap("A", "blues");
    const blue = cells.find((c) => c.string === 5 && c.fret === 6)!; // D# / Eb on A string
    expect(blue.name).toBe("D#");
    expect(blue.inScale).toBe(true);
    expect(blue.isRoot).toBe(false);
  });

  it("gives every pitch-class one solid color", () => {
    const c = noteMarkerColors("C");
    const g = noteMarkerColors("G");
    expect(c.fill).toBe(noteMarkerColors("C").fill);
    expect(c.fill).not.toBe(g.fill);
    expect(c.ink).toBeTruthy();
  });

  it("lists related chords for major and minor keys", () => {
    expect(relatedScaleChords("C", "major").map((c) => c.symbol)).toEqual([
      "C", "Dm", "Em", "F", "G", "Am", "B°",
    ]);
    expect(relatedScaleChords("B", "major").map((c) => c.symbol)).toEqual([
      "B", "C#m", "D#m", "E", "F#", "G#m", "A#°",
    ]);
    expect(relatedScaleChords("A", "minor").map((c) => c.symbol)).toEqual([
      "Am", "B°", "C", "Dm", "Em", "F", "G",
    ]);
    expect(relatedScaleChords("A", "minor-pentatonic").map((c) => c.symbol)).toEqual([
      "Am", "C", "Dm", "Em", "G",
    ]);
  });
});
