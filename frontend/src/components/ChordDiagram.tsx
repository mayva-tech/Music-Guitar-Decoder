// Classic chord box: strings 6..1 left to right, nut on top, O = open, X = muted.
import type { ChordDiagram as Diagram } from "@/lib/types";

export function ChordDiagram({ name, diagram, size = 1 }: { name: string; diagram: Diagram; size?: number }) {
  const fretted = diagram.frets.filter((f): f is number => f !== null && f > 0);
  const maxF = Math.max(0, ...fretted);
  const minF = fretted.length ? Math.min(...fretted) : 1;
  const base = maxF > 4 ? minF : 1;
  const rows = 4;
  const gap = 16 * size;
  const left = 18 * size;
  const top = 34 * size;
  const w = left * 2 + gap * 5;
  const h = top + gap * rows + 14 * size;
  const sx = (i: number) => left + i * gap;
  const fy = (f: number) => top + (f - base + 0.5) * gap;
  return (
    <figure className="flex flex-col items-center">
      <svg width={w} height={h} role="img" aria-label={`${name} chord diagram`}>
        <text x={w / 2} y={13 * size} textAnchor="middle" fontWeight="800" fontSize={14 * size} fill="var(--color-ink)">{name}</text>
        {base === 1 ? (
          <line x1={sx(0)} x2={sx(5)} y1={top} y2={top} stroke="var(--color-maple)" strokeWidth={4 * size} />
        ) : (
          <text x={sx(0) - 6 * size} y={top + gap / 2} textAnchor="end" dominantBaseline="central" fontSize={10 * size} fill="var(--color-muted)">{base}fr</text>
        )}
        {Array.from({ length: rows + 1 }, (_, r) => (
          <line key={r} x1={sx(0)} x2={sx(5)} y1={top + r * gap} y2={top + r * gap} stroke="var(--color-faint)" strokeWidth="1" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1={sx(i)} x2={sx(i)} y1={top} y2={top + rows * gap} stroke="var(--color-nickel)" strokeWidth={1 + (5 - i) * 0.25} />
        ))}
        {diagram.frets.map((f, i) => {
          if (f === null) return <text key={i} x={sx(i)} y={top - 9 * size} textAnchor="middle" fontSize={11 * size} fill="var(--color-muted)">X</text>;
          if (f === 0) {
            return (
              <text key={i} x={sx(i)} y={top - 8 * size} textAnchor="middle" fontSize={12 * size} fontWeight="800" fill="var(--color-maple)">
                O
              </text>
            );
          }
          return (
            <g key={i}>
              <circle cx={sx(i)} cy={fy(f)} r={6.5 * size} fill="var(--color-maple)" />
              <text x={sx(i)} y={fy(f)} textAnchor="middle" dominantBaseline="central" fontSize={9 * size} fontWeight="800" fill="var(--color-tolex)">
                {diagram.fingers[i] ?? ""}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
