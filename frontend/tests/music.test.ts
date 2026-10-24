import { describe, expect, it } from "vitest";
import { STANDARD_TUNING, midiAt, positionsForMidi, positionMatches } from "@/lib/music/guitar";
import { centsFrom, freqToMidi, midiToFreq, midiToName, nameToMidi } from "@/lib/music/theory";
import { fingerInstructions, wrongNoteHint } from "@/lib/music/instructions";
import { layoutTab, renderAsciiTab } from "@/lib/music/tab";
import { phraseInsight } from "@/lib/music/insights";
import fixture from "./fixtures/demo-arrangement.json";
import type { Arrangement } from "@/lib/types";

const arr = fixture as unknown as Arrangement;

const REFERENCE_TAB = `e|--0--3--3--0--|--1-----0--1--|--3--------3--|--3--0--------|
B|--------------|-----1--------|-----3--0-----|--------1--1--|
G|--------------|--------------|--------------|--------------|
D|--------------|--------------|--------------|--------------|
A|--------------|--------------|--------------|--------------|
E|--------------|--------------|--------------|--------------|`;

describe("standard tuning & MIDI (tests 1–3)", () => {
  it("has the standard open strings", () => {
    expect(STANDARD_TUNING).toEqual({ 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 });
    expect([6, 5, 4, 3, 2, 1].map((s) => midiToName(STANDARD_TUNING[s]))).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
  });

  it("converts names, MIDI and frequency", () => {
    expect(nameToMidi("C4")).toBe(60);
    expect(nameToMidi("Bb3")).toBe(58);
    expect(midiToName(61)).toBe("C#4");
    expect(midiToName(61, true)).toBe("Db4");
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(freqToMidi(82.4069)).toBeCloseTo(40, 3);
    expect(centsFrom(64.2, 64)).toBeCloseTo(20);
    expect(() => midiToName(200)).toThrow();
    expect(() => nameToMidi("H2")).toThrow();
  });

  it.each([
    ["E4", 1, 0], ["F4", 1, 1], ["G4", 1, 3], ["B3", 2, 0], ["C4", 2, 1], ["D4", 2, 3],
  ])("%s is string %i fret %i", (name, s, f) => {
    expect(midiAt(s as number, f as number)).toBe(nameToMidi(name as string));
    expect(positionsForMidi(nameToMidi(name as string))).toContainEqual({ string: s, fret: f });
  });

  it("applies MIDI = open string + fret everywhere and rejects bad positions", () => {
    for (const s of [1, 2, 3, 4, 5, 6]) for (let f = 0; f <= 22; f++) expect(midiAt(s, f)).toBe(STANDARD_TUNING[s] + f);
    expect(() => midiAt(7, 1)).toThrow();
    expect(() => midiAt(1, -1)).toThrow();
    expect(positionMatches({ midi: 67, string: 1, fret: 3 })).toBe(true);
    expect(positionMatches({ midi: 66, string: 1, fret: 3 })).toBe(false);
  });
});

describe("finger GPS instructions", () => {
  it("describes G4 like a teacher", () => {
    expect(fingerInstructions({ string: 1, fret: 3, finger: 3 })).toEqual([
      "Play the thinnest string.", "Press the third fret.", "Use your ring finger.", "Pluck the string gently.",
    ]);
  });
  it("needs no finger for open strings", () => {
    expect(fingerInstructions({ string: 1, fret: 0, finger: 0 })).toEqual(["Play the thinnest string.", "No finger needed. Just pluck this string."]);
    expect(wrongNoteHint({ string: 1, fret: 3, finger: 3 })).toBe("Try the third fret on the thinnest string.");
  });
});

describe("TAB (tests 9 & 13)", () => {
  it("renders the reference demo TAB exactly from the generated solo data", () => {
    const tab = renderAsciiTab(arr.solo.notes, 4, 4);
    expect(tab).toBe(REFERENCE_TAB);
    // ... and the backend's own rendering agrees
    expect(arr.solo.tab_ascii.split("\n").slice(1).join("\n")).toBe(REFERENCE_TAB);
  });

  it("puts the thin e string on top and thick E at the bottom", () => {
    const lines = renderAsciiTab(arr.solo.notes, 4, 4).split("\n");
    expect(lines[0][0]).toBe("e");
    expect(lines[5][0]).toBe("E");
  });

  it("every TAB number plays the note's pitch", () => {
    const lay = layoutTab(arr.solo.notes, 4, arr.total_bars);
    const byId = new Map(arr.solo.notes.map((n) => [n.id, n]));
    let count = 0;
    for (const cell of lay.cells) for (const n of cell.notes) {
      const ev = byId.get(n.id!)!;
      expect(STANDARD_TUNING[n.string] + n.fret).toBe(ev.midi);
      expect(cell.beat).toBe(ev.start_beat);
      count++;
    }
    expect(count).toBe(arr.solo.notes.length);
  });

  it("handles eighth notes, rests and two-digit frets", () => {
    const tab = renderAsciiTab([
      { start_beat: 0, string: 1, fret: 12 }, { start_beat: 0.5, string: 1, fret: 10 }, { start_beat: 2, string: 2, fret: 13 },
    ], 4, 1);
    expect(tab.split("\n")[0]).toBe("e|--12--10---------------------|");
    expect(tab.split("\n")[1]).toBe("B|----------------13-----------|"); // identical to backend render_tab
  });
});

describe("hidden theory insights", () => {
  const key = arr.key;
  it("spots chord tones", () => {
    const bar1 = arr.solo.notes.slice(0, 4);
    const ins = phraseInsight(bar1, arr.harmonization.chords[0], key, { isLastPhrase: false });
    expect(ins.headline).toBe("You just played two notes from a C major chord!");
  });
  it("celebrates landing on the home note", () => {
    const last = arr.solo.notes.slice(12);
    expect(phraseInsight(last, arr.harmonization.chords[3], key, { isLastPhrase: true }).id).toBe("home-note");
  });
});

import { deleteNote, hasOverlaps, insertAfter, setDuration, transposeNote, canRequantize } from "@/lib/music/edit";

describe("correcting detected notes", () => {
  const m = fixture.original_melody as unknown as Arrangement["original_melody"];
  it("changes pitch and marks the note as user-edited and certain", () => {
    const e = transposeNote(m, m.notes[0].id, 1);
    expect(e.notes[0].name).toBe("F4");
    expect(e.notes[0].source).toBe("edited");
    expect(e.notes[0].low_confidence).toBe(false);
    expect(m.notes[0].name).toBe("E4"); // original untouched
  });
  it("never creates overlapping notes", () => {
    expect(hasOverlaps(setDuration(m, m.notes[0].id, 3))).toBe(false);
    expect(setDuration(m, m.notes[0].id, 3).notes[0].duration_beats).toBe(1);
    const ins = insertAfter(m, m.notes[1].id);
    expect(ins.notes).toHaveLength(17);
    expect(hasOverlaps(ins)).toBe(false);
    expect(deleteNote(m, m.notes[0].id).notes).toHaveLength(15);
    expect(canRequantize(ins)).toBe(false);
  });
});
