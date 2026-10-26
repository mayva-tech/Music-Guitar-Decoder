import { describe, expect, it } from "vitest";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import { scaleKindPcs, rootPc } from "@/lib/music/scaleFretmap";
import { layoutTab, noteToken } from "@/lib/music/tab";
import { articulation } from "@/lib/audio/timeline";
import {
  BOX_RUN, CHORD_TONES, JAM_TRACKS, LICKS, LICKS_BY_ID, PLAN, SCALE_CHOICES, SOLO, SOLO_BASS, SOLO_VOICINGS, TARGETING, TECHNIQUES, WANDERING,
  chordToneCells, fretRange, jamExample, lickExample, lickOverlay, lickWindow, pentatonicBox, type Lick,
} from "@/lib/music/soloGuide";

const ALL: Lick[] = Object.values(LICKS_BY_ID);
const pc = (m: number) => ((m % 12) + 12) % 12;

describe("solo guide: licks follow the app's note rules", () => {
  it("has 8 techniques, 8 licks and 13 more examples", () => {
    expect(TECHNIQUES).toHaveLength(8);
    expect(LICKS).toHaveLength(8);
    expect(ALL).toHaveLength(20); // 8 technique licks + 8 licks + box run + targeting + wandering + solo
  });

  it("matches backend/app/schemas.py validation for every note", () => {
    for (const L of ALL) {
      L.notes.forEach((n, i) => {
        const where = `${L.id}[${i}]`;
        const fretted = STANDARD_TUNING[n.string] + n.fret;
        const expected = n.technique === "bend" ? fretted + (n.bend_semitones ?? 0) : fretted;
        expect(n.midi, where).toBe(expected);
        if (n.technique === "bend" || n.technique === "bend_release") expect([1, 2], where).toContain(n.bend_semitones);
        else expect(n.bend_semitones ?? null, where).toBeNull();
        if (n.technique === "slide_up" || n.technique === "slide_down") {
          expect(n.slide_from_fret, where).not.toBeNull();
          expect(n.technique === "slide_up", where).toBe(n.slide_from_fret! < n.fret);
        }
        expect(n.fret, where).toBeGreaterThanOrEqual(0);
        expect(n.fret, where).toBeLessThanOrEqual(22);
        expect((n.fret === 0) === (n.finger === 0), where).toBe(true);
        expect(n.finger, where).toBeLessThanOrEqual(4);
      });
    }
  });

  it("keeps every note (and bend target) in the lick's scale", () => {
    for (const L of ALL) {
      const scale = scaleKindPcs(rootPc(L.root), L.mode);
      L.notes.forEach((n, i) => {
        const fretted = STANDARD_TUNING[n.string] + n.fret;
        const fOverF = L.id === "solo" && n.start_beat === 24 && pc(fretted) === 5; // F over the F chord, on purpose
        if (!fOverF) expect(scale, `${L.id}[${i}]`).toContain(pc(fretted));
        if (n.technique === "bend" && L.id !== "blue-curl") expect(scale, `${L.id}[${i}] bend`).toContain(pc(n.midi));
      });
    }
  });

  it("technique card symbols are real TAB tokens from noteToken()", () => {
    const tokens = (L: Lick) => L.notes.map((n, i) => (i > 0 && n.technique === "hammer_on" || n.technique === "pull_off" ? `${L.notes[i - 1].fret}` : "") + noteToken(n));
    const has = (id: string, sym: string) => expect(tokens(TECHNIQUES.find((t) => t.id === id)!.lick).join(" "), id).toContain(sym);
    has("slide", "/7");
    has("hammer", "5h7");
    has("pull", "8p5");
    has("bend", "7b9");
    has("release", "8b10r8");
    has("vibrato", "5~");
    for (const L of ALL) expect(() => layoutTab(L.notes, 4), L.id).not.toThrow();
  });

  it("articulation() reads the techniques the way playLead expects", () => {
    const slide = TECHNIQUES[0].lick.notes;
    expect(articulation(slide[1], slide[0])).toMatchObject({ slideFromMidi: 60, legato: true });
    const bend = TECHNIQUES[3].lick.notes[0];
    expect(articulation(bend)).toMatchObject({ bendSemitones: 2, vibrato: true });
    const release = TECHNIQUES[4].lick.notes[0];
    expect(articulation(release)).toMatchObject({ bendSemitones: 2, release: true });
    expect(articulation(TECHNIQUES[1].lick.notes[1])).toMatchObject({ legato: true });
  });
});

describe("solo guide: harmony", () => {
  const beat1 = (L: Lick) => {
    let t = 0;
    return L.backing.map(([chord, beats]) => {
      const first = L.notes.filter((n) => n.start_beat === t);
      t += beats;
      return { chord, first };
    });
  };
  it("targeting and the full solo start every bar on a chord tone", () => {
    for (const L of [TARGETING, SOLO]) for (const { chord, first } of beat1(L)) {
      expect(first.length, `${L.id} ${chord}`).toBeGreaterThan(0);
      expect(first.some((n) => CHORD_TONES[chord].includes(pc(STANDARD_TUNING[n.string] + n.fret))), `${L.id} ${chord}`).toBe(true);
    }
  });
  it("wandering starts every bar off the chord, on purpose", () => {
    for (const { chord, first } of beat1(WANDERING)) expect(first.some((n) => CHORD_TONES[chord].includes(pc(n.midi))), chord).toBe(false);
  });
  it("lead lines fit inside their backing", () => {
    for (const L of ALL.filter((l) => l.backing.length)) {
      const total = L.backing.reduce((a, b) => a + b[1], 0);
      expect(Math.max(...L.notes.map((n) => n.start_beat + n.duration_beats)), L.id).toBeLessThanOrEqual(total);
    }
  });
  it("chord data is consistent", () => {
    for (const [c, tones] of Object.entries(CHORD_TONES)) {
      expect(SOLO_VOICINGS[c], c).toBeDefined();
      expect(SOLO_BASS[c], c).toBeDefined();
      expect(new Set(SOLO_VOICINGS[c].map(pc)), c).toEqual(new Set(tones));
    }
  });
});

