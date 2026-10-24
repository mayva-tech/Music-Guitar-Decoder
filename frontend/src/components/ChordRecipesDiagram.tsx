"use client";

import { CHORD_RECIPES, CHROMATIC_FROM_C } from "@/lib/music/chordRecipes";

const CELL = 36;
const LABEL_W = 168;
const PAD_X = 8;
const PAD_Y = 10;
const HEADER_H = 28;
const ROW_H = 44;
const FOOTER_H = 36;

/** Chromatic “Building Chords” grid: major / minor / power / seventh recipes from a root. */
export function ChordRecipesDiagram({ className }: { className?: string }) {
  const gridW = CHROMATIC_FROM_C.length * CELL;
  const width = PAD_X * 2 + LABEL_W + gridW;
  const height = PAD_Y * 2 + HEADER_H + CHORD_RECIPES.length * ROW_H + FOOTER_H;

  return (
    <figure className={className} data-testid="chord-recipes-diagram">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Building chords: major, minor, power and seventh recipes on a chromatic fret grid from C"
        className="max-w-full overflow-hidden rounded-2xl bg-tolex"
      >
        <title>Building Chords</title>
        <text x={PAD_X + 4} y={PAD_Y + 16} fontSize="15" fontWeight="800" fill="var(--color-ink)">Building Chords</text>

        {CHROMATIC_FROM_C.map((n, i) => (
          <text
            key={`h-${i}`}
            x={PAD_X + LABEL_W + i * CELL + CELL / 2}
            y={PAD_Y + HEADER_H - 6}
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="var(--color-muted)"
            data-testid={i === 0 ? "chord-recipes-note-c" : undefined}
          >
            {n}
          </text>
        ))}

        {CHORD_RECIPES.map((row, ri) => {
          const y0 = PAD_Y + HEADER_H + ri * ROW_H;
          const cy = y0 + ROW_H / 2;
          return (
            <g key={row.symbol} data-testid={`chord-recipe-${row.symbol.toLowerCase()}`}>
              <text x={PAD_X + 4} y={cy - 6} fontSize="13" fontWeight="800" fill="var(--color-ink)">
                {row.name} ({row.symbol})
              </text>
              <text x={PAD_X + 4} y={cy + 10} fontSize="11" fill="var(--color-muted)">{row.recipe}</text>

              {CHROMATIC_FROM_C.map((_, i) => {
                const tone = row.tones.find((t) => t.step === i);
                const x = PAD_X + LABEL_W + i * CELL + 3;
                const y = y0 + 6;
                const w = CELL - 6;
                const h = ROW_H - 12;
                if (!tone) {
                  return (
                    <rect key={i} x={x} y={y} width={w} height={h} rx="7"
                      fill="transparent" stroke="var(--color-line)" strokeWidth="1.2" opacity="0.55" />
                  );
                }
                const fill = tone.kind === "third" ? "var(--color-next)" : "var(--color-ok)";
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} data-tone={tone.label} />
                    <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="central"
                      fontSize="13" fontWeight="800" fill="var(--color-tolex)">{tone.label}</text>
                  </g>
                );
              })}
            </g>
          );
        })}

        <g transform={`translate(${PAD_X + 4}, ${height - FOOTER_H + 8})`}>
          <rect width="14" height="14" rx="3" fill="var(--color-ok)" />
          <text x="20" y="11" fontSize="11" fill="var(--color-muted)">Root, 5th, 7th</text>
          <rect x="130" width="14" height="14" rx="3" fill="var(--color-next)" />
          <text x="150" y="11" fontSize="11" fill="var(--color-muted)">The 3rd: decides happy or sad</text>
          <text x={width - PAD_X * 2 - 8} y="11" textAnchor="end" fontSize="11" fill="var(--color-faint)">1 box = 1 fret</text>
        </g>
      </svg>
    </figure>
  );
}
