"use client";

import { SectionHead, type ShowMap } from "./shared";
import { scaleDisplayName } from "@/lib/music/scaleFretmap";
import { SCALE_CHOICES } from "@/lib/music/soloGuide";

export function ScaleChoices({ onShowMap }: { onShowMap: ShowMap }) {
  return (
    <section id="scale" aria-labelledby="solo-scale-heading" className="scroll-mt-4 space-y-4" data-testid="solo-scales">
      <SectionHead id="solo-scale-heading" eyebrow="Choose the scale" title="Which notes can I play?">
        Match the song, not the chord: one scale usually fits a whole section. Each row opens the fretboard map on that scale.
      </SectionHead>
      <div role="table" aria-label="Scales to choose from" className="surface divide-y divide-line px-4">
        <div role="row" className="hidden gap-4 py-2 text-xs uppercase tracking-wide text-faint min-[900px]:grid min-[900px]:grid-cols-[1.2fr_1.1fr_1.4fr_auto]">
          <span role="columnheader">If the song is…</span>
          <span role="columnheader">Use</span>
          <span role="columnheader">Example</span>
          <span role="columnheader" className="w-36 text-right">Map</span>
        </div>
        {SCALE_CHOICES.map((c) => (
          <div
            key={c.song}
            role="row"
            className="grid gap-1 py-3 min-[900px]:grid-cols-[1.2fr_1.1fr_1.4fr_auto] min-[900px]:items-center min-[900px]:gap-4"
          >
            <span role="cell" className="text-sm font-semibold">{c.song}</span>
            <span role="cell" className="text-sm text-muted">{c.use}</span>
            <span role="cell" className="text-sm text-muted">{c.example}</span>
            <span role="cell" className="pt-1 min-[900px]:w-36 min-[900px]:pt-0 min-[900px]:text-right">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                data-testid={`scale-open-${c.root}-${c.mode}`}
                onClick={() => onShowMap({ root: c.root, mode: c.mode, box: c.box, chordList: c.chords })}
              >
                Show {scaleDisplayName(c.root, c.mode)}
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
