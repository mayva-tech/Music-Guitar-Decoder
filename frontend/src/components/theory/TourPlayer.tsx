"use client";

import { useEffect, useRef, useState } from "react";
import { ALL_TERMS, LANE_LABEL, TOUR, type TheoryVisual } from "@/lib/theory/content";
import { getTheoryPlayer } from "@/lib/theory/player";
import { cancelEnglishSpeech, speakEnglish } from "@/lib/tts/speakEnglish";
import { useApp } from "@/lib/store";
import { TheoryVisualStage } from "./TheoryVisualStage";
import { clearHighlights, setHighlight } from "./highlight";

export function TourPlayer({
  tourIndex,
  tourPlaying,
  onIndex,
  onPlaying,
  onSelectTerm,
  stageRef,
}: {
  tourIndex: number;
  tourPlaying: boolean;
  onIndex: (i: number) => void;
  onPlaying: (p: boolean) => void;
  onSelectTerm: (id: string | null) => void;
  stageRef: React.RefObject<HTMLElement | null>;
}) {
  const autoRead = useApp((s) => s.prefs.autoReadAloud);
  const [started, setStarted] = useState(false);
  const [listen, setListen] = useState<string | null>(null);
  const [visual, setVisual] = useState<TheoryVisual | null>({ type: "overview" });
  const runToken = useRef(0);

  const step = TOUR[tourIndex] ?? TOUR[0]!;
  const term = step.termId ? ALL_TERMS[step.termId] : null;

  useEffect(() => () => {
    runToken.current += 1;
    cancelEnglishSpeech();
    getTheoryPlayer().stop();
    clearHighlights(stageRef.current);
  }, [stageRef]);

  useEffect(() => {
    if (!tourPlaying || !started) return;
    const token = ++runToken.current;
    let cancelled = false;
    const ac = new AbortController();

    const hl = (id: string, on: boolean) => setHighlight(stageRef.current, id, on);

    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    const speak = async (text: string) => {
      if (!autoRead) {
        await wait(Math.max(2400, text.length * 64));
        return;
      }
      // Safety cap if the browser stalls SpeechSynthesis without firing end/error.
      const estimate = Math.max(2400, text.length * 64);
      await Promise.race([
        speakEnglish(text, { signal: ac.signal }).catch(() => undefined),
        wait(estimate * 1.7 + 3000),
      ]);
    };

    (async () => {
      onSelectTerm(step.termId ?? null);
      const firstEx = step.examples[0];
      setVisual(firstEx?.visual ?? (tourIndex === 0 ? { type: "overview" } : term?.figure ?? { type: "overview" }));
      setListen(null);
      await speak(step.narration);
      if (cancelled || runToken.current !== token) return;
      await wait(300);
      if (cancelled || runToken.current !== token) return;

      for (const ex of step.examples) {
        if (cancelled || runToken.current !== token) return;
        setVisual(ex.visual);
        setListen(`Listen: ${ex.label}. ${ex.sub}`);
        await getTheoryPlayer().play(ex, hl);
        if (cancelled || runToken.current !== token) return;
        await wait(700);
      }

      if (cancelled || runToken.current !== token) return;
      if (tourIndex < TOUR.length - 1) onIndex(tourIndex + 1);
      else onPlaying(false);
    })();

    return () => {
      cancelled = true;
      ac.abort();
      cancelEnglishSpeech();
      getTheoryPlayer().stop();
    };
  }, [tourPlaying, tourIndex, started, autoRead]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = () => {
    runToken.current += 1;
    cancelEnglishSpeech();
    getTheoryPlayer().stop();
    onPlaying(false);
  };

  const play = () => {
    setStarted(true);
    onPlaying(true);
  };

  const jump = (i: number) => {
    const was = tourPlaying;
    pause();
    onIndex(Math.max(0, Math.min(TOUR.length - 1, i)));
    if (was || started) {
      setStarted(true);
      queueMicrotask(() => onPlaying(true));
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-panel-2/70 p-4" data-testid="theory-tour">
      {!started && (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-panel px-4 py-6">
          <p className="display text-xl">Guided tour</p>
          <p className="max-w-xl text-sm text-muted">
            About eight minutes. Each step explains a term, then plays a short example so you can hear what it means.
          </p>
          <button type="button" className="btn btn-primary" onClick={play} data-testid="theory-tour-start">
            Start tour
          </button>
        </div>
      )}

      {started && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip text-xs" style={{ color: `var(--lane-${step.lane})` }}>
              {step.eyebrow || LANE_LABEL[step.lane]}
            </span>
            <span className="text-xs text-muted" data-testid="theory-tour-step">
              Step {tourIndex + 1} of {TOUR.length}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
          <p className="mt-1 text-sm text-muted">{step.definition}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink" data-testid="theory-tour-narration">
            {step.narration}
          </p>
          {listen && <p className="mt-2 text-sm text-next">{listen}</p>}
          <div className="mt-4" ref={stageRef as React.RefObject<HTMLDivElement>}>
            <TheoryVisualStage visual={visual} lane={step.lane} />
          </div>

          <div className="mt-4 flex flex-wrap gap-1" role="tablist" aria-label="Tour progress">
            {TOUR.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`h-2 min-w-[8px] flex-1 rounded-full ${i === tourIndex ? "bg-maple" : i < tourIndex ? "bg-ok/70" : "bg-line"}`}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i === tourIndex ? "step" : undefined}
                onClick={() => jump(i)}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-quiet btn-sm" disabled={tourIndex <= 0} onClick={() => jump(tourIndex - 1)}>
              Previous
            </button>
            {tourPlaying ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={pause} data-testid="theory-tour-pause">
                Pause
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={play} data-testid="theory-tour-play">
                Play
              </button>
            )}
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              disabled={tourIndex >= TOUR.length - 1}
              onClick={() => jump(tourIndex + 1)}
              data-testid="theory-tour-next"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
