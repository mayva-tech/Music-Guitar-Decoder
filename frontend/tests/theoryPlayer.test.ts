import { beforeEach, describe, expect, it, vi } from "vitest";

const drawSchedules: { time: number; fn: () => void }[] = [];

vi.mock("tone", () => {
  const synth = () => ({
    triggerAttackRelease: vi.fn(),
    triggerRelease: vi.fn(),
    releaseAll: vi.fn(),
    connect: vi.fn().mockReturnThis(),
    toDestination: vi.fn().mockReturnThis(),
    dispose: vi.fn(),
    volume: { value: 0 },
  });
  class FakePoly {
    constructor(_opts: unknown) { /* */ }
    triggerAttackRelease = vi.fn();
    releaseAll = vi.fn();
    connect = vi.fn().mockReturnThis();
    toDestination = vi.fn().mockReturnThis();
    dispose = vi.fn();
    volume = { value: 0 };
  }
  return {
    start: vi.fn(async () => undefined),
    now: vi.fn(() => 1),
    getDestination: vi.fn(() => ({})),
    getDraw: vi.fn(() => ({
      schedule: (fn: () => void, time: number) => {
        drawSchedules.push({ time, fn });
      },
      cancel: vi.fn(),
    })),
    PolySynth: FakePoly,
    MonoSynth: class {
      constructor() { Object.assign(this, synth()); }
    },
    MembraneSynth: class {
      constructor() { Object.assign(this, synth()); }
    },
    NoiseSynth: class {
      constructor() { Object.assign(this, synth()); }
      connect = vi.fn().mockReturnThis();
    },
    Filter: class {
      constructor() { Object.assign(this, synth()); }
      connect = vi.fn();
    },
    Gain: class {
      gain = {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      };
      connect = vi.fn().mockReturnThis();
      toDestination = vi.fn().mockReturnThis();
      dispose = vi.fn();
      constructor(_v?: number) { /* */ }
    },
  };
});

vi.mock("@/lib/audio/engine", () => ({
  loadTone: () => import("tone"),
  getEngine: () => ({ stop: vi.fn() }),
}));

async function waitForSchedules(min = 1) {
  for (let i = 0; i < 40; i++) {
    if (drawSchedules.length >= min) return;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error(`expected >= ${min} draw schedules, got ${drawSchedules.length}`);
}

describe("theory player", () => {
  beforeEach(() => {
    drawSchedules.length = 0;
    vi.resetModules();
  });

  it("schedules highlight on/off for events with highlight ids", async () => {
    const { getTheoryPlayer } = await import("@/lib/theory/player");
    const player = getTheoryPlayer();
    const seen: { id: string; on: boolean }[] = [];
    const playPromise = player.play(
      {
        bpm: 120,
        lengthBeats: 1,
        events: [
          { kind: "highlight", beat: 0, beats: 0.5, velocity: 1, highlight: "d0" },
          { kind: "pluck", beat: 0, beats: 0.5, velocity: 0.8, midi: 64, highlight: "d1" },
        ],
      },
      (id, on) => seen.push({ id, on }),
    );

    expect(player.playing).toBe(true);
    await waitForSchedules(2);
    drawSchedules.sort((a, b) => a.time - b.time).forEach((s) => s.fn());
    expect(seen.some((s) => s.id === "d0" && s.on)).toBe(true);
    expect(seen.some((s) => s.id === "d1" && s.on)).toBe(true);

    player.stop();
    await playPromise;
    expect(player.playing).toBe(false);
  });

  it("stop resolves the pending play and clears highlights", async () => {
    const { getTheoryPlayer } = await import("@/lib/theory/player");
    const player = getTheoryPlayer();
    const offs: string[] = [];
    const p = player.play(
      {
        bpm: 60,
        lengthBeats: 8,
        events: [{ kind: "pluck", beat: 0, beats: 1, velocity: 1, midi: 60, highlight: "x" }],
      },
      (id, on) => {
        if (!on) offs.push(id);
      },
    );
    await waitForSchedules(1);
    // Turn the highlight on via its scheduled callback, then stop should turn it off.
    drawSchedules.filter((s) => s.time <= 1.1).forEach((s) => s.fn());
    player.stop();
    await p;
    expect(offs).toContain("x");
  });
});
