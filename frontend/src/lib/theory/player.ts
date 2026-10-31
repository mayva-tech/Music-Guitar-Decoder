/**
 * Plays TheoryExample events through Tone, lighting visuals via onHighlight.
 * Uses the app guitar/bass/drum voices where possible; organ is a plain sine.
 */
import { getEngine, loadTone, playLead } from "@/lib/audio/engine";
import { articulation } from "@/lib/audio/timeline";
import { midiToFreq } from "@/lib/music/theory";
import { TONES, warmToneKind, type WarmToneKind } from "@/lib/audio/guitarTone";
import type { PlayableNote } from "@/lib/types";
import type { TheoryEvent, Timbre } from "./content";
import type { Sound } from "./ear";

type ToneMod = typeof import("tone");

export interface PlayOptions {
  /** Lead line (lick notes, beats relative to the example start) played with playLead + articulation. */
  lead?: PlayableNote[];
  /** "clean" = the app's lead path; "crunch" adds a mild waveshaper before the cab filter. */
  leadTone?: "clean" | "crunch";
  /** Reschedule the example back to back until stop(). */
  loop?: boolean;
  /**
   * Looping only: called at the start of every pass after the first to get the example to play
   * (so a tempo change applies from the next loop). Falls back to the original example.
   */
  nextExample?: () => Sound;
}

export interface TheoryPlayer {
  /** Accepts a full TheoryExample or a Sound (drills have no visual). */
  play(ex: Sound, onHighlight: (id: string, on: boolean) => void, opts?: PlayOptions): Promise<void>;
  stop(): void;
  readonly playing: boolean;
}

interface Kit {
  bus: import("tone").Gain;
  pluckBright: import("tone").PolySynth;
  pluckWarm: import("tone").PolySynth;
  pluckNormal: import("tone").PolySynth;
  bass: import("tone").MonoSynth;
  organ: import("tone").MonoSynth;
  kick: import("tone").MembraneSynth;
  snare: import("tone").NoiseSynth;
  hat: import("tone").NoiseSynth;
  click: import("tone").MembraneSynth;
  /** Backing-track kit pieces (open hat, ride, rim click, crash). */
  ohat: import("tone").NoiseSynth;
  ride: import("tone").NoiseSynth;
  ridePing: import("tone").MembraneSynth;
  rim: import("tone").MembraneSynth;
  crash: import("tone").NoiseSynth;
  /** Built on demand (only when a lead line is played). Two voices per string family so double stops can sound together. */
  lead: LeadRig | null;
  fx: { dispose(): unknown }[];
}

interface LeadVoice {
  synth: import("tone").MonoSynth;
  /** Seconds (Tone time) until which this voice is busy. */
  busyUntil: number;
}
interface LeadRig {
  tone: "clean" | "crunch";
  pools: Record<"bass" | "g", LeadVoice[]>;
}

/** Mild amp-style drive for the crunch lead (pre-gain → soft clip → makeup). */
const CRUNCH = { pre: 2.2, distortion: 0.32, post: 0.6 };

function buildLeadRig(Tone: ToneMod, kit: Kit, tone: "clean" | "crunch"): LeadRig {
  const keep = <N extends { dispose(): unknown }>(n: N) => (kit.fx.push(n), n);
  // Same cab as the engine's lead voices; crunch puts the drive in front of it.
  const chain = (lpHz: number, hpHz: number): import("tone").InputNode => {
    const hp = keep(new Tone.Filter(hpHz, "highpass"));
    const lp = keep(new Tone.Filter({ type: "lowpass", frequency: lpHz, rolloff: -12 }));
    hp.connect(lp);
    lp.connect(kit.bus);
    if (tone !== "crunch") return hp;
    const pre = keep(new Tone.Gain(CRUNCH.pre));
    const dist = keep(new Tone.Distortion({ distortion: CRUNCH.distortion, oversample: "2x" }));
    const post = keep(new Tone.Gain(CRUNCH.post));
    pre.connect(dist);
    dist.connect(post);
    post.connect(hp);
    return pre;
  };
  const mk = (opts: typeof TONES.lead, lpHz: number, hpHz: number): LeadVoice[] => {
    const dest = chain(lpHz, hpHz);
    return [0, 1].map(() => {
      const synth = keep(new Tone.MonoSynth(opts).connect(dest));
      synth.volume.value = -4;
      return { synth, busyUntil: 0 };
    });
  };
  return {
    tone,
    pools: {
      bass: mk(TONES.leadLow, 4200, 100),
      g: mk(TONES.leadG, 4800, 95),
    },
  };
}

/** First idle voice in the family's pool (so notes at the same instant use different voices). */
function claimLeadVoice(rig: LeadRig, kind: WarmToneKind, at: number, dur: number): LeadVoice {
  const pool = rig.pools[kind === "bass" ? "bass" : "g"];
  const free = pool.find((v) => v.busyUntil <= at - 1e-4);
  const v = free ?? pool.reduce((a, b) => (a.busyUntil <= b.busyUntil ? a : b));
  v.busyUntil = at + dur + 0.02;
  return v;
}

