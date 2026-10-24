"use client";

import { useApp } from "@/lib/store";
import type { TheoryVisual } from "@/lib/theory/content";

type FretVis = Extract<TheoryVisual, { type: "fret" }>;

const ROLE_FILL: Record<string, string> = {
  root: "var(--theory-highlight)",
  third: "#e07a3a",
  seventh: "#8b6cc7",
  blue: "#6a8fd8",
  "": "transparent",
};

/** Compact TAB-order fret diagram with data-hl dots for synced lighting. */
export function FretVisual({ visual }: { visual: FretVis }) {
  const handedness = useApp((s) => s.prefs.handedness);
  const from = visual.fromFret ?? 0;
  const to = Math.max(visual.toFret ?? 5, from + 4);
  const frets = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const strings = handedness === "left" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6];
  // Display high E on top (TAB): string 1 at top of SVG.
  const rows = strings;
  const muted = new Set(visual.muted ?? []);
  const w = 280;
  const h = 150;
  const left = 36;
  const top = 18;
  const gapX = (w - left - 16) / Math.max(1, frets.length - 1 || 1);
  const gapY = 20;

  return (
    <div className="theory-visual overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Fretboard example">
        {rows.map((s, si) => {
          const y = top + si * gapY;
          return (
            <g key={s}>
              <text x={10} y={y + 4} fontSize="10" fill="var(--color-muted)">
                {["e", "B", "G", "D", "A", "E"][s - 1]}
              </text>
              <line x1={left} x2={w - 12} y1={y} y2={y} stroke="var(--color-nickel)" strokeWidth={1 + (6 - s) * 0.15} />
              {muted.has(s as 1 | 2 | 3 | 4 | 5 | 6) && (
                <text x={left - 10} y={y + 4} textAnchor="middle" fontSize="12" fill="var(--color-muted)">×</text>
              )}
            </g>
          );
        })}
        {frets.map((f, fi) => {
          const x = left + fi * gapX;
          return (
            <g key={f}>
              <line x1={x} x2={x} y1={top} y2={top + 5 * gapY} stroke={f === 0 ? "var(--color-maple)" : "var(--color-faint)"} strokeWidth={f === 0 ? 4 : 1} />
              {[3, 5, 7, 9, 12].includes(f) && f > 0 && (
                <circle cx={x - gapX / 2} cy={top + 2.5 * gapY} r={3} fill="var(--color-maple)" opacity="0.35" />
              )}
              <text x={x - (f === 0 ? 0 : gapX / 2)} y={h - 6} textAnchor="middle" fontSize="9" fill="var(--color-faint)">
                {f === 0 ? "0" : String(f)}
              </text>
            </g>
          );
        })}
        {visual.dots.map((d, i) => {
          const si = rows.indexOf(d.string);
          const fi = frets.indexOf(d.fret);
          if (si < 0 || fi < 0) return null;
          const x = d.fret === 0 ? left : left + fi * gapX - gapX / 2;
          const y = top + si * gapY;
          const fill = ROLE_FILL[d.role] || "var(--color-maple)";
          const outlined = !d.role;
          return (
            <g key={i} data-hl={`d${i}`} className="theory-dot">
              <circle
                cx={x}
                cy={y}
                r={9}
                fill={outlined ? "var(--color-panel-2)" : fill}
                stroke={outlined ? "var(--color-maple)" : fill}
                strokeWidth={outlined ? 1.5 : 0}
              />
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--color-tolex)">
                {d.label ?? d.name}
              </text>
            </g>
          );
        })}
      </svg>
      {visual.legend && (
        <p className="mt-1 text-[0.65rem] text-muted">
          {visual.legend === "chord" && "Filled = root · orange = third · purple = seventh"}
          {visual.legend === "blue" && "Purple marks the blue note"}
          {visual.legend === "default" && "Dots show the notes in this example"}
        </p>
      )}
    </div>
  );
}
