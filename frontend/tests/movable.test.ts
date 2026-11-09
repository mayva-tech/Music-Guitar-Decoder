import { describe, expect, it } from "vitest";
import { parseChord } from "@/lib/music/chordSymbol";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import {
  DEVICES, MELODIC_DEVICES, MIX, PICK_QUALITIES, PROGRESSIONS, SUGGEST, VARIATIONS,
  arpeggioLine, chordScale, chordSound, chordSymbol, chordTonesIn, compileMotif, coreVariation,
  defaultFrame, familyOf, frameChoices, frameWalk, keyLabel, lineSound, longestRun, makeFrame,
  mod12, nearestFrame, placeInFrame, planProgression, pretty, rootChart,
  type Anchor, type DeviceId, type Family,
} from "@/lib/music/movable";

const KEYS = Array.from({ length: 12 }, (_, i) => i);
const FAMILIES: Family[] = ["minor", "major"];
const ANCHORS: Anchor[] = [6, 5];
const each = (fn: (tonic: number, family: Family, anchor: Anchor) => void) => {
  for (const t of KEYS) for (const f of FAMILIES) for (const a of ANCHORS) fn(t, f, a);
};

describe("the movable frame", () => {
  it("puts the root under the index (minor) or middle (major) finger on the anchor string, in every key", () => {
    each((t, f, a) => {
      const fr = defaultFrame(t, f, a);
      expect(mod12(STANDARD_TUNING[a]! + fr.rootFret)).toBe(t);
      expect(fr.lo).toBeGreaterThanOrEqual(1);
      const root = placeInFrame(fr, coreVariation(f).intervals).find((n) => n.string === a && n.fret === fr.rootFret);
      expect(root?.finger).toBe(f === "minor" ? 1 : 2);
    });
  });

  it("core pentatonic: two notes per string inside four frets, every key and anchor", () => {
    each((t, f, a) => {
      const fr = defaultFrame(t, f, a);
      const ns = placeInFrame(fr, coreVariation(f).intervals);
      for (let s = 1; s <= 6; s++) expect(ns.filter((n) => n.string === s)).toHaveLength(2);
      expect(ns.every((n) => n.fret >= fr.lo && n.fret <= fr.hi && !n.stretch)).toBe(true);
    });
  });

  it("is the same hand shape in every key: only the fret moves", () => {
    for (const f of FAMILIES) for (const a of ANCHORS) {
      const shape = (t: number) => {
        const fr = defaultFrame(t, f, a);
        return placeInFrame(fr, coreVariation(f).intervals).map((n) => `${n.string}:${n.fret - fr.rootFret}:${n.finger}`).join(" ");
      };
      for (const t of KEYS) expect(shape(t)).toBe(shape(9));
    }
  });

  it("every variation fits one hand: all its notes, fingers rising along each string, at most one fret of stretch", () => {
    for (const v of VARIATIONS) for (const t of KEYS) for (const a of ANCHORS) {
      const fr = defaultFrame(t, v.family, a);
      const ns = placeInFrame(fr, v.intervals);
      const pcs = new Set(ns.map((n) => mod12(n.midi)));
      for (const iv of v.intervals) expect(pcs.has(mod12(t + iv)), `${v.id} key ${t} anchor ${a} misses ${iv}`).toBe(true);
      expect(new Set(ns.map((n) => n.midi)).size).toBe(ns.length);
      expect(ns.every((n) => n.fret >= fr.lo - 1 && n.fret <= fr.hi + 1)).toBe(true);
      const frets = ns.map((n) => n.fret);
      expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(4);
      for (let s = 1; s <= 6; s++) {
        const fs = ns.filter((n) => n.string === s).map((n) => n.finger);
        for (let i = 1; i < fs.length; i++) expect(fs[i]!).toBeGreaterThan(fs[i - 1]!);
        expect(fs.every((x) => x >= 0 && x <= 4)).toBe(true);
      }
    }
  });

  it("variations keep the core notes and add exactly the listed ones", () => {
    for (const v of VARIATIONS.filter((x) => !x.arpeggio)) {
      const core = coreVariation(v.family).intervals;
      const added = v.intervals.filter((i) => !core.includes(i)).sort((a, b) => a - b);
      expect(added).toEqual([...v.adds].sort((a, b) => a - b));
    }
  });

  it("lists every placement up the neck and finds the nearest one", () => {
    expect(frameChoices(9, "minor", 6).map((f) => f.rootFret)).toEqual([5]);
    expect(frameChoices(9, "minor", 6, 22).map((f) => f.rootFret)).toEqual([5, 17]);
    expect(defaultFrame(4, "minor", 6).rootFret).toBe(12); // E: fret 0 has no room below, so the 12th
    expect(nearestFrame(7, "major", 5).lo).toBeLessThanOrEqual(6);
    expect(makeFrame(0, "major", 5, 3)).toMatchObject({ lo: 2, hi: 5, rootMidi: 48 });
  });

  it("root chart matches the neck", () => {
    const a = rootChart().find((r) => r.pc === 9)!;
    expect(a).toEqual({ pc: 9, low: 5, a: 0 });
    expect(rootChart().find((r) => r.pc === 0)).toEqual({ pc: 0, low: 8, a: 3 });
  });

  it("spells keys and chords the usual way", () => {
    expect(keyLabel(10, false)).toBe("B♭");
    expect(keyLabel(1, true)).toBe("C♯");
    expect(chordSymbol(10, "m7b5", true)).toBe("Bbm7b5");
    expect(pretty("Bbm7b5")).toBe("B♭m7♭5");
  });
});

