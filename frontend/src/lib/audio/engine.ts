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
  hat: InstanceType<T["MetalSynth"]>;
  click: InstanceType<T["MetalSynth"]>;
  punch: Record<"melody" | "solo" | "lead" | "backing", Punch>;
  punchG: Record<"melody" | "solo" | "lead", Punch>;
  fx: { dispose(): unknown }[];
}

function buildVoices(Tone: ToneModule, ch: Record<TrackName, InstanceType<T["Channel"]>>): Voices {
  const fx: { dispose(): unknown }[] = [];
  const keep = <N extends { dispose(): unknown }>(n: N) => (fx.push(n), n);
  // Bright body for B / high-e.
  const bodyBright = (dest: import("tone").InputNode) => {
    const hp = keep(new Tone.Filter(90, "highpass"));
    const presence = keep(new Tone.Filter({ type: "peaking", frequency: 3400, Q: 1.0, gain: 2.5 }));
    const air = keep(new Tone.Filter({ type: "peaking", frequency: 6200, Q: 0.7, gain: 1.2 }));
    hp.chain(presence, air, dest);
    return hp;
  };
  // Warm body for E / A / D: guitar low-string tone (cut sub so it isn't a bass guitar).
  const bodyWarm = (dest: import("tone").InputNode) => {
    const hp = keep(new Tone.Filter(110, "highpass")); // drop bass-amp rumble
    const body = keep(new Tone.Filter({ type: "peaking", frequency: 280, Q: 0.85, gain: 2.2 }));
    const lowMid = keep(new Tone.Filter({ type: "peaking", frequency: 520, Q: 0.8, gain: 1.8 }));
    const presence = keep(new Tone.Filter({ type: "peaking", frequency: 1800, Q: 0.7, gain: 1.2 }));
    const dull = keep(new Tone.Filter({ type: "lowpass", frequency: 4200, rolloff: -12 }));
    hp.chain(body, lowMid, presence, dull, dest);
    return hp;
  };
  // G string: mid-focused guitar, near D.
  const bodyMid = (dest: import("tone").InputNode) => {
    const hp = keep(new Tone.Filter(100, "highpass"));
    const body = keep(new Tone.Filter({ type: "peaking", frequency: 320, Q: 0.85, gain: 2 }));
    const mid = keep(new Tone.Filter({ type: "peaking", frequency: 650, Q: 0.8, gain: 1.6 }));
    const dull = keep(new Tone.Filter({ type: "lowpass", frequency: 4500, rolloff: -12 }));
    hp.chain(body, mid, dull, dest);
    return hp;
  };
  const cab = (hz: number, dest: import("tone").InputNode) => {
    const lp = keep(new Tone.Filter({ type: "lowpass", frequency: hz, rolloff: -24 }));
    lp.connect(dest);
    return lp;
  };
  const drive = (amount: number) => keep(new Tone.Distortion({ distortion: amount, oversample: "4x" }));
  const makePunch = (dest: import("tone").InputNode, db: number): Punch => {
    const synth = keep(new Tone.MembraneSynth({
      pitchDecay: 0.04, octaves: 3.2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.04 },
    }));
    synth.connect(dest);
    synth.volume.value = db;
    return { synth, last: -1 };
  };

  // Clean melody: bright / EAD bass / G mid-bass.
  const melodyIn = bodyBright(ch.melody);
  const melodyLowIn = bodyWarm(ch.melody);
  const melodyGIn = bodyMid(ch.melody);
  // G/B/e share the *G bus now — give it the same polyphony headroom as the old bright bus.
  const melody = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.melody, maxPolyphony: 48 }).connect(melodyIn);
  const melodyLow = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.melodyLow, maxPolyphony: 32 }).connect(melodyLowIn);
  const melodyG = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.melodyG, maxPolyphony: 48 }).connect(melodyGIn);
  // Overdriven solo / lead: same split.
  const soloDrive = drive(0.28);
  soloDrive.connect(cab(4800, bodyBright(ch.solo)));
  const soloLowDrive = drive(0.3);
  soloLowDrive.connect(cab(2800, bodyWarm(ch.solo)));
  const soloGDrive = drive(0.28);
  soloGDrive.connect(cab(3200, bodyMid(ch.solo)));
  const solo = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.solo, maxPolyphony: 48 }).connect(soloDrive);
  const soloLow = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.soloLow, maxPolyphony: 32 }).connect(soloLowDrive);
  const soloG = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.soloG, maxPolyphony: 48 }).connect(soloGDrive);

  const leadDrive = drive(0.35);
  leadDrive.connect(cab(5200, bodyBright(ch.lead)));
  const leadLowDrive = drive(0.32);
  leadLowDrive.connect(cab(3000, bodyWarm(ch.lead)));
  const leadGDrive = drive(0.3);
  leadGDrive.connect(cab(3400, bodyMid(ch.lead)));
  const lead = new Tone.MonoSynth(TONES.lead).connect(leadDrive);
  const leadLow = new Tone.MonoSynth(TONES.leadLow).connect(leadLowDrive);
  const leadG = new Tone.MonoSynth(TONES.leadG).connect(leadGDrive);

  // Rhythm: warm cab — power chords live on the low strings.
  const rhythmDrive = drive(0.45);
  rhythmDrive.connect(cab(2200, bodyWarm(ch.backing)));
  const backing = new Tone.PolySynth({ voice: Tone.MonoSynth, options: TONES.backing, maxPolyphony: 32 }).connect(rhythmDrive);

  // Keep punch synths muted — sub-octave membrane made E/A sound like a bass guitar.
  const punch = {
    melody: makePunch(melodyLowIn, -60),
    solo: makePunch(soloLowDrive, -60),
    lead: makePunch(leadLowDrive, -60),
    backing: makePunch(rhythmDrive, -60),
  };
  const punchG = {
    melody: makePunch(melodyGIn, -60),
    solo: makePunch(soloGDrive, -60),
    lead: makePunch(leadGDrive, -60),
  };

  // Bass guitar: round and subby.
  const bassLp = keep(new Tone.Filter({ type: "lowpass", frequency: 900, rolloff: -24 }));
  const bassShelf = keep(new Tone.Filter({ type: "lowshelf", frequency: 120, gain: 2.5 }));
  bassLp.chain(bassShelf, ch.bass);
  const bass = new Tone.MonoSynth({
    oscillator: { type: "sawtooth" }, filter: { Q: 0.7, type: "lowpass" },
    filterEnvelope: { attack: 0.008, decay: 0.22, sustain: 0.15, baseFrequency: 80, octaves: 1.6 },
    envelope: { attack: 0.008, decay: 0.25, sustain: 0.7, release: 0.15 },
  }).connect(bassLp);

  // Drums: kick-forward, moderate levels.
  const drumWarm = keep(new Tone.Filter({ type: "lowshelf", frequency: 110, gain: 3 }));
  const drumLp = keep(new Tone.Filter({ type: "lowpass", frequency: 6500, rolloff: -12 }));
  drumWarm.chain(drumLp, ch.drums);
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.08, octaves: 4.5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.12 },
  }).connect(drumWarm);
  kick.volume.value = -2;
  const snareLp = keep(new Tone.Filter({ type: "lowpass", frequency: 2800, rolloff: -12 }));
  const snareBody = keep(new Tone.Filter({ type: "peaking", frequency: 180, Q: 0.9, gain: 1.5 }));
  snareLp.chain(snareBody, drumWarm);
  const snare = new Tone.NoiseSynth({
    noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  }).connect(snareLp);
  snare.volume.value = -6;
  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.04, release: 0.01 }, harmonicity: 5.1, modulationIndex: 24, resonance: 2800, octaves: 1.2,
  }).connect(drumWarm);
  hat.volume.value = -26;
  const click = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.06, release: 0.01 }, harmonicity: 3, resonance: 3000 }).connect(ch.click);
  click.volume.value = -10;
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
 * Tone's monophonic voices (MonoSynth/MembraneSynth/NoiseSynth/MetalSynth) keep a
 * single "started" state per voice and assert that every start time is strictly
 * greater than the previous one on that same voice. Two hits landing on the same
 * voice at the same instant — e.g. the arrangement puts a crash AND a hat on
 * beat 0, and both are played by the hat MetalSynth — therefore throw
 * "Start time must be strictly greater than previous start time" and kill playback.
 *
 * Returns the monophonic voice an event plays on, or null for polyphonic tracks
 * (which can freely sound several notes at once).
 */
