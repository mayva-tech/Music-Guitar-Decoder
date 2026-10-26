"use client";

import { useState } from "react";
import type { WorkedSong as WorkedSongData } from "@/lib/theory/ear";
import type { TheoryExample, TheoryVisual } from "@/lib/theory/content";
import { ExampleButton } from "@/components/theory/ExampleButton";
import { TheoryVisualStage } from "@/components/theory/TheoryVisualStage";

export function WorkedSong({
  song,
  playingLabel,
  onPlayExample,
}: {
  song: WorkedSongData;
  playingLabel: string | null;
  onPlayExample: (key: string, ex: TheoryExample) => void;
}) {
  const first = song.stages[0]?.examples[0];
  const [visual, setVisual] = useState<TheoryVisual | null>(first?.visual ?? null);
  const [caption, setCaption] = useState(first ? `${first.label}. ${first.sub}` : "");

  return (
    <article
      className="grid gap-6 rounded-2xl border border-line bg-panel/50 p-4 ear-worked"
      data-testid={`ear-worked-${song.id}`}
    >
      <div className="min-w-0 space-y-4">
        <div>
          <p className="font-mono text-xs text-muted">{song.meta}</p>
          <h3 className="display mt-1 text-2xl">{song.title}</h3>
        </div>
        {song.stages.map((stage, si) => (
          <div key={stage.title} className="space-y-2">
            <p className="text-sm font-bold">
              <span className="font-mono text-muted">{si + 1}.</span> {stage.title}
            </p>
            <p className="text-sm text-muted">{stage.text}</p>
            <div className="grid gap-2">
              {stage.examples.map((ex, ei) => {
                const key = `${song.id}:${si}:${ei}`;
                return (
                  <ExampleButton
                    key={key}
                    label={ex.label}
                    sub={ex.sub}
                    playing={playingLabel === key}
                    onToggle={() => {
                      setVisual(ex.visual);
                      setCaption(`${ex.label}. ${ex.sub}`);
                      onPlayExample(key, ex);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        className="ear-worked-stage min-w-0 self-start rounded-xl bg-panel p-3 md:sticky"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        {caption ? <p className="mb-2 text-sm text-muted" data-testid={`ear-worked-caption-${song.id}`}>{caption}</p> : null}
        <TheoryVisualStage visual={visual} lane="song" />
      </div>
    </article>
  );
}
