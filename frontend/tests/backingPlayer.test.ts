import { beforeEach, describe, expect, it, vi } from "vitest";

/** Every synth the player builds, so the test can count what was triggered. */
const made: { kind: string; triggerAttackRelease: ReturnType<typeof vi.fn> }[] = [];

vi.mock("tone", () => {
  const voice = (kind: string) =>
    class {
      triggerAttackRelease = vi.fn();
      triggerRelease = vi.fn();
      releaseAll = vi.fn();
      connect = vi.fn().mockReturnThis();
      toDestination = vi.fn().mockReturnThis();
      dispose = vi.fn();
      volume = { value: 0 };
      constructor() { made.push({ kind, triggerAttackRelease: this.triggerAttackRelease }); }
    };
  return {
    start: vi.fn(async () => undefined),
    now: vi.fn(() => 1),
    getDraw: vi.fn(() => ({ schedule: vi.fn(), cancel: vi.fn() })),
    PolySynth: voice("poly"),
    MonoSynth: voice("mono"),
    MembraneSynth: voice("membrane"),
    NoiseSynth: voice("noise"),
    Filter: class { connect = vi.fn(); dispose = vi.fn(); },
    Gain: class {
      gain = { value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
      connect = vi.fn().mockReturnThis();
      toDestination = vi.fn().mockReturnThis();
      dispose = vi.fn();
    },
  };
});

const leadCalls: number[] = [];
vi.mock("@/lib/audio/engine", () => ({
  loadTone: () => import("tone"),
  getEngine: () => ({ stop: vi.fn() }),
  playLead: (_synth: unknown, midi: number) => { leadCalls.push(midi); },
}));

describe("backing tracks through the theory player", () => {
  beforeEach(() => {
    made.length = 0;
    leadCalls.length = 0;
    vi.resetModules();
  });

  it("plays every drum hit and bass note of a bar, including ride, rim, open hat and crash", async () => {
    const { getTheoryPlayer } = await import("@/lib/theory/player");
    const { TRACKS, barSound, drumBar, bassBar } = await import("@/lib/music/backingTracks");
    const jazz = TRACKS.find((t) => t.drums.id === "swingRide")!;
    const reggae = TRACKS.find((t) => t.drums.id === "steppers")!;
    const rock = TRACKS.find((t) => t.genre === "rock" && t.drums.rows.ohat)!;
    const p = getTheoryPlayer();
    for (const [t, cycle] of [[jazz, 0], [reggae, 0], [rock, 1]] as const) {
      made.length = 0;
      void p.play(barSound(t, 0, { bpm: t.bpm, cycle }), () => {});
      await new Promise((r) => setTimeout(r, 0));
      const calls = made.reduce((n, m) => n + m.triggerAttackRelease.mock.calls.length, 0);
      const drums = drumBar(t, 0, cycle);
      const rides = drums.filter((h) => h.voice === "ride").length; // ride = noise + ping
      expect(calls, t.id).toBe(drums.length + rides + bassBar(t, 0).length);
      p.stop();
    }
  });

  it("plays each bar's own lick notes on the lead voice", async () => {
    const { getTheoryPlayer } = await import("@/lib/theory/player");
    const { TRACKS, barSound } = await import("@/lib/music/backingTracks");
    const { guideLick, lickBar } = await import("@/lib/music/backingSolo");
    const t = TRACKS.find((x) => x.name === "Garage Eighths")!;
    const lick = guideLick(t, "beat");
    const p = getTheoryPlayer();
    for (const bar of [0, 2]) {
      leadCalls.length = 0;
      const { notes } = lickBar(lick, bar, 4);
      void p.play({ ...barSound(t, bar, { bpm: t.bpm }), lead: notes }, () => {});
      await new Promise((r) => setTimeout(r, 0));
      expect(leadCalls).toEqual(notes.map((n) => n.midi));
      p.stop();
    }
  });
});
