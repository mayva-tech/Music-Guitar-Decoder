"use client";

import type { Lane, TheoryVisual } from "@/lib/theory/content";
import { LANE_LABEL } from "@/lib/theory/content";
import { BlocksVisual } from "./BlocksVisual";
import { FretVisual } from "./FretVisual";
import { GridVisual } from "./GridVisual";

export function TheoryVisualStage({
  visual,
  lane,
}: {
  visual: TheoryVisual | null | undefined;
  lane?: Lane;
}) {
  if (!visual) {
    return <p className="text-sm text-muted">Pick a term or start the tour to see an example.</p>;
  }
  if (visual.type === "overview") {
    const lanes: Lane[] = ["pitch", "chords", "time", "colour", "song"];
    return (
      <div className="theory-visual grid gap-2 sm:grid-cols-5">
        {lanes.map((l) => (
          <div key={l} className="rounded-xl px-3 py-4 text-center text-sm font-semibold" style={{ background: `var(--lane-${l}-bg)`, color: `var(--lane-${l})` }}>
            {LANE_LABEL[l]}
          </div>
        ))}
      </div>
    );
  }
  if (visual.type === "fret") return <FretVisual visual={visual} />;
  if (visual.type === "grid") return <GridVisual visual={visual} lane={lane ?? "time"} />;
  if (visual.type === "blocks") return <BlocksVisual visual={visual} />;
  return null;
}
