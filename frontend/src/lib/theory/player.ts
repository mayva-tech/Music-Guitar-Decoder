/**
 * Plays TheoryExample events through Tone, lighting visuals via onHighlight.
 * Uses the app guitar/bass/drum voices where possible; organ is a plain sine.
 */
import { getEngine, loadTone } from "@/lib/audio/engine";
import { midiToFreq } from "@/lib/music/theory";
import { TONES, warmToneKind } from "@/lib/audio/guitarTone";
import type { TheoryExample, TheoryEvent, Timbre } from "./content";

type ToneMod = typeof import("tone");

export interface TheoryPlayer {
  play(ex: TheoryExample, onHighlight: (id: string, on: boolean) => void): Promise<void>;
  stop(): void;
  readonly playing: boolean;
}

interface Kit {
  pluckBright: import("tone").PolySynth;
  pluckWarm: import("tone").PolySynth;
  pluckNormal: import("tone").PolySynth;
  bass: import("tone").MonoSynth;
  organ: import("tone").MonoSynth;
  kick: import("tone").MembraneSynth;
  snare: import("tone").NoiseSynth;
  hat: import("tone").NoiseSynth;
  click: import("tone").MembraneSynth;
  fx: { dispose(): unknown }[];
}

function buildKit(Tone: ToneMod): Kit {
  const fx: { dispose(): unknown }[] = [];
  const keep = <N extends { dispose(): unknown }>(n: N) => (fx.push(n), n);
  const dest = Tone.getDestination();

  const pluckNormal = new Tone.PolySynth({
    voice: Tone.MonoSynth,
    options: TONES.melodyG,
    maxPolyphony: 16,
  }).connect(dest);
  pluckNormal.volume.value = -8;

  const pluckBright = new Tone.PolySynth({
    voice: Tone.MonoSynth,
    options: {
      ...TONES.melodyG,
      filterEnvelope: { ...TONES.melodyG.filterEnvelope, baseFrequency: 720, octaves: 2.8 },
    },
    maxPolyphony: 12,
  }).connect(dest);
  pluckBright.volume.value = -8;

  const pluckWarm = new Tone.PolySynth({
    voice: Tone.MonoSynth,
    options: TONES.melodyLow,
    maxPolyphony: 12,
  }).connect(dest);
  pluckWarm.volume.value = -7;

  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: { Q: 0.7, type: "lowpass" },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, baseFrequency: 80, octaves: 1.5 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.2 },
  }).connect(dest);
  bass.volume.value = -10;

  const organ = new Tone.MonoSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.05, sustain: 0.7, release: 0.15 },
    filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.5, baseFrequency: 800, octaves: 1 },
  }).connect(dest);
  organ.volume.value = -12;

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 4,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.08 },
  }).connect(dest);
  kick.volume.value = -4;

  const snareLp = keep(new Tone.Filter({ type: "lowpass", frequency: 2800 }));
  snareLp.connect(dest);
  const snare = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
  }).connect(snareLp);
  snare.volume.value = -8;

  const hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
  }).connect(dest);
  hat.volume.value = -22;

  const click = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 2,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  }).connect(dest);
  click.volume.value = -14;

  return { pluckBright, pluckWarm, pluckNormal, bass, organ, kick, snare, hat, click, fx };
}

function disposeKit(kit: Kit) {
  for (const x of [
    kit.pluckBright, kit.pluckWarm, kit.pluckNormal, kit.bass, kit.organ,
    kit.kick, kit.snare, kit.hat, kit.click, ...kit.fx,
  ]) {
    try { x.dispose(); } catch { /* ignore */ }
  }
}

function pluckFor(kit: Kit, timbre?: Timbre) {
  if (timbre === "bright") return kit.pluckBright;
  if (timbre === "warm") return kit.pluckWarm;
  return kit.pluckNormal;
}

class TheoryPlayerImpl implements TheoryPlayer {
  private kit: Kit | null = null;
  private Tone: ToneMod | null = null;
  private _playing = false;
  private run = 0;
  private lit = new Set<string>();
  private resolvePlay: (() => void) | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private onHighlight: ((id: string, on: boolean) => void) | null = null;

  get playing() {
    return this._playing;
  }

