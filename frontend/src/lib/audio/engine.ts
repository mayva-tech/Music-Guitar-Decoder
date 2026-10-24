// Tone.js playback of a Schedule. Melody / solo / lead / rhythm use plucked-string
// harmonics (custom partials + pluck envelope). E/A/D use a dark bass voice, G a
// mid-bass punch voice, B/e stay bright; drums are kick-forward.
import type { Articulation, Schedule, TrackName, TrackToggles } from "./timeline";
import { midiToFreq } from "../music/theory";
import { isBassStringMidi, TONES, warmToneKind, type WarmToneKind } from "./guitarTone";

type ToneModule = typeof import("tone");
type T = typeof import("tone");
type PolyPluck = import("tone").PolySynth<import("tone").MonoSynth>;

let tonePromise: Promise<ToneModule> | null = null;
export function loadTone(): Promise<ToneModule> {
  if (!tonePromise) tonePromise = import("tone");
  return tonePromise;
}

/** Extra sine thump layered under E/A/D/G attacks for weight. */
interface Punch {
  synth: InstanceType<T["MembraneSynth"]>;
  last: number;
}

interface Voices {
  melody: PolyPluck;
  melodyLow: PolyPluck;
  melodyG: PolyPluck;
  solo: PolyPluck;
  soloLow: PolyPluck;
  soloG: PolyPluck;
  lead: InstanceType<T["MonoSynth"]>;
  leadLow: InstanceType<T["MonoSynth"]>;
  leadG: InstanceType<T["MonoSynth"]>;
  backing: PolyPluck;
  bass: InstanceType<T["MonoSynth"]>;
  kick: InstanceType<T["MembraneSynth"]>;
  snare: InstanceType<T["NoiseSynth"]>;
  hat: InstanceType<T["NoiseSynth"]>;
  click: InstanceType<T["MembraneSynth"]>;
  punch: Record<"melody" | "solo" | "lead" | "backing", Punch>;
  punchG: Record<"melody" | "solo" | "lead", Punch>;
  fx: { dispose(): unknown }[];
}

/**
 * Voice graph aligned with the Theory player: synth → light cab → channel.
 * No Distortion / multi-band EQ — those cracked note edges and overloaded the
 * audio thread so Learn / riff playback staggered and cut out.
 */
