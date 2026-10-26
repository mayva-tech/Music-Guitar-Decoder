"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Drill as DrillData, DrillQuestion, Rng, Sound } from "@/lib/theory/ear";
import { ExampleButton } from "@/components/theory/ExampleButton";

/** Pure helpers — unit-tested without a DOM. */
export function scoreAfterAnswer(right: number, total: number, correct: boolean) {
  return { right: right + (correct ? 1 : 0), total: total + 1 };
}

export function freshQuestion(drill: DrillData, rng?: Rng): DrillQuestion {
  return drill.generate(rng);
}

export function Drill({
  drill,
  playingLabel,
  onPlaySound,
  onStop,
  rng,
}: {
  drill: DrillData;
  playingLabel: string | null;
  onPlaySound: (key: string, sound: Sound) => void;
  onStop: () => void;
  rng?: Rng;
}) {
  // Defer random generation until after mount so SSR HTML matches the first client paint.
  const [question, setQuestion] = useState<DrillQuestion | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setQuestion(freshQuestion(drill, rng));
    setPicked(null);
  }, [drill, rng]);

  const answered = picked != null;
  const correctIdx = question?.options.findIndex((o) => o.correct) ?? -1;

  const answer = (i: number) => {
    if (!question || answered) return;
    setPicked(i);
    const next = scoreAfterAnswer(right, total, question.options[i]?.correct === true);
    setRight(next.right);
    setTotal(next.total);
  };

  const newQuestion = () => {
    onStop();
    setQuestion(freshQuestion(drill, rng));
    setPicked(null);
  };

  return (
    <article
      className="flex flex-col gap-3 rounded-2xl border border-line bg-panel/50 p-4"
      data-testid={`ear-drill-${drill.id}`}
      style={{ borderColor: `color-mix(in srgb, var(--lane-${drill.lane}) 40%, var(--color-line))` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold" style={{ color: `var(--lane-${drill.lane})` }}>
          {drill.title}
        </h3>
        <p className="font-mono text-xs text-muted" data-testid={`ear-drill-score-${drill.id}`}>
          {right} of {total}
        </p>
      </div>
      <p className="text-sm text-muted">{drill.prompt}</p>

      {!question ? (
        <p className="text-sm text-muted">Loading question…</p>
      ) : (
        <>
          <div className="grid gap-2">
            {question.listen.map((l, i) => {
              const key = `drill:${drill.id}:listen:${i}`;
              return (
                <ExampleButton
                  key={key}
                  label={l.label}
                  sub={l.sub}
                  playing={playingLabel === key}
                  onToggle={() => onPlaySound(key, l.sound)}
                />
              );
            })}
          </div>

          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Answers">
            {question.options.map((opt, i) => {
              let style: CSSProperties | undefined;
              if (answered) {
                if (opt.correct) style = { background: "var(--lane-chords-bg)", color: "var(--lane-chords)", borderColor: "var(--lane-chords)" };
                else if (i === picked) style = { background: "var(--lane-time-bg)", color: "var(--lane-time)", borderColor: "var(--lane-time)" };
              }
              return (
                <button
                  key={opt.label}
                  type="button"
                  className="btn btn-quiet btn-sm justify-start text-left"
                  disabled={answered}
                  aria-pressed={picked === i}
                  data-testid={`ear-drill-option-${drill.id}-${i}`}
                  data-correct={opt.correct ? "true" : "false"}
                  style={style}
                  onClick={() => answer(i)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div aria-live="polite" className="min-h-[3rem] text-sm" data-testid={`ear-drill-feedback-${drill.id}`}>
            {answered ? (
              <>
                <p className="font-bold">
                  {picked === correctIdx ? "Correct." : "Not this time."}
                </p>
                <p className="mt-1 text-muted">{question.explanation}</p>
              </>
            ) : null}
          </div>
        </>
      )}

      <button
        type="button"
        className="btn btn-quiet btn-sm self-start"
        onClick={newQuestion}
        disabled={!question}
        data-testid={`ear-drill-new-${drill.id}`}
      >
        New question
      </button>
    </article>
  );
}
