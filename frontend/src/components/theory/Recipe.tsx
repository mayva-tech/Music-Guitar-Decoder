"use client";

import { MINI_SONG, RECIPE } from "@/lib/theory/content";
import { ExampleButton } from "./ExampleButton";
import { TheoryVisualStage } from "./TheoryVisualStage";

export function Recipe({
  playingMini,
  onToggleMini,
}: {
  playingMini: boolean;
  onToggleMini: () => void;
}) {
  return (
    <section className="space-y-4" data-testid="theory-recipe">
      <h2 className="display text-xl">Six steps + mini song</h2>
      <p className="text-sm text-muted">A short recipe for writing a guitar part, then a nine-bar demo.</p>
      <ol className="grid gap-3 sm:grid-cols-2">
        {RECIPE.map((step, i) => (
          <li key={i} className="rounded-2xl border border-line bg-panel/40 p-3">
            <p className="text-[0.65rem] uppercase tracking-wide text-muted">Step {i + 1}</p>
            <p className="mt-1 font-bold">{step.title}</p>
            <p className="mt-1 text-sm text-muted">{step.example}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {step.terms.map((t) => (
                <span key={t} className="chip text-[0.65rem]">{t}</span>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="rounded-2xl border border-line bg-panel-2/60 p-4">
        <ExampleButton
          label={MINI_SONG.label}
          sub={MINI_SONG.sub}
          playing={playingMini}
          onToggle={onToggleMini}
        />
        <div className="mt-3">
          <TheoryVisualStage visual={MINI_SONG.visual} lane="song" />
        </div>
      </div>
    </section>
  );
}
