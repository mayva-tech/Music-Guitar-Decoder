"use client";

import { fretSpan, lickSeconds, type DiagonalLick } from "@/lib/music/diagonalLicks";

const MODE_NAME: Record<string, string> = {
  "minor-pentatonic": "minor pentatonic",
  "major-pentatonic": "major pentatonic",
  blues: "blues",
};

/** One card per lick; the chosen one is pressed. */
export function LickChooser({
  licks,
  selected,
  onSelect,
}: {
  licks: DiagonalLick[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[560px]:grid-cols-2 min-[980px]:grid-cols-3" data-testid="dg-chooser">
      {licks.map((d) => {
        const on = d.lick.id === selected;
        const span = fretSpan(d.lick.notes);
        return (
          <button
            key={d.lick.id}
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
              {d.lick.root} {MODE_NAME[d.lick.mode] ?? d.lick.mode} · {d.lick.bpm} BPM
            </span>
            <span className="mt-1 block font-mono text-xs text-faint">
              frets {span.lo === 0 ? "open" : span.lo}–{span.hi} · {d.speedFeel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function modeName(mode: string): string {
  return MODE_NAME[mode] ?? mode;
}
