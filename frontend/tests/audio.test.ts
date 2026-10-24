import { beforeEach, describe, expect, it } from "vitest";
import { detectPitch, toMidiFloat } from "@/lib/audio/pitch";
import { BandScorer, StablePitchTracker, judge } from "@/lib/audio/noteMatcher";
import { MicError, classifyMicError, requestMicrophone } from "@/lib/audio/mic";
import { activeNoteIndex, barAndBeat, buildSchedule, chordAtBeat } from "@/lib/audio/timeline";
import { extensionFor, pickMimeType, validateUpload } from "@/lib/audio/recorder";
import fixture from "./fixtures/demo-arrangement.json";
import type { Arrangement } from "@/lib/types";

const arr = fixture as unknown as Arrangement;
const SR = 44100;

function pluck(freq: number, n = 2048, harmonics = [1, 0.6, 0.35, 0.2], noise = 0): Float32Array {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    harmonics.forEach((a, k) => (v += a * Math.sin((2 * Math.PI * freq * (k + 1) * i) / SR)));
    b[i] = 0.3 * v + noise * (Math.random() * 2 - 1);
  }
  return b;
}

describe("live pitch detection (YIN)", () => {
  it.each([[82.41, 40], [110, 45], [196, 55], [329.63, 64], [392, 67], [659.26, 76]])("detects %f Hz as MIDI %i", (f, midi) => {
    const r = detectPitch(pluck(f, 4096), SR);
    expect(r.freq).not.toBeNull();
    expect(Math.abs(toMidiFloat(r)! - midi) * 100).toBeLessThan(8); // within 8 cents
    expect(r.clarity).toBeGreaterThan(0.8);
  });

  it("stays accurate at 48 kHz (decimated fast path)", () => {
    for (const [f, midi] of [[82.41, 40], [246.94, 59], [987.77, 83]]) {
      const n = 4096, b = new Float32Array(n);
      for (let i = 0; i < n; i++) b[i] = 0.3 * (Math.sin((2 * Math.PI * f * i) / 48000) + 0.5 * Math.sin((4 * Math.PI * f * i) / 48000));
      const r = detectPitch(b, 48000);
      expect(Math.abs(toMidiFloat(r)! - midi) * 100).toBeLessThan(8);
    }
  });

  it("ignores silence and treats noise as unpitched", () => {
    expect(detectPitch(new Float32Array(2048), SR).freq).toBeNull();
    const noise = new Float32Array(2048).map(() => Math.random() * 0.6 - 0.3);
    const r = detectPitch(noise, SR);
    expect(r.freq === null || r.clarity < 0.7).toBe(true);
  });

  it("copes with a little background noise", () => {
    const r = detectPitch(pluck(196, 4096, [1, 0.5, 0.3], 0.05), SR);
    expect(Math.round(toMidiFloat(r)!)).toBe(55);
  });
});

describe("note judging", () => {
  it("needs several steady frames before deciding", () => {
    const t = new StablePitchTracker(4);
    expect(t.push({ midi: 67.02, clarity: 0.95 })).toBeNull();
    expect(t.push({ midi: 66.98, clarity: 0.95 })).toBeNull();
    expect(t.push({ midi: 67.05, clarity: 0.95 })).toBeNull();
    expect(t.push({ midi: 67.0, clarity: 0.95 })!.midi).toBeCloseTo(67, 1);
    expect(t.push({ midi: null, clarity: 0 })).toBeNull(); // silence resets
    expect(t.push({ midi: 67, clarity: 0.4 })).toBeNull(); // unclear frames ignored
  });

  it("judges correct, octave and wrong notes", () => {
    expect(judge(67.1, 67).verdict).toBe("correct");
    expect(judge(79.0, 67).verdict).toBe("octave");
    expect(judge(65.0, 67).verdict).toBe("wrong");
    expect(judge(67.6, 67, 40).verdict).toBe("wrong");
  });

  it("scores playing along with the band, including timing", () => {
    const s = new BandScorer([
      { id: "a", midi: 64, start: 1.0, end: 1.75 },
      { id: "b", midi: 67, start: 1.75, end: 2.5 },
    ]);
    for (let t = 0.9; t < 1.6; t += 0.025) s.push(t, { midi: t > 1.05 ? 64.05 : null, clarity: 0.95 });
    for (let t = 1.75; t < 2.6; t += 0.025) s.push(t, { midi: 65, clarity: 0.95 }); // wrong note
    const [a, b] = s.results();
    expect(a.correct).toBe(true);
    expect(a.timingOffsetMs!).toBeGreaterThan(40);
    expect(a.timingOffsetMs!).toBeLessThan(120);
    expect(b.correct).toBe(false);
    expect(b.detectedMidi).toBeCloseTo(65);
  });
});