/** Shared stop fade for Theory / By ear / Find / drills (all use this player). */
const STOP_FADE_SEC = 0.12;

function buildKit(Tone: ToneMod): Kit {
  const fx: { dispose(): unknown }[] = [];
  const keep = <N extends { dispose(): unknown }>(n: N) => (fx.push(n), n);
  // Shared bus so stop can fade to silence instead of hard-cutting disposed nodes.
  const bus = keep(new Tone.Gain(1).toDestination());

  const pluckNormal = new Tone.PolySynth({
    voice: Tone.MonoSynth,
    options: TONES.melodyG,
    maxPolyphony: 16,
  }).connect(bus);
  // Guitar plucks quieter than bass so the root line reads clearly.
  pluckNormal.volume.value = -14;

  const pluckBright = new Tone.PolySynth({
    voice: Tone.MonoSynth,
    options: {
      ...TONES.melodyG,
      filterEnvelope: { ...TONES.melodyG.filterEnvelope, baseFrequency: 720, octaves: 2.8 },
    },
    maxPolyphony: 12,
  }).connect(bus);
  pluckBright.volume.value = -14;

  const pluckWarm = new Tone.PolySynth({
    voice: Tone.MonoSynth,
    options: TONES.melodyLow,
    maxPolyphony: 12,
  }).connect(bus);
  pluckWarm.volume.value = -13;

  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" },
    filter: { Q: 0.7, type: "lowpass" },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, baseFrequency: 80, octaves: 1.5 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.2 },
  }).connect(bus);
  bass.volume.value = -4;

  const organ = new Tone.MonoSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.05, sustain: 0.7, release: 0.15 },
    filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.5, baseFrequency: 800, octaves: 1 },
  }).connect(bus);
  organ.volume.value = -12;

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.06,
    octaves: 4,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.08 },
  }).connect(bus);
  kick.volume.value = -4;

  const snareLp = keep(new Tone.Filter({ type: "lowpass", frequency: 2800 }));
  snareLp.connect(bus);
  const snare = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
  }).connect(snareLp);
  snare.volume.value = -8;

  const hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
  }).connect(bus);
  hat.volume.value = -22;

  const click = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 2,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  }).connect(bus);
  click.volume.value = -14;

  // Cymbals: filtered noise (no MetalSynth, so the kit stays light and testable).
  const ohatHp = keep(new Tone.Filter({ type: "highpass", frequency: 6500 }));
  ohatHp.connect(bus);
  const ohat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.002, decay: 0.24, sustain: 0 },
  }).connect(ohatHp);
  ohat.volume.value = -24;

  const rideHp = keep(new Tone.Filter({ type: "highpass", frequency: 5200 }));
  rideHp.connect(bus);
  const ride = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.32, sustain: 0 },
  }).connect(rideHp);
  ride.volume.value = -27;
  // A short high "ping" gives the ride its bell-like stick sound.
  const ridePing = new Tone.MembraneSynth({
    pitchDecay: 0.002,
    octaves: 0.3,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
  }).connect(bus);
  ridePing.volume.value = -30;

  const rim = new Tone.MembraneSynth({
    pitchDecay: 0.004,
    octaves: 1.5,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 },
  }).connect(bus);
  rim.volume.value = -16;

  const crashHp = keep(new Tone.Filter({ type: "highpass", frequency: 3800 }));
  crashHp.connect(bus);
  const crash = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.002, decay: 1.3, sustain: 0 },
  }).connect(crashHp);
  crash.volume.value = -23;

  return {
    bus, pluckBright, pluckWarm, pluckNormal, bass, organ, kick, snare, hat, click,
    ohat, ride, ridePing, rim, crash, lead: null, fx,
  };
}

function disposeKit(kit: Kit) {
  for (const x of [
    kit.pluckBright, kit.pluckWarm, kit.pluckNormal, kit.bass, kit.organ,
    kit.kick, kit.snare, kit.hat, kit.click,
    kit.ohat, kit.ride, kit.ridePing, kit.rim, kit.crash, ...kit.fx,
  ]) {
    try { x.dispose(); } catch { /* ignore */ }
  }
}

/**
 * Fade the bus to silence first, then dispose.
 * Do NOT releaseAll at full volume — that was the hard-cut click on By ear / Theory stop.
 */
