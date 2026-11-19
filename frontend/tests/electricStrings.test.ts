import { describe, expect, it } from "vitest";
import {
  LeadString, PolyStrings, SAMPLE_HIGH, SAMPLE_LOW, likelyFret, mountStrings, renderString, sampleMidi,
} from "@/lib/audio/electricStrings";
import { midiToFreq } from "@/lib/music/theory";

const SR = 44100;

function rms(x: Float32Array, fromSec: number, toSec: number): number {
  const a = Math.floor(fromSec * SR);
  const b = Math.min(x.length, Math.floor(toSec * SR));
  let s = 0;
  for (let i = a; i < b; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, b - a));
}

/** Share of the signal that is fast movement: high = bright. */
function brightness(x: Float32Array, fromSec: number, toSec: number): number {
  const a = Math.floor(fromSec * SR) + 1;
  const b = Math.min(x.length, Math.floor(toSec * SR));
  let diff = 0;
  let tot = 0;
  for (let i = a; i < b; i++) {
    diff += (x[i]! - x[i - 1]!) ** 2;
    tot += x[i]! ** 2;
  }
  return Math.sqrt(diff / Math.max(1e-12, tot));
}

/** Pitch in Hz from the autocorrelation peak near the expected period. */
function pitchOf(x: Float32Array, expectHz: number, atSec = 0.4): number {
  const start = Math.floor(atSec * SR);
  const win = Math.floor(SR * 0.25);
  const expect = SR / expectHz;
  const corr = (lag: number) => {
    let s = 0;
    for (let i = 0; i < win; i++) s += x[start + i]! * x[start + i + lag]!;
    return s;
  };
  // Eight periods apart, so a fraction of a sample is a small fraction of the lag.
  const centre = Math.round(expect * 8);
  let best = centre;
  let bestV = -Infinity;
  for (let lag = centre - 6; lag <= centre + 6; lag++) {
    const v = corr(lag);
    if (v > bestV) { bestV = v; best = lag; }
  }
  const l = corr(best - 1);
  const r = corr(best + 1);
  const shift = (l - r) / (2 * (l - 2 * bestV + r));
  return (SR * 8) / (best + shift);
}

const cents = (hz: number, ref: number) => 1200 * Math.log2(hz / ref);

describe("string model", () => {
  it("is in tune across the neck", () => {
    for (const midi of [40, 45, 52, 57, 64, 69, 76, 83, 88]) {
      const x = renderString(midi, SR);
      expect(Math.abs(cents(pitchOf(x, midiToFreq(midi)), midiToFreq(midi))), `midi ${midi}`).toBeLessThan(4);
    }
  });

  it("stays inside full scale, with no silence at the start and none left at the end", () => {
    for (const midi of [37, 52, 64, 76, 91]) {
      const x = renderString(midi, SR);
      let peak = 0;
      let finite = true;
      for (let i = 0; i < x.length; i++) {
        if (!Number.isFinite(x[i]!)) finite = false;
        peak = Math.max(peak, Math.abs(x[i]!));
      }
      expect(finite, `midi ${midi}`).toBe(true);
      expect(peak, `midi ${midi}`).toBeLessThanOrEqual(0.9001);
      expect(peak, `midi ${midi}`).toBeGreaterThan(0.6);
      expect(rms(x, 0, 0.03), `midi ${midi}`).toBeGreaterThan(0.1);
      expect(Math.abs(x[x.length - 1]!)).toBeLessThan(1e-3);
    }
  });

  it("rings and dies away: loud at the pick, still sounding a second later, quieter by three", () => {
    for (const midi of [40, 57, 69]) {
      const x = renderString(midi, SR);
      const pick = rms(x, 0, 0.1);
      expect(rms(x, 1, 1.1), `midi ${midi}`).toBeGreaterThan(pick * 0.12);
      expect(rms(x, 1, 1.1), `midi ${midi}`).toBeLessThan(pick * 0.9);
      expect(rms(x, 2.5, 2.6), `midi ${midi}`).toBeLessThan(rms(x, 1, 1.1));
    }
  });

  it("loses its brightness as it rings, the way a string does and an organ does not", () => {
    for (const midi of [45, 57, 69, 81]) {
      const x = renderString(midi, SR);
      expect(brightness(x, 1.5, 1.8), `midi ${midi}`).toBeLessThan(brightness(x, 0.02, 0.12) * 0.8);
    }
  });

  it("has overtones: the plucked tone is far from a sine", () => {
    for (const midi of [40, 52, 64]) {
      const x = renderString(midi, SR);
      const sine = 2 * Math.sin((Math.PI * midiToFreq(midi)) / SR);
      expect(brightness(x, 0.02, 0.12), `midi ${midi}`).toBeGreaterThan(sine * 2.5);
    }
  });

  it("palm mute chokes the note in a fraction of a second", () => {
    for (const midi of [40, 52, 64]) {
      const x = renderString(midi, SR, { muted: true });
      expect(x.length).toBeLessThan(SR * 0.6);
      expect(rms(x, 0.25, 0.3), `midi ${midi}`).toBeLessThan(rms(x, 0, 0.04) * 0.12);
      const open = renderString(midi, SR, { seconds: 0.5 });
      expect(brightness(x, 0.02, 0.1), `midi ${midi}`).toBeLessThan(brightness(open, 0.02, 0.1));
    }
  });

  it("samples every third semitone, so no note is repitched by more than one", () => {
    for (let m = 38; m <= 90; m++) expect(Math.abs(sampleMidi(m) - m)).toBeLessThanOrEqual(1);
    expect(sampleMidi(20)).toBe(SAMPLE_LOW);
    expect(sampleMidi(120)).toBe(SAMPLE_HIGH);
    expect(likelyFret(40)).toBe(0);
    expect(likelyFret(57)).toBe(2); // A on the G string
    expect(likelyFret(76)).toBe(12); // high e, 12th fret
  });
});

