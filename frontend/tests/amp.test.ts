import { describe, expect, it } from "vitest";
import {
  AMP_PRESETS,
  ampPresetMatches,
  ampSignature,
  createAmpPreset,
  driveFromAmp,
  knobToDb,
  masterDb,
  nextTonePresetName,
  normalizeAmp,
  normalizeAmpPresets,
  spaceFromAmp,
} from "@/lib/audio/amp";

describe("amp knobs", () => {
  it("clamps and fills missing knobs", () => {
    expect(normalizeAmp({ gain: 99, bass: -3 })).toEqual({
      gain: 10, bass: 0, mid: 5, treble: 5, presence: 5,
      delay: 2, feedback: 2, reverb: 2.5, mute: 0, master: 5,
    });
  });

  it("maps centre knobs to ~0 dB", () => {
    expect(knobToDb(5)).toBe(0);
    expect(knobToDb(10, 10)).toBe(10);
    expect(knobToDb(0, 10)).toBe(-10);
  });

  it("raises drive with gain on crunch and softens clean", () => {
    const soft = driveFromAmp("clean", AMP_PRESETS.clean);
    const hot = driveFromAmp("distortion", AMP_PRESETS.distortion);
    const crunchHot = driveFromAmp("crunch", { ...AMP_PRESETS.crunch, gain: 10 });
    expect(soft.softClean).toBe(true);
    expect(hot.pre).toBeGreaterThan(soft.pre);
    expect(hot.stage2).toBeGreaterThan(0.5);
    expect(crunchHot.distortion).toBeGreaterThan(0.7);
    expect(crunchHot.pre).toBeGreaterThan(6);
  });

  it("changes signature when a knob moves", () => {
    const a = AMP_PRESETS.clean;
    expect(ampSignature("clean", a)).not.toBe(ampSignature("clean", { ...a, gain: a.gain + 1 }));
    expect(ampSignature("clean", a)).not.toBe(ampSignature("crunch", a));
  });

  it("raises master volume with the master knob", () => {
    expect(masterDb("clean", { ...AMP_PRESETS.clean, master: 10 }))
      .toBeGreaterThan(masterDb("clean", { ...AMP_PRESETS.clean, master: 0 }));
  });

  it("opens delay and reverb with their knobs and caps feedback", () => {
    const dry = spaceFromAmp({ ...AMP_PRESETS.clean, delay: 0, feedback: 10, reverb: 0 });
    const wet = spaceFromAmp({ ...AMP_PRESETS.clean, delay: 10, feedback: 10, reverb: 10 });
    expect(dry.delayWet).toBe(0);
    expect(dry.reverbWet).toBe(0);
    expect(wet.delayWet).toBeGreaterThan(0.4);
    expect(wet.reverbWet).toBeGreaterThan(0.3);
    expect(wet.feedback).toBeLessThanOrEqual(0.7);
    expect(dry.feedback).toBeLessThan(wet.feedback);
  });

  it("creates and matches saved amp presets", () => {
    const preset = createAmpPreset("  Embers  ", "crunch", AMP_PRESETS.crunch);
    expect(preset.name).toBe("Embers");
    expect(preset.tone).toBe("crunch");
    expect(ampPresetMatches(preset, "crunch", AMP_PRESETS.crunch)).toBe(true);
    expect(ampPresetMatches(preset, "crunch", { ...AMP_PRESETS.crunch, gain: 1 })).toBe(false);
    expect(normalizeAmpPresets([{ ...preset }, { name: "", amp: {} }, null])).toEqual([
      { id: preset.id, name: "Embers", tone: "crunch", amp: normalizeAmp(AMP_PRESETS.crunch) },
    ]);
  });

  it("opens palm mute with the Palm knob", () => {
    expect(normalizeAmp({ mute: 8 }).mute).toBe(8);
    expect(ampSignature("distortion", AMP_PRESETS.distortion))
      .not.toBe(ampSignature("distortion", { ...AMP_PRESETS.distortion, mute: 0 }));
  });

  it("auto-names tone presets crunch1, crunch2, …", () => {
    expect(nextTonePresetName("crunch", [])).toBe("crunch1");
    const one = createAmpPreset("crunch1", "crunch", AMP_PRESETS.crunch);
    expect(nextTonePresetName("crunch", [one])).toBe("crunch2");
    const two = createAmpPreset("Crunch2", "crunch", AMP_PRESETS.crunch);
    expect(nextTonePresetName("crunch", [one, two])).toBe("crunch3");
    expect(nextTonePresetName("clean", [one])).toBe("clean1");
  });
});
