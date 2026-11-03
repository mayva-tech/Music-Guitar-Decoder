import { describe, expect, it } from "vitest";
import { MAX_FRET, STANDARD_TUNING } from "@/lib/music/guitar";
import {
  DIAGONAL_BY_ID,
  DIAGONAL_LICKS,
  RAMP_MAX,
  barChords,
  barsMissingChordTone,
  compileLine,
  degreeMidi,
  fretSpan,
  lickBeats,
  lickSeconds,
  longestScaleRun,
  melodyLine,
  nextRampPct,
  notesPerSecond,
  partRange,
  phraseNotes,
  practiceExample,
  tempoAt,
} from "@/lib/music/diagonalLicks";
import { SOLO_BASS, SOLO_VOICINGS, chordTonesOf } from "@/lib/music/soloGuide";
import { rootPc, scaleKindPcs } from "@/lib/music/scaleFretmap";
import { layoutTab } from "@/lib/music/tab";

describe("diagonal licks: content", () => {
  it("has 26 licks (6 in set 1, 10 in set 2, 10 in set 3) with unique ids, all looked up by id", () => {
    expect(DIAGONAL_LICKS).toHaveLength(26);
    expect(DIAGONAL_LICKS.filter((d) => d.set === 3)).toHaveLength(10);
    expect(DIAGONAL_LICKS.filter((d) => d.set === 1)).toHaveLength(6);
    expect(DIAGONAL_LICKS.filter((d) => d.set === 2)).toHaveLength(10);
    const ids = DIAGONAL_LICKS.map((d) => d.lick.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(DIAGONAL_BY_ID[id]!.lick.id).toBe(id);
  });

  it("every lick lasts about 20 seconds at its own tempo", () => {
    for (const d of DIAGONAL_LICKS) {
      const s = lickSeconds(d);
      expect(s, d.lick.id).toBeGreaterThanOrEqual(19);
      expect(s, d.lick.id).toBeLessThanOrEqual(21);
    }
  });

  it("every note's string and fret (plus bend) give its pitch, inside the neck", () => {
    for (const d of DIAGONAL_LICKS) {
      for (const n of d.lick.notes) {
        expect(n.fret, n.id).toBeGreaterThanOrEqual(0);
        expect(n.fret, n.id).toBeLessThanOrEqual(MAX_FRET);
        const bent = n.technique === "bend" ? (n.bend_semitones ?? 0) : 0;
        expect(STANDARD_TUNING[n.string]! + n.fret + bent, n.id).toBe(n.midi);
        if (n.fret === 0) expect(n.finger, n.id).toBe(0);
        else {
          expect(n.finger, n.id).toBeGreaterThanOrEqual(1);
          expect(n.finger, n.id).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it("legato and slides stay on the previous note's string, in the right direction", () => {
    for (const d of DIAGONAL_LICKS) {
      const ns = d.lick.notes;
      ns.forEach((n, i) => {
        const p = ns[i - 1];
        if (n.technique === "hammer_on") { expect(p!.string, n.id).toBe(n.string); expect(n.fret, n.id).toBeGreaterThan(p!.fret); }
        if (n.technique === "pull_off") { expect(p!.string, n.id).toBe(n.string); expect(n.fret, n.id).toBeLessThan(p!.fret); }
        if (n.technique === "slide_up" || n.technique === "slide_down") {
          expect(p!.string, n.id).toBe(n.string);
          expect(n.slide_from_fret, n.id).toBe(p!.fret);
        }
      });
    }
  });

  it("each bar starts on (or bends into) a note of its chord", () => {
    for (const d of DIAGONAL_LICKS) expect(barsMissingChordTone(d), d.lick.id).toEqual([]);
  });

  it("never runs more than four notes straight up or down the scale", () => {
    for (const d of DIAGONAL_LICKS) expect(longestScaleRun(d), d.lick.id).toBeLessThanOrEqual(4);
  });

  it("travels diagonally: at least 10 frets and 3 strings, phrases in different positions", () => {
    for (const d of DIAGONAL_LICKS) {
      const span = fretSpan(d.lick.notes);
      expect(span.hi - span.lo, d.lick.id).toBeGreaterThanOrEqual(10);
      expect(new Set(d.lick.notes.map((n) => n.string)).size, d.lick.id).toBeGreaterThanOrEqual(3);
      const los = d.phrases.map((_, i) => fretSpan(phraseNotes(d, i).map((k) => d.lick.notes[k]!)).lo);
      expect(Math.max(...los) - Math.min(...los), d.lick.id).toBeGreaterThanOrEqual(5);
    }
  });

  it("no fast jump of 5+ frets without a slide", () => {
    for (const d of DIAGONAL_LICKS) {
      const ns = d.lick.notes;
      for (let i = 1; i < ns.length; i++) {
        const a = ns[i - 1]!;
        const b = ns[i]!;
        if (b.technique === "slide_up" || b.technique === "slide_down" || a.fret === 0 || b.fret === 0) continue;
        if (b.start_beat - a.start_beat <= 0.5) expect(Math.abs(b.fret - a.fret), b.id).toBeLessThan(5);
      }
    }
  });

  it("phrases cover every bar in order; each phrase has melody notes", () => {
    for (const d of DIAGONAL_LICKS) {
      let bar = 0;
      for (const p of d.phrases) {
        expect(p.bars[0], d.lick.id).toBe(bar);
        bar += p.bars[1];
      }
      expect(bar).toBe(barChords(d).length);
      d.phrases.forEach((_, i) => {
        const idx = new Set(phraseNotes(d, i));
        expect(d.melody.some((m) => idx.has(m)), `${d.lick.id} phrase ${i}`).toBe(true);
      });
    }
  });

  it("backing chords all have voicings, bass notes and chord tones", () => {
    for (const d of DIAGONAL_LICKS) {
      for (const [c, beats] of d.lick.backing) {
        expect(beats).toBe(4);
        expect(SOLO_VOICINGS[c], c).toBeDefined();
        expect(SOLO_BASS[c], c).toBeDefined();
        expect(chordTonesOf(c), c).not.toBeNull();
      }
    }
  });

  it("set 2 covers new styles and scales: no two licks share genre, and seven-note scales are used", () => {
    const set2 = DIAGONAL_LICKS.filter((d) => d.set === 2);
    const genres = DIAGONAL_LICKS.map((d) => d.genre);
    expect(new Set(genres).size).toBe(genres.length);
    const modes = new Set(set2.map((d) => d.lick.mode));
    for (const m of ["dorian", "mixolydian", "harmonic-minor", "major", "minor"]) expect(modes.has(m as never), m).toBe(true);
  });

  it("every lick's bars are 4 beats and its tempo lands the lick in 19-21 s at 100%", () => {
    for (const d of DIAGONAL_LICKS) {
      expect(lickBeats(d) % 4, d.lick.id).toBe(0);
      expect(Math.max(...d.lick.notes.map((n) => n.start_beat + n.duration_beats)), d.lick.id).toBeLessThanOrEqual(lickBeats(d) + 1e-9);
    }
  });

  it("set 3 adds Phrygian and Lydian, and uses chromatic notes outside the scale", () => {
    const set3 = DIAGONAL_LICKS.filter((d) => d.set === 3);
    const modes = new Set(set3.map((d) => d.lick.mode));
    expect(modes.has("phrygian")).toBe(true);
    expect(modes.has("lydian")).toBe(true);
    const outside = (id: string) => {
      const d = DIAGONAL_BY_ID[id]!;
      const pcs = scaleKindPcs(rootPc(d.lick.root), d.lick.mode);
      return d.lick.notes.filter((n) => !pcs.includes(n.midi % 12)).map((n) => n.name);
    };
    expect(outside("dg-bluegrass")).toContain("A#3"); // the G run: A# hammered to B
    expect(outside("dg-flamenco")).toContain("G#3"); // E major's 3rd over the Phrygian E chord
    expect(outside("dg-surf-wave")).toContain("C#4"); // A's 3rd in D minor
  });

  it("reports note speed: Clockwork's sextuplets at 96 BPM are the fastest", () => {
    const fastest = DIAGONAL_LICKS.reduce((a, b) => (notesPerSecond(b) > notesPerSecond(a) ? b : a));
    expect(fastest.lick.id).toBe("dg-clockwork");
    expect(notesPerSecond(fastest)).toBe(9.6);
    expect(notesPerSecond(DIAGONAL_BY_ID["dg-night-drive"]!)).toBe(8);
    expect(notesPerSecond(DIAGONAL_BY_ID["dg-staircase"]!)).toBe(4.8);
    expect(notesPerSecond(DIAGONAL_BY_ID["dg-staircase"]!, 50)).toBe(2.4);
  });
});

describe("diagonal licks: melody", () => {
  it("the melody line holds theme notes and drops legato marks", () => {
    for (const d of DIAGONAL_LICKS) {
      const m = melodyLine(d);
      expect(m.length, d.lick.id).toBeGreaterThanOrEqual(6);
      for (const { note, index } of m) {
        const src = d.lick.notes[index]!;
        expect(note.start_beat).toBe(src.start_beat);
        expect(note.duration_beats).toBeGreaterThanOrEqual(src.duration_beats);
        expect(["hammer_on", "pull_off", "slide_up", "slide_down"]).not.toContain(note.technique);
      }
      for (let k = 1; k < m.length; k++) {
        expect(m[k - 1]!.note.start_beat + m[k - 1]!.note.duration_beats).toBeLessThanOrEqual(m[k]!.note.start_beat + 1e-9);
      }
    }
  });
});

describe("diagonal licks: practice passes", () => {
  const d = DIAGONAL_BY_ID["dg-staircase"]!;

  it("the whole lick plays every note with a highlight, at the chosen tempo", () => {
    const ex = practiceExample(d, { pct: 80 });
    expect(ex.bpm).toBe(tempoAt(d, 80));
    expect(ex.lengthBeats).toBe(lickBeats(d));
    expect(ex.lead).toHaveLength(d.lick.notes.length);
    const ids = new Set(ex.events.filter((e) => e.kind === "highlight").map((e) => e.highlight));
    d.lick.notes.forEach((_, i) => expect(ids.has(`n${i}`)).toBe(true));
    barChords(d).forEach((_, b) => expect(ids.has(`b_${b}`)).toBe(true));
  });

  it("one phrase plays only its notes, starting at beat 0, keeping the lick's note ids", () => {
    const ex = practiceExample(d, { part: 2 });
    const { from, to } = partRange(d, 2);
    expect(ex.lengthBeats).toBe(to - from);
    const idx = phraseNotes(d, 2);
    expect(ex.lead).toHaveLength(idx.length);
    expect(ex.lead![0]!.start_beat).toBe(0);
    const hl = ex.events.filter((e) => e.kind === "highlight" && e.highlight?.startsWith("n")).map((e) => e.highlight);
    expect(hl).toEqual(idx.map((i) => `n${i}`));
  });

  it("a count-in adds a bar of clicks and shifts everything by four beats", () => {
    const plain = practiceExample(d, { part: 0 });
    const ex = practiceExample(d, { part: 0, countIn: true });
    expect(ex.lengthBeats).toBe(plain.lengthBeats + 4);
    expect(ex.events.filter((e) => e.kind === "click")).toHaveLength(4);
    expect(ex.lead![0]!.start_beat).toBe(plain.lead![0]!.start_beat + 4);
  });

  it("melody only plays the theme notes", () => {
    const ex = practiceExample(d, { melodyOnly: true });
    expect(ex.lead).toHaveLength(d.melody.length);
  });

  it("speed-up steps 5% per loop and stops at the cap", () => {
    expect(nextRampPct(60)).toBe(65);
    expect(nextRampPct(62)).toBe(65);
    expect(nextRampPct(105)).toBe(110);
    expect(nextRampPct(RAMP_MAX)).toBe(RAMP_MAX);
    expect(nextRampPct(115)).toBe(115);
  });
});

describe("diagonal licks: notation", () => {
  const scale = { mode: "minor-pentatonic" as const, rootMidi: 57 };

  it("maps scale degrees across octaves", () => {
    expect(degreeMidi(0, "minor-pentatonic", 57)).toBe(57);
    expect(degreeMidi(5, "minor-pentatonic", 57)).toBe(69);
    expect(degreeMidi(-1, "minor-pentatonic", 57)).toBe(55);
  });

  it("places notes inside the hand position and moves the hand on a slide", () => {
    const c = compileLine("t", "@5 0:1 1:1 2h:1 3/:1", scale);
    expect(c.specs.map((s) => [s.s, s.f])).toEqual([[4, 7], [3, 5], [3, 7], [3, 9]]);
    expect(c.fingers).toEqual([3, 1, 3, 3]);
    expect(c.beats).toBe(4);
  });

  it("accidentals: ^ raises and _ lowers a scale degree by a semitone", () => {
    const c = compileLine("t", "@5 1^:1 2_:1 0:2", scale);
    // A minor pentatonic degree 1 = C4 (60) → C#4; degree 2 = D4 (62) → C#4 (61); degree 0 = A3.
    expect(c.specs).toHaveLength(3);
    const midis = c.specs.map((x) => STANDARD_TUNING[x.s]! + x.f);
    expect(midis).toEqual([61, 61, 57]);
    expect(() => compileLine("t", "@5 1^^:1", scale)).toThrow(/bad token/);
  });

  it("rejects a bar line off the beat and a hammer-on that goes down", () => {
    expect(() => compileLine("t", "@5 0:1 | 1:1", scale)).toThrow(/bar line/);
    expect(() => compileLine("t", "@5 2:1 1h:1", scale)).toThrow(/hammer-on/);
  });
});

describe("diagonal licks: TAB with a per-bar grid", () => {
  it("keeps the default layout unchanged and places every note in time order, much narrower", () => {
    for (const d of DIAGONAL_LICKS) {
      const ns = d.lick.notes;
      const bars = lickBeats(d) / 4;
      const plain = layoutTab(ns, 4, bars);
      const compact = layoutTab(ns, 4, bars, { perBar: true });
      expect(compact.lineLength, d.lick.id).toBeLessThanOrEqual(plain.lineLength);
      expect(compact.barLineCols, d.lick.id).toHaveLength(bars);
      const colOf = new Map(compact.cells.flatMap((c) => c.notes.map((n) => [n.id, c.col] as const)));
      expect(colOf.size, d.lick.id).toBe(ns.length);
      for (let i = 1; i < ns.length; i++) {
        if (ns[i]!.start_beat > ns[i - 1]!.start_beat) expect(colOf.get(ns[i]!.id)!, ns[i]!.id).toBeGreaterThan(colOf.get(ns[i - 1]!.id)!);
      }
    }
    const fl = DIAGONAL_BY_ID["dg-flamenco"]!;
    expect(layoutTab(fl.lick.notes, 4, 9, { perBar: true }).lineLength).toBeLessThan(layoutTab(fl.lick.notes, 4, 9).lineLength / 3);
  });
});