export function monoVoiceKey(e: Schedule["events"][number]): string | null {
  if (e.track === "drums") return e.drum === "crash" ? "hat" : (e.drum ?? "drums"); // crash & hat share one MetalSynth
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
const GRAPH_GEN = 10;

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
      // Soft ceiling before the speakers so envelope edges through drive don't crack the output.
      this.master = new Tone.Limiter(-1.5).toDestination();
      this.room = new Tone.Reverb({ decay: 1.5, preDelay: 0.01, wet: 0.1 }).connect(this.master);
      await this.room.ready;
      const mk = (db: number, roomy = true) => {
        const c = new Tone.Channel().connect(roomy ? this.room! : this.master!);
        c.volume.value = db;
        return c;
      };
      this.channels = { melody: mk(-5), solo: mk(-5), lead: mk(-6), backing: mk(-11), bass: mk(-8), drums: mk(-7), click: mk(-4, false) };
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
      const dur = Math.max(0.03, e.duration);
      Tone.Transport.schedule((time) => {
        switch (e.track) {
          case "melody":
            safe(() => {
              const midi = e.midis[0] ?? 60;
              const kind = warmToneKind(e.string, midi);
              const vel = kind !== "bright" ? Math.min(0.9, e.velocity * 1.05) : e.velocity;
              polyFor(v, "melody", kind).triggerAttackRelease(f(e.midis), dur, time, vel);
              const p = punchFor(v, "melody", kind);
              if (p) thump(p, time, midi, vel);
            });
            break;
          case "solo":
            safe(() => {
              const midi = e.midis[0] ?? 60;
              const kind = warmToneKind(e.string, midi);
              const vel = kind !== "bright" ? Math.min(0.9, e.velocity * 1.05) : e.velocity;
              polyFor(v, "solo", kind).triggerAttackRelease(f(e.midis), dur, time, vel);
              const p = punchFor(v, "solo", kind);
              if (p) thump(p, time, midi, vel);
            });
            break;
          case "lead":
            safe(() => {
              const midi = e.midis[0];
              const kind = warmToneKind(e.string, midi);
              const vel = kind !== "bright" ? Math.min(0.9, e.velocity * 1.05) : e.velocity;
              playLead(leadFor(v, kind), midi, time, dur, vel, e.art);
              if (!e.art?.legato) {
                const p = punchFor(v, "lead", kind);
                if (p) thump(p, time, midi, vel);
              }
            });
            break;
          case "backing":
            safe(() => {
              v.backing.triggerAttackRelease(f(e.midis), dur, time, Math.min(1, e.velocity * 0.75));
              const root = e.midis[0];
              if (root != null && isBassStringMidi(root)) thump(v.punch.backing, time, root, e.velocity);
            });
            break;
          case "bass":
            safe(() => v.bass.triggerAttackRelease(midiToFreq(e.midis[0]), dur, time, e.velocity));
            break;
          case "click":
            safe(() => v.click.triggerAttackRelease(e.velocity > 0.8 ? 1200 : 800, 0.05, time, e.velocity));
            break;
          case "drums":
            safe(() => {
              if (e.drum === "kick") v.kick.triggerAttackRelease(38, 0.32, time, e.velocity);
              else if (e.drum === "snare") v.snare.triggerAttackRelease(0.18, time, e.velocity * 0.9);
              else if (e.drum === "crash") v.hat.triggerAttackRelease(220, 0.55, time, e.velocity * 0.7);
              else v.hat.triggerAttackRelease(320, 0.04, time, e.velocity * 0.65);
            });
            break;
        }
      }, e.time);
    }

    this.startedAt = Tone.now();
    this.playing = true;
    Tone.Transport.start("+0.05");
    this.endTimer = setTimeout(() => {
      this.playing = false;
      try {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
      } catch { /* ignore */ }
      onEnd?.();
    }, (schedule.durationSec + 0.6) * 1000);
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

  /** Softly end held notes, then rebuild voices so nothing is left hard-cut mid-sample. */
  stop() {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = null;
    if (this.Tone) {
      try {
        this.Tone.Transport.stop();
        this.Tone.Transport.cancel(0);
        this.Tone.Transport.seconds = 0;
      } catch { /* ignore */ }
    }
    const wasPlaying = this.playing;
    this.playing = false;
    this.releaseHeld();
    if (!this.voices || !this.Tone || !this.channels || !wasPlaying) return;
    disposeVoices(this.voices);
    this.voices = buildVoices(this.Tone, this.channels);
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
