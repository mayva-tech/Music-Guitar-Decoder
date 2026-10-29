"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EarFretNeck, type NeckMark } from "@/components/ear/EarFretNeck";
import { IconMic, IconPlay, IconStop } from "@/components/Icons";
import { getEngine } from "@/lib/audio/engine";
import { shapeToStrumSound } from "@/lib/audio/strumChord";
import { useMicPitch, type LiveFrame } from "@/lib/audio/useMicPitch";
import { useApp } from "@/lib/store";
import { noteName } from "@/lib/theory/content";
import {
  FINGER_WORD, NoteFollower, PLAY_SONGS, STRING_WORD, inChord, midiOf, moveHint, moveSound, playAlongExample, shapeSteps,
} from "@/lib/theory/earPlayAlong";
import { getTheoryPlayer } from "@/lib/theory/player";

export type TrainerMode = "follow" | "chords" | "ear";
const MODES: { id: TrainerMode; label: string; sub: string }[] = [
  { id: "follow", label: "Follow the notes", sub: "Pick the glowing note" },
  { id: "chords", label: "Strum the chords", sub: "Copy each shape" },
  { id: "ear", label: "Find it by ear", sub: "Notes are hidden" },
];
const SPEEDS = [0.6, 0.8, 1];
type Feedback = { tone: "ok" | "bad" | "info"; text: string } | null;

/**
 * Interactive play-along on a real neck: the chord shape for the current chord, the note to pick next,
 * tap-or-play to advance, a band to play along with, and a hidden-note mode for finding the tune by ear.
 */
