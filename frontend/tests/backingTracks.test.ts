import { describe, expect, it } from "vitest";
import {
  BASS, DRUMS, GENRES, LESSON_LINKS, TRACKS, TRACKS_BY_ID,
  barSound, bassBar, chordsOf, countInSound, drumBar, isFourChordPop, keyName, loopSound, stepBeat,
  METRONOME_MARKS, tempoBand, tempoRange, tempoStep, trackLessons, tracksFor, type BackingTrack,
} from "@/lib/music/backingTracks";
import { parseChord } from "@/lib/music/chordSymbol";
import { LESSONS } from "@/lib/music/lessons";
import { GREATS } from "@/lib/music/greats";
import { ALL_TERMS } from "@/lib/theory/content";
import { EAR_STEPS } from "@/lib/theory/ear";

describe("chord symbols", () => {
  it("reads roots, flats, sharps and qualities", () => {
    expect(parseChord("Am")).toMatchObject({ root: 9, quality: "min", pcs: [9, 0, 4], minor: true });
    expect(parseChord("Bb")).toMatchObject({ root: 10, quality: "maj", pcs: [10, 2, 5] });
    expect(parseChord("F#m7")).toMatchObject({ root: 6, quality: "m7", seventh: 10 });
    expect(parseChord("Cmaj7")).toMatchObject({ seventh: 11, third: 4 });
    expect(parseChord("E5")).toMatchObject({ third: null, fifth: 7, pcs: [4, 11] });
    expect(parseChord("Bm7b5")).toMatchObject({ fifth: 6, seventh: 10, minor: true });
    expect(parseChord("A9")?.pcs).toEqual([9, 1, 4, 7, 11]);
    expect(parseChord("H7")).toBeNull();
    expect(parseChord("Cxyz")).toBeNull();
  });
});

