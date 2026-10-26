"use client";

import { useId, useMemo } from "react";
import { computeLayout } from "@/lib/music/fretboardLayout";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import {
  CAGED_SHAPES, OCTAVE_RULES, noteHl, pentaDegree, pentaNeck,
  type CagedKey, type CagedPosition, type CagedShapeId, type StringNo,
} from "@/lib/music/caged";

export type CagedView = "both" | "chords" | "boxes" | "roots";
export interface HuntMark { string: number; fret: number; ok: boolean; label: string }

interface Props {
  musicKey: CagedKey;
  positions: CagedPosition[];
  frets: number;
  selected: CagedShapeId | "all";
  view: CagedView;
  labels: "degree" | "note";
  onSelect?: (id: CagedShapeId) => void;
  /** Quiz mode: no notes, every cell is clickable. */
  quiz?: { onPick: (string: number, fret: number) => void; marks: HuntMark[] };
  testId?: string;
}

const LANE = 24;
const cellKey = (s: number, f: number) => `${s}-${f}`;

/**
 * Full neck with the CAGED shapes as coloured bands, the pentatonic notes as dots,
 * chord tones ringed in their shape's colour and roots in green.
 * Same layout maths as ScaleFretmapNeck (TAB order: high e on top).
 */
export function CagedNeck({ musicKey, positions, frets, selected, view, labels, onSelect, quiz, testId = "caged-neck" }: Props) {
  const uid = useId().replace(/:/g, "");
  const lay = useMemo(() => computeLayout({ handedness: "right", view: "beginner", frets, equalSpacing: true }), [frets]);
  const top = quiz ? 0 : LANE * 2 + 8;

  const wireX = (n: number) => (n <= 0 ? lay.nut.x1 : lay.fretWires[n - 1]!.x1);
  const band = (p: CagedPosition) => ({ x1: p.lo === 0 ? lay.nut.x1 - 40 : wireX(p.lo - 1) + 3, x2: wireX(p.hi) - 3 });

  const shown = selected === "all" ? positions : positions.filter((p) => p.shape === selected);

  const notes = useMemo(() => {
    if (quiz) return [];
    const chordAt = new Map<string, CagedShapeId>();
    const inBox = new Set<string>();
    for (const p of shown) {
      for (const c of p.chord) chordAt.set(cellKey(c.string, c.fret), p.shape);
      for (const b of p.box) inBox.add(cellKey(b.string, b.fret));
    }
    return pentaNeck(musicKey, frets).flatMap((n) => {
      const k = cellKey(n.string, n.fret);
      const root = n.midi % 12 === musicKey.tonic;
      const chord = view === "both" || view === "chords" ? chordAt.get(k) : undefined;
      if (view === "roots" && !root) return [];
      if (view === "chords" && !chord) return [];
      if (view === "boxes" && selected !== "all" && !inBox.has(k)) return [];
      const dim = view === "both" && selected !== "all" && !inBox.has(k);
      return [{ ...n, root, chord, dim, degree: pentaDegree(musicKey, n.midi % 12) ?? "" }];
    });
  }, [quiz, shown, musicKey, frets, view, selected]);

  // Octave links between roots (roots view): low E→D, A→G, D→B, G→e.
  const links = useMemo(() => {
    if (view !== "roots" || quiz) return [];
    const out: { a: { s: StringNo; f: number }; b: { s: StringNo; f: number } }[] = [];
    for (const r of OCTAVE_RULES) {
      for (let f = 0; f + r.frets <= frets; f++) {
        if ((STANDARD_TUNING[r.from] + f) % 12 === musicKey.tonic) out.push({ a: { s: r.from, f }, b: { s: r.to, f: f + r.frets } });
      }
    }
    return out;
  }, [view, quiz, frets, musicKey.tonic]);

  const pt = (s: number, f: number) => (f === 0 ? lay.openMarker(s) : lay.note(s, f));

  return (
    <svg
      role="img"
      aria-label={quiz ? "Fretboard: tap a fret to answer" : `${musicKey.name} pentatonic and CAGED shapes on the fretboard`}
      viewBox={`0 ${-top} ${lay.width} ${lay.height + top}`}
      className="block select-none"
      style={{ width: "100%", minWidth: quiz ? 760 : 940 }}
      data-testid={testId}
      data-selected={selected}
      data-view={view}
    >
      <defs>
        <linearGradient id={`wood-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f3b28" />
          <stop offset="0.5" stopColor="#4a2e1f" />
          <stop offset="1" stopColor="#3d2519" />
        </linearGradient>
      </defs>

      {/* Shape lanes above the board: click one to focus it. */}
      {!quiz && positions.map((p, i) => {
        const { x1, x2 } = band(p);
        const def = CAGED_SHAPES[p.shape];
        const on = selected === "all" || selected === p.shape;
        const y = -top + 4 + (i % 2) * LANE;
        const wide = x2 - x1 > 150;
        return (
          <g key={`lane-${p.shape}-${p.offset}`} data-band={p.shape} data-lo={p.lo} data-hi={p.hi}
            opacity={on ? 1 : 0.35} style={{ cursor: onSelect ? "pointer" : undefined }}
            onClick={() => onSelect?.(p.shape)}>
            <rect x={x1} y={y} width={x2 - x1} height={LANE - 6} rx={9} fill={def.colour} />
            <text x={(x1 + x2) / 2} y={y + (LANE - 6) / 2} textAnchor="middle" dominantBaseline="central"
              fontSize="13" fontWeight="800" fill="#1a1b1e">
              {wide ? `${p.shape} shape · box ${p.boxNo}` : p.shape}
            </text>
          </g>
        );
      })}

      <rect x={lay.board.x} y={lay.board.y} width={lay.board.w} height={lay.board.h} rx="6" fill={`url(#wood-${uid})`} />

      {/* Tint the focused shape's frets. */}
      {!quiz && selected !== "all" && shown.map((p) => {
        const { x1, x2 } = band(p);
        return <rect key={`tint-${p.offset}`} x={Math.max(x1, lay.nut.x1 - 44)} y={lay.board.y - 4} width={x2 - Math.max(x1, lay.nut.x1 - 44)}
          height={lay.board.h + 8} rx={8} fill={CAGED_SHAPES[p.shape].colour} opacity={0.2} />;
      })}

      {lay.inlays.map((inl) => inl.points.map((p, i) => (
        <circle key={`${inl.fret}-${i}`} cx={p.x} cy={p.y} r={7} fill="#e9ddc3" opacity="0.5" />
      )))}
      {lay.fretWires.map((w) => (
        <line key={w.fret} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#c9c3b6" strokeWidth="3" strokeLinecap="round" />
      ))}
      <line x1={lay.nut.x1} y1={lay.nut.y1} x2={lay.nut.x2} y2={lay.nut.y2} stroke="#e9ddc3" strokeWidth="10" strokeLinecap="round" />
      {lay.strings.map((s) => (
        <g key={s.string}>
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.string >= 4 ? "#cdb98e" : "#dcd6ca"} strokeWidth={s.gauge} />
          <text x={s.labelPos.x} y={s.labelPos.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fill="var(--color-ink)">{s.label}</text>
        </g>
      ))}
      {lay.fretNumbers.map((f) => (
        <text key={f.fret} x={f.pos.x} y={f.pos.y} textAnchor="middle" dominantBaseline="central" fontSize="13"
          fill={f.fret % 12 === 0 ? "var(--color-ink)" : "var(--color-muted)"} fontWeight={f.fret % 12 === 0 ? 800 : 400}>{f.fret}</text>
      ))}

      {links.map(({ a, b }) => {
        const p = pt(a.s, a.f), q = pt(b.s, b.f);
        return <line key={`ln-${a.s}-${a.f}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--color-ok)" strokeWidth="3"
          strokeDasharray="5 5" opacity="0.8" data-testid="octave-link" />;
      })}

      <g data-testid="caged-notes">
        {notes.map((n) => {
          const p = pt(n.string, n.fret);
          const colour = n.chord ? (selected === "all" ? "#e9ddc3" : CAGED_SHAPES[n.chord].colour) : undefined;
          const fill = n.root ? "var(--color-ok)" : colour ?? "#2c2f34";
          const ink = n.root || colour ? "#1a1b1e" : "var(--color-ink)";
          const text = labels === "degree" ? n.degree : n.name;
          return (
            <g key={cellKey(n.string, n.fret)} transform={`translate(${p.x} ${p.y})`} opacity={n.dim ? 0.16 : 1}
              data-hl={noteHl(n.string, n.fret)} className="cg-note"
              data-string={n.string} data-fret={n.fret} data-root={n.root || undefined} data-chord={n.chord}>
              <g className="cg-pop">
                {n.chord && <circle r={17} fill="none" stroke={CAGED_SHAPES[n.chord].colour} strokeWidth={3} />}
                <circle className="cg-dot" r={13} fill={fill} stroke={n.root || colour ? "none" : "#6f6b64"} strokeWidth={1.5} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={text.length > 1 ? 11 : 13} fontWeight="800" fill={ink}>{text}</text>
              </g>
            </g>
          );
        })}
      </g>

      {quiz && (
        <g data-testid="hunt-cells">
          {lay.strings.map((s) => Array.from({ length: frets + 1 }, (_, f) => {
            const x1 = f === 0 ? lay.nut.x1 - 44 : wireX(f - 1);
            const x2 = f === 0 ? lay.nut.x1 : wireX(f);
            return (
              <rect key={`c-${s.string}-${f}`} x={x1} y={s.y1 - 17} width={x2 - x1} height={34} fill="transparent"
                style={{ cursor: "pointer" }} data-testid={`hunt-cell-${s.string}-${f}`}
                onClick={() => quiz.onPick(s.string, f)} />
            );
          }))}
          {quiz.marks.map((m, i) => {
            const p = pt(m.string, m.fret);
            return (
              <g key={`m-${i}`} transform={`translate(${p.x} ${p.y})`} pointerEvents="none" data-testid={m.ok ? "hunt-ok" : "hunt-miss"}>
                <circle r={14} fill={m.ok ? "var(--color-ok)" : "var(--color-bad)"} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={m.label.length > 1 ? 11 : 13} fontWeight="800" fill="#1a1b1e">{m.label}</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
