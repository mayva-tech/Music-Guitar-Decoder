// Suggested location: frontend/src/lib/theory/content.test.ts (adjust the import path)
import { describe, expect, it } from "vitest";
import {
  ALL_TERMS, BASS_ROOT, CHORD_VOICINGS, MAP_EDGES, MAP_NODES, MINI_SONG, OPEN_STRING_MIDI, PRINCIPLES, RECIPE, TERMS, TOUR,
  connections, edgePath, gridExample, noteName, type TheoryExample,
} from "./theory-content";

const allExamples: [string, TheoryExample][] = [
  ...Object.values(ALL_TERMS).flatMap((t) => t.examples.map((e) => [`${t.id}: ${e.label}`, e] as [string, TheoryExample])),
  ["mini song", MINI_SONG],
];

describe("theory content integrity", () => {
  it("has 19 terms and 5 principles, each with examples", () => {
    expect(Object.keys(TERMS)).toHaveLength(19);
    expect(Object.keys(PRINCIPLES)).toHaveLength(5);
    for (const t of Object.values(ALL_TERMS)) {
      expect(t.examples.length, t.id).toBeGreaterThan(0);
      expect(t.short.length, t.id).toBeGreaterThan(10);
      for (const i of t.tour) expect(t.examples[i], `${t.id} tour ${i}`).toBeDefined();
    }
  });

  it("only links to terms that exist", () => {
    for (const t of Object.values(ALL_TERMS)) for (const r of t.relates) expect(ALL_TERMS[r], `${t.id} -> ${r}`).toBeDefined();
    for (const [a, b] of MAP_EDGES) { expect(MAP_NODES[a]).toBeDefined(); expect(MAP_NODES[b]).toBeDefined(); }
    for (const s of RECIPE) for (const id of s.terms) expect(ALL_TERMS[id], id).toBeDefined();
    for (const id of Object.keys(TERMS)) expect(MAP_NODES[id], `${id} has a map node`).toBeDefined();
  });

  it("connections are symmetric enough to navigate both ways", () => {
    expect(connections("chord")).toEqual(expect.arrayContaining(["interval", "scale", "progression", "harmony"]));
    expect(connections("interval")).toContain("chord");
    expect(connections("note")).not.toContain("note");
  });

  it("every event fits inside its example and has a valid voice", () => {
    for (const [name, ex] of allExamples) {
      expect(ex.bpm, name).toBeGreaterThan(40);
      for (const e of ex.events) {
        expect(e.beat, name).toBeGreaterThanOrEqual(0);
        expect(e.beat, name).toBeLessThan(ex.lengthBeats + 0.01);
        expect(e.velocity, name).toBeGreaterThanOrEqual(0);
        expect(e.velocity, name).toBeLessThanOrEqual(1);
        if (["pluck", "bass", "organ"].includes(e.kind)) {
          expect(e.midi, name).toBeGreaterThanOrEqual(28);
          expect(e.midi, name).toBeLessThanOrEqual(84);
        }
      }
    }
  });

  it("every highlight id has a matching element in the example's visual", () => {
    for (const [name, ex] of allExamples) {
      const v = ex.visual;
      const ids = new Set<string>();
      if (v.type === "fret") v.dots.forEach((_, i) => ids.add(`d${i}`));
      if (v.type === "grid") v.rows.forEach((r) => r.cells.forEach((c) => c.highlight && ids.add(c.highlight)));
      if (v.type === "blocks") v.rows.forEach((r) => r.items.forEach((it) => it.highlight && ids.add(it.highlight)));
      for (const e of ex.events) if (e.highlight) expect(ids.has(e.highlight), `${name}: ${e.highlight}`).toBe(true);
    }
  });

  it("fret dots match standard tuning", () => {
    for (const [name, ex] of allExamples) {
      if (ex.visual.type !== "fret") continue;
      for (const d of ex.visual.dots) {
        expect(d.midi, name).toBe(OPEN_STRING_MIDI[d.string] + d.fret);
        expect(d.name, name).toBe(noteName(d.midi));
      }
    }
  });

  it("chord voicings contain the right notes", () => {
    const pcs = (c: string) => [...new Set(CHORD_VOICINGS[c].map((m) => noteName(m)))].sort();
    expect(pcs("C")).toEqual(["C", "E", "G"]);
    expect(pcs("Cm")).toEqual(["C", "E♭", "G"]);
    expect(pcs("G7")).toEqual(["B", "D", "F", "G"]);
    expect(pcs("Am")).toEqual(["A", "C", "E"]);
    expect(pcs("F")).toEqual(["A", "C", "F"]);
    for (const c of Object.keys(BASS_ROOT)) expect(CHORD_VOICINGS[c], c).toBeDefined();
  });

  it("grid ties extend the note and swing delays off-beats", () => {
    const ex = gridExample("t", "t", 100, 2, [{ name: "G", kind: "pluck", midi: 55, pattern: "x=.x" }], { swing: true });
    expect(ex.events).toHaveLength(2);
    expect(ex.events[0].beats).toBeCloseTo(1);
    expect(ex.events[1].beat).toBeCloseTo(1 + 2 / 3);
  });

  it("the tour has 26 steps and plays the mini song last", () => {
    expect(TOUR).toHaveLength(26);
    expect(TOUR[TOUR.length - 1].examples[0]).toBe(MINI_SONG);
    expect(MINI_SONG.lengthBeats).toBe(36);
  });

  it("edge paths are plain SVG path strings", () => {
    for (const e of MAP_EDGES) expect(edgePath(e)).toMatch(/^M[\d.]+ [\d.]+ /);
  });
});
