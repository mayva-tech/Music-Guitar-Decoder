"use client";

import { LickNeck, mapRequestForLick, type ShowMap } from "./shared";
import { LickTab } from "./LickTab";
import type { SoloAudio } from "./useSoloAudio";
import type { Lick } from "@/lib/music/soloGuide";

export function LickCard({ lick, audio, onShowMap }: { lick: Lick; audio: SoloAudio; onShowMap: ShowMap }) {
  const on = audio.playingKey === `lick:${lick.id}`;
  const over = [...new Set(lick.backing.map(([c]) => c))].join(" – ");
  return (
    <article className="surface flex min-w-0 flex-col gap-3 p-4" data-hl-scope={lick.id} data-testid={`lick-card-${lick.id}`}>
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {lick.tags.map((t) => <span key={t} className="chip text-xs">{t}</span>)}
          <span className="chip text-xs" title="Backing chords">over {over}</span>
        </div>
        <h3 className="text-lg font-bold leading-tight">{lick.title}</h3>
        <p className="mt-0.5 text-sm text-muted">{lick.sub}</p>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg bg-tolex/40 p-1">
        <LickNeck lick={lick} />
      </div>
      <LickTab notes={lick.notes} />
      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-sm ${on ? "btn-primary" : "btn-quiet"}`}
          aria-pressed={on}
          data-testid={`lick-play-${lick.id}`}
          onClick={() => audio.toggleLick(lick)}
        >
          <span aria-hidden>{on ? "■" : "▶"}</span> {on ? "Stop" : "Play"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          data-testid={`lick-show-${lick.id}`}
          onClick={() => onShowMap(mapRequestForLick(lick))}
        >
          Show on fretboard
        </button>
      </div>
    </article>
  );
}