describe("variation phrases", () => {
  it("compile in every key and anchor, two bars of the variation's notes", () => {
    for (const v of VARIATIONS) for (const t of KEYS) for (const a of ANCHORS) {
      const fr = defaultFrame(t, v.family, a);
      const chord = parseChord(chordSymbol(t, v.vamp, false))!;
      const { notes } = compileMotif(v.id, v.motif, fr, chord.pcs);
      const end = notes[notes.length - 1]!.start_beat + notes[notes.length - 1]!.duration_beats;
      expect(end).toBe(8);
      const pcs = v.intervals.map((i) => mod12(t + i));
      expect(notes.every((n) => pcs.includes(mod12(n.midi))), `${v.id} key ${t}`).toBe(true);
      expect(notes.every((n) => n.fret >= fr.lo - 2 && n.fret <= fr.hi + 2 && STANDARD_TUNING[n.string]! + n.fret === n.midi)).toBe(true);
    }
  });

  it("frame walk plays each frame note once", () => {
    const fr = defaultFrame(9, "minor", 6);
    const w = frameWalk(fr, VARIATIONS[0]!, false);
    expect(w.notes).toHaveLength(12);
    expect(w.chords).toEqual(["Am", "Am"]);
  });
});

describe("any chord", () => {
  it("every pickable chord has its tones in the frame for every key and anchor", () => {
    for (const q of PICK_QUALITIES) for (const t of KEYS) for (const a of ANCHORS) {
      const sym = chordSymbol(t, q.id, false);
      const c = parseChord(sym)!;
      const fr = defaultFrame(t, familyOf(q.id), a);
      const cts = chordTonesIn(fr, c);
      expect(cts.length).toBeGreaterThanOrEqual(c.pcs.length + 2);
      expect(new Set(cts.map((n) => mod12(n.midi)))).toEqual(new Set(c.pcs));
      expect(SUGGEST[q.id]?.ids.length).toBeGreaterThan(0);
      expect(chordScale(q.id).length).toBe(7);
    }
  });

  it("chordSound gives a bass note and a voicing of the chord's own notes", () => {
    for (const q of PICK_QUALITIES) for (const t of KEYS) {
      const sym = chordSymbol(t, q.id, t % 2 === 0);
      const c = parseChord(sym)!;
      const s = chordSound(sym);
      expect(mod12(s.bass)).toBe(c.root);
      expect(s.voicing.length).toBeGreaterThanOrEqual(3);
      expect(s.voicing.every((m) => c.pcs.includes(mod12(m)))).toBe(true);
    }
  });
});

