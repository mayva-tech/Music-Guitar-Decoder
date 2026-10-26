"use client";

import { useState } from "react";
import type { EarStep } from "@/lib/theory/ear";
import type { TheoryExample, TheoryVisual } from "@/lib/theory/content";
import { ExampleButton } from "@/components/theory/ExampleButton";
import { TheoryVisualStage } from "@/components/theory/TheoryVisualStage";
import { KeyChart } from "./KeyChart";
import { TapTempo } from "./TapTempo";

export function MethodStep({
  step,
  index,
  playingLabel,
  onPlayExample,
}: {
  step: EarStep;
  index: number;
  playingLabel: string | null;
  onPlayExample: (key: string, ex: TheoryExample) => void;
}) {
  const [visual, setVisual] = useState<TheoryVisual | null>(step.examples[0]?.visual ?? null);
  const [caption, setCaption] = useState(
    step.examples[0] ? `${step.examples[0].label}. ${step.examples[0].sub}` : "",
  );

  return (
    <article
      id={`step-${step.id}`}
      className="scroll-mt-20 grid gap-4 rounded-2xl border border-line bg-panel/50 p-4 ear-method-row"
      data-testid={`ear-step-${step.id}`}
    >
      <div className="min-w-0">
        <p className="font-mono text-3xl font-bold tabular-nums" style={{ color: `var(--lane-${step.lane})` }}>
          {String(index + 1).padStart(2, "0")}
        </p>
        <h3 className="display mt-1 text-xl md:text-2xl">{step.title}</h3>
        <p className="mt-2 text-base leading-relaxed text-ink">{step.why}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {step.how.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {step.extra === "keyChart" ? <KeyChart /> : null}
        {step.extra === "tapTempo" ? <TapTempo /> : null}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="grid gap-2">
          {step.examples.map((ex, i) => {
            const key = `${step.id}:${i}`;
            return (
              <ExampleButton
                key={key}
                label={ex.label}
                sub={ex.sub}
                playing={playingLabel === key}
                onToggle={() => {
                  setVisual(ex.visual);
                  setCaption(`${ex.label}. ${ex.sub}`);
                  onPlayExample(key, ex);
                }}
              />
            );
          })}
        </div>
        <div className="rounded-xl bg-panel p-3">
          {caption ? <p className="mb-2 text-sm text-muted">{caption}</p> : null}
          <TheoryVisualStage visual={visual} lane={step.lane} />
        </div>
      </div>
    </article>
  );
}
