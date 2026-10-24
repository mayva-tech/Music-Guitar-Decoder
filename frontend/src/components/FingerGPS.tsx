"use client";

import { TECHNIQUE_NAMES, fingerInstructions } from "@/lib/music/instructions";
import { degreeWords, isChordTone } from "@/lib/music/theory";
import { FINGER_NAMES, stringWords } from "@/lib/music/guitar";
import type { PlayableNote } from "@/lib/types";

interface Props {
  current: PlayableNote | null;
  next: PlayableNote | null;
  chord: string;
  bar: number;
  beat: number;
  showText: boolean;
  seventh?: boolean;
  move?: string;
  /** Fixed-height layout; full Move/how-to live in the draggable ExplainFloat. */
  compact?: boolean;
}

export function FingerGPS({ current, next, chord, bar, beat, showText, seventh, move, compact }: Props) {
  if (!current) {
    if (!compact) return null;
    return <div className="h-[7.25rem]" data-testid="finger-gps" aria-hidden />;
  }
  const lines = fingerInstructions(current);
  const tech = current.technique
    ? `${TECHNIQUE_NAMES[current.technique]}${current.bend_semitones ? (current.bend_semitones === 2 ? " · full" : " · ½") : ""}`
    : current.vibrato
      ? "Vibrato"
      : "";
  const nextLabel = next
    ? `then ${next.name} (${next.fret === 0 ? "open" : `fret ${next.fret}`}, ${stringWords(next.string).replace("the ", "")})`
    : "";

  if (compact) {
    return (
      <div className="flex h-[7.25rem] min-w-0 flex-col gap-1.5 overflow-hidden" data-testid="finger-gps">
        <p className="shrink-0 text-xs text-muted">Play this note</p>
        <div className="flex min-h-[2.4rem] shrink-0 items-baseline gap-2 overflow-hidden">
          <span className="display shrink-0 text-[2rem] leading-none md:text-[2.25rem]" data-testid="current-note">{current.name}</span>
          {tech && (
            <span className="chip max-w-[9rem] truncate bg-next/15 text-next font-bold" data-testid="current-technique" title={tech}>
              {tech}
            </span>
          )}
          <span className="min-w-0 truncate text-sm text-next" data-testid="next-note" title={nextLabel}>
            {nextLabel || "\u00a0"}
          </span>
        </div>
        {/* One-line peek; full text is in the draggable tip so panels stay fixed height */}
        <p className="h-5 shrink-0 truncate text-xs text-muted" data-testid="finger-change" title={move}>
          {move ? <>Move: {move}</> : "\u00a0"}
        </p>
        <dl className="mt-auto grid shrink-0 grid-cols-4 gap-1.5 text-center">
          {[
            ["Chord", chord || "—"],
            ["Bar", String(bar)],
            ["Beat", String(beat)],
            ["Finger", current.fret === 0 ? "O" : String(current.finger)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-tolex px-1.5 py-1.5" title={k === "Finger" ? FINGER_NAMES[current.finger] : undefined}>
              <dt className="text-[0.65rem] text-muted">{k}</dt>
              <dd className="display truncate text-base" data-testid={`gps-${k.toLowerCase()}`}>{v}</dd>
            </div>
          ))}
        </dl>
        {/* Keep test hooks for degree/instructions when compact — content is in ExplainFloat */}
        <span className="sr-only" data-testid="degree">
          {current.chord_degree && chord
            ? `${degreeWords(current.chord_degree)} of ${chord.replace(/5$/, "")}`
            : ""}
        </span>
        {showText && (
          <span className="sr-only" data-testid="instructions">{lines.join(" ")}</span>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" data-testid="finger-gps">
      <div className="min-w-0">
        <p className="text-xs text-muted">Play this note</p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="display text-[3.2rem] leading-none md:text-[4rem]" data-testid="current-note">{current.name}</span>
          {(current.technique || current.vibrato) && (
            <span className="chip bg-next/15 text-next font-bold" data-testid="current-technique">
              {current.technique ? TECHNIQUE_NAMES[current.technique] : "Vibrato"}
              {current.bend_semitones ? (current.bend_semitones === 2 ? " · full step" : " · half step") : ""}
            </span>
          )}
          {next && (
            <span className="text-lg text-next" data-testid="next-note">
              then {next.name} <span className="text-xs text-muted">({next.fret === 0 ? "open" : `fret ${next.fret}`}, {stringWords(next.string).replace("the ", "")})</span>
            </span>
          )}
        </div>
        {move && (
          <p className="mt-2 rounded-lg bg-tolex/70 px-2.5 py-1 text-[0.95rem]" data-testid="finger-change">
            <span className="text-muted">Move: </span>{move}
          </p>
        )}
        {current.chord_degree && chord && (
          <p className="mt-2 text-sm text-muted" data-testid="degree">
            The {degreeWords(current.chord_degree)} of the {chord.replace(/5$/, "")} chord
            {isChordTone(current.chord_degree, seventh) ? " — a chord note, so it blends with the band." : " — a colour note between chord notes."}
          </p>
        )}
        {showText && (
          <ol className="mt-3 grid gap-0.5 text-[1.08rem] leading-snug" aria-live="polite" data-testid="instructions">
            {lines.map((l) => <li key={l}>{l}</li>)}
          </ol>
        )}
      </div>
      <dl className="grid grid-cols-4 gap-1.5 text-center md:w-[22rem]">
        {[
          ["Chord", chord || "—"],
          ["Bar", String(bar)],
          ["Beat", String(beat)],
          ["Finger", current.fret === 0 ? "O" : String(current.finger)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-tolex px-2 py-2.5" title={k === "Finger" ? FINGER_NAMES[current.finger] : undefined}>
            <dt className="text-[0.65rem] text-muted">{k}</dt>
            <dd className="display text-xl" data-testid={`gps-${k.toLowerCase()}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