export function FretTrainer({ songId, onSongChange }: { songId: string; onSongChange: (id: string) => void }) {
  const song = PLAY_SONGS.find((s) => s.id === songId) ?? PLAY_SONGS[0]!;
  const prefs = useApp((s) => s.prefs);
  const [mode, setMode] = useState<TrainerMode>("follow");
  const [idx, setIdx] = useState(0);
  const [cIdx, setCIdx] = useState(0);
  const [auto, setAuto] = useState(false);
  const [count, setCount] = useState(0);
  const [speed, setSpeed] = useState(0.8);
  const [iPlay, setIPlay] = useState(false);
  const [showShape, setShowShape] = useState(true);
  const [marks, setMarks] = useState<NeckMark[]>([]);
  const [misses, setMisses] = useState(0);
  const [found, setFound] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [done, setDone] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const follower = useRef(new NoteFollower(prefs.clarityThreshold));

  const note = song.notes[Math.min(idx, song.notes.length - 1)]!;
  const prevNote = idx > 0 ? song.notes[idx - 1]! : null;
  const nextNote = song.notes[idx + 1] ?? null;
  const chord = mode === "chords" ? song.chords[cIdx] ?? null : song.chords[note.chord] ?? null;

  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const stopSound = useCallback(() => {
    runRef.current++;
    getTheoryPlayer().stop();
    setAuto(false);
    setCount(0);
  }, []);

  const resetPlace = useCallback(() => {
    clearTimer();
    setIdx(0); setCIdx(0); setMarks([]); setMisses(0); setFound(false); setFirstTry(0); setFeedback(null); setDone(false);
  }, []);

  // New song or mode: start from the top.
  useEffect(() => { stopSound(); resetPlace(); }, [songId, mode, stopSound, resetPlace]);
  useEffect(() => () => { clearTimer(); getTheoryPlayer().stop(); }, []);

  // The microphone listens for the current note.
  useEffect(() => { follower.current.setTarget(note.midi, prevNote?.midi ?? null); }, [note.midi, prevNote?.midi, idx]);

  // Keep the action in view when the neck scrolls sideways (phones).
  useEffect(() => {
    const box = scrollRef.current;
    const el = box?.querySelector('[data-testid="ef-target"], [data-testid="ef-shape"]');
    if (!box || !el) return;
    const c = box.getBoundingClientRect(), b = el.getBoundingClientRect();
    if (b.left < c.left + 24 || b.right > c.right - 24) {
      box.scrollTo({ left: box.scrollLeft + (b.left + b.width / 2) - (c.left + c.width / 2), behavior: "smooth" });
    }
  }, [idx, cIdx, mode, songId]);

  const preview = (midi: number, string: number) => { void getEngine().preview(midi, "melody", 1.6, undefined, string).catch(() => undefined); };

  const advance = useCallback(() => {
    setMarks([]); setMisses(0); setFound(false);
    setIdx((i) => {
      if (i + 1 >= song.notes.length) { setDone(true); return i; }
      return i + 1;
    });
  }, [song.notes.length]);

  /* ------------------------------------------------ answering (tap or mic) */

  const correct = useCallback((via: "tap" | "mic") => {
    if (mode === "follow") {
      setFeedback(via === "mic" ? { tone: "ok", text: `Heard ${note.name}. Next!` } : null);
      advance();
      return;
    }
    // Find by ear: reveal, then move on.
    setFound(true);
    if (misses === 0) setFirstTry((x) => x + 1);
    setMarks((m) => [...m.filter((x) => x.ok), { string: note.string, fret: note.fret, ok: true, label: note.name }]);
    setFeedback({ tone: "ok", text: `Yes, ${note.name}. ${prevNote ? moveHint(prevNote, note) : "That's the first note."}` });
    clearTimer();
    timer.current = setTimeout(advance, 900);
  }, [mode, note, prevNote, misses, advance]);

  const wrong = useCallback((midi: number, at?: { string: number; fret: number }) => {
    const higher = midi < note.midi;
    if (mode === "follow") {
      if (at) setMarks([{ ...at, ok: false, label: noteName(midi) }]);
      setFeedback({ tone: "bad", text: `That's ${noteName(midi)}. Look for the glowing dot: ${STRING_WORD[note.string]} string, ${note.fret === 0 ? "open" : `fret ${note.fret}`}.` });
      return;
    }
    const n = misses + 1;
    setMisses(n);
    if (at) setMarks((m) => [...m.slice(-3), { ...at, ok: false, label: noteName(midi) }]);
    setFeedback({ tone: "bad", text: n >= 2 ? `Not ${noteName(midi)}. Hint: ${moveHint(prevNote, note)}` : `Not ${noteName(midi)}: go ${higher ? "higher" : "lower"}.` });
  }, [mode, note, prevNote, misses]);

  const tap = (string: number, fret: number) => {
    const midi = midiOf(string, fret);
    preview(midi, string);
    if (auto || done) return;
    if (mode === "chords") {
      const inShape = chord?.shape.frets[6 - string] === fret;
      setFeedback({ tone: inShape ? "ok" : "info", text: inShape ? `${noteName(midi)}: part of ${chord?.symbol}.` : `${noteName(midi)}: not in this shape.` });
      return;
    }
    if (mode === "ear" && found) return;
    if (midi === note.midi) correct("tap");
    else wrong(midi, { string, fret });
  };

  /* ------------------------------------------------ microphone */

  const onFrame = useCallback((f: LiveFrame) => {
    const name = f.midi == null ? null : noteName(Math.round(f.midi));
    setHeard((h) => (h === name ? h : name));
    if (auto || done || mode === "chords" || (mode === "ear" && found)) return;
    const ev = follower.current.push(f);
    if (!ev) return;
    if (ev.kind === "hit") correct("mic");
    else if (ev.kind === "octave") setFeedback({ tone: "info", text: `Right note (${noteName(ev.heard)}), other octave. Try the ${STRING_WORD[note.string]} string.` });
    else wrong(ev.heard);
  }, [auto, done, mode, found, correct, wrong, note.string]);
  const mic = useMicPitch({ a4: prefs.a4, noiseGate: prefs.noiseGate, clarityThreshold: prefs.clarityThreshold }, onFrame);
  const micOn = mic.state === "on" || mic.state === "starting";

  /* ------------------------------------------------ sound */

  const playAlong = async () => {
    if (auto) { stopSound(); return; }
    clearTimer();
    setDone(false); setMarks([]); setFeedback(null);
    const fromBar = mode === "chords" ? chord?.bar ?? 0 : note.bar;
    const ex = playAlongExample(song, {
      speed, fromBar,
      melody: !(iPlay && mode === "follow"),
      chords: !(iPlay && mode === "chords"),
    });
    const run = ++runRef.current;
    setAuto(true);
    await getTheoryPlayer().play(ex, (id, on) => {
      if (!on) return;
      const m = /^ef-(n|c|count)-(\d+)$/.exec(id);
      if (!m) return;
      const k = Number(m[2]);
      if (m[1] === "n") { setCount(0); setIdx(k); }
      else if (m[1] === "c") setCIdx(k);
      else setCount(k + 1);
    });
    if (runRef.current === run) { setAuto(false); setCount(0); }
  };

  const hearIt = () => {
    stopSound();
    void getTheoryPlayer().play(moveSound(prevNote?.midi ?? null, note.midi), () => undefined);
  };
  const strum = () => {
    if (!chord) return;
    stopSound();
    void getTheoryPlayer().play(shapeToStrumSound(chord.shape, 96), () => undefined);
  };
  const showMe = () => {
    if (found) return;
    setMisses((x) => x + 1); // no first-try point
    setFound(true);
    setMarks([{ string: note.string, fret: note.fret, ok: true, label: note.name }]);
    setFeedback({ tone: "info", text: `It was ${note.name}: ${STRING_WORD[note.string]} string, ${note.fret === 0 ? "open" : `fret ${note.fret}`}. ${moveHint(prevNote, note)}` });
    preview(note.midi, note.string);
    clearTimer();
    timer.current = setTimeout(advance, 1600);
  };
  const jump = (i: number) => { stopSound(); clearTimer(); setDone(false); setMarks([]); setMisses(0); setFound(false); setFeedback(null); setIdx(i); };
  const nextChord = () => { setFeedback(null); if (cIdx + 1 >= song.chords.length) setDone(true); else setCIdx(cIdx + 1); };
  const restart = () => { stopSound(); resetPlace(); };

  /* ------------------------------------------------ what the neck shows */

  const hidden = mode === "ear" && !found;
  const neck = {
    shape: mode === "chords" ? chord?.shape ?? null : showShape ? chord?.shape ?? null : null,
    shapeStyle: mode === "chords" ? "full" as const : "ghost" as const,
    target: mode === "chords" || hidden || done ? null : { string: note.string, fret: note.fret, finger: note.finger, label: note.name },
    next: mode === "follow" && nextNote && !done ? { string: nextNote.string, fret: nextNote.fret } : null,
    prev: mode !== "chords" && prevNote && !done ? { string: prevNote.string, fret: prevNote.fret } : null,
    hand: mode === "chords" ? null : song.hand,
  };
  const fits = inChord(song, note);
  const chordsInBar = useMemo(() => song.bars.map((b) => song.chords.filter((c) => c.bar === b.index)), [song]);

  const btn = (on: boolean) => `rounded-full px-3 py-1.5 text-sm ${on ? "bg-ink text-tolex font-bold" : "text-muted hover:text-ink"}`;

  return (
    <div ref={rootRef} className="rounded-2xl border border-line bg-panel/50 p-4 md:p-5" data-testid="ef-trainer" data-mode={mode} data-song={song.id}
      data-index={idx} data-chord-index={cIdx} data-done={done || undefined}>
      {/* Song + mode */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Song</span>
          <select className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-ink" value={song.id} onChange={(e) => onSongChange(e.target.value)} data-testid="ef-song">
            {PLAY_SONGS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-1 rounded-full bg-panel-2 p-1" role="tablist" aria-label="How to practise">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={btn(mode === m.id)} title={m.sub}
              onClick={() => setMode(m.id)} data-testid={`ef-mode-${m.id}`}>{m.label}</button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">{song.meta} · {song.tip}</p>

      {/* What to do now */}
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" aria-live="polite">
        {done ? (
          <div data-testid="ef-done">
            <p className="display text-2xl">{mode === "chords" ? "All the chords — nice." : "You played the whole tune!"}</p>
            <p className="mt-1 text-sm text-muted">
              {mode === "ear" ? `Found ${firstTry} of ${song.notes.length} notes on the first try. ` : ""}
              {mode === "follow" ? "Now hide the notes and find them by ear, or play along with the band." : mode === "chords" ? "Play along with the band and switch shapes in time." : "Try it again tomorrow: the second time is always faster."}
            </p>
          </div>
        ) : mode === "chords" && chord ? (
          <div>
            <p className="text-sm text-muted">Chord {cIdx + 1} of {song.chords.length} · bar {chord.bar + 1} · {chord.beats} beats</p>
            <p className="mt-0.5"><span className="display text-3xl" data-testid="ef-chord-name">{chord.symbol}</span> <span className="text-muted">({chord.numeral})</span></p>
            <ul className="mt-2 space-y-0.5 text-sm" data-testid="ef-chord-steps">
              {shapeSteps(chord.shape).map((s) => <li key={s}>• {s}</li>)}
            </ul>
          </div>
        ) : mode === "ear" ? (
          <div>
            <p className="text-sm text-muted">Note {idx + 1} of {song.notes.length} · bar {note.bar + 1}{chord ? ` · over ${chord.symbol} (${chord.numeral})` : " · pickup"}</p>
            <p className="mt-0.5 display text-2xl">{found ? `It's ${note.name}` : "Find this note by ear"}</p>
            <p className="mt-1 text-sm text-muted">Press <strong className="text-ink">Hear it</strong>, sing it, then tap frets until one matches. Every tap plays its note.</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted">Note {idx + 1} of {song.notes.length} · bar {note.bar + 1}</p>
            <p className="mt-0.5">
              <span className="text-muted">Play </span><span className="display text-3xl" data-testid="ef-note-name">{note.name}</span>
              <span className="text-muted"> · {STRING_WORD[note.string]} string, {note.fret === 0 ? "open — no finger" : `fret ${note.fret}, ${FINGER_WORD[note.finger]} (${note.finger})`}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {chord ? <>Over <strong className="text-ink">{chord.symbol}</strong> ({chord.numeral}): {fits ? `${note.name} is in the chord, so it sounds settled.` : `${note.name} is a passing note between chord notes.`}</> : "Pickup note: the chords start on the next beat 1."}
              {nextNote && <> Next: <strong className="text-ink">{nextNote.name}</strong>.</>}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 md:justify-end">
          {mode === "ear" && !done && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={hearIt} data-testid="ef-hear"><IconPlay /> Hear it</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={showMe} disabled={found} data-testid="ef-show">Show me</button>
            </>
          )}
          {mode === "chords" && !done && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={strum} data-testid="ef-strum"><IconPlay /> Strum it</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={nextChord} data-testid="ef-next-chord">Next chord →</button>
            </>
          )}
          {mode === "follow" && !done && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => preview(note.midi, note.string)} data-testid="ef-hear-note"><IconPlay /> Hear {note.name}</button>
          )}
          {done && <button type="button" className="btn btn-primary btn-sm" onClick={restart} data-testid="ef-again">Again</button>}
        </div>
      </div>

      {feedback && !done && (
        <p className={`mt-2 text-sm font-bold ${feedback.tone === "ok" ? "text-ok" : feedback.tone === "bad" ? "text-bad" : "text-next"}`} data-testid="ef-feedback">{feedback.text}</p>
      )}

      {/* Neck */}
      <div ref={scrollRef} className="relative mt-3 overflow-x-auto rounded-xl bg-tolex p-2" data-testid="ef-neck-scroll">
        {count > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-next px-3 py-0.5 text-sm font-bold text-tolex" data-testid="ef-count">
            Count-in {count}
          </div>
        )}
        <EarFretNeck frets={12} shape={neck.shape} shapeStyle={neck.shapeStyle} target={neck.target} next={neck.next} prev={neck.prev}
          marks={marks} hand={neck.hand} onTap={tap} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {mode !== "chords" && <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-next" />Pick this note (number = finger)</li>}
        {mode === "follow" && <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-dashed border-next" />Next note</li>}
        <li className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${mode === "chords" ? "bg-maple" : "border-2 border-dashed border-maple"}`} />Chord shape{mode === "chords" ? " (number = finger)" : " under the tune"}</li>
        <li>Tap any fret to hear it.</li>
      </ul>

      {/* Transport */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mode !== "ear" && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void playAlong()} data-testid="ef-play">
            {auto ? <IconStop /> : <IconPlay />} {auto ? "Stop" : "Play along"}
          </button>
        )}
        {mode !== "ear" && (
          <div className="flex gap-1 rounded-full bg-panel-2 p-1" role="radiogroup" aria-label="Speed">
            {SPEEDS.map((s) => <button key={s} type="button" role="radio" aria-checked={speed === s} className={btn(speed === s)} onClick={() => setSpeed(s)}>{Math.round(s * 100)}%</button>)}
          </div>
        )}
        {mode !== "ear" && (
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input type="checkbox" checked={iPlay} onChange={(e) => setIPlay(e.target.checked)} data-testid="ef-iplay" />
            I&apos;ll play the {mode === "chords" ? "chords" : "melody"} (mute it)
          </label>
        )}
        {mode !== "chords" && (
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input type="checkbox" checked={showShape} onChange={(e) => setShowShape(e.target.checked)} data-testid="ef-show-shape" />
            Show chord shape
          </label>
        )}
        {mode !== "chords" && (
          <button type="button" className={`btn btn-sm ${micOn ? "btn-primary" : "btn-quiet"}`} onClick={() => (micOn ? mic.stop() : void mic.start())} data-testid="ef-mic"
            aria-pressed={micOn}>
            <IconMic /> {micOn ? "Listening" : "Listen to my guitar"}
          </button>
        )}
        {micOn && (
          <span className="flex items-center gap-2 text-xs text-muted" data-testid="ef-heard">
            <span className="h-2 w-16 overflow-hidden rounded-full bg-panel-2"><span className="block h-full bg-ok" style={{ width: `${Math.min(100, mic.level * 900)}%` }} /></span>
            Heard: <strong className="text-ink">{heard ?? "—"}</strong>
          </span>
        )}
        <button type="button" className="btn btn-quiet btn-sm ml-auto" onClick={restart} data-testid="ef-restart">Start over</button>
      </div>
      {mic.error && <p className="mt-2 text-sm text-bad">{mic.error.message}</p>}
      {mode === "ear" && <p className="mt-2 text-sm text-muted" data-testid="ef-score">Found on the first try: <strong className="text-ink">{firstTry}</strong> of {Math.min(idx + (found ? 1 : 0), song.notes.length)}</p>}

      {/* The whole song, bar by bar */}
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="ef-bars">
        {song.bars.map((b) => (
          <li key={b.index} className={`rounded-lg border p-2 ${(mode === "chords" ? chord?.bar : note.bar) === b.index ? "border-next" : "border-line"}`}>
            <div className="flex gap-1 text-xs font-bold">
              {chordsInBar[b.index]!.length ? chordsInBar[b.index]!.map((c) => (
                <button key={c.j} type="button" onClick={() => { stopSound(); setDone(false); setCIdx(c.j); if (mode !== "chords") jump(song.notes.find((n) => n.chord === c.j)?.i ?? idx); }}
                  className={`rounded px-1.5 py-0.5 ${mode === "chords" && c.j === cIdx ? "bg-next text-tolex" : "bg-panel-2 text-ink"}`} data-testid={`ef-chip-chord-${c.j}`}>
                  {c.symbol}
                </button>
              )) : <span className="px-1.5 py-0.5 text-faint">pickup</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {song.notes.filter((n) => n.bar === b.index).map((n) => {
                const cur = mode !== "chords" && n.i === idx && !done;
                const show = mode !== "ear" || n.i < idx || (n.i === idx && found) || done;
                return (
                  <button key={n.i} type="button" onClick={() => jump(n.i)} data-testid={`ef-chip-${n.i}`}
                    className={`min-w-[2.1rem] rounded px-1.5 py-0.5 text-center text-xs ${cur ? "bg-next font-bold text-tolex" : n.i < idx && mode !== "chords" ? "bg-panel-2 text-ok" : "bg-panel-2 text-muted"}`}>
                    {show ? n.name : "?"}
                    {show && mode === "follow" && <span className="block text-[0.6rem] opacity-70">{STRING_WORD[n.string]?.split(" ").pop()}{n.fret}</span>}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
