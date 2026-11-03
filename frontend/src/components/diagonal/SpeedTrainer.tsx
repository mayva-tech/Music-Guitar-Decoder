"use client";

import {
  RAMP_MAX,
  RAMP_STEP,
  TEMPO_MAX,
  TEMPO_MIN,
  TEMPO_PRESETS,
  lickSeconds,
  notesPerSecond,
  partRange,
  tempoAt,
  type DiagonalLick,
} from "@/lib/music/diagonalLicks";

export interface TrainerState {
  pct: number;
  loop: boolean;
  ramp: boolean;
  countIn: boolean;
}

/** Tempo (% of the lick's BPM), loop, speed-up-each-loop and count-in, plus a live status line. */
export function SpeedTrainer({
  dl,
  part,
  state,
  onChange,
  playing,
  pass,
  livePct,
}: {
  dl: DiagonalLick;
  part: number | null;
  state: TrainerState;
  onChange: (next: TrainerState) => void;
  playing: boolean;
  pass: number;
  livePct: number | null;
}) {
  const set = (patch: Partial<TrainerState>) => onChange({ ...state, ...patch });
  const { from, to } = partRange(dl, part);
  const secs = ((to - from) * 60) / tempoAt(dl, state.pct);
  const shownPct = playing && livePct != null ? livePct : state.pct;

  return (
    <div className="rounded-2xl border border-line bg-panel p-4" data-testid="dg-trainer">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-bold">Speed trainer</h3>
        <p className="font-mono text-sm" aria-live="polite" data-testid="dg-status">
          {playing
            ? `Loop ${pass} · ${shownPct}% · ${tempoAt(dl, shownPct)} BPM`
            : `${state.pct}% · ${tempoAt(dl, state.pct)} BPM · ${secs.toFixed(1)} s`}
        </p>
      </div>

      <label className="mt-3 block text-sm" htmlFor="dg-tempo">
        Tempo <span className="text-muted">(% of {dl.lick.bpm} BPM)</span>
      </label>
      <div className="mt-1 flex items-center gap-3">
        <input
          id="dg-tempo"
          type="range"
          min={TEMPO_MIN}
          max={TEMPO_MAX}
          step={5}
          value={state.pct}
          onChange={(e) => set({ pct: Number(e.target.value) })}
          className="w-full accent-[var(--color-next)]"
          data-testid="dg-tempo"
          aria-valuetext={`${state.pct}%, ${tempoAt(dl, state.pct)} BPM`}
        />
        <span className="w-12 shrink-0 text-right font-mono text-sm">{state.pct}%</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Tempo presets">
        {TEMPO_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={state.pct === p}
            onClick={() => set({ pct: p })}
            className={`rounded-full px-2.5 py-0.5 font-mono text-xs ${state.pct === p ? "bg-next text-tolex" : "bg-panel-2 text-muted hover:text-ink"}`}
            data-testid={`dg-preset-${p}`}
          >
            {p}%
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={state.loop} onChange={(e) => set({ loop: e.target.checked, ramp: e.target.checked && state.ramp })} data-testid="dg-loop" />
          Loop
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.ramp}
            onChange={(e) => set({ ramp: e.target.checked, loop: e.target.checked || state.loop })}
            data-testid="dg-ramp"
          />
          Speed up {RAMP_STEP}% each loop <span className="text-muted">(up to {RAMP_MAX}%)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={state.countIn} onChange={(e) => set({ countIn: e.target.checked })} data-testid="dg-countin" />
          Count in one bar
          <span className="ml-1 flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((k) => (
              <span key={k} data-hl={`count_${k}`} className="theory-cell inline-block h-2.5 w-2.5 rounded-full bg-panel-2" />
            ))}
          </span>
        </label>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted" data-testid="dg-speed-note">
        Fastest notes ({dl.speedFeel}): {notesPerSecond(dl, shownPct)} a second at {shownPct}%. Whole lick:{" "}
        {lickSeconds(dl, shownPct).toFixed(1)} s. Changes apply from the next loop.
      </p>
    </div>
  );
}
