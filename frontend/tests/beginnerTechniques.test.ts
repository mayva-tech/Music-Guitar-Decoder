import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import { pitchClassName } from "@/lib/music/theory";
import { BEGINNER_LESSONS, C_CHORD, FINGER_STRINGS, G_CHORD, exerciseExample, slotMidi } from "@/lib/music/beginnerTechniques";

const lesson = (id: string) => BEGINNER_LESSONS.find((l) => l.id === id)!;
const pcs = (chord: Record<number, number>) => [...new Set(Object.entries(chord).map(([s, f]) => pitchClassName(STANDARD_TUNING[Number(s)] + f)))].sort();

describe("beginner corner", () => {
  it("has strum, pick and fingers lessons with four steps each", () => {
    expect(BEGINNER_LESSONS.map((l) => l.id)).toEqual(["strum", "pick", "fingers"]);
    for (const l of BEGINNER_LESSONS) {
      expect(l.steps).toHaveLength(4);
      expect(l.exercise.slots.length % 8).toBe(0);
      expect(l.tip.length).toBeGreaterThan(20);
    }
  });

  it("uses real chord shapes", () => {
    expect(pcs(G_CHORD)).toEqual(["B", "D", "G"]);
    expect(pcs(C_CHORD)).toEqual(["C", "E", "G"]);
  });

  it("strum pattern is D · D U · U D U, down = all six strings, up = top four", () => {
    const slots = lesson("strum").exercise.slots.slice(0, 8);
    expect(slots.map((s) => s.mark || "·").join(" ")).toBe("D · D U · U D U");
    for (const s of slots) {
      if (s.mark === "D") expect(s.strings).toEqual([6, 5, 4, 3, 2, 1]);
      if (s.mark === "U") expect(s.strings).toEqual([1, 2, 3, 4]);
      if (!s.mark) expect(s.strings).toEqual([]);
    }
  });

  it("pick exercise alternates down and up, one finger per fret", () => {
    const slots = lesson("pick").exercise.slots;
    expect(slots).toHaveLength(16);
    slots.forEach((s, i) => {
      expect(s.mark).toBe(i % 2 === 0 ? "⊓" : "V");
      expect(s.strings).toHaveLength(1);
      expect(s.frets![s.strings[0]]).toBe((i % 4) + 1);
    });
    expect(slotMidi(slots[0], 5)).toBe(46); // A string, fret 1 = B♭
  });

  it("fingers follow p i m a string assignments", () => {
    for (const s of lesson("fingers").exercise.slots) {
      expect(s.finger).toBeDefined();
      expect(FINGER_STRINGS[s.finger!]).toContain(s.strings[0]);
    }
    const [first] = lesson("fingers").exercise.slots;
    expect(slotMidi(first, first.strings[0])).toBe(48); // thumb plays C on the A string
  });

  it("builds a playable example with highlights for every slot, string and stroke", () => {
    const ex = exerciseExample(lesson("strum").exercise);
    const ids = new Set(ex.events.filter((e) => e.kind === "highlight").map((e) => e.highlight));
    for (let i = 0; i < 16; i++) expect(ids.has(`slot-${i}`)).toBe(true);
    for (const s of [1, 2, 3, 4, 5, 6]) expect(ids.has(`str-${s}`)).toBe(true);
    expect(ids.has("dir-down") && ids.has("dir-up")).toBe(true);
    const plucks = ex.events.filter((e) => e.kind === "pluck");
    expect(plucks).toHaveLength(2 * (3 * 6 + 3 * 4));
    // a down strum sounds low to high, an up strum high to low
    const firstDown = plucks.slice(0, 6).map((e) => e.midi);
    expect(firstDown).toEqual([...firstDown].sort((a, b) => a! - b!));
    expect(exerciseExample(lesson("pick").exercise, 0.7).bpm).toBe(53);
    for (const e of ex.events) expect(e.beat).toBeLessThan(ex.lengthBeats);
  });
});