function buildVoices(Tone: ToneModule, ch: Record<TrackName, InstanceType<T["Channel"]>>): Voices {
  const fx: { dispose(): unknown }[] = [];
  const keep = <N extends { dispose(): unknown }>(n: N) => (fx.push(n), n);
  // Single HP + LP cab (theory-style). Keeps string character without cracky peaking stacks.
  const cab = (lpHz: number, dest: import("tone").InputNode, hpHz = 85) => {
    const hp = keep(new Tone.Filter(hpHz, "highpass"));
    const lp = keep(new Tone.Filter({ type: "lowpass", frequency: lpHz, rolloff: -12 }));
    hp.chain(lp, dest);
    return hp;
  };
  const makePunch = (dest: import("tone").InputNode, db: number): Punch => {
    const synth = keep(new Tone.MembraneSynth({
      pitchDecay: 0.04, octaves: 3.2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.004, decay: 0.11, sustain: 0, release: 0.08 },
    }));
    synth.connect(dest);
    synth.volume.value = db;
    return { synth, last: -1 };
  };

  const melodyIn = cab(5600, ch.melody);
  const melodyLowIn = cab(4200, ch.melody, 100);
  const melodyGIn = cab(4800, ch.melody, 95);
  const melody = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.melody, maxPolyphony: 48 }).connect(melodyIn);
  const melodyLow = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.melodyLow, maxPolyphony: 32 }).connect(melodyLowIn);
  const melodyG = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.melodyG, maxPolyphony: 48 }).connect(melodyGIn);

  // Solo / lead / rhythm: same clean path as melody (no waveshaper).
  const soloIn = cab(5200, ch.solo);
  const soloLowIn = cab(4000, ch.solo, 100);
  const soloGIn = cab(4600, ch.solo, 95);
  const solo = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.solo, maxPolyphony: 48 }).connect(soloIn);
  const soloLow = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.soloLow, maxPolyphony: 32 }).connect(soloLowIn);
  const soloG = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.soloG, maxPolyphony: 48 }).connect(soloGIn);

  const leadIn = cab(5400, ch.lead);
  const leadLowIn = cab(4200, ch.lead, 100);
  const leadGIn = cab(4800, ch.lead, 95);
  const lead = new Tone.MonoSynth(TONES.lead).connect(leadIn);
  const leadLow = new Tone.MonoSynth(TONES.leadLow).connect(leadLowIn);
  const leadG = new Tone.MonoSynth(TONES.leadG).connect(leadGIn);

  const rhythmIn = cab(3800, ch.backing, 100);
  const backing = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.backing, maxPolyphony: 32 }).connect(rhythmIn);

  // Punch synths stay muted (API / thump hook); sub-octave thump made E/A sound like bass.
  const punch = {
    melody: makePunch(melodyLowIn, -60),
    solo: makePunch(soloLowIn, -60),
    lead: makePunch(leadLowIn, -60),
    backing: makePunch(rhythmIn, -60),
  };
  const punchG = {
    melody: makePunch(melodyGIn, -60),
    solo: makePunch(soloGIn, -60),
    lead: makePunch(leadGIn, -60),
  };

  const bassLp = keep(new Tone.Filter({ type: "lowpass", frequency: 900, rolloff: -24 }));
  bassLp.connect(ch.bass);
  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" }, filter: { Q: 0.7, type: "lowpass" },
    filterEnvelope: { attack: 0.01, decay: 0.22, sustain: 0.15, baseFrequency: 80, octaves: 1.6 },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.7, release: 0.28 },
  }).connect(bassLp);

  // Drums like Theory: Membrane + Noise — MetalSynth hats cracked on every beat.
  const drumLp = keep(new Tone.Filter({ type: "lowpass", frequency: 5500, rolloff: -12 }));
  drumLp.connect(ch.drums);
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.06, octaves: 4,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.08 },
  }).connect(drumLp);
  kick.volume.value = -4;
  const snareLp = keep(new Tone.Filter({ type: "lowpass", frequency: 2800 }));
  snareLp.connect(drumLp);
  const snare = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
  }).connect(snareLp);
  snare.volume.value = -8;
  const hat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
  }).connect(drumLp);
  hat.volume.value = -22;
  const click = new Tone.MembraneSynth({
    pitchDecay: 0.01, octaves: 2,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  }).connect(ch.click);
  click.volume.value = -14;
  return {
    melody, melodyLow, melodyG, solo, soloLow, soloG, lead, leadLow, leadG,
    backing, bass, kick, snare, hat, click, punch, punchG, fx,
  };
}

/** Optional attack layer — disabled in practice (volume −60); kept for API stability. */
function thump(_p: Punch, _at: number, _midi: number, _velocity: number) {
  /* no-op: sub-octave thump made low guitar strings sound like a bass guitar */
}

function disposeVoices(v: Voices) {
  for (const x of [
    v.melody, v.melodyLow, v.melodyG, v.solo, v.soloLow, v.soloG, v.lead, v.leadLow, v.leadG,
    v.backing, v.bass, v.kick, v.snare, v.hat, v.click,
    v.punch.melody.synth, v.punch.solo.synth, v.punch.lead.synth, v.punch.backing.synth,
    v.punchG.melody.synth, v.punchG.solo.synth, v.punchG.lead.synth,
    ...v.fx,
  ]) {
    try {
      x.dispose();
    } catch {
      /* already disposed */
    }
  }
}

function polyFor(v: Voices, part: "melody" | "solo", kind: WarmToneKind): PolyPluck {
  if (part === "melody") return kind === "bass" ? v.melodyLow : kind === "g" ? v.melodyG : v.melody;
  return kind === "bass" ? v.soloLow : kind === "g" ? v.soloG : v.solo;
}

function leadFor(v: Voices, kind: WarmToneKind) {
  return kind === "bass" ? v.leadLow : kind === "g" ? v.leadG : v.lead;
}

function punchFor(v: Voices, part: "melody" | "solo" | "lead", kind: WarmToneKind): Punch | null {
  if (kind === "bass") return v.punch[part];
  if (kind === "g") return v.punchG[part];
  return null;
}

/**
 * Tone's monophonic voices (MonoSynth/MembraneSynth/NoiseSynth) keep a
 * single "started" state per voice and assert that every start time is strictly
 * greater than the previous one on that same voice. Two hits landing on the same
 * voice at the same instant — e.g. the arrangement puts a crash AND a hat on
 * beat 0, and both are played by the hat NoiseSynth — therefore throw
 * "Start time must be strictly greater than previous start time" and kill playback.
 *
 * Returns the monophonic voice an event plays on, or null for polyphonic tracks
 * (which can freely sound several notes at once).
 */
