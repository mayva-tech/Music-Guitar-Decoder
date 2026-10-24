"use client";

import { ALL_TERMS, LANE_LABEL, connections, type TheoryVisual } from "@/lib/theory/content";
import { cancelEnglishSpeech, speakEnglish } from "@/lib/tts/speakEnglish";
import { ExampleButton } from "./ExampleButton";
import { TheoryVisualStage } from "./TheoryVisualStage";

export function TermPanel({
  selectedId,
  playingLabel,
  activeVisual,
  onSelectRelated,
  onPlayExample,
}: {
  selectedId: string | null;
  playingLabel: string | null;
  activeVisual: TheoryVisual | null;
  onSelectRelated: (id: string) => void;
  onPlayExample: (termId: string, exampleIndex: number) => void;
}) {
  const term = selectedId ? ALL_TERMS[selectedId] : null;
  if (!term) {
    return (
      <div className="rounded-2xl border border-line bg-panel-2/60 p-4 text-sm text-muted" data-testid="theory-term-panel">
        Select a node on the map to read what it means and hear an example.
      </div>
    );
  }

  const visual = activeVisual ?? term.figure ?? term.examples[0]?.visual;
  const speakText =
    term.narration.trim() ||
    [term.name, term.short, term.body, term.guitar ? `On guitar. ${term.guitar}` : ""]
      .filter(Boolean)
      .join(" ");

  const replay = () => {
    cancelEnglishSpeech();
    if (speakText) void speakEnglish(speakText).catch(() => undefined);
  };

  return (
    <div className="rounded-2xl border border-line bg-panel-2/80 p-4" data-testid="theory-term-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: `var(--lane-${term.lane})` }}>
          {LANE_LABEL[term.lane]}
        </p>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={replay}
          data-testid="theory-term-speak"
          aria-label={`Read ${term.name} aloud`}
        >
          Read aloud
        </button>
      </div>
      <h2 className="display mt-1 text-2xl">{term.name}</h2>
      <p className="mt-2 text-sm font-semibold text-ink">{term.short}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{term.body}</p>
      {term.guitar && (
        <p className="mt-3 rounded-xl bg-panel px-3 py-2 text-sm text-ink">
          <span className="font-bold">On guitar · </span>
          {term.guitar}
        </p>
      )}

      <div className="mt-4">
        <TheoryVisualStage visual={visual} lane={term.lane} />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[0.65rem] uppercase tracking-wide text-muted">Connected to</p>
        <div className="flex flex-wrap gap-1.5">
          {connections(term.id).map((id) => {
            const t = ALL_TERMS[id];
            if (!t) return null;
            return (
              <button
                key={id}
                type="button"
                className="chip text-xs"
                style={{ color: `var(--lane-${t.lane})` }}
                onClick={() => onSelectRelated(id)}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <p className="text-[0.65rem] uppercase tracking-wide text-muted">Examples</p>
        {term.examples.map((ex, i) => (
          <ExampleButton
            key={`${term.id}-${i}`}
            label={ex.label}
            sub={ex.sub}
            playing={playingLabel === `${term.id}:${i}`}
            onToggle={() => onPlayExample(term.id, i)}
          />
        ))}
      </div>
    </div>
  );
}
