"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Notice, PageTitle } from "@/components/AppShell";
import { Fretboard, type FretMarker } from "@/components/Fretboard";
import { FingerGPS } from "@/components/FingerGPS";
import { ExplainFloat } from "@/components/ExplainFloat";
import { TabView, type NoteStatus } from "@/components/TabView";
import { ChordDiagram } from "@/components/ChordDiagram";
import { IconExpand, IconHeadphones, IconPlay, IconStop } from "@/components/Icons";
import { api } from "@/lib/api";
import { getEngine } from "@/lib/audio/engine";
import { BandScorer, StablePitchTracker, judge, type BandNoteResult } from "@/lib/audio/noteMatcher";
import { MIC_MESSAGES } from "@/lib/audio/mic";
import { activeNoteIndex, barAndBeat, buildSchedule, chordAtBeat, partNotes, type TrackToggles } from "@/lib/audio/timeline";
import { useMicPitch, type LiveFrame } from "@/lib/audio/useMicPitch";
import { FEEDBACK, bendFeedback, fingerInstructions, pitchDirection, spokenInstruction, wrongNoteHint } from "@/lib/music/instructions";
import { handBases } from "@/lib/music/handLayout";
import { fingerChange } from "@/lib/music/fingerMoves";
import { TheoryPanel } from "@/components/TheoryPanel";
import { LessonContent } from "@/components/LessonContent";
import { ScaleFretmapFloat } from "@/components/ScaleFretmapFloat";
import { articulation } from "@/lib/audio/timeline";
import { ApiError } from "@/lib/api";
import { phraseInsight, type Insight } from "@/lib/music/insights";
import { LESSONS } from "@/lib/music/lessons";
import { SCALE_ROOTS, type ScaleMode, type ScaleRoot } from "@/lib/music/scaleFretmap";
import { degreeWords, isChordTone, midiToName, pitchClassName } from "@/lib/music/theory";
import { useApp, useHydrated } from "@/lib/store";
import { cancelEnglishSpeech, speakEnglish } from "@/lib/tts/speakEnglish";
import type { Part, PlayableNote, PracticeEventResult, PracticeMode, Recommendation, Style, TechniquesMode } from "@/lib/types";

