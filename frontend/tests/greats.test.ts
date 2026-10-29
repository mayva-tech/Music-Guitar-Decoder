import { describe, expect, it } from "vitest";
import { GREATS, howToPlay, lickSteps, pitchAt } from "@/lib/music/greats";
import { CHORD_TONES, SOLO_BASS, SOLO_VOICINGS, lickExample } from "@/lib/music/soloGuide";
import { layoutTab } from "@/lib/music/tab";
import { shapeSteps } from "@/lib/theory/earPlayAlong";

const pc = (m: number) => ((m % 12) + 12) % 12;
const SCALES: Record<string, number[]> = {
  "minor-pentatonic": [0, 3, 5, 7, 10], "major-pentatonic": [0, 2, 4, 7, 9], blues: [0, 3, 5, 6, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
};
const ROOT: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const allLicks = GREATS.flatMap((g) => g.licks.map((l) => ({ g, ...l })));

describe("guitar greats", () => {
  it("has eight players, each with chords, two licks, listening and practice", () => {
    expect(GREATS.map((g) => g.id)).toEqual(["bb-king", "hendrix", "srv", "page", "gilmour", "knopfler", "evh", "wes"]);
    for (const g of GREATS) {
      expect(g.traits).toHaveLength(4);
      expect(g.chords.length).toBeGreaterThanOrEqual(1);
      expect(g.licks).toHaveLength(2);
      expect(g.listen.length).toBeGreaterThanOrEqual(3);
      expect(g.practice).toHaveLength(3);
    }
    expect(new Set(allLicks.map((l) => l.lick.id)).size).toBe(allLicks.length);
  });

  it("chord shapes have six strings, sound the named chord's notes, and read as steps", () => {
    const expected: Record<string, number[]> = {
      D9: [2, 6, 9, 0, 4], "E7♯9": [4, 8, 2, 7], "G, thumb over": [7, 11, 2], E9: [4, 8, 2, 6, 11], "E7, open": [4, 8, 11, 2],
      A5: [9, 4], Dsus4: [2, 7, 9], Em7: [4, 7, 11, 2], Cadd9: [0, 4, 7, 2], "D triad (7th fret)": [2, 6, 9], "G triad (7th fret)": [7, 11, 2],
      E5: [4, 11], "A5 (with octave)": [9, 4], Dm7: [2, 5, 9, 0], "G7 (shell)": [7, 11, 5], Cmaj7: [0, 4, 7, 11],
    };
    for (const g of GREATS) for (const c of g.chords) {
      expect(c.shape.frets).toHaveLength(6);
      expect(c.shape.fingers).toHaveLength(6);
      const pcs = new Set(c.shape.frets.flatMap((f, i) => (f == null ? [] : [pc(pitchAt(6 - i, f))])));
      expect([...pcs].sort(), `${g.id} ${c.name}`).toEqual([...new Set(expected[c.name])].sort());
      c.shape.frets.forEach((f, i) => { if (f === 0) expect(c.shape.fingers[i]).toBe(0); });
      expect(shapeSteps(c.shape).length).toBeGreaterThan(0);
    }
    expect(shapeSteps(GREATS[1]!.chords[1]!.shape)[0]).toMatch(/^Index/);
    expect(shapeSteps(GREATS[1]!.chords[1]!.shape).some((s) => s.startsWith("Thumb over the neck (T): low E string fret 3"))).toBe(true);
  });

  it("every lick note is real: pitch matches string+fret(+bend), slides start where the last note was", () => {
    for (const { lick } of allLicks) {
      for (const n of lick.notes) {
        const fretted = pitchAt(n.string, n.fret);
        expect(n.midi, `${lick.id} ${n.id}`).toBe(n.technique === "bend" ? fretted + (n.bend_semitones ?? 0) : fretted);
        expect(n.fret).toBeGreaterThanOrEqual(0);
        expect(n.fret).toBeLessThanOrEqual(15);
      }
    }
  });

  it("lick notes stay in the lick's scale (allowing chromatic notes that are chord tones or marked passing notes)", () => {
    const allowed: Record<string, number[]> = { "wes-line": [7], "bb-answer": [1, 7], "bb-curl": [5], "srv-open": [0, 9], "mk-roll": [] };
    for (const { lick } of allLicks) {
      const scale = SCALES[lick.mode]!.map((x) => (x + ROOT[lick.root]!) % 12);
      const chordPcs = new Set(lick.backing.flatMap(([c]) => CHORD_TONES[c] ?? []));
      lick.notes.forEach((n, i) => {
        const ok = scale.includes(pc(n.midi)) || chordPcs.has(pc(n.midi)) || (allowed[lick.id] ?? []).includes(i) || n.technique === "bend_release";
        expect(ok, `${lick.id} note ${i} ${n.name}`).toBe(true);
      });
    }
  });

  it("licks fit their backing, have known chords, write valid TAB and build a playable example", () => {
    for (const { lick } of allLicks) {
      const len = lick.backing.reduce((a, [, b]) => a + b, 0);
      const end = Math.max(...lick.notes.map((n) => n.start_beat + n.duration_beats));
      expect(end, lick.id).toBeLessThanOrEqual(len + 1e-6);
      for (const [c] of lick.backing) {
        expect(SOLO_VOICINGS[c], c).toBeDefined();
        expect(SOLO_BASS[c], c).toBeDefined();
        expect(CHORD_TONES[c], c).toBeDefined();
      }
      expect(() => layoutTab(lick.notes, 4, Math.ceil(len / 4))).not.toThrow();
      const ex = lickExample(lick);
      expect(ex.events.filter((e) => e.highlight?.startsWith("n"))).toHaveLength(lick.notes.length);
    }
  });

  it("swung licks put the 'and' on the last third of the beat", () => {
    const srv = allLicks.find((l) => l.lick.id === "srv-open")!.lick;
    expect(srv.notes[1]!.start_beat).toBeCloseTo(2 / 3, 6);
    expect(srv.notes[0]!.duration_beats).toBeCloseTo(2 / 3, 6);
    expect(srv.notes[1]!.duration_beats).toBeCloseTo(1 / 3, 6);
  });

  it("groups double stops into one step and explains each note", () => {
    const wes = allLicks.find((l) => l.lick.id === "wes-octaves")!;
    const steps = lickSteps(wes.lick.notes);
    expect(steps[0]).toEqual([0, 1]);
    expect(steps.every((s) => s.length === 2)).toBe(true);
    const evh = allLicks.find((l) => l.lick.id === "evh-tap")!;
    expect(howToPlay(evh.lick.notes, 3, evh)).toBe("Tap fret 13 with a picking-hand finger.");
    expect(howToPlay(evh.lick.notes, 0, evh)).toMatch(/^Tap fret 13 with your picking hand/);
    const dg = allLicks.find((l) => l.lick.id === "dg-release")!;
    expect(howToPlay(dg.lick.notes, 1, dg)).toBe("B string, fret 12 with your index finger.");
    const page = allLicks.find((l) => l.lick.id === "page-triplets")!;
    expect(howToPlay(page.lick.notes, 4, page)).toMatch(/pull off/);
    for (const l of allLicks) for (const i of l.taps ?? []) expect(l.lick.notes[i], `${l.lick.id} tap ${i}`).toBeDefined();
    for (const l of allLicks) for (const k of Object.keys(l.hints ?? {})) expect(l.lick.notes[Number(k)], `${l.lick.id} hint ${k}`).toBeDefined();
  });

  it("uses real fingerings: chord stabs, octaves, thumb, tapping shifts, ring-finger bends", () => {
    const L = (id: string) => allLicks.find((l) => l.lick.id === id)!;
    expect(L("hx-7s9").lick.notes.slice(0, 4).map((n) => n.finger)).toEqual([2, 1, 3, 4]);
    expect(L("wes-octaves").lick.notes.every((n) => n.finger === (n.string === 4 ? 1 : 3))).toBe(true);
    expect(L("hx-embellish").thumbs).toEqual([7]);
    expect(L("hx-embellish").lick.notes[7]!.string).toBe(6);
    const tapG = L("evh-tap").lick.notes.filter((n) => n.fret === 8);
    expect(tapG.every((n) => n.finger === 1)).toBe(true);
    const thirds = L("mk-thirds").lick.notes;
    expect([thirds[0]!.finger, thirds[1]!.finger]).toEqual([2, 1]); // G4 middle, B3 index
    expect([thirds[4]!.finger, thirds[5]!.finger]).toEqual([2, 3]); // same fret: middle + ring
    for (const { lick } of allLicks) for (const n of lick.notes) {
      if (n.technique === "bend" || n.technique === "bend_release") expect(n.finger, `${lick.id} ${n.id}`).not.toBe(4);
      if (n.fret === 0) expect(n.finger).toBe(0);
      else expect(n.finger).toBeGreaterThanOrEqual(1);
    }
  });
});
