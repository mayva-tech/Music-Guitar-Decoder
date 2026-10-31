import { describe, expect, it } from "vitest";
import { TRACKS, chordsOf } from "@/lib/music/backingTracks";
import { LICK_STYLES, chordSegments, guideLick, isVoicingOf, lickBar, nextChange, soloPosition, voicingsFor } from "@/lib/music/backingSolo";
import { parseChord } from "@/lib/music/chordSymbol";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import { scaleKindPcs, rootPc } from "@/lib/music/scaleFretmap";

const allChords = [...new Set(TRACKS.flatMap((t) => chordsOf(t)))];

describe("chord voicings", () => {
  it("gives every chord in the loops at least two playable voicings, low to high", () => {
    for (const sym of allChords) {
      const vs = voicingsFor(sym);
      expect(vs.length, sym).toBeGreaterThanOrEqual(2);
      const c = parseChord(sym)!;
      for (const v of vs) {
        expect(isVoicingOf(v.shape.frets, c), `${sym} ${v.shape.frets.join(",")}`).toBe(true);
        expect(Math.max(...v.shape.frets.filter((f): f is number => f != null))).toBeLessThanOrEqual(15);
        const fretted = v.shape.frets.filter((f): f is number => f != null && f > 0);
        if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted), sym).toBeLessThanOrEqual(4);
      }
      const bases = vs.map((v) => v.baseFret);
      expect([...bases].sort((a, b) => a - b), sym).toEqual(bases);
    }
  });

  it("knows the common open shapes", () => {
    expect(voicingsFor("E7")[0]!.shape.frets).toEqual([0, 2, 0, 1, 0, 0]);
    expect(voicingsFor("Am")[0]!.label).toBe("Open");
    expect(voicingsFor("Cmaj7")[0]!.shape.frets).toEqual([null, 3, 2, 0, 0, 0]);
    expect(voicingsFor("A9").some((v) => v.shape.frets.join() === [null, 12, 11, 12, 12, 12].join())).toBe(true);
  });

  it("rejects shapes with wrong notes", () => {
    const am = parseChord("Am")!;
    expect(isVoicingOf([null, 0, 2, 2, 2, 0], am)).toBe(false); // A major
    expect(isVoicingOf([null, 0, 2, 2, 1, 0], am)).toBe(true);
  });
});

describe("solo position", () => {
  it("is pentatonic box 1 for pentatonic and blues loops, a five-fret window otherwise", () => {
    expect(soloPosition({ root: "A", mode: "minor-pentatonic" })).toMatchObject({ box: 1, window: { from: 4, to: 10 } });
    const dor = soloPosition({ root: "D", mode: "dorian" });
    expect(dor.box).toBe(0);
    expect(dor.window.to - dor.window.from).toBeGreaterThanOrEqual(6);
  });

  it("only uses scale notes, one position per pitch", () => {
    for (const t of TRACKS) {
      const pos = soloPosition(t);
      const pcs = scaleKindPcs(rootPc(t.root), t.mode);
      expect(pos.ladder.length, t.id).toBeGreaterThanOrEqual(10);
      for (const p of pos.ladder) {
        expect(STANDARD_TUNING[p.string]! + p.fret).toBe(p.midi);
        expect(pcs, t.id).toContain(p.midi % 12);
      }
      expect(new Set(pos.ladder.map((p) => p.midi)).size).toBe(pos.ladder.length);
    }
  });
});

describe("suggested lick", () => {
  it("is written for every loop in every style, inside the loop and in one position", () => {
    for (const t of TRACKS) {
      const total = t.bars.length * t.drums.beats;
      const pos = soloPosition(t);
      for (const s of LICK_STYLES) {
        const lick = guideLick(t, s.id);
        expect(lick.length, `${t.id} ${s.id}`).toBeGreaterThanOrEqual(t.bars.length);
        for (let i = 0; i < lick.length; i++) {
          const n = lick[i]!;
          expect(n.start_beat).toBeGreaterThanOrEqual(0);
          expect(n.start_beat + n.duration_beats, `${t.id} ${s.id}`).toBeLessThanOrEqual(total + 1e-6);
          if (i) expect(n.start_beat).toBeGreaterThan(lick[i - 1]!.start_beat);
          expect(n.fret).toBeGreaterThanOrEqual(pos.window.from);
          expect(n.fret).toBeLessThanOrEqual(pos.window.to);
          expect(STANDARD_TUNING[n.string]! + n.fret).toBe(n.midi);
        }
      }
    }
  });

  it("lands on a chord tone at every chord change", () => {
    let segs = 0;
    let hits = 0;
    for (const t of TRACKS) {
      for (const s of LICK_STYLES) {
        const lick = guideLick(t, s.id);
        for (const seg of chordSegments(t)) {
          const n = lick.find((x) => Math.abs(x.start_beat - seg.start) < 1e-6);
          expect(n, `${t.id} ${s.id} @${seg.start}`).toBeDefined();
          segs++;
          if (parseChord(seg.chord)!.pcs.includes(n!.midi % 12)) hits++;
        }
      }
    }
    // A few chords (e.g. E7 over A minor pentatonic) have no tone in the position; everything else lands.
    expect(hits / segs).toBeGreaterThan(0.97);
  });

  it("swings the off-beats on shuffles and moves by small steps", () => {
    const shuffle = TRACKS.find((t) => t.name === "12-Bar Shuffle in A")!;
    const phr = guideLick(shuffle, "phrase");
    expect(phr.some((n) => Math.abs((n.start_beat % 1) - 2 / 3) < 1e-6)).toBe(true);
    expect(phr.some((n) => Math.abs((n.start_beat % 1) - 0.5) < 1e-6)).toBe(false);
    for (const t of TRACKS) {
      const lick = guideLick(t, "beat");
      for (let i = 1; i < lick.length; i++) expect(Math.abs(lick[i]!.midi - lick[i - 1]!.midi), t.id).toBeLessThanOrEqual(10);
    }
  });

  it("splits into bars for the live neck", () => {
    const t = TRACKS[0]!;
    const lick = guideLick(t, "beat");
    const b1 = lickBar(lick, 1, 4);
    expect(b1.notes).toHaveLength(4);
    expect(b1.notes[0]!.start_beat).toBe(0);
    expect(lick[b1.first]!.start_beat).toBe(4);
  });
});

describe("chord-change countdown", () => {
  it("counts the beats to the next different chord, across repeats and the loop end", () => {
    const blues = TRACKS.find((t) => t.name === "12-Bar Shuffle in A")!; // A7 ×4, D7 ×2, …
    expect(nextChange(blues, 0)).toEqual({ current: "A7", chord: "D7", inBeats: 16 });
    expect(nextChange(blues, 14)).toMatchObject({ chord: "D7", inBeats: 2 });
    expect(nextChange(blues, 46)).toMatchObject({ current: "E7", chord: "A7", inBeats: 2 });
    const turn = TRACKS.find((t) => t.name === "Quick Turnaround in C")!;
    expect(nextChange(turn, 1)).toMatchObject({ current: "Cmaj7", chord: "A7", inBeats: 1 });
  });
});
