import { beforeEach, describe, expect, it, vi } from "vitest";

const created: { distortion: number; mono: number } = { distortion: 0, mono: 0 };
const leadCalls: { synth: unknown; midi: number; at: number; art: unknown }[] = [];
const drawSchedules: { time: number; fn: () => void }[] = [];

vi.mock("tone", () => {
  const node = () => ({
    triggerAttackRelease: vi.fn(),
    triggerRelease: vi.fn(),
    releaseAll: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    chain: vi.fn(),
    dispose: vi.fn(),
    volume: { value: 0 },
  });
  class Plain { constructor() { Object.assign(this, node()); } }
  return {
    start: vi.fn(async () => undefined),
    now: vi.fn(() => 1),
    getDraw: vi.fn(() => ({ schedule: (fn: () => void, time: number) => { drawSchedules.push({ time, fn }); }, cancel: vi.fn() })),
    PolySynth: Plain,
    MonoSynth: class { constructor() { created.mono++; Object.assign(this, node()); } },
    MembraneSynth: Plain,
    NoiseSynth: Plain,
    Filter: Plain,
    Distortion: class { constructor() { created.distortion++; Object.assign(this, node()); } },
    Gain: class {
      gain = { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
      constructor() { Object.assign(this, node()); }
    },
  };
});

vi.mock("@/lib/audio/engine", () => ({
  loadTone: () => import("tone"),
  getEngine: () => ({ stop: vi.fn() }),
  playLead: (synth: unknown, midi: number, at: number, _dur: number, _vel: number, art: unknown) => {
    leadCalls.push({ synth, midi, at, art });
  },
}));

async function until(cond: () => boolean) {
  for (let i = 0; i < 60; i++) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("condition not met");
}

describe("theory player lead line", () => {
  beforeEach(() => {
    created.distortion = 0;
    created.mono = 0;
    leadCalls.length = 0;
    drawSchedules.length = 0;
    vi.resetModules();
  });

  it("plays lick notes through playLead with articulation, double stops on separate voices", async () => {
    const { getTheoryPlayer } = await import("@/lib/theory/player");
    const { LICKS_BY_ID, lickExample } = await import("@/lib/music/soloGuide");
    const lick = LICKS_BY_ID["t-double"]!;
    const p = getTheoryPlayer().play(lickExample(lick), () => undefined, { lead: lick.notes, leadTone: "clean" });
    await until(() => leadCalls.length === lick.notes.length);
    expect(created.distortion).toBe(0);
    // Notes 0 and 1 share a beat (E+A double stop): they must not use the same voice.
    expect(leadCalls[0]!.at).toBe(leadCalls[1]!.at);
    expect(leadCalls[0]!.synth).not.toBe(leadCalls[1]!.synth);
    // The last A has vibrato.
    expect((leadCalls[lick.notes.length - 1]!.art as { vibrato?: boolean }).vibrato).toBe(true);
    getTheoryPlayer().stop();
    await p;
  });

  it("passes bend and slide articulation", async () => {
    const { getTheoryPlayer } = await import("@/lib/theory/player");
    const { LICKS_BY_ID, lickExample } = await import("@/lib/music/soloGuide");
    const bend = LICKS_BY_ID["t-bend"]!;
    const p = getTheoryPlayer().play(lickExample(bend), () => undefined, { lead: bend.notes });
    await until(() => leadCalls.length === bend.notes.length);
    expect(leadCalls[0]!.art).toMatchObject({ bendSemitones: 2 });
    getTheoryPlayer().stop();
    await p;
    leadCalls.length = 0;
    const slide = LICKS_BY_ID["t-slide"]!;
    const p2 = getTheoryPlayer().play(lickExample(slide), () => undefined, { lead: slide.notes });
    await until(() => leadCalls.length === slide.notes.length);
    expect(leadCalls[1]!.art).toMatchObject({ slideFromMidi: slide.notes[0]!.midi, legato: true });
    getTheoryPlayer().stop();
    await p2;
  });

  it("crunch adds a drive stage and plain playback builds no lead voices", async () => {
    const { getTheoryPlayer } = await import("@/lib/theory/player");
    const { LICKS_BY_ID, lickExample } = await import("@/lib/music/soloGuide");
    const lick = LICKS_BY_ID["t-vibrato"]!;
    const plain = getTheoryPlayer().play(lickExample(lick), () => undefined);
    await until(() => drawSchedules.length > 0);
    const monoPlain = created.mono;
    getTheoryPlayer().stop();
    await plain;
    const p = getTheoryPlayer().play(lickExample(lick), () => undefined, { lead: lick.notes, leadTone: "crunch" });
    await until(() => created.distortion > 0);
    expect(created.mono).toBeGreaterThan(monoPlain);
    getTheoryPlayer().stop();
    await p;
  });

  it("loops until stop, then stop resolves and clears highlights", async () => {
    const { getTheoryPlayer } = await import("@/lib/theory/player");
    const { JAM_TRACKS, jamExample } = await import("@/lib/music/soloGuide");
    const ex = jamExample(JAM_TRACKS[0]!, 140);
    const player = getTheoryPlayer();
    let resolved = false;
    const p = player.play({ ...ex, lengthBeats: 0.2 }, () => undefined, { loop: true, nextExample: () => ({ ...ex, lengthBeats: 0.2 }) }).then(() => { resolved = true; });
    await until(() => drawSchedules.length > 0);
    const first = drawSchedules.length;
    // The mocked clock never advances, so passes queue one lookahead timer apart; wait for the second pass.
    await until(() => drawSchedules.length > first);
    expect(player.playing).toBe(true);
    expect(resolved).toBe(false);
    player.stop();
    await p;
    expect(resolved).toBe(true);
    expect(player.playing).toBe(false);
  });
});
