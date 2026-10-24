import { describe, expect, it } from "vitest";
import {
  BASS_STRING_PARTIALS, CLEAN_PARTIALS, G_STRING_PARTIALS, isBassStringMidi, pluckedPartials, pluckVoice, TONES,
  warmToneKind,
} from "@/lib/audio/guitarTone";

describe("plucked-string harmonics", () => {
  it("is normalized to the fundamental and has the requested length", () => {
    const p = pluckedPartials(12, 0.12, 1.1);
    expect(p).toHaveLength(12);
    expect(p[0]).toBe(1);
    p.forEach((a) => expect(a).toBeGreaterThanOrEqual(0));
  });

  it("is rich in harmonics, unlike a sine or an organ flute stop", () => {
    expect(CLEAN_PARTIALS.length).toBeGreaterThanOrEqual(24);
    // 2nd–4th harmonics clearly present — string bite, not a soft fundamental.
    expect(CLEAN_PARTIALS[1]).toBeGreaterThan(0.45);
    expect(CLEAN_PARTIALS[2]).toBeGreaterThan(0.3);
    expect(CLEAN_PARTIALS[3]).toBeGreaterThan(0.2);
    // Upper harmonics still audible enough to keep the ring stringy while it decays.
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(CLEAN_PARTIALS.slice(8, 16))).toBeGreaterThan(0.08);
    expect(avg(CLEAN_PARTIALS.slice(10, 20))).toBeLessThan(avg(CLEAN_PARTIALS.slice(1, 5)));
  });

  it("goes quiet at harmonics that have a node at the pick point", () => {
    // Picking at 1/5 of the string silences the 5th and 10th harmonics.
    const p = pluckedPartials(12, 0.2, 1.1);
    expect(p[4]).toBeLessThan(1e-3);
    expect(p[9]).toBeLessThan(1e-3);
    expect(p[3]).toBeGreaterThan(0.05);
  });

  it("picking nearer the bridge sounds brighter", () => {
    const upper = (p: number[]) => p.slice(4, 12).reduce((s, x) => s + x, 0);
    expect(upper(pluckedPartials(12, 0.08))).toBeGreaterThan(upper(pluckedPartials(12, 0.25)));
  });
});

describe("pluck voice settings", () => {
  it("dies away instead of holding like an organ", () => {
    expect(TONES.melody.envelope.sustain).toBe(0);
    expect(TONES.melody.envelope.attack).toBeLessThan(0.002);
    expect(TONES.melody.envelope.decayCurve).toBe("exponential");
    expect(TONES.lead.envelope.sustain).toBeLessThan(0.3);
  });

  it("starts with body and keeps a warm shelf while it rings", () => {
    const v = pluckVoice({ partials: G_STRING_PARTIALS, base: 560, bright: 2.4, filterSustain: 0.3 });
    const settle = v.filterEnvelope.baseFrequency * 2 ** (v.filterEnvelope.octaves * v.filterEnvelope.sustain);
    const peak = v.filterEnvelope.baseFrequency * 2 ** v.filterEnvelope.octaves;
    expect(peak).toBeGreaterThan(2500);
    expect(settle).toBeLessThan(peak);
    expect(settle).toBeGreaterThan(800);
    expect(v.filterEnvelope.sustain).toBeGreaterThanOrEqual(0.25);
  });

  it("gives overdriven parts a string ring and the rhythm part a chug", () => {
    expect(TONES.lead.envelope.sustain).toBeGreaterThan(0.05);
    expect(TONES.backing.envelope.decay).toBeLessThan(0.6);
  });

  it("darkens E/A/D-range notes vs the old bright recipe", () => {
    expect(isBassStringMidi(40)).toBe(true); // open low E
    expect(isBassStringMidi(50)).toBe(true); // open D
    expect(isBassStringMidi(57)).toBe(true);
    expect(isBassStringMidi(59)).toBe(false); // open B
    expect(isBassStringMidi(64)).toBe(false); // open high e
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(BASS_STRING_PARTIALS.slice(4))).toBeLessThan(avg(CLEAN_PARTIALS.slice(4, 12)));
    expect(TONES.melodyLow.filterEnvelope.baseFrequency).toBeLessThan(TONES.melody.filterEnvelope.baseFrequency);
  });

  it("voices G/B/high-e together: mid body, not bridge twang", () => {
    expect(warmToneKind(6)).toBe("bass");
    expect(warmToneKind(5)).toBe("bass");
    expect(warmToneKind(4)).toBe("bass");
    expect(warmToneKind(3)).toBe("g");
    expect(warmToneKind(2)).toBe("g");
    expect(warmToneKind(1)).toBe("g");
    expect(TONES.melodyLow.filterEnvelope.baseFrequency).toBeGreaterThanOrEqual(350); // guitar body, not bass-amp sub
    expect(TONES.melodyG.filterEnvelope.baseFrequency).toBeGreaterThan(TONES.melodyLow.filterEnvelope.baseFrequency);
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(G_STRING_PARTIALS.slice(4))).toBeLessThan(avg(CLEAN_PARTIALS.slice(4, 12)));
  });
});