/* A stand-in for Tone that records what the voices ask of it. */
class FakeParam {
  events: [string, number, number][] = [];
  constructor(public value: number) {}
  cancelScheduledValues(t: number) { this.events.push(["cancel", NaN, t]); }
  setValueAtTime(v: number, t: number) { this.value = v; this.events.push(["set", v, t]); }
  exponentialRampToValueAtTime(v: number, t: number) { this.value = v; this.events.push(["exp", v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.value = v; this.events.push(["lin", v, t]); }
  getValueAtTime() { return this.value; }
}
interface FakeSourceOpts { url: { length: number }; playbackRate: number; fadeIn: number; fadeOut: number; onended: (s: FakeSource) => void }
class FakeSource {
  static made: FakeSource[] = [];
  playbackRate: FakeParam;
  fadeOut: number;
  started: { time: number; offset: number; duration?: number; gain: number } | null = null;
  stops: { time: number; fadeOut: number }[] = [];
  disposed = false;
  constructor(public opts: FakeSourceOpts) {
    this.playbackRate = new FakeParam(opts.playbackRate);
    this.fadeOut = opts.fadeOut;
    FakeSource.made.push(this);
  }
  connect() { return this; }
  start(time: number, offset: number, duration: number | undefined, gain: number) {
    this.started = { time, offset, duration, gain };
    if (duration != null) this.stop(time + duration);
    return this;
  }
  stop(time: number) { this.stops.push({ time, fadeOut: this.fadeOut }); return this; }
  dispose() { this.disposed = true; return this; }
  end() { this.opts.onended(this); }
}
function fakeTone() {
  FakeSource.made = [];
  const buffers: { length: number; data: Float32Array }[] = [];
  const tone = {
    now: () => 10,
    getContext: () => ({
      rawContext: {
        sampleRate: 8000,
        createBuffer: (_ch: number, length: number) => {
          const b = { length, data: new Float32Array(length), getChannelData: () => b.data };
          buffers.push(b);
          return b;
        },
      },
    }),
    ToneBufferSource: FakeSource,
    Gain: class { gain = { value: 1 }; constructor(v: number) { this.gain.value = v; } connect() { return this; } dispose() { return this; } },
  };
  return { tone: tone as unknown as typeof import("tone"), buffers };
}

describe("string voices", () => {
  it("renders one bank of open and muted samples and reuses it", () => {
    const { tone, buffers } = fakeTone();
    const rig = mountStrings(tone)!;
    expect(rig).not.toBeNull();
    const count = (SAMPLE_HIGH - SAMPLE_LOW) / 3 + 1;
    expect(buffers).toHaveLength(count * 2);
    mountStrings(tone);
    expect(buffers).toHaveLength(count * 2);
  });

  it("gives null without an audio context, so callers keep their oscillators", () => {
    expect(mountStrings({} as unknown as typeof import("tone"))).toBeNull();
  });

  it("plays a chord as one sample per note, repitched from the nearest sampled pitch", () => {
    const { tone } = fakeTone();
    const poly = mountStrings(tone)!.poly({}, { release: 0.3, db: -6 }) as PolyStrings;
    expect(poly.volume.value).toBe(-6);
    poly.triggerAttackRelease([midiToFreq(52), midiToFreq(56), midiToFreq(59)], 1.5, 12, 0.7);
    expect(FakeSource.made).toHaveLength(3);
    const [a, b] = FakeSource.made;
    expect(a!.started).toEqual({ time: 12, offset: 0, duration: 1.5, gain: 0.7 });
    expect(a!.playbackRate.value).toBeCloseTo(1, 6); // 52 is sampled
    expect(b!.playbackRate.value).toBeCloseTo(2 ** (1 / 12), 6); // 56 plays the 55 sample a semitone up
    expect(a!.stops).toEqual([{ time: 13.5, fadeOut: 0.3 }]);
    poly.dispose();
    expect(FakeSource.made.every((s) => s.disposed)).toBe(true);
  });

  it("bends the lead note by moving the playback speed of the note just struck", () => {
    const { tone } = fakeTone();
    const lead = mountStrings(tone)!.lead({}) as LeadString;
    const from = midiToFreq(62);
    const to = midiToFreq(64);
    lead.triggerAttack(from, 20, 0.8);
    lead.frequency.setValueAtTime(from, 20);
    lead.frequency.exponentialRampToValueAtTime(to, 20.2);
    const src = FakeSource.made[0]!;
    const base = midiToFreq(sampleMidi(62));
    expect(src.started).toMatchObject({ time: 20, offset: 0, gain: 0.8 });
    expect(src.playbackRate.events).toEqual([["set", from / base, 20], ["exp", to / base, 20.2]]);
    expect(Number(lead.frequency.getValueAtTime(20.2))).toBeCloseTo(to, 6);
    lead.triggerRelease(21);
    expect(src.stops).toEqual([{ time: 21, fadeOut: 0.07 }]);
  });

  it("hammer-ons skip the pick click, palm mutes use the muted string", () => {
    const { tone } = fakeTone();
    const lead = mountStrings(tone)!.lead({}) as LeadString;
    lead.triggerAttack(midiToFreq(64), 5, 0.5, { legato: true });
    lead.triggerRelease(5.2);
    lead.triggerAttack(midiToFreq(64), 6, 1, { mute: 0.6 });
    const [hammer, chug] = FakeSource.made;
    expect(hammer!.started!.offset).toBeGreaterThan(0.005);
    expect(hammer!.opts.fadeIn).toBeGreaterThan(0);
    expect(chug!.started!.offset).toBe(0);
    expect(chug!.opts.url.length).toBeLessThan(hammer!.opts.url.length);
  });

  it("is one string: a new note cuts one that is still ringing, and leaves a released one alone", () => {
    const { tone } = fakeTone();
    const lead = mountStrings(tone)!.lead({}) as LeadString;
    lead.triggerAttack(midiToFreq(60), 1, 1);
    lead.triggerAttack(midiToFreq(62), 1.5, 1); // first note never released
    const [first, second] = FakeSource.made;
    expect(first!.stops).toEqual([{ time: 1.5, fadeOut: 0.012 }]);
    lead.triggerRelease(2);
    lead.triggerAttack(midiToFreq(64), 2.1, 1);
    expect(second!.stops).toEqual([{ time: 2, fadeOut: 0.07 }]);
    // Once a note has ended, pitch moves no longer reach it.
    const third = FakeSource.made[2]!;
    third.end();
    lead.frequency.setValueAtTime(440, 3);
    expect(third.playbackRate.events).toEqual([]);
    expect(Number(lead.frequency.getValueAtTime(3))).toBe(440);
  });
});
