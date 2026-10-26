// Location: frontend/src/lib/theory/ear.test.ts (next to ear.ts and content.ts)
import { describe, expect, it } from "vitest";
import {
  AMAZING_GRACE_BARS, COMMON_PROGRESSIONS, DRILLS, EAR_ROOTS, EAR_STEPS, EAR_VOICINGS, KEY_CHART, TROUBLESHOOTING, TWINKLE_BARS, WORKED_SONGS,
  tempoFromTaps, tempoLabel, type Rng,
} from "./ear";
import { noteName, OPEN_STRING_MIDI, type TheoryExample } from "./content";

const examples: [string, TheoryExample][] = [
  ...EAR_STEPS.flatMap((s) => s.examples.map((e) => [`${s.id}: ${e.label}`, e] as [string, TheoryExample])),
  ...WORKED_SONGS.flatMap((w) => w.stages.flatMap((st) => st.examples.map((e) => [`${w.id}/${st.title}: ${e.label}`, e] as [string, TheoryExample]))),
];
/** Small seeded generator so drill tests are repeatable. */
const seeded = (seed: number): Rng => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const rootPc = (chord: string) => (PC[chord[0]] + (chord[1] === "♯" ? 1 : chord[1] === "♭" ? -1 : 0) + 12) % 12;