  private async ensure() {
    const Tone = await loadTone();
    this.Tone = Tone;
    await Tone.start();
    if (!this.kit) this.kit = buildKit(Tone);
  }

  private clearHighlights() {
    const cb = this.onHighlight;
    if (!cb) { this.lit.clear(); return; }
    for (const id of [...this.lit]) cb(id, false);
    this.lit.clear();
  }

  stop() {
    this.run += 1;
    this._playing = false;
    if (this.endTimer) {
      clearTimeout(this.endTimer);
      this.endTimer = null;
    }
    try {
      this.Tone?.getDraw().cancel(0);
    } catch { /* ignore */ }
    if (this.kit) {
      try {
        this.kit.pluckBright.releaseAll();
        this.kit.pluckWarm.releaseAll();
        this.kit.pluckNormal.releaseAll();
        this.kit.bass.triggerRelease();
        this.kit.organ.triggerRelease();
      } catch { /* ignore */ }
    }
    this.clearHighlights();
    const done = this.resolvePlay;
    this.resolvePlay = null;
    done?.();
  }

  async play(ex: TheoryExample, onHighlight: (id: string, on: boolean) => void): Promise<void> {
    this.stop();
    try { getEngine().stop(); } catch { /* ignore */ }
    const myRun = ++this.run;
    this._playing = true;
    this.onHighlight = onHighlight;
    await this.ensure();
    if (this.run !== myRun) return;
    const Tone = this.Tone!;
    const kit = this.kit!;

    const t0 = Tone.now() + 0.1;
    const beatSec = 60 / ex.bpm;

    const scheduleHl = (id: string | undefined, start: number, beats: number) => {
      if (!id) return;
      const onAt = start;
      const offAt = start + Math.max(beats * beatSec - 0.03, 0.11);
      Tone.getDraw().schedule(() => {
        if (this.run !== myRun) return;
        this.lit.add(id);
        onHighlight(id, true);
      }, onAt);
      Tone.getDraw().schedule(() => {
        if (this.run !== myRun) return;
        this.lit.delete(id);
        onHighlight(id, false);
      }, offAt);
    };

    const fire = (e: TheoryEvent, at: number) => {
      const dur = Math.max(0.04, e.beats * beatSec);
      const vel = Math.max(0.05, Math.min(1, e.velocity));
      scheduleHl(e.highlight, at, e.beats);
      try {
        switch (e.kind) {
          case "pluck": {
            if (e.midi == null) break;
            const kind = warmToneKind(undefined, e.midi);
            const synth = pluckFor(kit, e.timbre ?? (kind === "bass" ? "warm" : "normal"));
            synth.triggerAttackRelease(midiToFreq(e.midi), dur, at, vel);
            break;
          }
          case "bass":
            if (e.midi != null) kit.bass.triggerAttackRelease(midiToFreq(e.midi), dur, at, vel);
            break;
          case "organ":
            if (e.midi != null) kit.organ.triggerAttackRelease(midiToFreq(e.midi), dur, at, vel);
            break;
          case "kick":
            kit.kick.triggerAttackRelease(38, Math.min(0.32, dur), at, vel);
            break;
          case "snare":
            kit.snare.triggerAttackRelease(Math.min(0.18, dur), at, vel);
            break;
          case "hat":
            kit.hat.triggerAttackRelease(0.04, at, vel * 0.7);
            break;
          case "click":
            kit.click.triggerAttackRelease(e.velocity >= 0.95 ? 1400 : 900, 0.04, at, vel);
            break;
          case "highlight":
            break;
        }
      } catch {
        /* one bad event must not abort the example */
      }
    };

    for (const e of ex.events) {
      fire(e, t0 + e.beat * beatSec);
    }

    const totalMs = (ex.lengthBeats * beatSec + 0.35) * 1000;
    return new Promise<void>((resolve) => {
      this.resolvePlay = resolve;
      this.endTimer = setTimeout(() => {
        if (this.run !== myRun) return;
        this._playing = false;
        this.clearHighlights();
        this.resolvePlay = null;
        resolve();
      }, totalMs);
    });
  }
}

let shared: TheoryPlayerImpl | null = null;
export function getTheoryPlayer(): TheoryPlayer {
  if (!shared) shared = new TheoryPlayerImpl();
  return shared;
}
