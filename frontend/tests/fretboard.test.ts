import { describe, expect, it } from "vitest";
import { computeLayout, displayStringOrder, fretPositions, nutSideFor } from "@/lib/music/fretboardLayout";
import type { ViewMode } from "@/lib/types";

const right = computeLayout({ handedness: "right", view: "beginner", frets: 12 });
const left = computeLayout({ handedness: "left", view: "beginner", frets: 12 });

describe("right-handed beginner fretboard (tests 4–7)", () => {
  it("draws the nut on the LEFT", () => {
    expect(right.nutSide).toBe("left");
    expect(right.nut.x1).toBe(right.nut.x2);
    for (const w of right.fretWires) expect(w.x1).toBeGreaterThan(right.nut.x1);
    expect(right.nut.x1).toBeCloseTo(right.board.x);
  });

  it("numbers frets increasing from left to right", () => {
    const xs = right.fretNumbers.map((f) => f.pos.x);
    expect(right.fretNumbers.map((f) => f.fret)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    const wires = right.fretWires.map((w) => w.x1);
    for (let i = 1; i < wires.length; i++) expect(wires[i]).toBeGreaterThan(wires[i - 1]);
    expect(right.fretWires).toHaveLength(12);
  });

  it("orders strings like TAB: 1 (thin e) at the top to 6 (thick E) at the bottom", () => {
    const ys = [1, 2, 3, 4, 5, 6].map((s) => right.strings.find((x) => x.string === s)!.y1);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    expect(right.strings.map((s) => s.label)).toEqual(["1 · e", "2 · B", "3 · G", "4 · D", "5 · A", "6 · E"]);
    const gauges = right.strings.map((s) => s.gauge);
    expect(gauges[5]).toBeGreaterThan(gauges[0]); // thick string drawn thicker
  });

  it("places open-string markers just outside (left of) the nut, never on a fret", () => {
    for (const s of [1, 2, 3, 4, 5, 6]) {
      const p = right.openMarker(s);
      expect(p.x).toBeLessThan(right.nut.x1);
      expect(p.y).toBeCloseTo(right.strings.find((x) => x.string === s)!.y1);
    }
  });

  it("puts fretted notes between the correct fret wires", () => {
    const p = right.note(1, 3);
    expect(p.x).toBeGreaterThan(right.fretWires[1].x1); // after fret wire 2
    expect(p.x).toBeLessThan(right.fretWires[2].x1); // before fret wire 3
    expect(p.y).toBeCloseTo(right.strings.find((s) => s.string === 1)!.y1);
  });

  it("uses real-guitar spacing (frets get narrower) unless equal spacing is chosen", () => {
    const d = fretPositions(12, 1000);
    expect(d[1] - d[0]).toBeGreaterThan(d[12] - d[11]);
    expect(d[12]).toBeCloseTo(1000);
    const e = fretPositions(12, 1200, true);
    expect(e[1] - e[0]).toBeCloseTo(e[12] - e[11]);
  });
});

describe("left-handed and alternative views (test 8)", () => {
  it("mirrors the neck for left-handed players without changing musical data", () => {
    expect(left.nutSide).toBe("right");
    for (const w of left.fretWires) expect(w.x1).toBeLessThan(left.nut.x1);
    const xs = left.fretNumbers.map((f) => f.pos.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeLessThan(xs[i - 1]);
    expect(left.openMarker(1).x).toBeGreaterThan(left.nut.x1);
    // same string on the same row in both hands
    expect(left.strings.map((s) => s.string)).toEqual(right.strings.map((s) => s.string));
    // mirror symmetry of a note position
    const r = right.note(2, 1), l = left.note(2, 1);
    expect(r.y).toBeCloseTo(l.y);
    expect(r.x - right.board.x).toBeCloseTo(left.board.x + left.board.w - l.x);
  });

  it("every view uses TAB string order (thin e first)", () => {
    for (const view of ["beginner", "chart", "facing", "vertical"] as ViewMode[]) {
      expect(displayStringOrder(view, "right")).toEqual([1, 2, 3, 4, 5, 6]);
      expect(displayStringOrder(view, "left")).toEqual([1, 2, 3, 4, 5, 6]);
    }
    const chart = computeLayout({ handedness: "right", view: "chart", frets: 12 });
    expect(chart.note(1, 0).y).toBeLessThan(chart.note(6, 0).y);
  });

  it("facing view puts the nut on the right for a right-handed teacher", () => {
    expect(nutSideFor("facing", "right")).toBe("right");
    expect(nutSideFor("facing", "left")).toBe("left");
  });

  it("vertical view puts the nut on top and thin e (1) on the left", () => {
    const v = computeLayout({ handedness: "right", view: "vertical", frets: 5 });
    expect(v.orientation).toBe("vertical");
    expect(v.openMarker(6).y).toBeLessThan(v.nut.y1);
    expect(v.note(1, 1).x).toBeLessThan(v.note(6, 1).x);
    const vl = computeLayout({ handedness: "left", view: "vertical", frets: 5 });
    expect(vl.note(1, 1).x).toBeLessThan(vl.note(6, 1).x);
  });

  it("every view can place every note of the first 12 frets", () => {
    for (const view of ["beginner", "chart", "facing", "vertical"] as ViewMode[]) {
      for (const hand of ["right", "left"] as const) {
        const lay = computeLayout({ handedness: hand, view, frets: 12 });
        for (const s of [1, 2, 3, 4, 5, 6]) for (let f = 0; f <= 12; f++) {
          const p = lay.note(s, f);
          expect(p.x).toBeGreaterThan(0);
          expect(p.y).toBeGreaterThan(0);
          expect(p.x).toBeLessThan(lay.width);
          expect(p.y).toBeLessThan(lay.height);
        }
        expect(() => lay.note(1, 13)).toThrow();
      }
    }
  });

  it("zoom scales the drawing", () => {
    const big = computeLayout({ handedness: "right", view: "beginner", frets: 12, scale: 1.5 });
    expect(big.width).toBeCloseTo(right.width * 1.5);
  });
});
