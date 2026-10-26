import { describe, expect, it } from "vitest";
import {
  CAGED_ORDER, CAGED_SHAPES, OCTAVE_RULES, boxExample, cagedKey, cagedPositions, pcName, pcOf,
  pentaBox, pentaDegree, pentaNeck, rootFrets, shapeExample,
} from "@/lib/music/caged";
import { STANDARD_TUNING } from "@/lib/music/guitar";

const C = cagedKey(0, "major");
const frets = (ns: { string: number; fret: number }[]) => ns.map((n) => `${n.string}:${n.fret}`).join(" ");

describe("CAGED shapes", () => {
  it("open shapes are real major chords", () => {
    for (const id of CAGED_ORDER) {
      const def = CAGED_SHAPES[id];
      const pcs = new Set(Object.entries(def.open).map(([s, f]) => (STANDARD_TUNING[Number(s)] + f!) % 12));
      const r = def.openRootPc;
      expect([...pcs].sort()).toEqual([r, (r + 4) % 12, (r + 7) % 12].sort());
      expect(pcName(r)).toBe(id);
    }
  });

  it("C major: C A G E D climb the neck at frets 0, 3, 5, 8, 10, then C again at 12", () => {
    const pos = cagedPositions(C);
    expect(pos.slice(0, 6).map((p) => `${p.shape}${p.offset}`)).toEqual(["C0", "A3", "G5", "E8", "D10", "C12"]);
  });

  it("G major starts on the G shape at the nut", () => {
    const pos = cagedPositions(cagedKey(pcOf("G"), "major"));
    expect(pos.slice(0, 5).map((p) => `${p.shape}${p.offset}`)).toEqual(["G0", "E3", "D5", "C7", "A10"]);
  });

  it("E shape in C is the 8th-fret barre chord with the right degrees and fingers", () => {
    const e = cagedPositions(C).find((p) => p.shape === "E")!;
    expect(frets(e.chord)).toBe("6:8 5:10 4:10 3:9 2:8 1:8");
    expect(e.chord.map((n) => n.degree).join("")).toBe("R5R35R");
    expect(e.chord.map((n) => n.finger).join("")).toBe("134211");
  });

  it("open chords use open fingerings", () => {
    const c = cagedPositions(C).find((p) => p.shape === "C" && p.offset === 0)!;
    expect(c.chord.map((n) => n.finger).join("")).toBe("32010");
  });

  it("every chord tone sits inside its pentatonic box, in every key", () => {
    for (let pc = 0; pc < 12; pc++) {
      for (const mode of ["major", "minor"] as const) {
        const pos = cagedPositions(cagedKey(pc, mode));
        expect(new Set(pos.map((p) => p.shape)).size).toBe(5);
        for (const p of pos) {
          for (const c of p.chord) expect(p.box.some((n) => n.string === c.string && n.fret === c.fret)).toBe(true);
          expect(p.box).toHaveLength(12);
          expect(p.hi - p.lo).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});

describe("pentatonic boxes", () => {
  const Am = cagedKey(pcOf("A"), "minor");

  it("A minor box 1 is the classic fifth-fret box", () => {
    expect(frets(pentaBox(Am, 1, 5))).toBe("6:5 6:8 5:5 5:7 4:5 4:7 3:5 3:7 2:5 2:8 1:5 1:8");
  });

  it("box shapes are the same in every key, just moved", () => {
    const shape = (k: number) => pentaBox(cagedKey(k, "minor"), 2, 3 + k).map((n) => n.fret - (3 + k));
    expect(shape(0)).toEqual(shape(4));
  });

  it("A minor and C major share the same notes and positions", () => {
    expect(frets(pentaNeck(Am))).toBe(frets(pentaNeck(C)));
    expect(cagedPositions(Am).map((p) => p.offset)).toEqual(cagedPositions(C).map((p) => p.offset));
  });

  it("labels degrees for major and minor", () => {
    expect(pentaDegree(C, pcOf("A"))).toBe("6");
    expect(pentaDegree(Am, pcOf("C"))).toBe("♭3");
    expect(pentaDegree(Am, pcOf("F"))).toBeNull();
  });

  it("neck map has five notes per octave on every string", () => {
    const n = pentaNeck(C, 11);
    for (const s of [1, 2, 3, 4, 5, 6]) expect(n.filter((x) => x.string === s)).toHaveLength(5);
  });
});

describe("memory aids", () => {
  it("octave rules land on the same note an octave up", () => {
    for (const r of OCTAVE_RULES) {
      for (let f = 0; f < 12; f++) {
        expect(STANDARD_TUNING[r.to] + f + r.frets - (STANDARD_TUNING[r.from] + f)).toBe(12);
      }
    }
  });

  it("finds root frets on a string", () => {
    expect(rootFrets(pcOf("C"), 5)).toEqual([3, 15]);
    expect(rootFrets(pcOf("E"), 6)).toEqual([0, 12]);
  });

  it("builds playable examples that light each note", () => {
    const pos = cagedPositions(C)[2]!;
    const ex = boxExample(pos.box, "Box 1");
    expect(ex.events.filter((e) => e.kind === "pluck")).toHaveLength(23);
    const sh = shapeExample(pos, "G shape");
    expect(sh.events.filter((e) => e.kind === "pluck")).toHaveLength(pos.chord.length + 23);
    for (const e of sh.events) expect(e.beat).toBeLessThan(sh.lengthBeats);
  });
});
