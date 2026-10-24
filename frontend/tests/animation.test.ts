import { describe, expect, it } from "vitest";
import { computeLayout } from "@/lib/music/fretboardLayout";
import { computeHand, easeInOut, interpolateHand, pressOf } from "@/lib/music/handLayout";
import { fingerChange, handBaseOf } from "@/lib/music/fingerMoves";

const lay = computeLayout({ handedness: "right", view: "beginner", frets: 12 });

describe("hand animation", () => {
  const from = computeHand(lay, 1, { string: 1, fret: 3, finger: 3 }, 12); // ring finger, first position
  const to = computeHand(lay, 5, { string: 2, fret: 5, finger: 1 }, 12); // index finger, fifth position

  it("starts at the old pose and ends exactly at the new one", () => {
    const a = interpolateHand(from, to, 0);
    const b = interpolateHand(from, to, 1);
    a.fingers.forEach((f, i) => expect(f.tip).toEqual(from.fingers[i].tip));
    b.fingers.forEach((f, i) => {
      expect(f.tip.x).toBeCloseTo(to.fingers[i].tip.x);
      expect(f.tip.y).toBeCloseTo(to.fingers[i].tip.y);
    });
    expect(b.palm.cx).toBeCloseTo(to.palm.cx);
    expect(b.base).toBe(5);
  });

  it("slides the hand along the neck and swaps which finger presses", () => {
    const mid = interpolateHand(from, to, 0.5);
    expect(mid.palm.cx).toBeGreaterThan(from.palm.cx);
    expect(mid.palm.cx).toBeLessThan(to.palm.cx);
    const ring = (s: typeof mid) => pressOf(s.fingers[2]);
    const index = (s: typeof mid) => pressOf(s.fingers[0]);
    expect(ring(interpolateHand(from, to, 0.25))).toBeGreaterThan(ring(interpolateHand(from, to, 0.75))); // ring lifts
    expect(index(interpolateHand(from, to, 0.75))).toBeGreaterThan(index(interpolateHand(from, to, 0.25))); // index presses
    expect(mid.fingers.filter((f) => pressOf(f) > 0.99)).toHaveLength(0); // nobody fully pressed mid-move
  });

  it("eases in and out", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
  });
});

describe("next-move wording", () => {
  it("covers starting, open strings and repeats", () => {
    expect(fingerChange(null, { string: 1, fret: 3, finger: 3 })).toBe("Start with your ring finger on the third fret.");
    expect(fingerChange(null, { string: 1, fret: 0, finger: 0 })).toContain("open string");
    expect(fingerChange({ string: 1, fret: 3, finger: 3 }, { string: 1, fret: 0, finger: 0 })).toBe("Lift your fingers — play the open string.");
    expect(fingerChange({ string: 1, fret: 3, finger: 3 }, { string: 1, fret: 3, finger: 3 })).toContain("Same note again");
  });

  it("describes finger swaps, string moves and hand shifts", () => {
    expect(fingerChange({ string: 1, fret: 3, finger: 3 }, { string: 1, fret: 1, finger: 1 }))
      .toBe("Hand stays put: lift your ring finger, press with your index finger.");
    expect(fingerChange({ string: 1, fret: 3, finger: 3 }, { string: 2, fret: 3, finger: 3 }))
      .toBe("Move your ring finger towards the thicker strings, to the second-thinnest string.");
    expect(fingerChange({ string: 1, fret: 3, finger: 3 }, { string: 1, fret: 7, finger: 3 }))
      .toBe("Shift your hand up 4 frets (index finger to fret 5), then press with your ring finger.");
    expect(fingerChange({ string: 1, fret: 0, finger: 0 }, { string: 2, fret: 1, finger: 1 }))
      .toBe("Put your index finger on the first fret of the second-thinnest string.");
  });

  it("explains techniques as moves", () => {
    expect(fingerChange({ string: 3, fret: 7, finger: 1 }, { string: 3, fret: 9, finger: 1, technique: "slide_up" }))
      .toBe("Keep your index finger pressed and slide it up to fret 9.");
    expect(fingerChange({ string: 3, fret: 5, finger: 1 }, { string: 3, fret: 7, finger: 3, technique: "hammer_on" })).toContain("Hammer");
    expect(fingerChange({ string: 1, fret: 1, finger: 1 }, { string: 1, fret: 0, finger: 0, technique: "pull_off" })).toContain("open string rings");
  });

  it("finds the hand position from fret and finger", () => {
    expect(handBaseOf({ string: 1, fret: 7, finger: 3 })).toBe(5);
    expect(handBaseOf({ string: 1, fret: 0, finger: 0 })).toBeNull();
  });
});
