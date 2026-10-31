"use client";

import { CAGED_SHAPES, noteHl, pentaDegree, type CagedKey, type CagedPosition, type NeckNote } from "@/lib/music/caged";

/** Vertical chord box of one CAGED shape where it sits in this key, with finger numbers. */
export function ShapeChordBox({ pos, musicKey: _musicKey }: { pos: CagedPosition; musicKey: CagedKey }) {
  const def = CAGED_SHAPES[pos.shape];
  const sx = (s: number) => 34 + (6 - s) * 17;
  const top = 30, row = 24;
  const base = pos.offset;
  const rowOf = (f: number) => (base === 0 ? f : f - base + 1);
  const ones = base > 0 ? pos.chord.filter((c) => c.finger === 1 && c.fret === base) : [];
  // Root · third · fifth under the box (unique triad notes, key spelling).
  const triadNotes = (["R", "3", "5"] as const)
    .map((d) => pos.chord.find((c) => c.degree === d)?.name)
    .filter((n): n is string => Boolean(n));
  return (
    <figure className="flex w-full max-w-[132px] flex-col items-center">
      <svg viewBox="0 0 132 148" className="block w-full" role="img"
        aria-label={`${pos.shape} shape ${base === 0 ? "open" : `at fret ${base}`}${triadNotes.length ? `: ${triadNotes.join(" · ")}` : ""}`}>
        {[6, 5, 4, 3, 2, 1].map((s) => (
          <line key={s} x1={sx(s)} x2={sx(s)} y1={top} y2={top + row * 4} stroke="#dcd6ca" strokeWidth={s >= 4 ? 1.8 : 1.2} />
        ))}
        {[0, 1, 2, 3, 4].map((r) => (
          <line key={r} x1={sx(6)} x2={sx(1)} y1={top + r * row} y2={top + r * row}
            stroke={r === 0 && base === 0 ? "#e9ddc3" : "#6f6b64"} strokeWidth={r === 0 && base === 0 ? 5 : 1.5} />
        ))}
        {base > 0 && <text x={sx(6) - 11} y={top + row / 2} textAnchor="end" dominantBaseline="central" fontSize="11" fontWeight="700" fill="var(--color-muted)">{base}fr</text>}
        {[6, 5, 4, 3, 2, 1].filter((s) => !pos.chord.some((c) => c.string === s)).map((s) => (
          <text key={`x${s}`} x={sx(s)} y={top - 11} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--color-faint)">×</text>
        ))}
        {ones.length > 1 && (
          <rect x={sx(Math.max(...ones.map((o) => o.string))) - 8} y={top + row / 2 - 8}
            width={sx(Math.min(...ones.map((o) => o.string))) - sx(Math.max(...ones.map((o) => o.string))) + 16} height={16} rx={8}
            fill={def.colour} opacity={0.55} />
        )}
        {pos.chord.map((c) => {
          if (base === 0 && c.fret === 0) {
            return <circle key={c.string} cx={sx(c.string)} cy={top - 14} r={5} fill="none"
              stroke={c.degree === "R" ? "var(--color-ok)" : "var(--color-ink)"} strokeWidth={2} />;
          }
          const cy = top + (rowOf(c.fret) - 0.5) * row;
          return (
            <g key={c.string} transform={`translate(${sx(c.string)} ${cy})`}>
              <circle r={8} fill={c.degree === "R" ? "var(--color-ok)" : def.colour} />
              <text textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="800" fill="#1a1b1e">{c.finger || ""}</text>
            </g>
          );
        })}
      </svg>
      {triadNotes.length > 0 && (
        <figcaption className="mt-0.5 text-center font-mono text-[0.7rem] font-semibold tracking-wide text-muted" data-testid="caged-chord-notes">
          {triadNotes.join(" · ")}
        </figcaption>
      )}
    </figure>
  );
}

/** Small horizontal pentatonic box (TAB order, high e on top) with degree labels. */
export function MiniBox({ box, musicKey, colour }: { box: NeckNote[]; musicKey: CagedKey; colour: string }) {
  const lo = Math.min(...box.map((n) => n.fret));
  const hi = Math.max(...box.map((n) => n.fret));
  const left = lo === 0 ? 30 : 14;
  const col = 32, gap = 19, top = 12;
  const first = lo === 0 ? 1 : lo; // first fretted column
  const x = (f: number) => (f === 0 ? left - 14 : left + (f - first + 0.5) * col);
  const cols = hi - first + 1;
  const w = left + cols * col + 8;
  const y = (s: number) => top + (s - 1) * gap;
  return (
    <svg viewBox={`0 0 ${w} ${top + gap * 5 + 26}`} className="block w-full" role="img" aria-label={`Box from fret ${lo} to ${hi}`}>
      {[1, 2, 3, 4, 5, 6].map((s) => (
        <line key={s} x1={left} x2={left + cols * col} y1={y(s)} y2={y(s)} stroke="#dcd6ca" strokeWidth={s >= 4 ? 1.6 : 1.1} />
      ))}
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line key={i} x1={left + i * col} x2={left + i * col} y1={y(1)} y2={y(6)}
          stroke={i === 0 && lo === 0 ? "#e9ddc3" : "#6f6b64"} strokeWidth={i === 0 && lo === 0 ? 4 : 1.4} />
      ))}
      <text x={x(first)} y={y(6) + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-muted)">{first}</text>
      {box.map((n) => {
        const root = n.midi % 12 === musicKey.tonic;
        const d = pentaDegree(musicKey, n.midi % 12) ?? "";
        return (
          <g key={`${n.string}-${n.fret}`} transform={`translate(${x(n.fret)} ${y(n.string)})`} data-hl={noteHl(n.string, n.fret)} className="cg-note">
            <g className="cg-pop">
              <circle className="cg-dot" r={8.5} fill={root ? "var(--color-ok)" : "#2c2f34"} stroke={root ? "none" : colour} strokeWidth={1.6} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={d.length > 1 ? 8 : 9.5} fontWeight="800" fill={root ? "#1a1b1e" : "var(--color-ink)"}>{d}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
