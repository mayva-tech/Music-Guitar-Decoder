"use client";

import { EAR_STEPS } from "@/lib/theory/ear";

export function StepStrip() {
  return (
    <nav aria-label="Method steps" className="flex flex-wrap gap-2" data-testid="ear-step-strip">
      {EAR_STEPS.map((s, i) => (
        <a
          key={s.id}
          href={`#step-${s.id}`}
          className="min-w-[130px] flex-1 rounded-xl border border-line bg-panel-2/70 px-3 py-2.5 no-underline transition-colors hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-maple"
          style={{ borderColor: `color-mix(in srgb, var(--lane-${s.lane}) 45%, var(--color-line))` }}
          data-testid={`ear-strip-${s.id}`}
        >
          <span className="font-mono text-[0.7rem] font-semibold" style={{ color: `var(--lane-${s.lane})` }}>
            Step {i + 1}
          </span>
          <span className="mt-0.5 block text-sm font-bold leading-snug text-ink">{s.title}</span>
        </a>
      ))}
    </nav>
  );
}