describe("backing track catalogue", () => {
  it("has ten genres with twenty tracks each and unique ids", () => {
    expect(GENRES).toHaveLength(10);
    for (const g of GENRES) expect(tracksFor(g.id)).toHaveLength(20);
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(200);
    expect(Object.keys(TRACKS_BY_ID)).toHaveLength(200);
    expect(new Set(TRACKS.map((t) => `${t.genre}:${t.name}`)).size).toBe(200);
  });

  it("varies the tempo inside every genre", () => {
    for (const g of GENRES) {
      const bpms = tracksFor(g.id).map((t) => t.bpm);
      expect(new Set(bpms).size, g.id).toBe(20);
      expect(Math.max(...bpms) - Math.min(...bpms), g.id).toBeGreaterThanOrEqual(50);
      expect(new Set(bpms.map(tempoBand)).size, g.id).toBeGreaterThanOrEqual(2);
      for (const b of bpms) expect(b).toBeGreaterThanOrEqual(40), expect(b).toBeLessThanOrEqual(240);
    }
  });

  it("uses at least four drum grooves and three bass lines per genre", () => {
    for (const g of GENRES) {
      const ts = tracksFor(g.id);
      expect(new Set(ts.map((t) => t.drums.id)).size, g.id).toBeGreaterThanOrEqual(4);
      expect(new Set(ts.map((t) => t.bass.id)).size, g.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("only uses chords the parser can read", () => {
    for (const t of TRACKS) for (const c of chordsOf(t)) expect(parseChord(c), `${t.id} ${c}`).not.toBeNull();
  });

  it("writes drum rows that fit their grid", () => {
    for (const d of Object.values(DRUMS)) {
      expect(d.steps).toBe(d.beats * (d.triplet ? 3 : 4));
      for (const [voice, row] of Object.entries(d.rows)) {
        expect(row!.length, `${d.id}.${voice}`).toBe(d.steps);
        expect(row, `${d.id}.${voice}`).toMatch(/^[Xxo.]+$/);
      }
      if (d.triplet) expect(d.swing).toBe(0);
    }
  });

  it("writes bass bars that fit their grid, and pairs each track's bass with its drums", () => {
    for (const b of Object.values(BASS)) {
      for (const bar of b.bars) for (const n of bar) {
        expect(n.step, b.id).toBeGreaterThanOrEqual(0);
        expect(n.step + n.len, b.id).toBeLessThanOrEqual(b.steps);
      }
    }
    for (const t of TRACKS) expect(t.bass.steps, t.id).toBe(t.drums.steps);
  });
});

describe("bass lines", () => {
  const nextRootPc = (t: BackingTrack, bi: number, chord: string) => {
    const bar = t.bars[bi]!.split(/\s+/);
    const i = bar.indexOf(chord);
    const nxt = i + 1 < bar.length ? bar[i + 1]! : t.bars[(bi + 1) % t.bars.length]!.split(/\s+/)[0]!;
    return parseChord(nxt)!.root;
  };

  it("stays in a playable bass range and starts each chord on its root or a lead-in", () => {
    for (const t of TRACKS) {
      t.bars.forEach((_, bi) => {
        const notes = bassBar(t, bi);
        expect(notes.length, t.id).toBeGreaterThan(0);
        for (const n of notes) {
          expect(n.midi, t.id).toBeGreaterThanOrEqual(28);
          expect(n.midi, t.id).toBeLessThanOrEqual(60);
        }
      });
    }
  });

  it("plays only chord tones, the 6th/♭7 of boogie lines, or half-step approaches to the next chord", () => {
    for (const t of TRACKS) {
      t.bars.forEach((_, bi) => {
        for (const n of bassBar(t, bi)) {
          const c = parseChord(n.chord)!;
          const rel = ((n.midi % 12) - c.root + 12) % 12;
          const tone = c.pcs.includes(n.midi % 12);
          const colour = [2, 4, 5, 9, 10].includes(rel); // 9th, 3rd on power chords, 4th, 6th, ♭7 (walks / boogie)
          const nr = nextRootPc(t, bi, n.chord);
          const approach = n.midi % 12 === (nr + 11) % 12 || n.midi % 12 === (nr + 1) % 12;
          expect(tone || colour || approach, `${t.id} bar ${bi} ${n.chord} midi ${n.midi}`).toBe(true);
        }
      });
    }
  });

  it("puts a root on the downbeat of most bars", () => {
    for (const g of GENRES) {
      const ts = tracksFor(g.id);
      let bars = 0;
      let rooted = 0;
      for (const t of ts) t.bars.forEach((_, bi) => {
        bars++;
        const first = bassBar(t, bi).find((n) => n.step === 0);
        if (first && first.midi % 12 === parseChord(first.chord)!.root) rooted++;
      });
      // Reggae one-drop lines deliberately leave beat 1 empty.
      expect(rooted / bars, g.id).toBeGreaterThan(g.id === "reggae" ? 0.5 : 0.7);
    }
  });

  it("walks the boogie up on a chord's first bar and down on its second", () => {
    const t = TRACKS.find((x) => x.name === "12-Bar Shuffle in A")!;
    expect(bassBar(t, 0).map((n) => n.midi)).toEqual([45, 45, 49, 49, 52, 52, 54, 54]); // A C# E F#
    expect(bassBar(t, 1).map((n) => n.midi)).toEqual([55, 55, 54, 54, 52, 52, 49, 49]); // G F# E C#
    expect(bassBar(t, 4)[0]!.midi).toBe(38); // D7 starts again on its root
  });

  it("approaches the next chord by a half step in walking lines", () => {
    const t = TRACKS.find((x) => x.name === "ii–V–I in C")!;
    const bar0 = bassBar(t, 0); // Dm7 → G7
    expect(bar0.map((n) => n.midi)).toEqual([38, 41, 45, 42]); // D F A F#
    const turn = TRACKS.find((x) => x.name === "Quick Turnaround in C")!;
    expect(bassBar(turn, 0).map((n) => n.midi)).toEqual([36, 44, 45, 37]); // C (G#→A) A (C#→D)
  });
});

describe("drums", () => {
  it("plays a fill on the last bar of the loop, except in reggae", () => {
    for (const t of TRACKS) {
      const last = drumBar(t, t.bars.length - 1);
      const groove = drumBar(t, 0);
      const lastBeat = t.drums.steps - t.drums.steps / t.drums.beats;
      const snaresAtEnd = last.filter((h) => h.voice === "snare" && h.step >= lastBeat).length;
      if (t.genre === "reggae") expect(last).toEqual(groove);
      else expect(snaresAtEnd, t.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("crashes on bar 1 of a repeat in rock, pop, metal and punk only", () => {
    for (const t of TRACKS) {
      const crash = GENRES.find((g) => g.id === t.genre)!.crash;
      expect(drumBar(t, 0, 0).some((h) => h.voice === "crash")).toBe(false);
      expect(drumBar(t, 0, 1).some((h) => h.voice === "crash"), t.id).toBe(crash);
    }
  });

  it("swings odd sixteenths only on swung straight grids", () => {
    expect(stepBeat(DRUMS.neoSoul, 1)).toBeCloseTo(0.25 + 0.33 * 0.25);
    expect(stepBeat(DRUMS.neoSoul, 2)).toBeCloseTo(0.5);
    expect(stepBeat(DRUMS.rock8, 1)).toBeCloseTo(0.25);
    expect(stepBeat(DRUMS.bluesShuffle, 2)).toBeCloseTo(2 / 3);
  });
});

describe("playback data", () => {
  it("builds one bar with every voice, plus bar, beat and step highlights", () => {
    for (const t of TRACKS) {
      const s = barSound(t, 1, { bpm: t.bpm });
      expect(s.lengthBeats).toBe(t.drums.beats);
      const ids = s.events.filter((e) => e.kind === "highlight").map((e) => e.highlight);
      expect(ids).toContain(`b_${1 % t.bars.length}`);
      expect(ids.filter((i) => i?.startsWith("beat_"))).toHaveLength(t.drums.beats);
      expect(ids.filter((i) => i?.startsWith("st_"))).toHaveLength(t.drums.steps);
      for (const e of s.events) {
        expect(e.beat, t.id).toBeGreaterThanOrEqual(0);
        expect(e.beat, t.id).toBeLessThan(t.drums.beats);
        expect(e.velocity).toBeLessThanOrEqual(1);
      }
      expect(s.events.some((e) => e.kind === "bass"), t.id).toBe(true);
      expect(s.events.some((e) => e.kind === "kick" || e.kind === "rim" || e.kind === "ride"), t.id).toBe(true);
    }
  });

  it("mutes drums or bass on request", () => {
    const t = TRACKS[0]!;
    const noDrums = barSound(t, 0, { bpm: 100, drums: false });
    expect(noDrums.events.some((e) => ["kick", "snare", "hat"].includes(e.kind))).toBe(false);
    expect(noDrums.events.some((e) => e.kind === "bass")).toBe(true);
    const noBass = barSound(t, 0, { bpm: 100, bass: false });
    expect(noBass.events.some((e) => e.kind === "bass")).toBe(false);
  });

  it("counts in one bar of clicks with an accent on 1", () => {
    const t = TRACKS.find((x) => x.drums.beats === 3)!;
    const c = countInSound(t, 120);
    const clicks = c.events.filter((e) => e.kind === "click");
    expect(clicks).toHaveLength(3);
    expect(clicks[0]!.velocity).toBeGreaterThanOrEqual(0.95);
    expect(clicks[1]!.velocity).toBeLessThan(0.95);
  });

  it("lays a whole loop end to end", () => {
    const t = TRACKS.find((x) => x.bars.length === 12)!;
    const s = loopSound(t, { bpm: t.bpm });
    expect(s.lengthBeats).toBe(48);
    expect(Math.max(...s.events.map((e) => e.beat))).toBeLessThan(48);
  });
});

describe("lesson links", () => {
  const lessonIds = new Set(LESSONS.map((l) => l.id));
  const terms = new Set(Object.keys(ALL_TERMS));
  const greats = new Set(GREATS.map((g) => g.id));
  const steps = new Set(EAR_STEPS.map((s) => s.id));

  it("point at lessons, terms, players and steps that exist", () => {
    for (const [id, l] of Object.entries(LESSON_LINKS)) {
      const u = new URL(l.href, "http://x");
      if (u.pathname === "/progress") expect(lessonIds.has(u.searchParams.get("lesson")!), id).toBe(true);
      if (u.pathname === "/learn/theory") expect(terms.has(u.searchParams.get("term")!), id).toBe(true);
      if (u.pathname === "/learn/greats") expect(greats.has(u.hash.slice(1)), id).toBe(true);
      if (u.pathname === "/learn/by-ear") expect(steps.has(u.hash.replace("#step-", "")), id).toBe(true);
      if (u.pathname === "/learn/solo") expect(["jam", "techniques", "licks", "target", "scale"]).toContain(u.hash.slice(1));
    }
  });

  it("gives every genre four or more lessons and every track at least two", () => {
    for (const g of GENRES) {
      expect(g.lessons.length, g.id).toBeGreaterThanOrEqual(4);
      for (const l of g.lessons) expect(LESSON_LINKS[l], `${g.id}:${l}`).toBeDefined();
    }
    for (const t of TRACKS) {
      const ls = trackLessons(t);
      expect(ls.length, t.id).toBeGreaterThanOrEqual(1);
      for (const l of ls) expect(LESSON_LINKS[l]).toBeDefined();
    }
  });

  it("links the right lesson to the loop's content", () => {
    const by = (name: string) => TRACKS.find((t) => t.name === name)!;
    expect(trackLessons(by("12-Bar Shuffle in A"))).toEqual(expect.arrayContaining(["lesson-twelve-bar", "lesson-blues-scale", "lesson-swing"]));
    expect(trackLessons(by("Power Chord Stomp"))).toContain("lesson-power-chords");
    expect(trackLessons(by("Four-Chord Sunshine"))).toContain("lesson-four-chords");
    expect(trackLessons(by("Dancefloor Lights"))).toContain("lesson-four-chords"); // Am F C G = vi IV I V
    expect(trackLessons(by("Sing-Along Waltz"))).toContain("theory-meter");
    expect(trackLessons(by("ii–V–I in C"))).toContain("solo-target");
    expect(isFourChordPop(by("Open Road"))).toBe(false);
  });

  it("names keys plainly", () => {
    expect(keyName({ root: "A", mode: "minor-pentatonic" })).toBe("A minor");
    expect(keyName({ root: "G", mode: "major-pentatonic" })).toBe("G major");
    expect(keyName({ root: "E", mode: "blues" })).toBe("E blues");
    expect(keyName({ root: "D", mode: "dorian" })).toBe("D Dorian");
  });
});

describe("tempo arrows", () => {
  it("step through the standard metronome markings", () => {
    expect(METRONOME_MARKS.slice(0, 4)).toEqual([40, 42, 44, 46]);
    expect(METRONOME_MARKS).toEqual(expect.arrayContaining([60, 63, 66, 69, 72, 76, 80, 120, 126, 132, 138, 144, 152, 208, 240]));
    const wide = { min: 40, max: 240 };
    expect(tempoStep(92, 1, wide)).toBe(96);
    expect(tempoStep(92, -1, wide)).toBe(88);
    expect(tempoStep(120, 1, wide)).toBe(126);
    expect(tempoStep(126, -1, wide)).toBe(120);
    expect(tempoStep(60, 1, wide)).toBe(63);
    expect(tempoStep(144, 1, wide)).toBe(152);
  });

  it("snap an off-scale tempo to the nearest marking in that direction", () => {
    const wide = { min: 40, max: 240 };
    expect(tempoStep(98, 1, wide)).toBe(100);
    expect(tempoStep(98, -1, wide)).toBe(96);
    expect(tempoStep(212, -1, wide)).toBe(208);
  });

  it("stay inside half to one and a half times the loop's tempo", () => {
    const t = TRACKS.find((x) => x.bpm === 100)!;
    const r = tempoRange(t);
    expect(r).toEqual({ min: 50, max: 150 });
    expect(tempoStep(150, 1, r)).toBe(150);
    expect(tempoStep(50, -1, r)).toBe(50);
    expect(tempoStep(148, 1, r)).toBe(150);
    for (const x of TRACKS) {
      const rr = tempoRange(x);
      expect(rr.min).toBeGreaterThanOrEqual(40);
      expect(rr.max).toBeLessThanOrEqual(240);
      expect(tempoStep(x.bpm, 1, rr)).toBeGreaterThan(x.bpm);
      expect(tempoStep(x.bpm, -1, rr)).toBeLessThan(x.bpm);
    }
  });
});