/** Map a song key onto the fretboard map's natural roots (C–B). */
function fretmapRootFromTonic(tonic: number): ScaleRoot {
  const natural = pitchClassName(60 + ((tonic % 12) + 12) % 12).replace(/#/g, "");
  return (SCALE_ROOTS as readonly string[]).includes(natural) ? (natural as ScaleRoot) : "C";
}

type Feedback = { tone: "ok" | "bad" | "info"; text: string } | null;
const PART_LABEL: Record<Part, string> = { solo: "Easy solo", lead: "Lead solo", melody: "Original melody" };
const RIFF_PART_LABEL: Record<Part, string> = { melody: "The riff", solo: "Easy version", lead: "Jam over it" };
const GENRE_STYLES: [Style, string][] = [["classic_rock", "Rock"], ["pop", "Pop"], ["blues", "Blues"]];
const TECH_LABEL: Record<TechniquesMode, string> = { auto: "Match my level", none: "Plain notes", slides: "Slides & legato", all: "Everything (bends too)" };
const TRACK_LABELS: [keyof TrackToggles, string][] = [
  ["melody", "Original melody"], ["solo", "Easy solo"], ["lead", "Lead solo"], ["backing", "Guitar backing"], ["bass", "Bass"], ["drums", "Drums"],
];

export default function LearnPage() {
  const hydrated = useHydrated();
  const { arrangement: arr, prefs, setPrefs, addSession, setArrangement } = useApp();
  const [part, setPart] = useState<Part>("solo");
  const [regenBusy, setRegenBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, NoteStatus>>({});
  const [tabMode, setTabMode] = useState<"beginner" | "standard">("standard");
  const [tempo, setTempo] = useState(1);
  const [countIn, setCountIn] = useState(true);
  const [tracks, setTracks] = useState<TrackToggles>({ melody: false, solo: true, lead: false, backing: true, bass: true, drums: true });
  const [phrase, setPhrase] = useState<{ from: number; to: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [summary, setSummary] = useState<{ correct: number; total: number; timing?: number | null; recs: Recommendation[]; saved: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [noiseMsg, setNoiseMsg] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(true);
  const [fretmapOpen, setFretmapOpen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const notes: PlayableNote[] = useMemo(() => (arr ? partNotes(arr, part) : []), [arr, part]);
  const range = phrase ?? { from: 0, to: notes.length - 1 };
  const cur = notes[index] ?? null;
  const nxt = index + 1 <= range.to ? notes[index + 1] ?? null : null;
  const bases = useMemo(() => handBases(notes), [notes]);
  const curStatus = cur ? statuses[cur.id] : undefined;

  // Stable marker objects, so the (memoised) fretboard only redraws when something really changes.
  const labelFor = useCallback((n: PlayableNote) => {
    if (prefs.markerLabel === "interval") return n.chord_degree ?? "";
    if (prefs.markerLabel === "note") return n.name.replace(/-?\d+$/, "");
    return n.fret === 0 ? "O" : String(n.finger);
  }, [prefs.markerLabel]);
  const curMarker = useMemo<FretMarker | null>(() => {
    if (!cur) return null;
    const prev = index > 0 ? notes[index - 1] : undefined;
    return {
      string: cur.string, fret: cur.fret, finger: cur.finger, text: labelFor(cur),
      status: curStatus === "correct" ? "correct" : curStatus === "wrong" ? "wrong" : "target",
      technique: cur.technique, bend: cur.bend_semitones, vibrato: cur.vibrato,
      fromFret: cur.slide_from_fret ?? ((cur.technique === "hammer_on" || cur.technique === "pull_off") && prev?.string === cur.string ? prev.fret : null),
    };
  }, [cur, curStatus, index, notes, labelFor]);
  const nextMarker = useMemo<FretMarker | null>(() => (nxt && (nxt.string !== cur?.string || nxt.fret !== cur?.fret)
    ? { string: nxt.string, fret: nxt.fret, finger: nxt.finger, status: "next", text: labelFor(nxt) } : null), [nxt, cur, labelFor]);
  const moveText = useMemo(() => {
    if (!cur) return undefined;
    const prev = index > range.from ? notes[index - 1] : null;
    return fingerChange(prev, cur, prev ? bases[index - 1] : null, bases[index]);
  }, [cur, index, notes, bases, range.from]);
  const pulseKey = cur ? `${cur.id}-${index}` : undefined;

  // "Watch the fingers": step through the part slowly, sounding each note, so the hand animation
  // shows every finger change in order.
  useEffect(() => {
    if (!watching || !arr) return;
    const n = notes[index];
    if (!n) { setWatching(false); return; }
    void getEngine().preview(n.midi, part, 3.5, part === "lead" ? articulation(n, notes[index - 1]) : undefined, n.string);
    const secs = Math.max(0.75, (n.duration_beats * 60) / (arr.tempo_bpm * 0.6));
    const t = setTimeout(() => {
      if (index >= range.to) setWatching(false);
      else setIndex(index + 1);
    }, secs * 1000);
    return () => clearTimeout(t);
  }, [watching, index, notes, part, arr, range.to]);

  const handProp = useMemo(() => (prefs.handOverlay && cur ? { base: bases[index] ?? 1, opacity: prefs.handOpacity } : null),
    [prefs.handOverlay, prefs.handOpacity, bases, index, cur]);

  // Mutable practice state read by the microphone callback.
  const live = useRef({
    mode: null as PracticeMode | null, index: 0, notes: [] as PlayableNote[], range, lockUntil: 0, lastSound: 0, prompted: 0,
    attempts: {} as Record<string, number>, results: {} as Record<string, PracticeEventResult>, tracker: new StablePitchTracker(4, 45, 0.8),
    scorer: null as BandScorer | null, startedAt: 0, statusSig: "",
  });
  live.current.index = index;
  live.current.notes = notes;
  live.current.range = range;
  live.current.mode = mode;

  const onFrame = useCallback((f: LiveFrame) => {
    const L = live.current;
    if (f.midi != null) L.lastSound = f.at;
    if (L.mode === "play_with_band" && L.scorer) {
      const t = getEngine().position();
      if (t >= 0) L.scorer.push(t, f);
      return;
    }
    if (L.mode !== "follow_me" || f.at < L.lockUntil) return;
    const target = L.notes[L.index];
    if (!target) return;
    const stable = L.tracker.push(f);
    if (!stable) return;
    L.tracker.reset();
    let { verdict, cents } = judge(stable.midi, target.midi, prefsRef.current.toleranceCents);
    if (verdict !== "correct" && target.technique === "bend_release" && target.bend_semitones) {
      // the peak of the bend counts too
      const peak = judge(stable.midi, target.midi + target.bend_semitones, prefsRef.current.toleranceCents);
      if (peak.verdict === "correct") ({ verdict, cents } = peak);
    }
    const tries = (L.attempts[target.id] ?? 0) + 1;
    L.attempts[target.id] = tries;
    if (verdict === "correct") {
      L.results[target.id] = {
        event_id: target.id, expected_midi: target.midi, detected_midi: Number(stable.midi.toFixed(2)), correct: tries === 1,
        attempts: tries, string: target.string, fret: target.fret,
      };
      setStatuses((s) => ({ ...s, [target.id]: "correct" }));
      setFeedback({ tone: "ok", text: FEEDBACK.correct });
      L.lockUntil = f.at + 650;
      setTimeout(() => advanceRef.current(), 600);
    } else {
      setStatuses((s) => ({ ...s, [target.id]: "wrong" }));
      const heard = midiToName(Math.round(stable.midi));
      const bendTip = target.technique === "bend" && target.bend_semitones ? bendFeedback(stable.midi, target.midi, target.bend_semitones) : null;
      const extra = verdict === "octave" ? FEEDBACK.octave : pitchDirection(cents);
      setFeedback({ tone: "bad", text: bendTip ? `I heard ${heard}. ${bendTip}` : `I heard ${heard}. ${extra ? extra + " " : ""}${wrongNoteHint(target)}` });
      L.lockUntil = f.at + 900; // let the wrong note ring out before listening again
    }
  }, []);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const mic = useMicPitch({ a4: prefs.a4, noiseGate: prefs.noiseGate, clarityThreshold: prefs.clarityThreshold }, onFrame);

  // ---------------------------------------------------------------- helpers
  const finishSession = useCallback(async (practiceMode: PracticeMode, results: PracticeEventResult[], completed: boolean) => {
    if (!arr) return;
    const L = live.current;
    const duration = (performance.now() - L.startedAt) / 1000;
    const correct = results.filter((r) => r.correct).length;
    const offs = results.filter((r) => r.correct && r.timing_offset_ms != null).map((r) => Math.abs(r.timing_offset_ms!));
    const timing = offs.length ? Math.round(offs.reduce((a, b) => a + b, 0) / offs.length) : null;
    const payload = {
      arrangement_id: arr.id, part, mode: practiceMode, tempo_factor: tempo, duration_sec: Math.max(0, duration), completed,
      used_microphone: practiceMode !== "manual", events: results,
    };
    try {
      const res = await api.practiceResult(payload);
      addSession(res.session);
      setSummary({ correct, total: results.length, timing, recs: res.recommendations, saved: true });
    } catch {
      addSession({ id: `local_${Date.now()}`, created_at: new Date().toISOString(), result: payload, accuracy: results.length ? correct / results.length : 0, mean_abs_timing_ms: timing });
      setSummary({ correct, total: results.length, timing, recs: [], saved: false });
    }
  }, [arr, part, tempo, addSession]);

  const showInsightFor = useCallback((i: number) => {
    if (!arr) return;
    const n = notes[i];
    const bpb = arr.beats_per_bar;
    const bar = Math.floor(n.start_beat / bpb);
    const isBarEnd = i === notes.length - 1 || Math.floor(notes[i + 1].start_beat / bpb) !== bar;
    if (!isBarEnd) return;
    const inBar = notes.filter((x) => Math.floor(x.start_beat / bpb) === bar);
    const prev = notes.filter((x) => Math.floor(x.start_beat / bpb) === bar - 1);
    setInsight(phraseInsight(inBar, chordAtBeat(arr.harmonization.chords, bar * bpb), arr.key, { isLastPhrase: i === notes.length - 1, previous: prev }));
    setWhyOpen(false);
  }, [arr, notes]);

  const advance = useCallback(() => {
    const L = live.current;
    const i = L.index;
    showInsightFor(i);
    if (i >= L.range.to) {
      if (L.mode === "follow_me") {
        const results = L.notes.slice(L.range.from, L.range.to + 1).map((n) => L.results[n.id] ?? {
          event_id: n.id, expected_midi: n.midi, correct: false, attempts: L.attempts[n.id] ?? 0, string: n.string, fret: n.fret,
        });
        void finishSession("follow_me", results, results.every((r) => r.attempts && r.attempts > 0));
        setMode(null);
        setFeedback({ tone: "ok", text: "You played the whole part. Nice work!" });
      }
      return;
    }
    setIndex(i + 1);
    L.prompted = performance.now();
  }, [finishSession, showInsightFor]);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // "I couldn't hear the string" prompt in Follow Me
  useEffect(() => {
    if (mode !== "follow_me") return;
    const t = setInterval(() => {
      const L = live.current;
      const now = performance.now();
      if (now - Math.max(L.lastSound, L.prompted) > 7000) {
        setFeedback({ tone: "info", text: FEEDBACK.silence });
        L.prompted = now;
      }
    }, 1000);
    return () => clearInterval(t);
  }, [mode]);

  // Voice instructions — Microsoft Andrew (EN) when available, same rules as JLPT-Trainer
  useEffect(() => {
    if (!cur || !mode || !["voice", "both"].includes(prefs.instructionMode)) return;
    if (mode === "play_with_band") return;
    const ac = new AbortController();
    void speakEnglish(spokenInstruction(cur), { signal: ac.signal });
    return () => {
      ac.abort();
      cancelEnglishSpeech();
    };
  }, [cur, mode, prefs.instructionMode]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      cancelAnimationFrame(raf.current);
      getEngine().stop();
    };
  }, []);

  useEffect(() => {
    setIndex(0);
    setStatuses({});
    setPhrase(null);
  }, [arr?.id, part]);

  // Riffs open on the riff itself, with the riff as the guide track.
  const riffId = arr?.kind === "riff" ? arr.id : null;
  useEffect(() => {
    if (!riffId) return;
    setPart("melody");
    setTracks((t) => ({ ...t, melody: true, solo: false, lead: false }));
  }, [riffId]);

  // ---------------------------------------------------------------- transport
  const stopAll = useCallback(() => {
    setWatching(false);
    cancelAnimationFrame(raf.current);
    getEngine().stop();
    setPlaying(false);
  }, []);

  const startPlayback = async (opts: { practice?: boolean } = {}) => {
    if (!arr) return;
    stopAll();
    const fromBeat = notes[range.from]?.start_beat ?? 0;
    const lastNote = notes[range.to];
    const barEnd = lastNote ? Math.ceil((lastNote.start_beat + lastNote.duration_beats) / arr.beats_per_bar - 1e-9) * arr.beats_per_bar : undefined;
    const sched = buildSchedule(arr, {
      tempoFactor: tempo, countInBeats: countIn || opts.practice ? arr.beats_per_bar : 0, part,
      fromBeat: phrase ? Math.floor(fromBeat / arr.beats_per_bar) * arr.beats_per_bar : 0, toBeat: phrase ? barEnd : undefined,
    });
    const ids = new Map(notes.map((n, i) => [n.id, i]));
    const L = live.current;
    if (opts.practice) {
      L.scorer = new BandScorer(sched.partNotes.map((p) => ({ id: p.id, midi: p.note.midi, start: p.start, end: p.end, string: p.note.string, fret: p.note.fret })), prefs.toleranceCents);
      L.startedAt = performance.now();
      setStatuses({});
    }
    setPlaying(true);
    await getEngine().play(sched, tracks, () => {
      setPlaying(false);
      cancelAnimationFrame(raf.current);
      if (opts.practice && L.scorer) {
        const res: BandNoteResult[] = L.scorer.results();
        void finishSession("play_with_band", res.map((r) => ({
          event_id: r.id, expected_midi: r.midi, detected_midi: r.detectedMidi, correct: r.correct, timing_offset_ms: r.timingOffsetMs, string: r.string, fret: r.fret,
        })), true);
        L.scorer = null;
        setMode(null);
      }
    });
    const tick = () => {
      const eng = getEngine();
      const t = eng.position();
      // Keep the RAF alive during look-ahead (t < 0) so the fretboard catches the first note.
      if (t >= 0) {
        const ai = activeNoteIndex(sched, t);
        if (ai >= 0) setIndex(ids.get(sched.partNotes[ai].id) ?? 0);
        if (opts.practice && L.scorer) {
          const st: Record<string, NoteStatus> = {};
          let sig = "";
          for (const p of sched.partNotes) {
            if (L.scorer.status(p.id) === "hit") { st[p.id] = "correct"; sig += "c"; }
            else if (t > Math.max(p.end, p.start + 0.3)) { st[p.id] = "wrong"; sig += "w"; }
            else sig += ".";
          }
          // Only re-render when a note's status actually changed (not on every animation frame).
          if (sig !== L.statusSig) { L.statusSig = sig; setStatuses(st); }
        }
      }
      if (eng.isPlaying()) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const startMode = async (m: PracticeMode) => {
    stopAll();
    setSummary(null);
    setInsight(null);
    setFeedback(null);
    const L = live.current;
    L.results = {};
    L.attempts = {};
    L.tracker = new StablePitchTracker(4, 45, prefs.clarityThreshold);
    L.startedAt = performance.now();
    L.prompted = performance.now();
    L.lastSound = 0;
    setStatuses({});
    setIndex(range.from);
    if (m === "manual") {
      setMode("manual");
      setFeedback({ tone: "info", text: "Manual practice: the app isn't listening. Use Next when you've played each note." });
      return;
    }
    const ok = await mic.start();
    if (!ok) {
      setMode(null);
      return;
    }
    setMode(m);
    if (m === "follow_me") setFeedback({ tone: "info", text: "Listening. Play the glowing note — take your time." });
    else void startPlayback({ practice: true });
  };

  const endMode = () => {
    const was = mode;
    stopAll();
    if (was && was !== "manual") mic.stop();
    if (was === "follow_me") {
      const L = live.current;
      const done = notes.slice(range.from, index).map((n) => L.results[n.id]).filter(Boolean);
      if (done.length) void finishSession("follow_me", done, false);
    }
    live.current.scorer = null;
    setMode(null);
  };

  const manualStep = (d: number) => {
    const i = Math.min(range.to, Math.max(range.from, index + d));
    if (d > 0) {
      showInsightFor(index);
      const n = notes[index];
      live.current.results[n.id] = { event_id: n.id, expected_midi: n.midi, correct: true, attempts: 1, string: n.string, fret: n.fret };
      if (index === range.to) {
        void finishSession("manual", notes.slice(range.from, range.to + 1).map((x) => live.current.results[x.id]).filter(Boolean), true);
        setMode(null);
        return;
      }
    }
    setIndex(i);
  };

  const hearNote = (n: PlayableNote, i: number) => {
    void getEngine().preview(n.midi, part, 3.5, part === "lead" ? articulation(n, notes[i - 1]) : undefined, n.string);
  };

  const selectTab = (i: number) => {
    const n = notes[i];
    if (!n) return;
    setIndex(i);
    setFeedback(null);
    hearNote(n, i);
  };

  const selectFret = (string: number, fret: number) => {
    const hits = notes.map((n, i) => ({ n, i })).filter(({ n }) => n.string === string && n.fret === fret);
    if (hits.length) {
      const pick = hits.find(({ i }) => i > index) ?? hits[0];
      setIndex(pick.i);
      setFeedback(null);
      hearNote(pick.n, pick.i);
    } else {
      const midi = (({ 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 }) as Record<number, number>)[string] + fret;
      void getEngine().preview(midi, part === "lead" ? "solo" : part, 3.5, undefined, string);
      setFeedback({ tone: "info", text: `That's ${midiToName(midi)}. It isn't in this part.` });
    }
  };

  const applyRec = (r: Recommendation) => {
    if (r.tempo_factor) setTempo(r.tempo_factor);
    if (r.kind === "shorter_phrase" && r.phrase_length) setPhrase({ from: 0, to: Math.min(notes.length - 1, r.phrase_length - 1) });
    if (r.kind === "longer_phrase") setPhrase(null);
    if (r.kind === "simpler") setPart("melody");
    setSummary(null);
  };

  const choosePart = (p: Part) => {
    endMode();
    setPart(p);
    const t = { ...tracks, solo: p === "solo", lead: p === "lead", melody: p === "melody" };
    setTracks(t);
    getEngine().setTracks(t);
  };

  /** Re-harmonise the ORIGINAL tune in another genre (or with other techniques) and rebuild every part. */
  const regenerate = async (style: Style, techniques: TechniquesMode) => {
    if (!arr) return;
    endMode();
    setRegenBusy(true);
    setRegenError(null);
    try {
      if (arr.kind === "riff" && arr.riff) {
        setPrefs({ techniques });
        setArrangement(await api.riffArrangement(arr.riff.id, prefs.skillLevel, techniques));
        return;
      }
      const melody = arr.original_melody;
      const res = await api.harmonize(melody, style, prefs.skillLevel);
      const kind = arr.harmonization.kind === "simple" || arr.harmonization.kind === "alternative" ? arr.harmonization.kind : "genre";
      const h = res.harmonizations.find((x) => x.kind === kind) ?? res.harmonizations[0];
      const next = await api.generateSolo(melody, h, prefs.skillLevel, style, arr.title, techniques);
      setPrefs({ style, techniques });
      setArrangement(next);
    } catch (e) {
      setRegenError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setRegenBusy(false);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.();
  };

  // ---------------------------------------------------------------- render
  if (!hydrated) return null;
  if (!arr) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageTitle title="Guitar learning" lead="Once you've decoded a tune and picked chords, your guitar part shows up here." />
        <div className="surface p-6 flex flex-wrap gap-3">
          <Link href="/record" className="btn btn-primary">Record a melody</Link>
          <Link href="/decoder" className="btn btn-ghost">Open the decoder</Link>
          <Link href="/library" className="btn btn-ghost">Open a saved song</Link>
          <Link href="/learn/theory" className="btn btn-ghost">Open the Theory map</Link>
          <Link href="/learn/caged" className="btn btn-ghost">CAGED &amp; pentatonic map</Link>
          <Link href="/learn/by-ear" className="btn btn-ghost">Play any song by ear</Link>
          <Link href="/learn/solo" className="btn btn-ghost">Lead solo workshop</Link>
          <Link href="/learn/greats" className="btn btn-ghost">Guitar greats</Link>
          <button type="button" className="btn btn-ghost" data-testid="learn-fretmap" onClick={() => setFretmapOpen(true)}>
            Fretboard map
          </button>
        </div>
        <ScaleFretmapFloat open={fretmapOpen} onOpenChange={setFretmapOpen} />
      </div>
    );
  }

  const fretmapRoot = fretmapRootFromTonic(arr.key.tonic);
  const fretmapMode: ScaleMode = arr.key.mode === "minor" ? "minor" : "major";

  const bpb = arr.beats_per_bar;
  const { bar, beat } = barAndBeat(cur?.start_beat ?? 0, bpb);
  const chord = chordAtBeat(arr.harmonization.chords, cur?.start_beat ?? 0)?.symbol ?? "";
  const maxFret = Math.max(...notes.map((n) => n.fret));
  const fretsShown = Math.max(prefs.fretsShown, Math.min(22, maxFret + 1));
  const barChords = Array.from({ length: arr.total_bars }, (_, b) => chordAtBeat(arr.harmonization.chords, b * bpb)?.symbol ?? "");
  const showText = prefs.instructionMode !== "voice" && prefs.instructionMode !== "silent";
  const uniqueChords = [...new Map(arr.harmonization.chords.map((c) => [c.symbol, c])).values()];
  const buildingChordsLesson = LESSONS.find((l) => l.id === "building-chords");
  const hasSevenths = arr.harmonization.chords.some((c) => c.quality === "7");
  const explainLines = cur && showText ? fingerInstructions(cur) : [];
  const degreeText = cur?.chord_degree && chord
    ? `The ${degreeWords(cur.chord_degree)} of the ${chord.replace(/5$/, "")} chord` +
      (isChordTone(cur.chord_degree, hasSevenths) ? " — a chord note, so it blends with the band." : " — a colour note between chord notes.")
    : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Compact header: title + part tabs on one row so the stage starts higher */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <p className="mb-2">
            <Link href="/learn/theory" className="chip text-xs hover:bg-panel-2" data-testid="theory-map-link">
              Theory map — hear every term with visuals
            </Link>
            <Link href="/learn/by-ear" className="ml-2 chip text-xs hover:bg-panel-2" data-testid="ear-guide-link">
              Play any song by ear
            </Link>
            <Link href="/learn/find" className="ml-2 chip text-xs hover:bg-panel-2" data-testid="find-link">
              Find a chord or topic
            </Link>
            <Link href="/learn/solo" className="ml-2 chip text-xs hover:bg-panel-2" data-testid="solo-link">
              Lead solo workshop
            </Link>
            <Link href="/learn/caged" className="ml-2 chip text-xs hover:bg-panel-2" data-testid="caged-map-link">
              CAGED &amp; pentatonic map
            </Link>
            <Link href="/learn/greats" className="ml-2 chip text-xs hover:bg-panel-2" data-testid="greats-link">
              Guitar greats
            </Link>
            <button
              type="button"
              className="ml-2 chip text-xs hover:bg-panel-2"
              data-testid="learn-fretmap"
              onClick={() => setFretmapOpen(true)}
            >
              Fretboard map
            </button>
          </p>
          <h1 className="display text-[1.55rem] md:text-[1.9rem] leading-tight">{arr.title}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {arr.key.name}, {Math.round(arr.tempo_bpm * tempo)} BPM, {arr.total_bars} bars · {arr.harmonization.label}
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-panel p-1" role="tablist" aria-label="Part to learn">
          {((arr.kind === "riff" ? ["melody", "solo", "lead"] : arr.lead ? ["solo", "lead", "melody"] : ["solo", "melody"]) as Part[]).map((p) => (
            <button key={p} role="tab" aria-selected={part === p} data-testid={`part-${p}`} onClick={() => choosePart(p)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${part === p ? "bg-maple text-tolex" : "text-muted"}`}>
              {(arr.kind === "riff" ? RIFF_PART_LABEL : PART_LABEL)[p]}
            </button>
          ))}
        </div>
      </div>

      <section className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-panel px-3 py-2" aria-label="Genre and techniques">
        {arr.kind !== "riff" && <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Genre</span>
          <div role="radiogroup" aria-label="Genre" className="flex gap-1">
            {GENRE_STYLES.map(([st, label]) => {
              const on = (arr.theory?.genre ?? "rock") === (st === "classic_rock" ? "rock" : st);
              return (
                <button key={st} role="radio" aria-checked={on} disabled={regenBusy} data-testid={`genre-${st}`}
                  onClick={() => !on && regenerate(st, prefs.techniques)} className={`chip ${on ? "bg-maple text-tolex" : ""}`}>{label}</button>
              );
            })}
          </div>
        </div>}
        <label className="flex items-center gap-2 text-sm text-muted">
          {arr.kind === "riff" ? "Jam techniques" : "Lead techniques"}
          <select className="field min-h-0 py-1" value={prefs.techniques} disabled={regenBusy} data-testid="techniques-select"
            onChange={(e) => regenerate(arr.style, e.target.value as TechniquesMode)}>
            {(Object.keys(TECH_LABEL) as TechniquesMode[]).map((k) => <option key={k} value={k}>{TECH_LABEL[k]}</option>)}
          </select>
        </label>
        {regenBusy && <span className="text-sm text-muted" role="status">Rewriting the band and solos…</span>}
        {arr.theory && <span className="text-sm text-muted ml-auto">{arr.theory.feel === "shuffle" ? "Shuffle" : "Straight"}, {arr.theory.progression_name}</span>}
      </section>
      {regenError && <div className="mb-3"><Notice tone="error">{regenError}</Notice></div>}

      {arr.kind === "riff" && arr.riff && (
        <details className="mb-3 rounded-2xl bg-panel px-3 py-2" data-testid="riff-tips">
          <summary className="cursor-pointer text-sm font-semibold">About this riff</summary>
          <p className="mt-1.5 text-sm text-muted">{arr.riff.credit}</p>
          <ul className="mt-1.5 list-disc pl-5 text-sm leading-relaxed">
            {arr.riff.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </details>
      )}

      {!(arr.kind === "riff" && part === "melody") && (part === "lead" ? arr.lead?.changes ?? [] : arr.solo.changes).length > 0 && (
        <details className="mb-3 rounded-2xl bg-panel px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold">{part === "lead" ? "How this lead solo is built" : "How we fitted your tune to the guitar"}</summary>
          <ul className="mt-1.5 list-disc pl-5 text-sm text-muted leading-relaxed">
            {(part === "lead" ? arr.lead?.changes ?? [] : arr.solo.changes).map((c) => <li key={c}>{c}</li>)}
            <li>Your original notes are kept unchanged on the Decoder page.</li>
          </ul>
        </details>
      )}

      {/* Stage: fixed-height note + play panels so the fretboard does not jump during playback */}
      <div ref={stage} className={`surface p-3 md:p-4 ${fullscreen ? "overflow-auto h-dvh rounded-none" : ""}`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(15.5rem,18.5rem)] lg:items-stretch">
          <div className="flex min-w-0 flex-col">
            <FingerGPS current={cur} next={nxt} chord={chord} bar={bar} beat={beat} showText={showText} move={moveText}
              seventh={hasSevenths} compact />
            {/* Always reserve one feedback line so appearing/clearing text does not shove the fretboard */}
            <p role="status" data-testid="feedback" title={feedback?.text ?? undefined}
              className={`mt-2 h-8 shrink-0 overflow-hidden rounded-xl px-3 py-1.5 text-sm font-semibold leading-tight line-clamp-1 ${
                feedback
                  ? feedback.tone === "ok" ? "bg-ok/15 text-ok" : feedback.tone === "bad" ? "bg-bad/15 text-bad" : "bg-panel-2 text-ink"
                  : "invisible bg-panel-2"
              }`}>
              {feedback?.text ?? "\u00a0"}
            </p>
          </div>

          {/* Play panel: fixed height matching the note column */}
          <aside className="flex h-[12.75rem] flex-col overflow-hidden rounded-2xl bg-panel-2 p-3" aria-label="Listen" data-testid="listen-panel">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => (playing ? stopAll() : startPlayback())} disabled={mode === "play_with_band"} data-testid="play-toggle">
                {playing ? <IconStop width={16} /> : <IconPlay width={16} />} {playing ? "Stop" : "Play"}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} /> Count-in
              </label>
              <label className="ml-auto flex items-center gap-1.5 text-xs text-muted tabular-nums">
                {Math.round(tempo * 100)}%
                <input type="range" min={0.5} max={1.2} step={0.05} value={tempo} aria-label={`Speed ${Math.round(tempo * 100)}%`}
                  className="w-20" onChange={(e) => setTempo(Number(e.target.value))} />
              </label>
            </div>
            <fieldset className="mt-2 min-h-0 shrink-0">
              <legend className="text-xs text-muted">Band</legend>
              <div className="mt-1 flex max-h-[3.25rem] flex-wrap gap-1 overflow-hidden">
                {TRACK_LABELS.map(([k, l]) => (
                  <button key={k} aria-pressed={tracks[k]} onClick={() => { const t = { ...tracks, [k]: !tracks[k] }; setTracks(t); getEngine().setTracks(t); }}
                    className={`chip text-[0.7rem] py-0.5 ${tracks[k] ? "bg-maple text-tolex" : "text-muted"}`} data-testid={`track-${k}`}>{l.replace("Original ", "").replace("Guitar ", "")} {tracks[k] ? "on" : "off"}</button>
                ))}
              </div>
            </fieldset>
            <div className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Loop</span>
              <button className={`chip text-[0.7rem] py-0.5 ${!phrase ? "bg-maple text-tolex" : ""}`} onClick={() => setPhrase(null)}>Whole part</button>
              <button className={`chip text-[0.7rem] py-0.5 ${phrase ? "bg-maple text-tolex" : ""}`} onClick={() => {
                const b = Math.floor((cur?.start_beat ?? 0) / bpb);
                const ids = notes.map((n, i) => ({ n, i })).filter(({ n }) => Math.floor(n.start_beat / bpb) === b).map(({ i }) => i);
                if (ids.length) { setPhrase({ from: ids[0], to: ids[ids.length - 1] }); setIndex(ids[0]); }
              }}>This bar</button>
            </div>
            <details className="mt-auto min-h-0 overflow-y-auto text-xs">
              <summary className="cursor-pointer text-muted flex items-center gap-1 sticky top-0 bg-panel-2"><IconHeadphones width={14} height={14} /> Headphones & mic</summary>
              <p className="mt-1.5 text-muted leading-snug">Use headphones when practising with the band so the mic hears your guitar, not the speakers.</p>
              <div className="mt-2 grid gap-2">
                <button className="btn btn-quiet btn-sm justify-self-start" onClick={async () => {
                  setNoiseMsg("Stay quiet for a moment…");
                  const g = await mic.measureNoise();
                  if (g == null) setNoiseMsg(mic.error?.message ?? MIC_MESSAGES.unknown);
                  else { setPrefs({ noiseGate: Number(g.toFixed(4)) }); setNoiseMsg(`Background level measured. Sounds quieter than ${g.toFixed(3)} will be ignored.`); }
                  if (!mode) mic.stop();
                }}>Measure background noise</button>
                {noiseMsg && <p className="line-clamp-2 text-muted">{noiseMsg}</p>}
                <label className="grid gap-0.5 text-muted">Pitch ±{prefs.toleranceCents}¢
                  <input type="range" min={20} max={60} step={5} value={prefs.toleranceCents} onChange={(e) => setPrefs({ toleranceCents: Number(e.target.value) })} />
                </label>
                <label className="grid gap-0.5 text-muted">Clarity {Math.round(prefs.clarityThreshold * 100)}%
                  <input type="range" min={0.6} max={0.95} step={0.05} value={prefs.clarityThreshold} onChange={(e) => setPrefs({ clarityThreshold: Number(e.target.value) })} />
                </label>
              </div>
            </details>
          </aside>
        </div>

        {cur && (
          <ExplainFloat
            noteName={cur.name}
            move={moveText}
            degree={degreeText}
            lines={explainLines}
            open={explainOpen}
            onOpenChange={setExplainOpen}
          />
        )}

        <div className="mt-3">
          <Fretboard
            handedness={prefs.handedness}
            view={prefs.viewMode}
            frets={fretsShown}
            equalSpacing={prefs.equalFretSpacing}
            zoom={zoom}
            current={curMarker}
            next={nextMarker}
            hand={handProp}
            animate={prefs.animateHand}
            pulseKey={pulseKey}
            scale={prefs.showScale ? arr.lead?.scale_positions ?? null : null}
            showNoteNames={prefs.showNoteNames}
            onSelect={selectFret}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <label className="flex items-center gap-1.5 text-muted">
            Frets
            <select className="field min-h-0 py-0.5 text-xs" value={prefs.fretsShown} onChange={(e) => setPrefs({ fretsShown: Number(e.target.value) })}>
              {[5, 7, 12, 15, 22].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          {!explainOpen && cur && (
            <button type="button" className="btn btn-quiet btn-sm" data-testid="show-explain"
              onClick={() => setExplainOpen(true)}>Show tip</button>
          )}
          <button className="btn btn-quiet btn-sm" onClick={() => setZoom((z) => (z === 1 ? 1.4 : 1))} aria-pressed={zoom > 1}>{zoom > 1 ? "Normal" : "Zoom"}</button>
          <button className={`btn btn-sm ${watching ? "btn-primary" : "btn-quiet"}`} aria-pressed={watching} data-testid="watch-fingers"
            disabled={!!mode || playing} onClick={() => {
              if (watching) { setWatching(false); return; }
              if (index >= range.to) setIndex(range.from);
              setWatching(true);
            }}>{watching ? "Stop watching" : "Watch fingers"}</button>
          <button className={`btn btn-sm ${prefs.handOverlay ? "btn-primary" : "btn-quiet"}`} aria-pressed={prefs.handOverlay} data-testid="toggle-hand"
            onClick={() => setPrefs({ handOverlay: !prefs.handOverlay })}>Hand</button>
          {prefs.handOverlay && (
            <label className="flex items-center gap-1.5 text-muted">
              <span className="sr-only">Hand opacity</span>
              <input type="range" min={0.1} max={0.9} step={0.05} value={prefs.handOpacity} aria-label="Hand opacity" className="w-20"
                onChange={(e) => setPrefs({ handOpacity: Number(e.target.value) })} />
            </label>
          )}
          {arr.lead && (
            <button className={`btn btn-sm ${prefs.showScale ? "btn-primary" : "btn-quiet"}`} aria-pressed={prefs.showScale} data-testid="toggle-scale"
              onClick={() => setPrefs({ showScale: !prefs.showScale })}>Scale</button>
          )}
          <label className="flex items-center gap-1.5 text-muted">
            Dots
            <select className="field min-h-0 py-0.5 text-xs" value={prefs.markerLabel} data-testid="marker-label"
              onChange={(e) => setPrefs({ markerLabel: e.target.value as typeof prefs.markerLabel })}>
              <option value="finger">Finger</option>
              <option value="interval">Interval</option>
              <option value="note">Note</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            View
            <select className="field min-h-0 py-0.5 text-xs" value={prefs.viewMode} onChange={(e) => setPrefs({ viewMode: e.target.value as typeof prefs.viewMode })}>
              <option value="beginner">Beginner</option>
              <option value="chart">Chart</option>
              <option value="facing">Facing</option>
              <option value="vertical">Vertical</option>
            </select>
          </label>
          <button className="btn btn-quiet btn-sm ml-auto" onClick={toggleFullscreen}><IconExpand width={14} /> {fullscreen ? "Exit" : "Full"}</button>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">TAB</h2>
            <div className="flex gap-1 rounded-full bg-tolex p-0.5 text-xs" role="tablist" aria-label="TAB style">
              {(["standard", "beginner"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={tabMode === m} onClick={() => setTabMode(m)}
                  className={`rounded-full px-2.5 py-0.5 ${tabMode === m ? "bg-panel-2 text-ink" : "text-muted"}`}>{m === "standard" ? "Standard" : "Big cards"}</button>
              ))}
            </div>
          </div>
          <TabView notes={notes} beatsPerBar={bpb} totalBars={arr.total_bars} barChords={barChords} current={index}
            next={nxt ? index + 1 : -1} statuses={statuses} mode={tabMode} onSelect={selectTab} />
        </div>

        {insight && (
          <div className="mt-3 rounded-2xl bg-panel-2 p-3" data-testid="insight">
            <p className="text-sm font-semibold">{insight.headline}</p>
            <button className="mt-1 text-xs underline underline-offset-4 text-muted" onClick={() => setWhyOpen((o) => !o)} aria-expanded={whyOpen}>
              Why does this work?
            </button>
            {whyOpen && <p className="mt-1.5 text-sm text-muted leading-relaxed max-w-prose">{insight.why}</p>}
          </div>
        )}
      </div>

      <section className="mt-4 surface p-3 md:p-4">
        <h2 className="text-base font-bold">Practise</h2>
        {!mode ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <button className="btn btn-primary" onClick={() => startMode("follow_me")} data-testid="mode-follow">Follow me</button>
            <button className="btn btn-quiet" onClick={() => startMode("play_with_band")}>With the band</button>
            <button className="btn btn-ghost" onClick={() => startMode("manual")} data-testid="mode-manual">Step by step</button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="chip">{mode === "follow_me" ? "Follow me — listening" : mode === "play_with_band" ? "Playing with the band — listening" : "Step by step — not listening"}</span>
            {mode === "manual" && (
              <>
                <button className="btn btn-quiet btn-sm" onClick={() => manualStep(-1)} disabled={index <= range.from}>Back</button>
                <button className="btn btn-primary btn-sm" onClick={() => manualStep(1)} data-testid="manual-next">{index >= range.to ? "Finish" : "Next note"}</button>
              </>
            )}
            {mode === "follow_me" && <button className="btn btn-quiet btn-sm" onClick={() => advance()}>Skip this note</button>}
            {cur && <button className="btn btn-quiet btn-sm" onClick={() => getEngine().preview(cur.midi, part, 3.5, part === "lead" ? articulation(cur, notes[index - 1]) : undefined, cur.string)}>Hear it</button>}
            <button className="btn btn-ghost btn-sm" onClick={endMode}>Stop</button>
          </div>
        )}
        <p className="mt-2 text-xs text-muted leading-relaxed">
          Follow me waits for each note. With the band checks pitch and timing. The mic hears the note — follow the fretboard for string and finger.
        </p>
        {mic.error && (
          <div className="mt-2 grid gap-2">
            <Notice tone="error">{mic.error.message}</Notice>
            <button className="btn btn-ghost btn-sm justify-self-start" onClick={() => startMode("manual")}>Practise step by step without the microphone</button>
          </div>
        )}
        {mic.state === "on" && (
          <div className="mt-2 flex items-center gap-3 text-xs text-muted">
            Input level
            <div className="h-1.5 flex-1 rounded-full bg-tolex" aria-hidden>
              <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${Math.min(100, mic.level * 400)}%` }} />
            </div>
          </div>
        )}
        {summary && (
          <div className="mt-3 rounded-2xl bg-panel-2 p-3" data-testid="summary">
            <p className="text-sm font-semibold">
              {summary.correct} of {summary.total} notes right{mode === null && summary.timing != null ? `, about ${summary.timing} ms from the beat on average` : ""}.
            </p>
            {!summary.saved && <p className="mt-1 text-xs text-next">Saved on this device only — the server couldn&apos;t be reached.</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.recs.map((r) => (
                <button key={r.kind} className="btn btn-quiet btn-sm" onClick={() => applyRec(r)}>{r.message}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      <TheoryPanel arr={arr} current={cur} part={part} />

      {buildingChordsLesson && (
        <details className="mt-6 surface p-4 md:p-6" data-testid="building-chords-lesson">
          <summary className="cursor-pointer text-lg font-bold">{buildingChordsLesson.title}</summary>
          <p className="mt-1 text-sm text-muted">How the band&apos;s chords are chosen from your tune — recipes, fit, and power chords.</p>
          <div className="mt-4">
            <LessonContent lesson={buildingChordsLesson} />
          </div>
        </details>
      )}

      <section className="mt-6 surface p-4 md:p-6">
        <h2 className="text-lg font-bold">The band&apos;s chords</h2>
        <p className="text-sm text-muted mt-1">You don&apos;t need to play these yet — the backing guitar does. They&apos;re here for when you&apos;re curious.</p>
        <div className="mt-4 flex flex-wrap gap-4">
          {uniqueChords.map((c) => (
            <div key={c.symbol} className="text-center">
              <ChordDiagram name={c.symbol} diagram={arr.harmonization.use_power_chords ? c.power_diagram : c.diagram} />
              <p className="text-xs text-muted max-w-[8rem]">{c.function}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="font-semibold">See the scale on the neck</h3>
          <p className="mt-1 text-sm text-muted">
            Open the fretboard map in {arr.key.name} to find every scale note and related chord shapes.
          </p>
          <button type="button" className="btn btn-primary btn-sm mt-3" data-testid="learn-fretmap-chords" onClick={() => setFretmapOpen(true)}>
            Open fretboard map
          </button>
        </div>
      </section>

      <ScaleFretmapFloat
        open={fretmapOpen}
        onOpenChange={setFretmapOpen}
        initialRoot={fretmapRoot}
        initialMode={fretmapMode}
      />
    </div>
  );
}