describe("ear guide content", () => {
  it("has seven steps in method order, each with examples", () => {
    expect(EAR_STEPS.map((s) => s.id)).toEqual(["listen", "home", "mode", "bass", "chords", "melody", "rhythm"]);
    for (const s of EAR_STEPS) { expect(s.examples.length, s.id).toBeGreaterThan(0); expect(s.how.length, s.id).toBeGreaterThanOrEqual(3); }
    expect(EAR_STEPS.find((s) => s.id === "chords")?.extra).toBe("keyChart");
    expect(EAR_STEPS.find((s) => s.id === "rhythm")?.extra).toBe("tapTempo");
  });

  it("every example's events fit and every highlight has a visual element", () => {
    expect(examples.length).toBe(31); // 19 in the method + 12 in the worked songs
    for (const [name, ex] of examples) {
      const v = ex.visual;
      const ids = new Set<string>();
      if (v.type === "fret") v.dots.forEach((_, i) => ids.add(`d${i}`));
      if (v.type === "grid") v.rows.forEach((r) => r.cells.forEach((c) => c.highlight && ids.add(c.highlight)));
      if (v.type === "blocks") v.rows.forEach((r) => r.items.forEach((it) => it.highlight && ids.add(it.highlight)));
      for (const e of ex.events) {
        expect(e.beat, name).toBeGreaterThanOrEqual(0);
        expect(e.beat, name).toBeLessThan(ex.lengthBeats + 0.01);
        expect(e.velocity, name).toBeLessThanOrEqual(1);
        if (e.highlight) expect(ids.has(e.highlight), `${name}: ${e.highlight}`).toBe(true);
        if (["pluck", "bass", "organ"].includes(e.kind)) expect(e.midi, name).toBeGreaterThanOrEqual(28);
      }
      if (v.type === "fret") for (const d of v.dots) expect(d.midi, name).toBe(OPEN_STRING_MIDI[d.string] + d.fret);
    }
  });

  it("the 70% example is the same notes at 70 BPM", () => {
    const [full, slow] = EAR_STEPS[0].examples;
    expect(slow.bpm).toBe(70);
    expect(slow.events.map((e) => e.midi)).toEqual(full.events.map((e) => e.midi));
  });

  it("strum rows sound chords and still light their cells", () => {
    const ex = EAR_STEPS.find((s) => s.id === "rhythm")!.examples[0];
    expect(ex.events.filter((e) => e.kind === "pluck").length).toBe(8 * EAR_VOICINGS.G.length);
    expect(ex.events.filter((e) => e.kind === "highlight").length).toBe(8);
  });

  it("worked songs have the right lengths and chords", () => {
    const beats = (bars: typeof TWINKLE_BARS, bpb: number) => bars.reduce((a, b) => a + (b.length ?? bpb), 0);
    expect(beats(TWINKLE_BARS, 4)).toBe(16);
    expect(beats(AMAZING_GRACE_BARS, 3)).toBe(22);
    for (const b of [...TWINKLE_BARS, ...AMAZING_GRACE_BARS]) {
      const bl = b.length ?? (TWINKLE_BARS.includes(b) ? 4 : 3);
      expect((b.melody ?? []).reduce((a, n) => a + n[1], 0)).toBe(bl);
      if (b.chords) expect(b.chords.reduce((a, c) => a + c[2], 0)).toBe(bl);
      for (const [c] of b.chords ?? []) { expect(EAR_VOICINGS[c], c).toBeDefined(); expect(EAR_ROOTS[c], c).toBeDefined(); }
    }
  });

  it("voicings contain the chord's notes", () => {
    const pcs = (c: string) => [...new Set(EAR_VOICINGS[c].map(noteName))].sort();
    expect(pcs("D")).toEqual(["A", "D", "F♯"]);
    expect(pcs("A")).toEqual(["A", "C♯", "E"]);
    expect(pcs("Bm")).toEqual(["B", "D", "F♯"]);
    expect(pcs("E")).toEqual(["A♭", "B", "E"]); // G♯ is spelled A♭ by noteName
  });

  it("drills always have exactly one correct answer and a matching explanation", () => {
    for (const d of DRILLS) {
      const rng = seeded(42);
      for (let i = 0; i < 300; i++) {
        const q = d.generate(rng);
        expect(q.options.filter((o) => o.correct), d.id).toHaveLength(1);
        expect(q.listen.length, d.id).toBeGreaterThan(0);
        for (const l of q.listen) { expect(l.sound.events.length).toBeGreaterThan(0); for (const e of l.sound.events) expect(e.beat).toBeLessThan(l.sound.lengthBeats + 0.01); }
        expect(q.explanation.length).toBeGreaterThan(20);
        if (d.id === "next-chord") expect(q.explanation).toContain(q.options.find((o) => o.correct)!.label);
        if (d.id === "mode") expect(q.explanation).not.toMatch(/B♭ was 4|A♭ was 4|E♭ was 4/);
      }
    }
  });

  it("drills are repeatable with the same seed", () => {
    for (const d of DRILLS) expect(d.generate(seeded(7)).explanation).toBe(d.generate(seeded(7)).explanation);
  });

  it("key chart chords are the scale's chords", () => {
    const MAJ = [0, 2, 4, 5, 7, 9, 11];
    for (const [key, chords] of KEY_CHART.major) {
      chords.forEach((c, i) => {
        expect(rootPc(c), `${key} ${c}`).toBe((rootPc(key) + MAJ[i]) % 12);
        expect(c.endsWith("m"), `${key} ${c}`).toBe([1, 2, 5].includes(i));
      });
    }
    for (const [key, chords] of KEY_CHART.minor) {
      const MIN = [0, 3, 5, 7, 8, 10];
      chords.forEach((c, i) => expect(rootPc(c), `${key} ${c}`).toBe((rootPc(key) + MIN[i]) % 12));
    }
    expect(COMMON_PROGRESSIONS).toHaveLength(7);
    expect(TROUBLESHOOTING).toHaveLength(6);
  });

  it("tap tempo", () => {
    expect(tempoFromTaps([0])).toBeNull();
    expect(tempoFromTaps([0, 500, 1000, 1500])).toBe(120);
    expect(tempoFromTaps(Array.from({ length: 12 }, (_, i) => i * 600))).toBe(100);
    expect(tempoLabel(60)).toBe("slow ballad");
    expect(tempoLabel(120)).toBe("mid-tempo pop and rock");
  });
});
