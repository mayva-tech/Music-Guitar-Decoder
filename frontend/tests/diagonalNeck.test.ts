import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScaleFretmapNeck } from "@/components/ScaleFretmapNeck";
import { buildFretmap } from "@/lib/music/scaleFretmap";
import { DIAGONAL_BY_ID } from "@/lib/music/diagonalLicks";
import { LICKS_BY_ID } from "@/lib/music/soloGuide";

const dl = DIAGONAL_BY_ID["dg-staircase"]!;
const cells = buildFretmap("A", "minor-pentatonic");
const neck = (lick: Record<string, unknown>) =>
  renderToString(createElement(ScaleFretmapNeck, { cells, root: "A", mode: "minor-pentatonic", lick } as never));

describe("ScaleFretmapNeck route and melody rings", () => {
  it("draws a route through the lick only when asked", () => {
    expect(neck({ notes: LICKS_BY_ID.call!.notes })).not.toContain("lick-route");
    const html = neck({ notes: dl.lick.notes, compact: true, route: true });
    const d = html.match(/<path d="(M[^"]+)" data-testid="lick-route"/)?.[1] ?? "";
    // One segment per change of position: dozens for a 20-second lick.
    expect(d.split("L").length).toBeGreaterThan(20);
  });

  it("rings every position that holds a melody note", () => {
    const html = neck({ notes: dl.lick.notes, compact: true, route: true, accent: new Set(dl.melody) });
    const melodyPositions = new Set(dl.melody.map((i) => `${dl.lick.notes[i]!.string}:${dl.lick.notes[i]!.fret}`));
    const ringed = [...html.matchAll(/data-lick-marker="(\d:\d+)" data-note="[^"]+" data-melody="true"/g)].map((m) => m[1]);
    expect(new Set(ringed)).toEqual(melodyPositions);
  });
});
