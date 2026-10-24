"use client";

import type { TheoryVisual } from "@/lib/theory/content";

type GridVis = Extract<TheoryVisual, { type: "grid" }>;

export function GridVisual({ visual, lane = "time" }: { visual: GridVis; lane?: string }) {
  const cols = visual.cols;
  return (
    <div className="theory-visual overflow-x-auto" data-lane={lane}>
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `4.5rem repeat(${cols}, minmax(1.1rem, 1.4rem))` }}>
        {visual.rows.map((row, ri) => (
          <div key={ri} className="contents">
            <span className="truncate self-center text-[0.65rem] text-muted">{row.name}</span>
            {row.cells.map((c, ci) => {
              const v = c.velocity ?? (c.hit ? 0.8 : 0);
              const bg = c.hit
                ? `color-mix(in srgb, var(--lane-${lane}) ${Math.round(25 + 75 * v)}%, transparent)`
                : ci % visual.stepsPerBeat === 0
                  ? "var(--color-panel)"
                  : "transparent";
              return (
                <div key={ci} className="relative flex h-7 items-center justify-center">
                  {ci > 0 && ci % visual.stepsPerBar === 0 && (
                    <span className="absolute -left-0.5 top-0 h-full w-px bg-line" />
                  )}
                  <span
                    data-hl={c.highlight ?? `g${ri}_${ci}`}
                    className={`theory-cell block h-5 w-full rounded-sm ${c.hit ? "ring-1 ring-line/40" : ""}`}
                    style={{ background: bg }}
                  />
                  {c.tie && (
                    <span
                      data-hl={c.highlight ?? `g${ri}_${ci}`}
                      className="theory-cell absolute inset-y-2 -right-1 left-1/2 bg-maple/40"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <span className="text-[0.6rem] text-faint"> </span>
        {Array.from({ length: cols }, (_, i) => {
          const beat = Math.floor(i / visual.stepsPerBeat) + 1;
          const show = i % visual.stepsPerBeat === 0;
          return (
            <span key={i} className="text-center text-[0.6rem] text-faint">
              {show ? beat : "+"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
