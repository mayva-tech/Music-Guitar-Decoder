"use client";

import { useEffect, useRef, useState } from "react";
import { tempoFromTaps, tempoLabel } from "@/lib/theory/ear";

const IDLE_MS = 2000;

export function TapTempo() {
  const [taps, setTaps] = useState<number[]>([]);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bpm = tempoFromTaps(taps);

  const clearIdle = () => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = null;
  };

  const tap = () => {
    const now = performance.now();
    setTaps((prev) => {
      const next = [...prev, now];
      return next.slice(-8);
    });
    clearIdle();
    idle.current = setTimeout(() => setTaps([]), IDLE_MS);
  };

  useEffect(() => () => clearIdle(), []);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-panel px-4 py-3" data-testid="ear-tap-tempo">
      <button
        type="button"
        className="grid h-16 w-16 place-items-center rounded-full text-sm font-bold text-tolex outline-none focus-visible:ring-2 focus-visible:ring-maple"
        style={{ background: "var(--lane-time)" }}
        onClick={tap}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            tap();
          }
        }}
        data-testid="ear-tap-pad"
        aria-label="Tap tempo"
      >
        Tap
      </button>
      <div>
        <p className="font-mono text-2xl font-bold tabular-nums" data-testid="ear-tap-bpm">
          {bpm == null ? "…" : bpm}
        </p>
        <p className="text-sm text-muted">{bpm == null ? "Tap at least twice" : tempoLabel(bpm)}</p>
      </div>
    </div>
  );
}