export function monoVoiceKey(e: Schedule["events"][number]): string | null {
  if (e.track === "drums") return e.drum === "crash" ? "hat" : (e.drum ?? "drums"); // crash & hat share one NoiseSynth
  // Lead / bass / click are monophonic: two starts at the same instant throw in Tone.js
  // and abort the rest of the schedule (silence + desync).
  if (e.track === "bass" || e.track === "lead" || e.track === "click") return e.track;
  return null;
}

/**
 * Claim a start time on a monophonic voice. Returns false when another hit was
 * already claimed at (practically) the same instant — one hit is what you'd hear
 * anyway, so the duplicate is dropped instead of crashing Tone.
 */
export function claimMonoStart(claimed: Map<string, number>, voice: string, at: number): boolean {
  const prev = claimed.get(voice);
  if (prev !== undefined && at <= prev + 1e-4) return false;
  claimed.set(voice, at);
  return true;
}

/**
 * The events that can actually be scheduled: polyphonic events untouched,
 * monophonic collisions removed (a crash replaces the hat on its beat; any
 * other same-instant repeat on one voice is dropped). Pure, so saved/demo
 * arrangements — which may already contain a crash + hat on beat 0 — play too.
 */
export function playableEvents(events: Schedule["events"]): Schedule["events"] {
  const crashTimes = new Set(
    events.filter((e) => e.track === "drums" && e.drum === "crash").map((e) => Math.round(e.time * 1e4)),
  );
  const claimed = new Map<string, number>();
  return events.filter((e) => {
    if (e.track === "drums" && e.drum === "hat" && crashTimes.has(Math.round(e.time * 1e4))) return false;
    const voice = monoVoiceKey(e);
    return !voice || claimMonoStart(claimed, voice, e.time);
  });
}

/** Bump when the output graph changes so a stale silent bus is rebuilt. */
const GRAPH_GEN = 12;