function softDisposeKit(Tone: ToneMod, kit: Kit) {
  try {
    const now = Tone.now();
    const g = kit.bus.gain;
    const cur = typeof g.value === "number" ? g.value : 1;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(cur, 0.0001), now);
    g.linearRampToValueAtTime(0, now + STOP_FADE_SEC);
  } catch { /* ignore */ }
  const later = typeof setTimeout === "function" ? setTimeout : null;
  // Dispose only after the fade so queued notes die into silence, not a clip.
  later?.(() => {
    try {
      kit.pluckBright.releaseAll();
      kit.pluckWarm.releaseAll();
      kit.pluckNormal.releaseAll();
      kit.bass.triggerRelease();
      kit.organ.triggerRelease();
    } catch { /* ignore */ }
    try { disposeKit(kit); } catch { /* ignore */ }
  }, Math.ceil(STOP_FADE_SEC * 1000) + 40);
}

function pluckFor(kit: Kit, timbre?: Timbre) {
  if (timbre === "bright") return kit.pluckBright;
  if (timbre === "warm") return kit.pluckWarm;
  return kit.pluckNormal;
}

/** Bump when kit levels / voices change so a live session rebuilds. */
const KIT_GEN = 6;

class TheoryPlayerImpl implements TheoryPlayer {
  private kit: Kit | null = null;
  private kitGen = 0;
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
    if (!this.kit || this.kitGen !== KIT_GEN) {
      if (this.kit) softDisposeKit(Tone, this.kit);
      this.kit = buildKit(Tone);
      this.kitGen = KIT_GEN;
    }
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
    if (this.kit && this.Tone) {
      // Fade then dispose so queued absolute-time notes die without a click.
      softDisposeKit(this.Tone, this.kit);
      this.kit = null;
    }
    this.clearHighlights();
    const done = this.resolvePlay;
    this.resolvePlay = null;
    done?.();
  }

  async play(ex: Sound, onHighlight: (id: string, on: boolean) => void, opts?: PlayOptions): Promise<void> {
    this.stop();
    try { getEngine().stop(); } catch { /* ignore */ }
    const myRun = ++this.run;
    this._playing = true;
    this.onHighlight = onHighlight;
    await this.ensure();
    if (this.run !== myRun) return;
    const Tone = this.Tone!;
    const kit = this.kit!;

    const lead = opts?.lead && opts.lead.length ? [...opts.lead].sort((a, b) => a.start_beat - b.start_beat) : null;
    if (lead && !kit.lead) {
      try { kit.lead = buildLeadRig(Tone, kit, opts?.leadTone ?? "clean"); } catch { kit.lead = null; }
    }
    // Per-string previous note (for slides / legato), in beat order. Same for every pass.
    const leadPrev = new Map<PlayableNote, PlayableNote | undefined>();
    if (lead) {
      const last: Record<number, PlayableNote | undefined> = {};
      for (const n of lead) {
        leadPrev.set(n, last[n.string]);
        last[n.string] = n;
      }
    }

    /** Schedules one pass of the example (backing, lead, highlights) starting at `t0`; returns its length in seconds. */
    const schedulePass = (cur: Sound, t0: number): number => {
    const beatSec = 60 / cur.bpm;

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
          case "ohat":
            kit.ohat.triggerAttackRelease(0.2, at, vel * 0.8);
            break;
          case "ride":
            kit.ride.triggerAttackRelease(0.3, at, vel * 0.8);
            kit.ridePing.triggerAttackRelease(2600, 0.15, at, vel * 0.6);
            break;
          case "rim":
            kit.rim.triggerAttackRelease(1500, 0.04, at, vel);
            break;
          case "crash":
            kit.crash.triggerAttackRelease(1.2, at, vel);
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

    for (const e of cur.events) {
      fire(e, t0 + e.beat * beatSec);
    }

    const rig = kit.lead;
    if (lead && rig) {
      for (const n of lead) {
        const at = t0 + n.start_beat * beatSec;
        const dur = Math.max(0.08, n.duration_beats * beatSec * 0.96);
        try {
          const kind = warmToneKind(n.string, n.midi);
          const voice = claimLeadVoice(rig, kind, at, dur);
          const vel = kind === "bass" ? 0.9 : 0.8;
          playLead(voice.synth, n.midi, at, dur, vel, articulation(n, leadPrev.get(n)));
        } catch {
          /* one bad note must not abort the lick */
        }
      }
    }
    return cur.lengthBeats * beatSec;
    };

    const startAt = Tone.now() + 0.1;
    const firstLen = schedulePass(ex, startAt);

    if (opts?.loop) {
      // Schedule the next pass shortly before this one ends so a tempo change lands on the next loop.
      let passEnd = startAt + firstLen;
      const queueNext = () => {
        const wait = Math.max(0, (passEnd - Tone.now() - 0.35) * 1000);
        this.endTimer = setTimeout(() => {
          if (this.run !== myRun) return;
          const next = opts.nextExample?.() ?? ex;
          passEnd += schedulePass(next, passEnd);
          queueNext();
        }, wait);
      };
      queueNext();
      return new Promise<void>((resolve) => {
        this.resolvePlay = resolve;
      });
    }

    const totalMs = (firstLen + 0.35) * 1000;
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
