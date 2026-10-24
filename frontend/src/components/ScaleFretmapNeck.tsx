"use client";

import { useId, useMemo } from "react";
import { MAX_FRET } from "@/lib/music/guitar";
import { computeLayout } from "@/lib/music/fretboardLayout";
import { noteMarkerColors, type FretmapCell } from "@/lib/music/scaleFretmap";
import type { ChordShape } from "@/lib/music/chordShapes";
import { shapeToHighlights } from "@/lib/music/chordShapes";

interface Props {
  cells: FretmapCell[];
  /** Prefer equal spacing so the long neck stays readable when scrolled. */
  equalSpacing?: boolean;
  /** When set, finger placement for this shape is highlighted on the neck. */
  chordShape?: ChordShape | null;
}

/**
 * Real guitar neck with scale notes as solid colored circles.
 * Optional chordShape overlays finger numbers for placement practice.
 */
export function ScaleFretmapNeck({ cells, equalSpacing = true, chordShape = null }: Props) {
  const uid = useId().replace(/:/g, "");
  const frets = MAX_FRET;
  const lay = useMemo(
    () => computeLayout({ handedness: "right", view: "beginner", frets, equalSpacing }),
    [equalSpacing, frets],
  );

  const scaleCells = cells.filter((c) => c.inScale && c.fret <= frets);
  const highlights = useMemo(
    () => (chordShape ? shapeToHighlights(chordShape) : []),
    [chordShape],
  );
  const placing = highlights.length > 0;

  return (
    <svg
      role="img"
      aria-label={placing ? "Guitar fretboard with chord finger placement" : "Guitar fretboard with scale notes highlighted"}
      viewBox={`0 0 ${lay.width} ${lay.height}`}
      width={lay.width}
      height={lay.height}
      className="block select-none"
      data-testid="scale-fretmap-board"
      data-nut-side={lay.nutSide}
      data-chord-highlight={placing ? "true" : undefined}
    >
      <defs>
        <linearGradient id={`wood-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f3b28" />
          <stop offset="0.5" stopColor="#4a2e1f" />
          <stop offset="1" stopColor="#3d2519" />
        </linearGradient>
        <pattern id={`grain-${uid}`} width="140" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 3 C40 1 90 5 140 3" stroke="#2b1a11" strokeOpacity="0.35" fill="none" strokeWidth="1" />
        </pattern>
      </defs>

      <rect x={lay.board.x} y={lay.board.y} width={lay.board.w} height={lay.board.h} rx="6" fill={`url(#wood-${uid})`} />
      <rect x={lay.board.x} y={lay.board.y} width={lay.board.w} height={lay.board.h} rx="6" fill={`url(#grain-${uid})`} />

      {lay.inlays.map((inl) =>
        inl.points.map((p, i) => (
          <circle key={`${inl.fret}-${i}`} cx={p.x} cy={p.y} r={7} fill="#e9ddc3" opacity="0.55" />
        )),
      )}

      {lay.fretWires.map((w) => (
        <line key={w.fret} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
          stroke="#c9c3b6" strokeWidth="3" strokeLinecap="round" />
      ))}

      <line x1={lay.nut.x1} y1={lay.nut.y1} x2={lay.nut.x2} y2={lay.nut.y2}
        stroke="#e9ddc3" strokeWidth="10" strokeLinecap="round" data-testid="nut" />
      <text x={lay.nut.x1} y={lay.board.y - 5} textAnchor="middle" fontSize="12" fill="var(--color-muted)">Nut</text>

      {lay.strings.map((s) => (
        <g key={s.string}>
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={s.string >= 4 ? "#cdb98e" : "#dcd6ca"} strokeWidth={s.gauge} />
          <text x={s.labelPos.x} y={s.labelPos.y} textAnchor="middle" dominantBaseline="central"
            fontSize="15" fill="var(--color-ink)">
            {s.label}
          </text>
        </g>
      ))}

      {lay.fretNumbers.map((f) => (
        <text key={f.fret} x={f.pos.x} y={f.pos.y} textAnchor="middle" dominantBaseline="central"
          fontSize="13" fill="var(--color-muted)">
          {f.fret}
        </text>
      ))}

      {/* Scale notes — dimmed while a chord placement is shown */}
      <g opacity={placing ? 0.22 : 1} data-testid="scale-note-layer">
        {scaleCells.map((cell) => {
          const p = cell.fret === 0 ? lay.openMarker(cell.string) : lay.note(cell.string, cell.fret);
          const r = 13;
          const { fill, ink } = noteMarkerColors(cell.name);
          return (
            <g
              key={`${cell.string}-${cell.fret}`}
              transform={`translate(${p.x} ${p.y})`}
              data-in-scale="true"
              data-note={cell.name}
            >
              <circle r={r} fill={fill} />
              <text textAnchor="middle" dominantBaseline="central"
                fontSize={cell.name.length > 1 ? 10 : 12} fontWeight="800" fill={ink}>
                {cell.name}
              </text>
            </g>
          );
        })}
      </g>

      {/* Chord finger placement */}
      {placing && (
        <g data-testid="chord-place-layer">
          {highlights.map((h) => {
            if (h.muted) {
              const p = lay.openMarker(h.string);
              return (
                <text key={`x-${h.string}`} x={p.x} y={p.y + 5} textAnchor="middle"
                  fontSize="16" fontWeight="900" fill="var(--color-muted)">
                  ×
                </text>
              );
            }
            const p = h.fret === 0 ? lay.openMarker(h.string) : lay.note(h.string, h.fret);
            const open = h.fret === 0;
            return (
              <g key={`h-${h.string}-${h.fret}`} transform={`translate(${p.x} ${p.y})`}
                data-place-string={h.string} data-place-fret={h.fret}>
                <circle r={16} fill="none" stroke="var(--color-maple)" strokeWidth="3" opacity="0.85" />
                <circle r={14} fill="var(--color-maple)" />
                <text textAnchor="middle" dominantBaseline="central" fontSize={open ? 14 : 15}
                  fontWeight="900" fill="var(--color-tolex)">
                  {open ? "O" : String(h.finger ?? "")}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
