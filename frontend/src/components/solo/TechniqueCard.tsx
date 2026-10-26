"use client";

import { LickNeck, mapRequestForLick, type ShowMap } from "./shared";
import { LickTab } from "./LickTab";
import type { SoloAudio } from "./useSoloAudio";
import type { SoloTechnique } from "@/lib/music/soloGuide";

export function TechniqueCard({
  tech,
  audio,
  onShowMap,
}: {
  tech: SoloTechnique;
  audio: SoloAudio;
  onShowMap: ShowMap;
}) {
  const on = audio.playingKey === `lick:${tech.lick.id}`;
  return (
    <article
      className="surface flex min-w-0 flex-col gap-3 p-4"
      data-hl-scope={tech.lick.id}
      data-testid={`technique-card-${tech.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold leading-tight">{tech.name}</h3>
        <span
          className="shrink-0 rounded-md px-2 py-0.5 font-mono text-sm font-bold"
          style={{ background: "color-mix(in srgb, var(--color-next) 22%, var(--color-panel-2))", color: "var(--color-next)" }}
          title="How it looks in TAB"
        >
          {tech.symbol}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted">{tech.what}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
        {tech.how.map((h) => <li key={h}>{h}</li>)}
      </ul>
      <div className="min-w-0 overflow-hidden rounded-lg bg-tolex/40 p-1">
        <LickNeck lick={tech.lick} />
      </div>
      <LickTab notes={tech.lick.notes} />
      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-sm ${on ? "btn-primary" : "btn-quiet"}`}
          aria-pressed={on}
          data-testid={`technique-hear-${tech.id}`}
          onClick={() => audio.toggleLick(tech.lick)}
        >
          <span aria-hidden>{on ? "■" : "▶"}</span> {on ? "Stop" : "Hear it"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid={`technique-show-${tech.id}`}
          onClick={() => onShowMap(mapRequestForLick(tech.lick))}
        >
          Show on fretboard
        </button>
      </div>
    </article>
  );
}