describe("microphone errors (test 15)", () => {
  const env = (err: unknown) => ({ isSecureContext: true, mediaDevices: { getUserMedia: () => Promise.reject(err) } });
  it("explains a denied permission", async () => {
    const p = requestMicrophone(env({ name: "NotAllowedError" }));
    await expect(p).rejects.toBeInstanceOf(MicError);
    await expect(p).rejects.toMatchObject({ kind: "denied" });
  });
  it("explains missing devices, busy devices, insecure pages and old browsers", async () => {
    await expect(requestMicrophone(env({ name: "NotFoundError" }))).rejects.toMatchObject({ kind: "no-device" });
    await expect(requestMicrophone(env({ name: "NotReadableError" }))).rejects.toMatchObject({ kind: "busy" });
    await expect(requestMicrophone({ isSecureContext: false })).rejects.toMatchObject({ kind: "insecure" });
    await expect(requestMicrophone({ isSecureContext: true })).rejects.toMatchObject({ kind: "unsupported" });
    expect(classifyMicError(new Error("x")).kind).toBe("unknown");
  });
  it("asks for raw audio (no speech processing)", async () => {
    let seen: MediaStreamConstraints | undefined;
    await requestMicrophone({ isSecureContext: true, mediaDevices: { getUserMedia: async (c) => { seen = c; return {} as MediaStream; } } });
    expect(seen!.audio).toMatchObject({ echoCancellation: false, noiseSuppression: false, autoGainControl: false });
  });
});

describe("synchronized playback timing (test 14)", () => {
  it("places every track on the same beat clock", () => {
    const s = buildSchedule(arr, { tempoFactor: 1 });
    expect(s.secondsPerBeat).toBeCloseTo(0.75); // 80 BPM
    const solo = s.events.filter((e) => e.track === "solo");
    solo.forEach((e, i) => expect(e.time).toBeCloseTo(i * 0.75));
    expect(s.partNotes.map((p) => p.start)).toEqual(solo.map((e) => e.time));
    const barStarts = s.events.filter((e) => e.track === "backing" && Math.abs((e.time / 0.75) % 4) < 1e-9).map((e) => e.time);
    expect(barStarts).toEqual([0, 3, 6, 9]);
    const kicks = s.events.filter((e) => e.drum === "kick").map((e) => e.time);
    expect(kicks).toContain(0);
    expect(s.durationSec).toBeCloseTo(12);
  });

  it("slows down and adds a count-in without breaking sync", () => {
    const s = buildSchedule(arr, { tempoFactor: 0.5, countInBeats: 4 });
    expect(s.secondsPerBeat).toBeCloseTo(1.5);
    expect(s.countInSec).toBeCloseTo(6);
    expect(s.events.filter((e) => e.track === "click")).toHaveLength(4);
    expect(s.partNotes[1].start).toBeCloseTo(6 + 1.5);
    expect(s.timeToBeat(s.beatToTime(5))).toBeCloseTo(5);
  });

  it("can loop a phrase", () => {
    const s = buildSchedule(arr, { fromBeat: 4, toBeat: 8 });
    expect(s.partNotes.map((p) => p.note.name)).toEqual(["F4", "C4", "E4", "F4"]);
    expect(s.partNotes[0].start).toBe(0);
    expect(s.durationSec).toBeCloseTo(3);
  });

  it("finds the active note, bar, beat and chord", () => {
    const s = buildSchedule(arr);
    expect(activeNoteIndex(s, -0.1)).toBe(-1);
    expect(activeNoteIndex(s, 0.8)).toBe(1);
    expect(barAndBeat(6, 4)).toEqual({ bar: 2, beat: 3 });
    expect(chordAtBeat(arr.harmonization.chords, 9)!.symbol).toBe("G5");
  });
});

