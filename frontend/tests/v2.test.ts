import { describe, expect, it } from "vitest";
import rockFixture from "./fixtures/demo-arrangement.json";
import bluesFixture from "./fixtures/demo-blues.json";
import type { Arrangement, PlayableNote } from "@/lib/types";
import { noteToken, renderAsciiTab } from "@/lib/music/tab";
import { articulation, buildSchedule, partNotes, swingBeat } from "@/lib/audio/timeline";
import { computeLayout } from "@/lib/music/fretboardLayout";
import { computeHand, handBases } from "@/lib/music/handLayout";
import { bendFeedback, fingerInstructions } from "@/lib/music/instructions";
import { phraseInsight } from "@/lib/music/insights";
import { STANDARD_TUNING } from "@/lib/music/guitar";

const rock = rockFixture as unknown as Arrangement;
const blues = bluesFixture as unknown as Arrangement;

describe("technique TAB matches the backend exactly", () => {
  it.each([["rock", rock], ["blues", blues]])("%s lead", (_, arr) => {
    const lead = arr.lead!;
    expect(renderAsciiTab(lead.notes, arr.beats_per_bar, arr.total_bars)).toBe(lead.tab_ascii.split("\n").slice(1).join("\n"));
    expect(lead.notes.some((n) => n.technique === "bend")).toBe(true);
  });

  it("writes each technique the standard way", () => {
    const base = { start_beat: 0, string: 3, fret: 7 };
    expect(noteToken({ ...base, technique: "bend", bend_semitones: 2 })).toBe("7b9");
    expect(noteToken({ ...base, technique: "bend", bend_semitones: 1, vibrato: true })).toBe("7b8~");
    expect(noteToken({ ...base, technique: "bend_release", bend_semitones: 2 })).toBe("7b9r7");
    expect(noteToken({ ...base, technique: "slide_up" })).toBe("/7");
    expect(noteToken({ ...base, technique: "slide_down" })).toBe("\\7");
    expect(noteToken({ ...base, technique: "hammer_on" })).toBe("h7");
    expect(noteToken({ ...base, technique: "pull_off" })).toBe("p7");
  });

  it("every lead note sounds string + fret (+ bend)", () => {
    for (const arr of [rock, blues]) for (const n of arr.lead!.notes) {
      expect(STANDARD_TUNING[n.string] + n.fret + (n.technique === "bend" ? n.bend_semitones! : 0)).toBe(n.midi);
    }
  });
});

describe("genre feel in the timeline", () => {
  it("shuffles the off-beat eighth for blues and keeps rock straight", () => {
    expect(swingBeat(0.5, 2 / 3)).toBeCloseTo(2 / 3);
    expect(swingBeat(3, 2 / 3)).toBe(3);
    expect(swingBeat(2.5, 0.5)).toBe(2.5);
    const b = buildSchedule(blues);
    const spb = b.secondsPerBeat;
    const backing = b.events.filter((e) => e.track === "backing").map((e) => e.time / spb);
    expect(backing[0]).toBeCloseTo(0);
    expect(backing[1]).toBeCloseTo(2 / 3); // late "and"
    expect(backing[2]).toBeCloseTo(1);
    const r = buildSchedule(rock);
    const rb = r.events.filter((e) => e.track === "backing").map((e) => e.time / r.secondsPerBeat);
    expect(rb[1]).toBeCloseTo(0.5);
  });

  it("schedules the lead part with its techniques", () => {
    const s = buildSchedule(rock, { part: "lead" });
    expect(s.partNotes.map((p) => p.id)).toEqual(rock.lead!.notes.map((n) => n.id));
    const leadEvents = s.events.filter((e) => e.track === "lead");
    expect(leadEvents).toHaveLength(rock.lead!.notes.length);
    const bend = leadEvents.find((e) => e.art?.bendSemitones);
    expect(bend).toBeDefined();
    expect(partNotes(rock, "lead")).toBe(rock.lead!.notes);
  });

  it("derives slide and bend articulation from the note data", () => {
    const slide = { midi: 67, fret: 12, string: 3, slide_from_fret: 10, technique: "slide_up" } as PlayableNote;
    expect(articulation(slide)).toMatchObject({ slideFromMidi: 65 });
    const bend = { midi: 64, fret: 8, string: 3, technique: "bend", bend_semitones: 1 } as PlayableNote;
    expect(articulation(bend)).toMatchObject({ bendSemitones: 1 });
    expect(articulation({ midi: 60, fret: 1, string: 2 } as PlayableNote)).toBeUndefined();
  });
});

