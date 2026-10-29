"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EarFretNeck, type NeckMark } from "@/components/ear/EarFretNeck";
import { IconMic, IconPlay, IconStop } from "@/components/Icons";
import { getEngine } from "@/lib/audio/engine";
import { articulation } from "@/lib/audio/timeline";
import { useMicPitch, type LiveFrame } from "@/lib/audio/useMicPitch";
import { howToPlay, lickSteps, type GreatLick } from "@/lib/music/greats";
import { useApp } from "@/lib/store";
import { noteName } from "@/lib/theory/content";
import { NoteFollower, midiOf } from "@/lib/theory/earPlayAlong";
import type { PlayableNote } from "@/lib/types";

const TECH_MARK: Partial<Record<NonNullable<PlayableNote["technique"]>, string>> = {
  bend: "bend ↑", bend_release: "bend ↑↓", hammer_on: "h", pull_off: "p", slide_up: "slide /", slide_down: "slide \\",
};

/** Previous note on the same string (slides and legato need it). */
function prevOnString(notes: PlayableNote[], i: number): PlayableNote | undefined {
  for (let k = i - 1; k >= 0; k--) if (notes[k]!.string === notes[i]!.string) return notes[k];
  return undefined;
}

/**
 * Step through a lick on a real neck: the notes to pick glow with the finger to use and the technique,
 * every fret can be tapped, and the microphone can follow your guitar.
 */
