"use client";

import { PRINCIPLES } from "@/lib/theory/content";
import { ExampleButton } from "./ExampleButton";

export function Principles({
  playingLabel,
  onPlayExample,
  onJumpTerm,
}: {
  playingLabel: string | null;
  onPlayExample: (termId: string, exampleIndex: number) => void;
  onJumpTerm: (id: string) => void;
}) {
  const list = Object.values(PRINCIPLES);
  return (
    <section className="space-y-4" data-testid="theory-principles">
      <h2 className="display text-xl">What makes it good</h2>
      <p className="text-sm text-muted">Five principles. Each one has an A/B listen-along.</p>
      {list.map((p, i) => (
        <article key={p.id} className="rounded-2xl border border-line bg-panel/50 p-4">
          <p className="text-[0.65rem] uppercase tracking-wide text-muted">Principle {i + 1} of {list.length}</p>
          <h3 className="mt-1 text-lg font-bold">{p.name}</h3>
          <p className="mt-1 text-sm text-muted">{p.short}</p>
          <p className="mt-2 text-sm leading-relaxed">{p.body}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {p.examples.map((ex, ei) => (
              <ExampleButton
                key={ei}
                label={ex.label}
                sub={ex.sub}
                playing={playingLabel === `${p.id}:${ei}`}
                onToggle={() => onPlayExample(p.id, ei)}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[0.65rem] text-muted">Uses</span>
            {p.relates.map((id) => (
              <button key={id} type="button" className="chip text-xs" onClick={() => onJumpTerm(id)}>
                {id}
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
