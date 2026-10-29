import { describe, expect, it } from "vitest";
import {
  NoteFollower, PLAY_SONGS, bassRoot, inChord, midiOf, moveHint, moveSound, playAlongExample, shapeNotes, shapeSteps,
} from "@/lib/theory/earPlayAlong";

const song = (id: string) => PLAY_SONGS.find((s) => s.id === id)!;

describe("play-along songs", () => {
  it("has three songs, easiest first", () => {
    expect(PLAY_SONGS.map((s) => s.id)).toEqual(["ode", "twinkle", "amazing-grace"]);
    expect(song("ode").notes).toHaveLength(30);
    expect(song("twinkle").notes).toHaveLength(42);
    expect(song("twinkle").bars).toHaveLength(12);
  });

  it("every note's string and fret really sound its pitch, inside the hand position", () => {
    for (const s of PLAY_SONGS) {
      for (const n of s.notes) {
        expect(midiOf(n.string, n.fret)).toBe(n.midi);
        if (n.fret > 0) expect(n.fret).toBeGreaterThanOrEqual(s.hand.lo);
        expect(n.fret).toBeLessThanOrEqual(s.hand.hi);
        expect(n.finger === 0).toBe(n.fret === 0);
      }
    }
  });

  it("bar lengths add up and notes fill each bar exactly", () => {
    for (const s of PLAY_SONGS) {
      for (const b of s.bars) {
        const inBar = s.notes.filter((n) => n.bar === b.index);
        const sum = inBar.reduce((a, n) => a + n.beats, 0);
        expect(sum).toBeCloseTo(b.beats, 5);
        const chordBeats = s.chords.filter((c) => c.bar === b.index).reduce((a, c) => a + c.beats, 0);
        if (chordBeats) expect(chordBeats).toBe(b.beats);
      }
    }
  });

  it("chord shapes are the real open chords", () => {
    const tw = song("twinkle");
    const shape = (sym: string) => tw.chords.find((c) => c.symbol === sym)!.shape.frets.map((f) => f ?? "x").join("");
    expect(shape("C")).toBe("x32010");
    expect(shape("G")).toBe("320003");
    expect(shape("F")).toBe("xx3211");
    expect(song("amazing-grace").chords.find((c) => c.symbol === "D")!.shape.frets.map((f) => f ?? "x").join("")).toBe("xx0232");
  });

  it("the melody note at each chord change belongs to that chord", () => {
    for (const s of PLAY_SONGS) {
      for (const c of s.chords) {
        const n = s.notes.find((x) => Math.abs(x.beat - c.beat) < 1e-6)!;
        expect(n, `${s.id} chord ${c.j}`).toBeDefined();
        expect(inChord(s, n)).toBe(true);
      }
    }
  });

  it("Amazing Grace starts on a pickup with no chord, in 3/4 at position VII", () => {
    const ag = song("amazing-grace");
    expect(ag.notes[0]!.chord).toBe(-1);
    expect(ag.notes[0]!.name).toBe("D");
    expect(ag.notes.every((n) => n.fret >= 7)).toBe(true);
    expect(ag.beatsPerBar).toBe(3);
  });
});

describe("teaching helpers", () => {
  it("describes moves between notes", () => {
    expect(moveHint({ midi: 60 }, { midi: 67 })).toBe("Up 7 frets from C: a leap.");
    expect(moveHint({ midi: 64 }, { midi: 62 })).toBe("Down 2 frets from E: a step.");
    expect(moveHint({ midi: 64 }, { midi: 64 })).toBe("Same note as the last one.");
    expect(moveHint(null, { midi: 60 })).toMatch(/first note/);
  });

  it("explains chord fingering in words", () => {
    const f = song("twinkle").chords.find((c) => c.symbol === "F")!.shape;
    const steps = shapeSteps(f);
    expect(steps[0]).toBe("Index finger (1): B string fret 1 and high e string fret 1 (lay the finger flat).");
    expect(steps.at(-1)).toBe("Don't play low E or A.");
    expect(shapeNotes(f)).toHaveLength(4);
  });

  it("finds bass roots", () => {
    expect(["C", "F", "G", "D", "Am", "Bb", "F#m"].map(bassRoot)).toEqual([36, 41, 43, 38, 45, 46, 42]);
  });

  it("builds a play-along with a count-in, a light for every note and chord, and a start bar", () => {
    const s = song("twinkle");
    const ex = playAlongExample(s, { speed: 0.5 });
    expect(ex.bpm).toBe(50);
    const ids = new Set(ex.events.map((e) => e.highlight).filter(Boolean));
    for (const n of s.notes) expect(ids.has(`ef-n-${n.i}`)).toBe(true);
    for (const c of s.chords) expect(ids.has(`ef-c-${c.j}`)).toBe(true);
    expect(ex.events.filter((e) => e.kind === "click")).toHaveLength(4);
    const first = ex.events.find((e) => e.highlight === "ef-n-0")!;
    expect(first.beat).toBe(4);
    const fromBar4 = playAlongExample(s, { fromBar: 4 });
    expect(fromBar4.events.some((e) => e.highlight === "ef-n-0")).toBe(false);
    expect(fromBar4.events.find((e) => e.highlight === `ef-n-${s.notes.find((n) => n.bar === 4)!.i}`)!.beat).toBe(4);
    for (const e of ex.events) expect(e.beat).toBeLessThan(ex.lengthBeats);
    expect(moveSound(60, 67).events).toHaveLength(2);
  });
});

describe("NoteFollower (microphone)", () => {
  const frame = (midi: number | null, rms = 0.05) => ({ midi, clarity: 0.95, rms });
  const feed = (f: NoteFollower, frames: ReturnType<typeof frame>[]) => frames.map((x) => f.push(x)).filter(Boolean);

  it("hits after a few steady frames of the right note", () => {
    const f = new NoteFollower();
    f.setTarget(60, null);
    expect(feed(f, [frame(60.1), frame(59.9), frame(60), frame(60.05)])).toEqual([{ kind: "hit" }]);
  });

  it("a ringing note doesn't count twice for a repeated note, a fresh pluck does", () => {
    const f = new NoteFollower();
    f.setTarget(60, null);
    feed(f, [frame(60), frame(60), frame(60), frame(60)]);
    f.setTarget(60, 60);
    // decaying ring: nothing
    expect(feed(f, [frame(60, 0.04), frame(60, 0.035), frame(60, 0.03), frame(60, 0.026), frame(60, 0.022), frame(60, 0.02)])).toEqual([]);
    // re-pluck: level jumps
    expect(feed(f, [frame(60, 0.06), frame(60, 0.06), frame(60, 0.058), frame(60, 0.055), frame(60, 0.05)])).toEqual([{ kind: "hit" }]);
  });

  it("ignores the previous note still ringing, reports a wrong note once, and spots octaves", () => {
    const f = new NoteFollower();
    f.setTarget(67, 60);
    expect(feed(f, [frame(60), frame(60), frame(60), frame(60), frame(60)])).toEqual([]);
    expect(feed(f, [frame(null), frame(65), frame(65), frame(65), frame(65), frame(65), frame(65)])).toEqual([{ kind: "miss", heard: 65 }]);
    expect(feed(f, [frame(null), frame(55), frame(55), frame(55), frame(55)])).toEqual([{ kind: "octave", heard: 55 }]);
  });
});