describe("melodic arpeggios", () => {
  const lines = function* () {
    for (const p of PROGRESSIONS) for (const t of KEYS) for (const a of ANCHORS) for (const mode of ["stay", "follow"] as const) {
      const plan = planProgression(p, t, mode, a);
      for (const d of DEVICES) yield { p, t, a, mode, plan, d: d.id, line: arpeggioLine(plan.bars, [d.id], () => plan.scale) };
    }
  };

  it("every bar is four beats and starts on a tone of its chord", () => {
    for (const { plan, line, p, t, d } of lines()) {
      plan.bars.forEach((bar, b) => {
        const inBar = line.notes.filter((n) => n.start_beat >= b * 4 - 1e-9 && n.start_beat < b * 4 + 4 - 1e-9);
        const first = inBar[0]!;
        expect(first.start_beat, `${p.id} ${t} ${d} bar ${b}`).toBe(b * 4);
        expect(parseChord(bar.chord)!.pcs).toContain(mod12(first.midi));
        const last = inBar[inBar.length - 1]!;
        expect(last.start_beat + last.duration_beats).toBeLessThanOrEqual(b * 4 + 4 + 1e-9);
      });
    }
  });

  it("stays in reach of the frame and keeps string + fret = pitch", () => {
    for (const { plan, line } of lines()) {
      line.notes.forEach((n, i) => {
        const fr = plan.bars[Math.floor(n.start_beat / 4)]!.frame;
        expect(n.fret).toBeGreaterThanOrEqual(fr.lo - 2);
        expect(n.fret).toBeLessThanOrEqual(fr.hi + 2);
        expect(STANDARD_TUNING[n.string]! + n.fret).toBe(n.midi);
        expect(["chord", "scale", "chromatic"]).toContain(line.roles[i]);
      });
    }
  });

  it("melodic ideas never run more than three notes the same way; the straight version does", () => {
    for (const { line, d, p, t } of lines()) {
      if (d === "robot") expect(longestRun(line.notes)).toBeGreaterThanOrEqual(4);
      else expect(longestRun(line.notes), `${d} ${p.id} key ${t}`).toBeLessThanOrEqual(3);
    }
  });

  it("voice-leads: in one frame, each bar starts within a 4th of where the last one ended", () => {
    const startsOnFirst = new Set(DEVICES.filter((d) => d.ops[0]!.t === "ct" && "k" in d.ops[0]! && d.ops[0]!.k === 0).map((d) => d.id));
    for (const { line, plan, mode, d } of lines()) {
      for (let b = 1; b < plan.bars.length; b++) {
        const before = line.notes.filter((n) => n.start_beat < b * 4).at(-1)!;
        const first = line.notes.find((n) => n.start_beat === b * 4)!;
        const jump = Math.abs(first.midi - before.midi);
        expect(jump).toBeLessThanOrEqual(14);
        if (mode === "stay" && startsOnFirst.has(d)) expect(jump).toBeLessThanOrEqual(5);
      }
    }
  });

  it("guide tones land on the 3rd or 7th", () => {
    const plan = planProgression(PROGRESSIONS.find((p) => p.id === "jazz")!, 0, "stay", 5);
    const line = arpeggioLine(plan.bars, ["guide"], () => plan.scale);
    line.bars.forEach((b) => expect(["3", "♭3", "7", "♭7"]).toContain(b.startDegree));
  });

  it("follow mode moves the frame with the chord; stay mode keeps it", () => {
    const p = PROGRESSIONS.find((x) => x.id === "pop")!;
    const stay = planProgression(p, 7, "stay", 6);
    expect(new Set(stay.bars.map((b) => b.frame.lo)).size).toBe(1);
    const follow = planProgression(p, 7, "follow", 6);
    expect(follow.bars.map((b) => mod12(b.frame.tonic))).toEqual([7, 2, 4, 0]);
    expect(follow.bars.map((b) => b.chord)).toEqual(["G", "D", "Em", "C"]);
  });

  it("mix cycles devices bar by bar and every device is described", () => {
    const plan = planProgression(PROGRESSIONS[0]!, 9, "stay", 6);
    const line = arpeggioLine([...plan.bars, ...plan.bars], MIX, () => plan.scale);
    expect(line.bars.map((b) => b.device)).toEqual(MIX);
    for (const d of DEVICES) {
      expect(d.idea.length).toBeGreaterThan(40);
      expect(d.ops.reduce((s, o) => s + o.d, 0)).toBe(4);
    }
    expect(MELODIC_DEVICES.map((d) => d.id)).not.toContain("robot" as DeviceId);
  });
});

describe("sound", () => {
  it("builds backing, lead and highlights for a line", () => {
    const plan = planProgression(PROGRESSIONS[0]!, 9, "stay", 6);
    const line = arpeggioLine(plan.bars, ["skip"], () => plan.scale);
    const snd = lineSound(plan.bars.map((b) => b.chord), line.notes, { bpm: 90, style: "pop", countIn: true });
    expect(snd.lengthBeats).toBe(20);
    expect(snd.lead).toHaveLength(line.notes.length);
    expect(snd.lead![0]!.start_beat).toBe(4);
    expect(snd.events.filter((e) => e.highlight?.startsWith("n"))).toHaveLength(line.notes.length);
    expect(snd.events.some((e) => e.kind === "bass")).toBe(true);
    expect(snd.events.filter((e) => e.highlight?.startsWith("b_"))).toHaveLength(4);
  });
});
