"use client";

/**
 * Movable power-chord shape: index on the root (string 6 or 5),
 * ring two frets higher on the next thinner string.
 */

const FRETS = 5;
const STRINGS = [
  { n: 6, label: "6 · E", y: 78 },
  { n: 5, label: "5 · A", y: 46 },
  { n: 4, label: "4 · D", y: 14 },
] as const;

export function PowerChordShapeDiagram({ className }: { className?: string }) {
  const left = 56;
  const top = 28;
  const fretW = 42;
  const nutX = left;
  const boardW = FRETS * fretW;
  const boardH = 90;
  const width = left + boardW + 24;
  const height = top + boardH + 48;

  const root = { string: 6 as const, fret: 3 }; // illustrative: C5 at 3rd fret
  const fifth = { string: 5 as const, fret: 5 };

  const xOf = (fret: number) => (fret === 0 ? nutX - 18 : nutX + (fret - 0.5) * fretW);
  const yOf = (s: number) => STRINGS.find((x) => x.n === s)!.y + top;

  return (
    <figure className={className} data-testid="power-chord-shape-diagram">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Power chord shape: index finger on the root, ring finger two frets higher on the next thinner string"
        className="max-w-md overflow-hidden rounded-2xl bg-tolex"
      >
        <title>Power chord shape</title>
        <text x={12} y={18} fontSize="14" fontWeight="800" fill="var(--color-ink)">Power chord shape</text>
        <text x={12} y={height - 22} fontSize="12" fontWeight="700" fill="var(--color-muted)" fontFamily="ui-monospace, monospace">
          C · G
        </text>
        <text x={12} y={height - 8} fontSize="11" fill="var(--color-muted)">
          Index on root · ring +2 frets on next thinner string — slide the shape
        </text>

        <rect x={nutX} y={top} width={boardW} height={boardH} rx="4" fill="var(--color-panel)" stroke="var(--color-line)" />
        <line x1={nutX} x2={nutX} y1={top} y2={top + boardH} stroke="var(--color-maple)" strokeWidth="5" />

        {Array.from({ length: FRETS }, (_, i) => {
          const x = nutX + (i + 1) * fretW;
          return <line key={i} x1={x} x2={x} y1={top} y2={top + boardH} stroke="var(--color-line)" strokeWidth="1.5" />;
        })}
        {[3].map((f) => (
          <circle key={f} cx={nutX + (f - 0.5) * fretW} cy={top + boardH / 2} r={4} fill="var(--color-faint)" opacity="0.5" />
        ))}

        {STRINGS.map((s) => (
          <g key={s.n}>
            <text x={8} y={yOf(s.n) + 4} fontSize="11" fontWeight="700" fill="var(--color-muted)">{s.label}</text>
            <line x1={nutX} x2={nutX + boardW} y1={yOf(s.n)} y2={yOf(s.n)}
              stroke={s.n >= 5 ? "#cdb98e" : "#dcd6ca"} strokeWidth={s.n === 6 ? 3.2 : s.n === 5 ? 2.6 : 2} />
          </g>
        ))}

        {/* Mute unused thinner string */}
        <text x={nutX - 14} y={yOf(4) + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--color-muted)">×</text>

        <g data-testid="power-root">
          <circle cx={xOf(root.fret)} cy={yOf(root.string)} r={12} fill="var(--color-ok)" />
          <text x={xOf(root.fret)} y={yOf(root.string) + 1} textAnchor="middle" dominantBaseline="central"
            fontSize="12" fontWeight="800" fill="var(--color-tolex)">1</text>
          <text x={xOf(root.fret)} y={yOf(root.string) + 22} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-ok)">R</text>
        </g>
        <g data-testid="power-fifth">
          <circle cx={xOf(fifth.fret)} cy={yOf(fifth.string)} r={12} fill="var(--color-ok)" />
          <text x={xOf(fifth.fret)} y={yOf(fifth.string) + 1} textAnchor="middle" dominantBaseline="central"
            fontSize="12" fontWeight="800" fill="var(--color-tolex)">3</text>
          <text x={xOf(fifth.fret)} y={yOf(fifth.string) + 22} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-ok)">5</text>
        </g>

        {/* Bracket showing +2 frets */}
        <path
          d={`M${xOf(root.fret)} ${yOf(root.string) - 18} L${xOf(root.fret)} ${top - 2} L${xOf(fifth.fret)} ${top - 2} L${xOf(fifth.fret)} ${yOf(fifth.string) - 18}`}
          fill="none" stroke="var(--color-next)" strokeWidth="1.5" strokeDasharray="3 2"
        />
        <text x={(xOf(root.fret) + xOf(fifth.fret)) / 2} y={top - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--color-next)">
          +2 frets
        </text>
      </svg>
    </figure>
  );
}