export function LickPicker({ item, colour, playing, onPlay, onClose }: {
  item: GreatLick;
  colour: string;
  playing: boolean;
  onPlay: (speed: number) => void;
  onClose: () => void;
}) {
  const { lick } = item;
  const notes = lick.notes;
  const steps = useMemo(() => lickSteps(notes), [notes]);
  const prefs = useApp((s) => s.prefs);
  const [step, setStep] = useState(0);
  const [hit, setHit] = useState<Set<number>>(new Set());
  const [marks, setMarks] = useState<NeckMark[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const follower = useRef(new NoteFollower(prefs.clarityThreshold));
  const frets = Math.max(12, Math.min(22, Math.max(...notes.map((n) => n.fret)) + 2));

  useEffect(() => { setStep(0); setHit(new Set()); setMarks([]); setFeedback(null); setDone(false); }, [lick.id]);

  const group = steps[Math.min(step, steps.length - 1)]!;
  const top = group.reduce((a, i) => (notes[i]!.midi > notes[a]!.midi ? i : a), group[0]!);
  const prevGroup = step > 0 ? steps[step - 1]! : null;
  const nextGroup = steps[step + 1] ?? null;

  useEffect(() => {
    const prevTop = prevGroup ? Math.max(...prevGroup.map((i) => notes[i]!.midi)) : null;
    follower.current.setTarget(notes[top]!.midi, prevTop);
  }, [top, prevGroup, notes]);

  const sound = (i: number) => {
    const n = notes[i]!;
    void getEngine().preview(n.midi, "lead", 1.4, articulation(n, prevOnString(notes, i)), n.string).catch(() => undefined);
  };

  const advance = useCallback(() => {
    setHit(new Set()); setMarks([]);
    setStep((s) => {
      if (s + 1 >= steps.length) { setDone(true); return s; }
      return s + 1;
    });
  }, [steps.length]);

  const tap = (string: number, fret: number) => {
    if (done) return;
    const i = group.find((k) => notes[k]!.string === string && notes[k]!.fret === fret);
    if (i == null) {
      const midi = midiOf(string, fret);
      void getEngine().preview(midi, "lead", 1.2, undefined, string).catch(() => undefined);
      const t = notes[top]!;
      setMarks([{ string, fret, ok: false, label: noteName(midi) }]);
      setFeedback({ ok: false, text: `That's ${noteName(midi)}. The glowing ${group.length > 1 ? "notes are" : "note is"} on the ${["", "high e", "B", "G", "D", "A", "low E"][t.string]} string, fret ${t.fret}.` });
      return;
    }
    sound(i);
    const now = new Set(hit).add(i);
    setHit(now);
    setFeedback(null);
    if (group.every((k) => now.has(k))) advance();
  };

  const onFrame = useCallback((f: LiveFrame) => {
    const name = f.midi == null ? null : noteName(Math.round(f.midi));
    setHeard((h) => (h === name ? h : name));
    if (done || playing) return;
    const ev = follower.current.push(f);
    if (!ev) return;
    if (ev.kind === "hit") { setFeedback({ ok: true, text: `Heard ${noteName(notes[top]!.midi)}. Next!` }); advance(); }
    else setFeedback({ ok: false, text: ev.kind === "octave" ? "Right note, other octave." : `Heard ${noteName(ev.heard)}. Go ${ev.heard < notes[top]!.midi ? "higher" : "lower"}.` });
  }, [done, playing, notes, top, advance]);
  const mic = useMicPitch({ a4: prefs.a4, noiseGate: prefs.noiseGate, clarityThreshold: prefs.clarityThreshold }, onFrame);
  const micOn = mic.state === "on" || mic.state === "starting";

  const spot = (i: number) => {
    const n = notes[i]!;
    const mark = n.technique ? TECH_MARK[n.technique] : n.vibrato ? "vib ~" : undefined;
    const tapped = item.taps?.includes(i);
    return { string: n.string, fret: n.fret, finger: tapped ? undefined : item.thumbs?.includes(i) ? 5 : n.finger ?? undefined, label: `${noteName(n.midi)}${tapped ? " tap" : mark ? ` ${mark}` : ""}` };
  };
  const pending = group.filter((i) => !hit.has(i));
  const target = done ? null : spot(pending.find((i) => i === top) ?? pending[0] ?? top);
  const extra = done ? [] : pending.filter((i) => notes[i]!.string !== target?.string || notes[i]!.fret !== target?.fret).map(spot);

  return (
    <div className="rounded-2xl border-2 p-4" style={{ borderColor: colour }} data-testid="greats-picker" data-lick={lick.id} data-step={step} data-done={done || undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Pick it, note by note</p>
          <h3 className="display text-xl">{lick.title}</h3>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onClose} data-testid="greats-picker-close">Close</button>
      </div>

      <div className="mt-2 min-h-[3.2rem]" aria-live="polite">
        {done ? (
          <p className="text-sm" data-testid="greats-picker-done"><strong>Got it.</strong> Now play it with the band, slow, then at full speed.</p>
        ) : (
          <>
            <p className="text-sm text-muted">Step {step + 1} of {steps.length}{group.length > 1 ? ` · ${group.length} notes together` : ""}</p>
            <p className="text-[1.05rem]" data-testid="greats-picker-how">{group.length > 1 ? `Pick these ${group.length} notes together. ` : ""}{howToPlay(notes, group.find((k) => item.hints?.[k]) ?? top, item)}</p>
          </>
        )}
        {feedback && !done && <p className={`mt-1 text-sm font-bold ${feedback.ok ? "text-ok" : "text-bad"}`} data-testid="greats-picker-feedback">{feedback.text}</p>}
      </div>

      <div className="mt-2 overflow-x-auto rounded-xl bg-tolex p-2">
        <EarFretNeck frets={frets} target={target} extraTargets={extra}
          next={!done && nextGroup ? { string: notes[nextGroup[0]!]!.string, fret: notes[nextGroup[0]!]!.fret } : null}
          prev={!done && prevGroup ? { string: notes[prevGroup[0]!]!.string, fret: notes[prevGroup[0]!]!.fret } : null}
          marks={marks} onTap={tap} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => group.forEach(sound)} disabled={done} data-testid="greats-picker-hear"><IconPlay /> Hear this step</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => (step > 0 ? (setStep(step - 1), setHit(new Set()), setDone(false)) : undefined)} disabled={step === 0}>← Back</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={advance} disabled={done} data-testid="greats-picker-skip">Skip →</button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setStep(0); setHit(new Set()); setMarks([]); setFeedback(null); setDone(false); }}>Start over</button>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <button type="button" className={`btn btn-sm ${playing ? "btn-primary" : "btn-quiet"}`} onClick={() => onPlay(0.7)} data-testid="greats-picker-slow">
          {playing ? <IconStop /> : <IconPlay />} {playing ? "Stop" : "Play slowly with band"}
        </button>
        <button type="button" className={`btn btn-sm ${micOn ? "btn-primary" : "btn-quiet"}`} onClick={() => (micOn ? mic.stop() : void mic.start())} aria-pressed={micOn} data-testid="greats-picker-mic">
          <IconMic /> {micOn ? "Listening" : "Listen to my guitar"}
        </button>
        {micOn && <span className="text-xs text-muted">Heard: <strong className="text-ink">{heard ?? "—"}</strong></span>}
      </div>
      {mic.error && <p className="mt-2 text-sm text-bad">{mic.error.message}</p>}

      <ol className="mt-3 flex flex-wrap gap-1" aria-label="Steps">
        {steps.map((g, k) => (
          <li key={k}>
            <button type="button" onClick={() => { setStep(k); setHit(new Set()); setMarks([]); setDone(false); }}
              className={`min-w-[2.2rem] rounded px-1.5 py-0.5 text-xs ${k === step && !done ? "bg-next font-bold text-tolex" : k < step || done ? "bg-panel-2 text-ok" : "bg-panel-2 text-muted"}`}
              data-testid={`greats-step-${k}`}>
              {g.map((i) => noteName(notes[i]!.midi)).join("+")}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
