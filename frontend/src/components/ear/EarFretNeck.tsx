"use client";

import { useId, useMemo } from "react";
import { computeLayout } from "@/lib/music/fretboardLayout";
import type { ChordShape } from "@/lib/music/chordShapes";
import { midiOf } from "@/lib/theory/earPlayAlong";
import { noteName } from "@/lib/theory/content";

export interface NeckSpot { string: number; fret: number; finger?: number; label?: string }
export interface NeckMark extends NeckSpot { ok: boolean }

interface Props {
  frets: number;
  /** Chord shape: "full" = dots with finger numbers, "ghost" = faint outline behind the melody. */
  shape?: ChordShape | null;
  shapeStyle?: "full" | "ghost";
  /** The note to pick now (glows). */
  target?: NeckSpot | null;
  /** More notes picked together with the target (double stops, chords). */
  extraTargets?: NeckSpot[];
  /** The note after it (dashed ring). */
  next?: NeckSpot | null;
  /** The note just played (faint). */
  prev?: NeckSpot | null;
  /** Tapped answers in "find it" mode, or a wrong tap. */
  marks?: NeckMark[];
  /** Fretting-hand window. */
  hand?: { lo: number; hi: number; label: string } | null;
  onTap?: (string: number, fret: number) => void;
}

const TOP = 30;

/**
 * Real neck (same layout maths as the app's fretboard map, high e on top like TAB)
 * that shows where to put your fingers for the chord and the next note to pick.
 * Every string/fret is tappable.
 */
