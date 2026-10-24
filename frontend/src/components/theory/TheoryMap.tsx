"use client";

import {
  ALL_TERMS,
  MAP_EDGES,
  MAP_LANES,
  MAP_NODES,
  MAP_VIEWBOX,
  connections,
  edgePath,
  nodeBox,
  type Lane,
} from "@/lib/theory/content";

export function TheoryMap({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const related = new Set(selectedId ? connections(selectedId) : []);
  const hot = MAP_EDGES.filter(
    ([a, b]) => selectedId && (a === selectedId || b === selectedId),
  );

  const scale = 1.35;
  const svgW = Math.round(MAP_VIEWBOX.width * scale);
  const svgH = Math.round(MAP_VIEWBOX.height * scale);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel/40 p-2" data-testid="theory-map">
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        width={svgW}
        height={svgH}
        role="img"
        aria-label="Music theory concept map"
        className="min-w-[1200px]"
      >
        <defs>
          <marker id="theory-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink)" />
          </marker>
        </defs>

        {MAP_LANES.map((lane) => (
          <g key={lane.lane}>
            <text x={12} y={lane.y - 22} fontSize="15" fontWeight="700" fill={`var(--lane-${lane.lane})`}>
              {lane.label}
            </text>
            <text x={12} y={lane.y - 6} fontSize="12" fill="var(--color-faint)">
              {lane.hint}
            </text>
          </g>
        ))}

        {MAP_EDGES.map((e, i) => {
          const isHot = hot.includes(e);
          if (isHot) return null;
          return (
            <path
              key={i}
              d={edgePath(e)}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth="1.5"
              opacity={selectedId ? 0.35 : 0.7}
            />
          );
        })}

        {Object.keys(MAP_NODES).map((id) => {
          const term = ALL_TERMS[id];
          if (!term) return null;
          const box = nodeBox(id);
          const selected = id === selectedId;
          const isRel = related.has(id);
          const dim = selectedId && !selected && !isRel;
          const lane = term.lane as Lane;
          return (
            <g key={id} opacity={dim ? 0.4 : 1}>
              <rect
                x={box.left}
                y={box.top}
                width={box.w}
                height={box.h}
                rx="12"
                fill={selected ? `var(--lane-${lane})` : `var(--lane-${lane}-bg)`}
                stroke={isRel && !selected ? `var(--lane-${lane})` : "transparent"}
                strokeWidth={isRel && !selected ? 3 : 0}
              />
              <foreignObject x={box.left} y={box.top} width={box.w} height={box.h}>
                <button
                  type="button"
                  className="flex h-full w-full items-center justify-center px-2 text-center text-[15px] font-bold leading-snug outline-none focus-visible:ring-2 focus-visible:ring-maple"
                  style={{ color: selected ? "var(--color-tolex)" : `var(--lane-${lane})` }}
                  aria-pressed={selected}
                  data-testid={`theory-node-${id}`}
                  onClick={() => onSelect(id)}
                >
                  {term.mapLabel ?? term.name}
                </button>
              </foreignObject>
            </g>
          );
        })}

        {hot.map((e, i) => (
          <path
            key={`hot-${i}`}
            d={edgePath(e)}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2.5"
            markerEnd="url(#theory-arrow)"
          />
        ))}
      </svg>
    </div>
  );
}
