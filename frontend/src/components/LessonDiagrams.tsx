"use client";

import { ChordRecipesDiagram } from "@/components/ChordRecipesDiagram";
import { PowerChordShapeDiagram } from "@/components/PowerChordShapeDiagram";
import type { LessonDiagramId } from "@/lib/music/lessons";

export function LessonDiagrams({ ids }: { ids: LessonDiagramId[] }) {
  if (!ids.length) return null;
  return (
    <div className="mt-3 grid gap-3" data-testid="lesson-diagrams">
      {ids.map((id) => {
        if (id === "chord-recipes") return <ChordRecipesDiagram key={id} />;
        if (id === "power-chord-shape") return <PowerChordShapeDiagram key={id} />;
        return null;
      })}
    </div>
  );
}
