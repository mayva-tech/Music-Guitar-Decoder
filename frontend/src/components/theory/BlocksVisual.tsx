"use client";

import type { TheoryVisual } from "@/lib/theory/content";

type BlocksVis = Extract<TheoryVisual, { type: "blocks" }>;

/** Dark fills so white labels stay readable (never pale yellow). */
const FORM: Record<string, string> = {
  "s-intro": "color-mix(in srgb, var(--lane-song) 42%, #0e0e0e)",
  "s-verse": "color-mix(in srgb, var(--lane-chords) 48%, #0e0e0e)",
  "s-chorus": "color-mix(in srgb, var(--lane-colour) 48%, #0e0e0e)",
  "s-bridge": "color-mix(in srgb, var(--lane-pitch) 48%, #0e0e0e)",
  sect: "transparent",
};

const ROW_FILL: Record<string, string> = {
  drums: "color-mix(in srgb, var(--lane-time) 38%, #101010)",
  bass: "color-mix(in srgb, var(--lane-chords) 42%, #101010)",
  chords: "color-mix(in srgb, var(--lane-pitch) 42%, #101010)",
  melody: "color-mix(in srgb, var(--lane-colour) 42%, #101010)",
  section: "color-mix(in srgb, var(--lane-song) 40%, #101010)",
};

function rowFill(name: string): string {
  const key = name.trim().toLowerCase();
  return ROW_FILL[key] ?? "color-mix(in srgb, var(--lane-pitch) 40%, #101010)";
}

export function BlocksVisual({ visual }: { visual: BlocksVis }) {
  const wide = visual.lengthBeats > 24;
  return (
    <div className={`theory-visual space-y-2 ${wide ? "min-w-[600px] overflow-x-auto" : ""}`}>
      {visual.rows.map((row, ri) => (
        <div key={ri}>
          <div className="mb-0.5 text-[0.65rem] text-muted">{row.name}</div>
          <div className="relative h-9 rounded-md bg-panel">
            {row.items.map((it, ii) => {
              const left = (it.beat / visual.lengthBeats) * 100;
              const width = (it.beats / visual.lengthBeats) * 100;
              const dashed = it.variant === "sect";
              const bg = FORM[it.variant ?? ""] ?? rowFill(row.name);
              return (
                <div
                  key={ii}
                  data-hl={it.highlight ?? `b_${ii}`}
                  className={`theory-block absolute top-1 bottom-1 flex flex-col justify-center overflow-hidden rounded px-1.5 text-white ${
                    dashed ? "border border-dashed border-line text-muted" : ""
                  }`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%`, background: dashed ? "transparent" : bg }}
                >
                  <span className="truncate text-[0.7rem] font-bold leading-tight tracking-wide">{it.label}</span>
                  {it.sub ? <span className="truncate font-mono text-[0.58rem] text-white/85">{it.sub}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
