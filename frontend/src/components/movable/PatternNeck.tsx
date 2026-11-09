"use client";

import { useId, useMemo } from "react";
import type { NoteRole } from "@/lib/music/movable";
import type { PlayableNote } from "@/lib/types";

export type DotTone = "root" | "core" | "added" | "chord" | "outside";

export interface NeckDot {
  string: number;
  fret: number;
  label: string;
  tone: DotTone;
  /** Ring the dot (a chord tone inside a scale view). */
  ring?: boolean;
  /** Played by reaching one fret outside the frame. */
  stretch?: boolean;
}

export interface NeckLine {
  notes: PlayableNote[];
  roles: NoteRole[];
  /** Text inside each note's marker (by note index), e.g. its degree. */
  labels?: string[];
  /** "full" draws the route, markers and order; "rings" only lights rings on the dots as notes sound. */
  mode?: "full" | "rings";
}

interface Props {
  /** First and last fret shown. */
  from: number;
  to: number;
  /** The four-fret hand frame to shade. */
  frame?: { lo: number; hi: number } | null;
  dots?: NeckDot[];
  line?: NeckLine | null;
  ariaLabel: string;
  compact?: boolean;
  testId?: string;
}

const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const GAUGE: Record<number, number> = { 1: 1.2, 2: 1.5, 3: 1.9, 4: 2.4, 5: 2.9, 6: 3.4 };
const LETTER: Record<number, string> = { 1: "e", 2: "B", 3: "G", 4: "D", 5: "A", 6: "E" };

const FILL: Record<DotTone, { fill: string; ink: string; stroke: string }> = {
  root: { fill: "var(--color-ok)", ink: "#1a1b1e", stroke: "none" },
  core: { fill: "#2c2f34", ink: "var(--color-ink)", stroke: "#8a857c" },
  added: { fill: "var(--color-next)", ink: "#1a1b1e", stroke: "none" },
  chord: { fill: "#e9ddc3", ink: "#1a1b1e", stroke: "none" },
  outside: { fill: "#2c2f34", ink: "var(--color-ink)", stroke: "#e9ddc3" },
};

/**
 * A cropped neck (high e on top, TAB order) for one hand position: the frame shaded, scale dots
 * with finger / degree / note labels, and optionally a line drawn over it. Line notes light through
 * `data-hl="n<i>"` (class `solo-hl`) inside the parent's `data-hl-scope`, like the other lick necks.
 */
