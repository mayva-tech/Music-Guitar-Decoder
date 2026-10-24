"use client";

import { MINOR_PENTA_BOX, type PentatonicGuide } from "@/lib/music/pentatonicGuides";

const STRINGS = [
  { n: 1, label: "1 · e", y: 18 },
  { n: 2, label: "2 · B", y: 48 },
  { n: 3, label: "3 · G", y: 78 },
  { n: 4, label: "4 · D", y: 108 },
  { n: 5, label: "5 · A", y: 138 },
  { n: 6, label: "6 · E", y: 168 },
] as const;

/** Visual box 1: four frets wide, two notes per string. */
export function PentatonicBoxDiagram({ guide }: { guide: PentatonicGuide }) {
  const left = 64;
  const top = 36;
  const fretsShown = 5; // nut side + 4 frets of the box
  const fretW = 48;
  const boardW = fretsShown * fretW;
  const boardH = 180;
  const width = left + boardW + 28;
  const height = top + boardH + 44;
  const rootFret = guide.rootFret;

  const xOf = (absFret: number) => {
    // Column 0 = root fret (left edge of box); open shown only when rootFret === 0
    const col = absFret - rootFret;
    return left + (col + 0.5) * fretW;
  };
  const yOf = (s: number) => STRINGS.find((x) => x.n === s)!.y + top;

  return (
    <figure className="rounded-2xl bg-tolex p-3" data-testid={`penta-box-${guide.id}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`${guide.name} box starting at fret ${rootFret}`}
        className="max-w-full"
      >
        <title>{guide.name} — box 1</title>
        <text x={12} y={20} fontSize="14" fontWeight="800" fill="var(--color-ink)">
          Box shape · root at fret {rootFret}
        </text>

        <rect x={left} y={top} width={boardW} height={boardH} rx="4"
          fill="var(--color-panel)" stroke="var(--color-line)" />
        {rootFret === 0 && (
          <line x1={left} x2={left} y1={top} y2={top + boardH} stroke="var(--color-maple)" strokeWidth="5" />
        )}

        {Array.from({ length: fretsShown }, (_, i) => {
          const x = left + (i + 1) * fretW;
          return <line key={i} x1={x} x2={x} y1={top} y2={top + boardH} stroke="var(--color-line)" strokeWidth="1.5" />;
        })}

        {/* Fret numbers under the board */}
        {Array.from({ length: fretsShown }, (_, i) => {
          const fret = rootFret + i;
          return (
            <text key={`fn-${i}`} x={left + (i + 0.5) * fretW} y={top + boardH + 16}
              textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-muted)">
              {fret}
            </text>
          );
        })}

        {STRINGS.map((s) => (
          <g key={s.n}>
            <text x={8} y={yOf(s.n) + 4} fontSize="11" fontWeight="700" fill="var(--color-muted)">{s.label}</text>
            <line x1={left} x2={left + boardW} y1={yOf(s.n)} y2={yOf(s.n)}
              stroke={s.n >= 5 ? "#cdb98e" : "#dcd6ca"} strokeWidth={s.n === 6 ? 3 : s.n === 5 ? 2.5 : 2} />
          </g>
        ))}

        {MINOR_PENTA_BOX.map((row) =>
          row.offsets.map((off, i) => {
            const fret = rootFret + off;
            const deg = row.degrees[i]!;
            const isRoot = deg === "R";
            const cx = xOf(fret);
            const cy = yOf(row.string);
            return (
              <g key={`${row.string}-${off}`} data-degree={deg}>
                <circle cx={cx} cy={cy} r={13}
                  fill={isRoot ? "var(--color-ok)" : "var(--color-next)"} />
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central"
                  fontSize="11" fontWeight="800" fill="var(--color-tolex)">{deg}</text>
              </g>
            );
          }),
        )}

        <text x={12} y={height - 8} fontSize="11" fill="var(--color-muted)">
          Green = root · gold = other box notes · one finger per fret
        </text>
      </svg>
    </figure>
  );
}