describe("monophonic voice collisions (playback regression)", () => {
  it("drops the hat that shares beat 0 with the crash on the demo arrangement", async () => {
    const { playableEvents, monoVoiceKey } = await import("@/lib/audio/engine");
    const s = buildSchedule(arr);
    // The fixture really does contain the collision that crashed Tone.js:
    const atZero = s.events.filter((e) => e.time === 0 && e.track === "drums").map((e) => e.drum);
    expect(atZero).toContain("crash");
    expect(atZero).toContain("hat");
    expect(monoVoiceKey(s.events.find((e) => e.drum === "crash")!)).toBe(monoVoiceKey(s.events.find((e) => e.drum === "hat")!));

    const kept = playableEvents(s.events);
    const keptZero = kept.filter((e) => e.time === 0 && e.track === "drums").map((e) => e.drum);
    expect(keptZero).toContain("crash"); // crash wins…
    expect(keptZero).not.toContain("hat"); // …the duplicate hat on its voice is gone
    expect(keptZero).toContain("kick"); // different voice, untouched
    // No monophonic voice is ever started twice at the same time, on any track:
    const seen = new Set<string>();
    for (const e of kept) {
      const voice = monoVoiceKey(e);
      if (!voice) continue;
      const key = `${voice}@${e.time}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    // Polyphony is preserved: simultaneous melody/solo/backing notes all survive.
    expect(kept.filter((e) => e.track !== "drums").length).toBe(s.events.filter((e) => e.track !== "drums").length);
  });
});

describe("uploads and recording formats", () => {
  it("validates file type and size", () => {
    expect(validateUpload({ name: "hum.wav", size: 1000 })).toBeNull();
    expect(validateUpload({ name: "hum.M4A", size: 1000 })).toBeNull();
    expect(validateUpload({ name: "song.txt", size: 1000 })).toMatch(/isn't supported/);
    expect(validateUpload({ name: "hum.wav", size: 0 })).toMatch(/empty/);
    expect(validateUpload({ name: "hum.wav", size: 20 * 1024 * 1024 })).toMatch(/15 MB/);
  });
  it("picks a recording format the browser supports", () => {
    expect(pickMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(extensionFor("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionFor("audio/mp4")).toBe("m4a");
  });
});

describe("progress persistence (test 19)", () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  });

  it("saves preferences and practice history to localStorage and restores them", async () => {
    const { useApp, STORE_KEY } = await import("@/lib/store");
    useApp.getState().completeOnboarding({ skillLevel: "zero", handedness: "left" });
    useApp.getState().addSession({ id: "ps_1", created_at: "now", accuracy: 0.75, result: {
      arrangement_id: "arr_x", part: "solo", mode: "follow_me", tempo_factor: 1, duration_sec: 30, completed: false, used_microphone: true, events: [],
    } });
    const saved = JSON.parse(mem.get(STORE_KEY)!);
    expect(saved.state.prefs.handedness).toBe("left");
    expect(saved.state.recentSessions[0].id).toBe("ps_1");

    useApp.setState({ onboarded: false, recentSessions: [] });
    mem.set(STORE_KEY, JSON.stringify(saved));
    await useApp.persist.rehydrate();
    expect(useApp.getState().onboarded).toBe(true);
    expect(useApp.getState().prefs.handedness).toBe("left");
    expect(useApp.getState().recentSessions).toHaveLength(1);
  });
});
