"use client";

import { useState } from "react";
import { fretSpan, lickSeconds, type DiagonalLick } from "@/lib/music/diagonalLicks";
import { keyOfLabel, scaleModeKeyLabel, type ScaleMode } from "@/lib/music/scaleFretmap";

const SETS: { set: 1 | 2; title: string; note: string }[] = [
  { set: 1, title: "Set 1", note: "Pentatonic and blues: start here" },
  { set: 2, title: "Set 2", note: "New styles and seven-note scales" },
];

type LevelFilter = "all" | DiagonalLick["level"];
const LEVELS: [LevelFilter, string][] = [["all", "All"], ["Medium", "Medium"], ["Harder", "Harder"]];

/** Cards for every lick, grouped by set, with a level filter; the chosen one is pressed. */
export function LickChooser({
  licks,
  selected,
  onSelect,
}: {
  licks: DiagonalLick[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [level, setLevel] = useState<LevelFilter>("all");
  const shown = licks.filter((d) => level === "all" || d.level === level);

  return (
    <div className="space-y-4" data-testid="dg-chooser">
      <div role="group" aria-label="Filter by level" className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted">Level</span>
        {LEVELS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={level === id}
            onClick={() => setLevel(id)}
            className={`rounded-full px-3 py-0.5 text-sm ${level === id ? "bg-next font-semibold text-tolex" : "bg-panel-2 text-muted hover:text-ink"}`}
            data-testid={`dg-level-${id}`}
          >
            {label} <span className="font-mono text-xs opacity-70">{licks.filter((d) => id === "all" || d.level === id).length}</span>
          </button>
        ))}
      </div>

      {SETS.map(({ set, title, note }) => {
        const group = shown.filter((d) => d.set === set);
        if (!group.length) return null;
        return (
          <div key={set} className="space-y-2" data-testid={`dg-set-${set}`}>
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-bold">{title}</span>
              <span className="text-muted">{note} · {group.length} licks</span>
            </h3>
            <div className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2 min-[980px]:grid-cols-3">
              {group.map((d) => <LickCardButton key={d.lick.id} d={d} on={d.lick.id === selected} onSelect={onSelect} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LickCardButton({ d, on, onSelect }: { d: DiagonalLick; on: boolean; onSelect: (id: string) => void }) {
  const span = fretSpan(d.lick.notes);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onSelect(d.lick.id)}
      data-testid={`dg-pick-${d.lick.id}`}
      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
        on ? "border-next bg-panel-2" : "border-line bg-panel hover:border-muted"
      }`}
    >
      <span className="flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted">
        <span className="chip text-[0.7rem]">{d.genre}</span>
        <span className="chip text-[0.7rem]">{d.level}</span>
        <span className="font-mono">{Math.round(lickSeconds(d))} s</span>
      </span>
      <span className="mt-1 block text-lg font-bold leading-tight">{d.lick.title}</span>
      <span className="block text-sm text-muted">
        {keyOfLabel(d.lick.root, d.lick.mode)} · {d.lick.bpm} BPM
      </span>
      <span className="mt-1 block font-mono text-xs text-faint">
        frets {span.lo === 0 ? "open" : span.lo}–{span.hi} · {d.speedFeel}
      </span>
    </button>
  );
}

export function modeName(mode: string): string {
  return scaleModeKeyLabel(mode as ScaleMode) || mode;
}