export function PatternNeck({ from, to, frame, dots = [], line, ariaLabel, compact = false, testId }: Props) {
  const uid = useId().replace(/:/g, "");
  const W = compact ? 40 : 54;
  const H = compact ? 23 : 31;
  const R = compact ? 9 : 12.5;
  const left = 24;
  const top = compact ? 14 : 22;
  const cols = to - from + 1;
  const width = left + cols * W + 6;
  const height = top + 5 * H + (compact ? 30 : 36);
  const x = (f: number) => left + (f - from + 0.5) * W;
  const wire = (f: number) => left + (f - from + 1) * W; // boundary after fret f
  const y = (s: number) => top + (s - 1) * H;
  const boardTop = y(1) - H / 2 + 4;
  const boardH = 5 * H + H - 8;

  const full = line && (line.mode ?? "full") === "full";
  const markers = useMemo(() => {
    if (!line) return [];
    const byPos = new Map<string, { string: number; fret: number; idx: number[]; role: NoteRole; label: string; order: number }>();
    line.notes.forEach((n, i) => {
      const k = `${n.string}-${n.fret}`;
      const m = byPos.get(k);
      if (m) m.idx.push(i);
      else byPos.set(k, { string: n.string, fret: n.fret, idx: [i], role: line.roles[i] ?? "chord", label: line.labels?.[i] ?? "", order: byPos.size + 1 });
    });
    return [...byPos.values()];
  }, [line]);
  const route = full && line && line.notes.length > 1
    ? line.notes.map((n, i) => `${i ? "L" : "M"}${x(n.fret).toFixed(1)} ${y(n.string).toFixed(1)}`).join(" ")
    : "";

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      className="block select-none"
      style={{ width: "100%", maxWidth: width * (compact ? 1.1 : 1.3), minWidth: compact ? undefined : Math.min(width, cols * 36) }}
      data-testid={testId}
      data-from={from}
      data-to={to}
    >
      <defs>
        <linearGradient id={`wood-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f3b28" />
          <stop offset="0.5" stopColor="#4a2e1f" />
          <stop offset="1" stopColor="#3d2519" />
        </linearGradient>
      </defs>

      <rect x={left} y={boardTop} width={cols * W} height={boardH} rx="5" fill={`url(#wood-${uid})`} />
      {frame && frame.hi >= from && frame.lo <= to && (
        <rect
          x={left + (Math.max(frame.lo, from) - from) * W + 2}
          y={boardTop - 3}
          width={(Math.min(frame.hi, to) - Math.max(frame.lo, from) + 1) * W - 4}
          height={boardH + 6}
          rx="7"
          fill="var(--color-next)"
          fillOpacity="0.13"
          stroke="var(--color-next)"
          strokeOpacity="0.55"
          strokeDasharray="5 4"
          data-testid={testId ? `${testId}-frame` : undefined}
        />
      )}

      {INLAYS.filter((f) => f >= from && f <= to).map((f) => (
        <circle key={`in-${f}`} cx={x(f)} cy={(y(3) + y(4)) / 2} r={compact ? 4 : 6} fill="#e9ddc3" opacity="0.45" />
      ))}
      {[12, 24].filter((f) => f >= from && f <= to).flatMap((f) => [
        <circle key={`in-${f}-a`} cx={x(f)} cy={(y(2) + y(3)) / 2} r={compact ? 4 : 6} fill="#e9ddc3" opacity="0.45" />,
        <circle key={`in-${f}-b`} cx={x(f)} cy={(y(4) + y(5)) / 2} r={compact ? 4 : 6} fill="#e9ddc3" opacity="0.45" />,
      ])}

      {/* Left edge: the nut when fret 0 is shown on its own column, else the wire before `from`. */}
      {from > 0 && <line x1={left} y1={boardTop} x2={left} y2={boardTop + boardH} stroke="#c9c3b6" strokeWidth="2.5" />}
      {Array.from({ length: cols }, (_, i) => from + i).map((f) => (
        <line
          key={`w-${f}`}
          x1={wire(f)} y1={boardTop} x2={wire(f)} y2={boardTop + boardH}
          stroke={f === 0 ? "#e9ddc3" : "#c9c3b6"}
          strokeWidth={f === 0 ? 8 : 2.5}
          strokeLinecap="round"
        />
      ))}
      {[1, 2, 3, 4, 5, 6].map((s) => (
        <g key={`s-${s}`}>
          <line x1={left} y1={y(s)} x2={left + cols * W} y2={y(s)} stroke={s >= 4 ? "#cdb98e" : "#dcd6ca"} strokeWidth={GAUGE[s]} />
          <text x={left / 2} y={y(s)} textAnchor="middle" dominantBaseline="central" fontSize={compact ? 10 : 12} fill="var(--color-muted)">{LETTER[s]}</text>
        </g>
      ))}
      {Array.from({ length: cols }, (_, i) => from + i).map((f) => (
        <text
          key={`n-${f}`}
          x={x(f)} y={boardTop + boardH + (compact ? 12 : 16)}
          textAnchor="middle" dominantBaseline="central" fontSize={compact ? 10 : 12}
          fill={frame && f >= frame.lo && f <= frame.hi ? "var(--color-next)" : "var(--color-muted)"}
          fontWeight={frame && f === frame.lo ? 800 : 400}
        >
          {f === 0 ? "open" : f}
        </text>
      ))}

      {route && <path d={route} fill="none" stroke="var(--color-next)" strokeOpacity={line!.notes.length > 14 ? 0.32 : 0.6} strokeWidth={compact ? 2 : 3} strokeLinejoin="round" data-testid="mv-route" />}

      <g data-testid={testId ? `${testId}-dots` : undefined}>
        {dots.map((d) => {
          const c = FILL[d.tone];
          const fade = full ? 0.28 : 1;
          return (
            <g key={`d-${d.string}-${d.fret}`} transform={`translate(${x(d.fret)} ${y(d.string)})`} opacity={fade}
              data-dot={`${d.string}:${d.fret}`} data-tone={d.tone}>
              {d.ring && <circle r={R + 3.5} fill="none" stroke="#e9ddc3" strokeWidth={2.2} />}
              {d.stretch && !d.ring && <circle r={R + 3} fill="none" stroke="var(--color-ink)" strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="3 2.5" />}
              <circle r={R} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} strokeDasharray={d.tone === "outside" ? "3 2" : undefined} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={d.label.length > 2 ? R * 0.72 : R * 0.95} fontWeight="800" fill={c.ink}>{d.label}</text>
            </g>
          );
        })}
      </g>

      {line && (
        <g data-testid={testId ? `${testId}-line` : "mv-line"}>
          {markers.map((m) => {
            const fill = m.role === "chord" ? "#e9ddc3" : m.role === "scale" ? "#2c2f34" : "#1a1b1e";
            const ink = m.role === "chord" ? "#1a1b1e" : "var(--color-ink)";
            return (
              <g key={`m-${m.string}-${m.fret}`} transform={`translate(${x(m.fret)} ${y(m.string)})`}
                data-line-marker={`${m.string}:${m.fret}`} data-role={m.role}>
                {full && (
                  <>
                    <circle r={R} fill={fill} stroke={m.role === "chord" ? "none" : "#e9ddc3"} strokeWidth={1.6}
                      strokeDasharray={m.role === "chromatic" ? "3 2" : undefined} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={m.label.length > 2 ? R * 0.72 : R * 0.9} fontWeight="800" fill={ink}>{m.label}</text>
                    {!compact && (
                      <g transform={`translate(${R * 0.85} ${-R * 0.95})`}>
                        <circle r={7.5} fill="var(--color-tolex)" stroke="var(--color-next)" strokeWidth={1.2} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={8.5} fontWeight="700" fill="var(--color-next)">{m.order}</text>
                      </g>
                    )}
                  </>
                )}
                {m.idx.map((i) => (
                  <g key={i} className="solo-hl" data-hl={`n${i}`}>
                    <circle className="solo-ring" r={R + 4} fill="none" stroke="var(--theory-highlight, #F2B233)" strokeWidth={compact ? 3 : 4} />
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