export function EarFretNeck({ frets, shape, shapeStyle = "full", target, extraTargets = [], next, prev, marks = [], hand, onTap }: Props) {
  const uid = useId().replace(/:/g, "");
  const lay = useMemo(() => computeLayout({ handedness: "right", view: "beginner", frets, equalSpacing: true }), [frets]);
  const wireX = (n: number) => (n <= 0 ? lay.nut.x1 : lay.fretWires[n - 1]!.x1);
  const pt = (s: number, f: number) => (f === 0 ? lay.openMarker(s) : lay.note(s, f));
  const ghost = shapeStyle === "ghost";

  const shapeDots = shape
    ? shape.frets.map((f, i) => ({ string: 6 - i, fret: f, finger: shape.fingers[i] ?? 0 }))
    : [];
  // Barre: one finger on several strings at the same fret.
  const barre = useMemo(() => {
    if (!shape) return null;
    const ones = shapeDots.filter((d) => d.fret != null && d.fret > 0 && d.finger === 1);
    if (ones.length < 2 || new Set(ones.map((d) => d.fret)).size > 1) return null;
    const ss = ones.map((d) => d.string);
    return { fret: ones[0]!.fret!, lo: Math.min(...ss), hi: Math.max(...ss) };
  }, [shape]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <svg
      role="img"
      aria-label="Guitar neck: chord shape and the next note to pick"
      viewBox={`0 ${-TOP} ${lay.width} ${lay.height + TOP}`}
      className="block select-none"
      style={{ width: "100%", minWidth: 760 }}
      data-testid="ef-neck"
      data-target={target ? `${target.string}-${target.fret}` : undefined}
    >
      <defs>
        <linearGradient id={`wood-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f3b28" />
          <stop offset="0.5" stopColor="#4a2e1f" />
          <stop offset="1" stopColor="#3d2519" />
        </linearGradient>
      </defs>

      {hand && (
        <g data-testid="ef-hand">
          <rect x={wireX(hand.lo - 1) + 2} y={-TOP + 4} width={wireX(hand.hi) - wireX(hand.lo - 1) - 4} height={20} rx={10} fill="var(--color-next)" opacity={0.18} />
          <text x={(wireX(hand.lo - 1) + wireX(hand.hi)) / 2} y={-TOP + 14} textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="700" fill="var(--color-next)">
            Hand here · frets {hand.lo}–{hand.hi}
          </text>
        </g>
      )}

      <rect x={lay.board.x} y={lay.board.y} width={lay.board.w} height={lay.board.h} rx="6" fill={`url(#wood-${uid})`} />
      {hand && <rect x={wireX(hand.lo - 1)} y={lay.board.y} width={wireX(hand.hi) - wireX(hand.lo - 1)} height={lay.board.h} fill="var(--color-next)" opacity={0.08} />}
      {lay.inlays.map((inl) => inl.points.map((p, i) => <circle key={`${inl.fret}-${i}`} cx={p.x} cy={p.y} r={7} fill="#e9ddc3" opacity="0.5" />))}
      {lay.fretWires.map((w) => <line key={w.fret} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#c9c3b6" strokeWidth="3" strokeLinecap="round" />)}
      <line x1={lay.nut.x1} y1={lay.nut.y1} x2={lay.nut.x2} y2={lay.nut.y2} stroke="#e9ddc3" strokeWidth="10" strokeLinecap="round" />
      {lay.strings.map((s) => {
        const lit = target?.string === s.string;
        return (
          <g key={s.string}>
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={lit ? "var(--color-next)" : s.string >= 4 ? "#cdb98e" : "#dcd6ca"} strokeWidth={lit ? s.gauge + 1 : s.gauge} />
            <text x={s.labelPos.x} y={s.labelPos.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight={lit ? 800 : 400} fill={lit ? "var(--color-next)" : "var(--color-ink)"}>{s.label}</text>
          </g>
        );
      })}
      {lay.fretNumbers.map((f) => (
        <text key={f.fret} x={f.pos.x} y={f.pos.y} textAnchor="middle" dominantBaseline="central" fontSize="13"
          fill={f.fret === target?.fret ? "var(--color-next)" : "var(--color-muted)"} fontWeight={f.fret === target?.fret ? 800 : 400}>{f.fret}</text>
      ))}

      {/* Chord shape */}
      {shape && (
        <g data-testid="ef-shape" data-style={shapeStyle} opacity={ghost ? 0.5 : 1}>
          {barre && (() => {
            const a = pt(barre.lo, barre.fret), b = pt(barre.hi, barre.fret);
            return <rect x={a.x - 11} y={Math.min(a.y, b.y) - 11} width={22} height={Math.abs(b.y - a.y) + 22} rx={11} fill="var(--color-maple)" opacity={ghost ? 0.35 : 0.6} />;
          })()}
          {shapeDots.map((d) => {
            if (d.fret == null) {
              const p = lay.mutedMarker(d.string);
              return <text key={`x${d.string}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="17" fontWeight="900" fill="var(--color-faint)" data-shape-muted={d.string}>×</text>;
            }
            const p = pt(d.string, d.fret);
            const open = d.fret === 0;
            return (
              <g key={`s${d.string}`} transform={`translate(${p.x} ${p.y})`} data-shape-string={d.string} data-shape-fret={d.fret}>
                {open ? (
                  <circle r={11} fill="none" stroke="var(--color-maple)" strokeWidth={3} />
                ) : ghost ? (
                  <circle r={13} fill="none" stroke="var(--color-maple)" strokeWidth={2.5} strokeDasharray="4 3" />
                ) : (
                  <>
                    <circle r={15} fill="var(--color-maple)" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="900" fill="#1a1b1e">{d.finger === 5 ? "T" : d.finger || ""}</text>
                  </>
                )}
                {ghost && !open && <text x={14} y={-12} textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--color-maple)">{d.finger || ""}</text>}
              </g>
            );
          })}
        </g>
      )}

      {prev && (() => { const p = pt(prev.string, prev.fret); return <circle cx={p.x} cy={p.y} r={9} fill="var(--color-ok)" opacity={0.45} data-testid="ef-prev" />; })()}

      {next && !(target && next.string === target.string && next.fret === target.fret) && (() => {
        const p = pt(next.string, next.fret);
        return (
          <g transform={`translate(${p.x} ${p.y})`} data-testid="ef-next">
            <circle r={15} fill="none" stroke="var(--color-next)" strokeWidth={2.5} strokeDasharray="5 4" opacity={0.85} />
            <text y={27} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-next)">next</text>
          </g>
        );
      })()}

      {(target ? [target, ...extraTargets] : []).map((t, k) => {
        const p = pt(t.string, t.fret);
        const label = t.label ?? noteName(midiOf(t.string, t.fret));
        const w = Math.max(34, label.length * 7.5 + 14);
        const fing = t.fret === 0 ? "O" : t.finger === 5 ? "T" : t.finger ?? "";
        return (
          <g key={`t${k}`} transform={`translate(${p.x} ${p.y})`} data-testid={k === 0 ? "ef-target" : "ef-target-extra"} pointerEvents="none">
            <circle r={16} fill="none" stroke="var(--color-next)" strokeWidth={3} className="ef-pulse" />
            <circle r={16} fill="var(--color-next)" />
            <text textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="900" fill="#1a1b1e">{fing}</text>
            {/* Label above for the top note, below for the others (double stops sit on neighbouring strings). */}
            <g transform={`translate(0 ${k === 0 ? -30 : 30})`}>
              <rect x={-w / 2} y={-10} width={w} height={20} rx={6} fill="#1a1b1e" stroke="var(--color-next)" strokeWidth={1.5} />
              <text textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="800" fill="var(--color-next)">{label}</text>
            </g>
          </g>
        );
      })}

      {marks.map((m, i) => {
        const p = pt(m.string, m.fret);
        return (
          <g key={`m${i}`} transform={`translate(${p.x} ${p.y})`} pointerEvents="none" data-testid={m.ok ? "ef-mark-ok" : "ef-mark-miss"}>
            <circle r={15} fill={m.ok ? "var(--color-ok)" : "var(--color-bad)"} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={(m.label ?? "").length > 1 ? 11 : 13} fontWeight="800" fill="#1a1b1e">{m.label}</text>
          </g>
        );
      })}

      {onTap && (
        <g data-testid="ef-cells">
          {lay.strings.map((s) => Array.from({ length: frets + 1 }, (_, f) => {
            const x1 = f === 0 ? lay.nut.x1 - 44 : wireX(f - 1);
            const x2 = f === 0 ? lay.nut.x1 : wireX(f);
            return (
              <rect key={`c${s.string}-${f}`} x={x1} y={s.y1 - 17} width={x2 - x1} height={34} fill="transparent" style={{ cursor: "pointer" }}
                data-testid={`ef-cell-${s.string}-${f}`} onClick={() => onTap(s.string, f)}>
                <title>{`${noteName(midiOf(s.string, f))} · string ${s.string}, fret ${f}`}</title>
              </rect>
            );
          }))}
        </g>
      )}
    </svg>
  );
}