describe("hand overlay geometry", () => {
  const lay = computeLayout({ handedness: "right", view: "beginner", frets: 12 });

  it("derives the hand position from fret and finger", () => {
    expect(new Set(handBases(rock.solo.notes))).toEqual(new Set([1])); // whole easy solo in first position
    const lead = rock.lead!.notes;
    handBases(lead).forEach((b, i) => {
      if (lead[i].fret > 0) expect(b).toBe(lead[i].fret - lead[i].finger + 1);
    });
    expect(handBases([{ string: 1, fret: 0, finger: 0 }, { string: 1, fret: 7, finger: 3 }])).toEqual([5, 5]);
  });

  it("puts the pressing fingertip exactly on the note and spreads one finger per fret", () => {
    const hand = computeHand(lay, 1, { string: 1, fret: 3, finger: 3 }, 12);
    const ring = hand.fingers.find((f) => f.finger === 3)!;
    expect(ring.pressing).toBe(true);
    expect(ring.tip).toEqual(lay.note(1, 3));
    expect(hand.fingers.filter((f) => f.pressing)).toHaveLength(1);
    expect(hand.fingers.map((f) => f.fret)).toEqual([1, 2, 3, 4]);
    const xs = hand.fingers.map((f) => f.tip.x);
    for (let i = 1; i < 4; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]); // index nearest the nut
  });

  it("brings fingers from the thin-string edge and the thumb from behind the thick-string edge", () => {
    const hand = computeHand(lay, 5, { string: 2, fret: 7, finger: 3 }, 12);
    const boardBottom = lay.board.y + lay.board.h;
    for (const f of hand.fingers) expect(f.knuckle.y).toBeLessThan(lay.board.y); // string 1 (thin e) is on top
    expect(hand.palm.cy).toBeLessThan(lay.board.y);
    expect(hand.thumb.tip.y).toBeGreaterThan(boardBottom);
    expect(hand.pad.edge).toBe("top");
    expect(hand.base).toBe(5);
  });

  it("follows the view: thin string on top, left-handed and vertical", () => {
    const chart = computeHand(computeLayout({ handedness: "right", view: "chart", frets: 12 }), 1, null, 12);
    expect(chart.pad.edge).toBe("top");
    const leftLay = computeLayout({ handedness: "left", view: "beginner", frets: 12 });
    const left = computeHand(leftLay, 1, { string: 1, fret: 3, finger: 3 }, 12);
    const xs = left.fingers.map((f) => f.tip.x);
    for (let i = 1; i < 4; i++) expect(xs[i]).toBeLessThan(xs[i - 1]); // index nearest the nut, which is on the right
    const vert = computeHand(computeLayout({ handedness: "right", view: "vertical", frets: 12 }), 1, null, 12);
    expect(vert.pad.edge).toBe("left"); // thin e on the left in vertical TAB order
  });

  it("keeps an open-string note hand-free (no finger pressing)", () => {
    const hand = computeHand(lay, 1, { string: 1, fret: 0, finger: 0 }, 12);
    expect(hand.fingers.every((f) => !f.pressing)).toBe(true);
  });
});

describe("technique coaching", () => {
  it("explains bends, slides, hammer-ons and pull-offs", () => {
    expect(fingerInstructions({ string: 3, fret: 7, finger: 3, technique: "bend", bend_semitones: 2 }).join(" "))
      .toContain("push the string towards the ceiling by a whole step");
    expect(fingerInstructions({ string: 3, fret: 9, finger: 3, technique: "slide_up", slide_from_fret: 7 })[1])
      .toBe("Keep your ring finger pressed and slide it up from fret 7 to fret 9.");
    expect(fingerInstructions({ string: 2, fret: 8, finger: 4, technique: "hammer_on" })[1]).toContain("Hammer");
    expect(fingerInstructions({ string: 2, fret: 5, finger: 1, technique: "pull_off" })[2]).toContain("Flick");
  });

  it("tells you to bend further when the pitch stops short", () => {
    expect(bendFeedback(65.2, 67, 2)).toContain("Push the string further");
    expect(bendFeedback(67.7, 67, 2)).toContain("too far");
    expect(bendFeedback(60, 67, 2)).toBeNull();
  });

  it("recognises the blues 'blue curl'", () => {
    const bar1 = blues.lead!.notes.filter((n) => n.start_beat < 4);
    const ins = phraseInsight(bar1, blues.harmonization.chords[0], blues.key, { isLastPhrase: false });
    expect(ins.id).toBe("blue-curl");
  });
});