export class PlaybackEngine {
  private Tone: ToneModule | null = null;
  private channels: Record<TrackName, InstanceType<T["Channel"]>> | null = null;
  private room: InstanceType<T["Reverb"]> | null = null;
  private master: InstanceType<T["Limiter"]> | null = null;
  private voices: Voices | null = null;
  private graphGen = 0;
  private startedAt = 0;
  private playing = false;
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    const Tone = await loadTone();
    this.Tone = Tone;
    await Tone.start();
    if (!this.channels || this.graphGen !== GRAPH_GEN) {
      try { this.room?.dispose(); } catch { /* ignore */ }
      try { this.master?.dispose(); } catch { /* ignore */ }
      try {
        if (this.voices) disposeVoices(this.voices);
      } catch { /* ignore */ }
      try {
        if (this.channels) Object.values(this.channels).forEach((c) => c.dispose());
      } catch { /* ignore */ }
      this.voices = null;
      this.channels = null;
      this.room = null;
      this.master = null;
      // Theory-like master: gentle ceiling only — compressor pumping made playback feel like it staggered.
      this.master = new Tone.Limiter(-2).toDestination();
      this.room = new Tone.Reverb({ decay: 1.0, preDelay: 0.01, wet: 0.06 }).connect(this.master);
      await this.room.ready;
      const mk = (db: number, roomy = true) => {
        const c = new Tone.Channel().connect(roomy ? this.room! : this.master!);
        c.volume.value = db;
        return c;
      };
      this.channels = { melody: mk(-8), solo: mk(-8), lead: mk(-9), backing: mk(-14), bass: mk(-11), drums: mk(-10), click: mk(-10, false) };
      this.graphGen = GRAPH_GEN;
    }
    if (!this.voices) this.voices = buildVoices(Tone, this.channels);
  }

  setTracks(t: TrackToggles) {
    if (!this.channels) return;
    (Object.keys(t) as (keyof TrackToggles)[]).forEach((k) => (this.channels![k].mute = !t[k]));
  }

  /** Seconds since the schedule started, or -1 when stopped. */
  position(): number {
    if (!this.playing || !this.Tone) return -1;
    // Transport timeline matches ScheduledEvent.time (includes count-in).
    return Math.max(0, this.Tone.Transport.seconds);
  }

  isPlaying() {
    return this.playing;
  }

  async play(schedule: Schedule, tracks: TrackToggles, onEnd?: () => void): Promise<void> {
    this.stop();
    await this.init();
    const Tone = this.Tone!;
    const v = this.voices!;
    this.setTracks(tracks);
    // Drop any lingering fret-tap notes so they don't stack under the full arrangement.
    this.releaseHeld();
    v.punch.melody.last = -1;
    v.punch.solo.last = -1;
    v.punch.lead.last = -1;
    v.punch.backing.last = -1;
    v.punchG.melody.last = -1;
    v.punchG.solo.last = -1;
    v.punchG.lead.last = -1;

    const events = playableEvents(schedule.events);
    // Use Transport so heavy custom-partial scheduling can't push note times into the past
    // (that made Learn / riff silent while short decoder previews still worked).
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.seconds = 0;
    Tone.Transport.bpm.value = 120; // event times are absolute seconds; bpm is unused for schedule()

    const f = (ms: number[]) => ms.map((m) => midiToFreq(m));
    const safe = (fn: () => void) => {
      try {
        fn();
      } catch {
        /* one bad hit must not abort the rest of the arrangement */
      }
    };

    for (const e of events) {
      // Leave a little room for release so triggerAttackRelease doesn't slam to silence.
      const dur = Math.max(0.05, e.duration);
      Tone.Transport.schedule((time) => {
        switch (e.track) {
          case "melody":
            safe(() => {
              const midi = e.midis[0] ?? 60;
              const kind = warmToneKind(e.string, midi);
              const vel = Math.min(0.75, e.velocity * 0.9);
              polyFor(v, "melody", kind).triggerAttackRelease(f(e.midis), dur, time, vel);
              const p = punchFor(v, "melody", kind);
              if (p) thump(p, time, midi, vel);
            });
            break;
          case "solo":
            safe(() => {
              const midi = e.midis[0] ?? 60;
              const kind = warmToneKind(e.string, midi);
              const vel = Math.min(0.75, e.velocity * 0.9);
              polyFor(v, "solo", kind).triggerAttackRelease(f(e.midis), dur, time, vel);
              const p = punchFor(v, "solo", kind);
              if (p) thump(p, time, midi, vel);
            });
            break;
          case "lead":
            safe(() => {
              const midi = e.midis[0];
              const kind = warmToneKind(e.string, midi);
              const vel = Math.min(0.75, e.velocity * 0.9);
              playLead(leadFor(v, kind), midi, time, dur, vel, e.art);
              if (!e.art?.legato) {
                const p = punchFor(v, "lead", kind);
                if (p) thump(p, time, midi, vel);
              }
            });
            break;
          case "backing":
            safe(() => {
              v.backing.triggerAttackRelease(f(e.midis), dur, time, Math.min(0.7, e.velocity * 0.65));
              const root = e.midis[0];
              if (root != null && isBassStringMidi(root)) thump(v.punch.backing, time, root, e.velocity);
            });
            break;
          case "bass":
            safe(() => v.bass.triggerAttackRelease(midiToFreq(e.midis[0]), dur, time, Math.min(0.8, e.velocity)));
            break;
          case "click":
            safe(() => v.click.triggerAttackRelease(e.velocity > 0.8 ? 1200 : 800, 0.06, time, Math.min(0.7, e.velocity)));
            break;
          case "drums":
            safe(() => {
              const dv = Math.min(0.8, e.velocity);
              if (e.drum === "kick") v.kick.triggerAttackRelease(38, 0.32, time, dv);
              else if (e.drum === "snare") v.snare.triggerAttackRelease(0.18, time, dv * 0.85);
              else if (e.drum === "crash") v.hat.triggerAttackRelease(0.35, time, dv * 0.55);
              else v.hat.triggerAttackRelease(0.04, time, dv * 0.5);
            });
            break;
        }
      }, e.time);
    }

    this.startedAt = Tone.now();
    this.playing = true;
    Tone.Transport.start("+0.05");
    // Soft-end: release voices before killing Transport so the last notes don't click off.
    this.endTimer = setTimeout(() => {
      this.releaseHeld();
      setTimeout(() => {
        this.playing = false;
        try {
          Tone.Transport.stop();
          Tone.Transport.cancel(0);
        } catch { /* ignore */ }
        onEnd?.();
      }, 280);
    }, Math.max(0, schedule.durationSec - 0.05) * 1000);
  }

  /** Play one note (practice / fret taps). Uses the long-ring melody voice so taps sustain
   * without forcing Play’s solo/lead envelopes to stack dozens of long notes (audio crash). */
  async preview(
    midi: number,
    part: "solo" | "lead" | "melody" = "solo",
    seconds = 3.5,
    art?: Articulation,
    string?: number,
  ) {
    await this.init();
    this.channels!.melody.mute = false;
    if (part === "lead" || part === "solo") this.channels![part].mute = false;
    const v = this.voices!;
    const at = this.Tone!.now() + 0.02;
    const kind = warmToneKind(string, midi);
    const vel = kind !== "bright" ? 1 : 0.85;
    const gate = Math.max(seconds, art?.bendSemitones ? 3.2 : 3.5);
    if (part === "lead" && art && (art.bendSemitones || art.slideFromMidi != null || art.vibrato || art.release)) {
      playLead(leadFor(v, kind), midi, at, gate, vel, art);
    } else {
      // Long melody ring (~9s decay) — full tone without overloading arrangement playback.
      polyFor(v, "melody", kind).triggerAttackRelease(midiToFreq(midi), gate, at, vel);
    }
  }

  private releaseHeld() {
    if (!this.voices) return;
    try {
      this.voices.melody.releaseAll();
      this.voices.melodyLow.releaseAll();
      this.voices.melodyG.releaseAll();
      this.voices.solo.releaseAll();
      this.voices.soloLow.releaseAll();
      this.voices.soloG.releaseAll();
      this.voices.backing.releaseAll();
      this.voices.lead.triggerRelease();
      this.voices.leadLow.triggerRelease();
      this.voices.leadG.triggerRelease();
    } catch { /* ignore */ }
  }

  /** Softly end held notes. Keep the voice graph (Theory style) — rebuild-on-stop was CPU-heavy and cut audio mid-phrase. */
  stop() {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = null;
    this.playing = false;
    this.releaseHeld();
    if (this.Tone) {
      try {
        this.Tone.Transport.stop();
        this.Tone.Transport.cancel(0);
        this.Tone.Transport.seconds = 0;
      } catch { /* ignore */ }
    }
  }
}