describe("solo guide: neck helpers", () => {
  const range = (r: Parameters<typeof pentatonicBox>[0], m: Parameters<typeof pentatonicBox>[1], n: number) => fretRange(pentatonicBox(r, m, n)!);
  it("pentatonic boxes are the standard positions", () => {
    expect(range("A", "minor-pentatonic", 1)).toEqual({ lo: 5, hi: 8 });
    expect(range("A", "minor-pentatonic", 2)).toEqual({ lo: 7, hi: 10 });
    expect(range("A", "minor-pentatonic", 3)).toEqual({ lo: 9, hi: 13 });
    expect(range("A", "minor-pentatonic", 4)).toEqual({ lo: 12, hi: 15 });
    expect(range("A", "minor-pentatonic", 5)).toEqual({ lo: 14, hi: 17 });
    expect(range("E", "minor-pentatonic", 1)).toEqual({ lo: 0, hi: 3 });
    expect(range("C", "major-pentatonic", 5)).toEqual({ lo: 17, hi: 20 }); // boxes climb from the root
    expect(fretRange(pentatonicBox("C", "major-pentatonic", 5, 5)!)).toEqual({ lo: 5, hi: 8 }); // near the lick: same shape as A minor box 1
    const major = LICKS.find((l) => l.id === "major")!;
    const near = fretRange(pentatonicBox(major.root, major.mode, major.box, lickWindow(major.notes).from)!);
    major.notes.forEach((n) => { expect(n.fret).toBeGreaterThanOrEqual(near.lo); expect(n.fret).toBeLessThanOrEqual(near.hi); });
    const box1 = pentatonicBox("A", "minor-pentatonic", 1)!;
    expect(box1.map((c) => `${c.string}:${c.fret}`)).toEqual(["6:5", "6:8", "5:5", "5:7", "4:5", "4:7", "3:5", "3:7", "2:5", "2:8", "1:5", "1:8"]);
    expect(pentatonicBox("A", "blues", 1)!.length).toBe(14); // + two E♭s
    expect(pentatonicBox("A", "major", 1)).toBeNull();
  });
  it("chord tones: in-box scale notes plus dashed outsiders", () => {
    const f = chordToneCells("F", "A", "minor-pentatonic", 1);
    expect(f.filter((c) => !c.inScale).map((c) => `${c.string}:${c.fret}`).sort()).toEqual(["2:6", "5:8"]);
    expect(f.filter((c) => c.inScale).every((c) => c.fret >= 5 && c.fret <= 8)).toBe(true);
    const am = chordToneCells("Am", "A", "minor-pentatonic", 1);
    expect(am.every((c) => c.inScale)).toBe(true);
    expect(am).toHaveLength(8); // A, C and E on all six strings of box 1
  });
  it("lick overlay finds every technique glyph", () => {
    const kinds = (id: string) => lickOverlay(TECHNIQUES.find((t) => t.id === id)!.lick.notes).glyphs.map((g) => g.kind);
    expect(kinds("slide")).toEqual(["slide", "vibrato"]);
    expect(kinds("hammer")).toEqual(["hammer_on", "hammer_on"]);
    expect(kinds("pull")).toEqual(["pull_off", "pull_off"]);
    expect(kinds("bend")).toEqual(["bend", "vibrato", "vibrato"]);
    expect(kinds("release")).toContain("bend_release");
    expect(kinds("double-stop").filter((k) => k === "double_stop")).toHaveLength(3);
    const box = lickOverlay(BOX_RUN.notes);
    expect(box.markers).toHaveLength(12); // up and down share positions
    expect(box.markers[0].noteIndices).toEqual([0, 22]);
    expect(lickWindow(TECHNIQUES[0].lick.notes)).toEqual({ from: 4, to: 9 });
  });
  it("examples carry highlights for every note and bar", () => {
    const ex = lickExample(SOLO);
    const ids = new Set(ex.events.filter((e) => e.kind === "highlight").map((e) => e.highlight));
    SOLO.notes.forEach((_, i) => expect(ids.has(`n${i}`)).toBe(true));
    SOLO.backing.forEach((_, i) => expect(ids.has(`b_${i}`)).toBe(true));
    expect(ex.lengthBeats).toBe(36);
    const jam = jamExample(JAM_TRACKS[1]);
    expect(jam.lengthBeats).toBe(48);
    expect(jam.events.filter((e) => e.highlight === "beat_0")).toHaveLength(12);
  });
  it("plan and scale rows point at real licks and scales", () => {
    for (const p of PLAN) for (const a of p.actions) {
      if (a.kind === "play" || (a.kind === "map" && a.lickId)) expect(LICKS_BY_ID[(a as { lickId: string }).lickId]).toBeDefined();
      if (a.kind === "playSequence") a.lickIds.forEach((id) => expect(LICKS_BY_ID[id]).toBeDefined());
    }
    for (const r of SCALE_CHOICES) r.chords.forEach((c) => expect(CHORD_TONES[c], c).toBeDefined());
    for (const t of JAM_TRACKS) t.bars.forEach((c) => expect(SOLO_VOICINGS[c], c).toBeDefined());
  });
});