/** Schedule one lead note with pitch glides for bends, slides and vibrato. */
export function playLead(synth: InstanceType<T["MonoSynth"]>, midi: number, at: number, dur: number, vel: number, art?: Articulation) {
  const f = synth.frequency;
  const bend = art?.bendSemitones ?? 0;
  let startMidi = midi;
  if (art?.slideFromMidi != null) startMidi = art.slideFromMidi;
  else if (bend && !art?.release) startMidi = midi - bend;
  synth.triggerAttack(midiToFreq(startMidi), at, art?.legato ? vel * 0.55 : vel);
  f.cancelScheduledValues(at);
  f.setValueAtTime(midiToFreq(startMidi), at);
  let t = at;
  if (art?.slideFromMidi != null) {
    t = at + Math.min(0.09, dur * 0.4);
    f.exponentialRampToValueAtTime(midiToFreq(midi), t);
  }
  if (bend) {
    if (art?.release) {
      const up = at + dur * 0.3, down = at + dur * 0.75;
      f.setValueAtTime(midiToFreq(midi), at + dur * 0.08);
      f.exponentialRampToValueAtTime(midiToFreq(midi + bend), up);
      f.setValueAtTime(midiToFreq(midi + bend), down - dur * 0.15);
      f.exponentialRampToValueAtTime(midiToFreq(midi), down);
      t = down;
    } else {
      t = at + Math.min(0.22, dur * 0.35);
      f.exponentialRampToValueAtTime(midiToFreq(midi), t);
    }
  }
  if (art?.vibrato) {
    const rate = 5.5, depth = 0.3; // semitones
    let k = 0;
    for (let x = Math.max(t, at + dur * 0.35); x < at + dur - 0.05; x += 1 / (2 * rate), k++) {
      f.linearRampToValueAtTime(midiToFreq(midi + (k % 2 ? -depth : depth) / 2), x);
    }
  }
  // Freeze pitch at release so leftover glide automation can't pop when the oscillator stops.
  const end = at + dur;
  try {
    const cur = f.getValueAtTime(end);
    f.cancelScheduledValues(end);
    f.setValueAtTime(cur, end);
  } catch { /* ignore */ }
  synth.triggerRelease(end);
}

let shared: PlaybackEngine | null = null;
export function getEngine(): PlaybackEngine {
  if (!shared) shared = new PlaybackEngine();
  return shared;
}
