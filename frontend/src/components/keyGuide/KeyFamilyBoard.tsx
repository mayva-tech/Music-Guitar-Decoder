"use client";

import { qualityLabel } from "@/components/keyGuide/ChordBuildDemo";
import type { KeyGuide } from "@/lib/music/keyGuides";

/** All seven chords in the key, plus the power-chord shortlist. */
export function KeyFamilyBoard({ guide }: { guide: KeyGuide }) {
  return (
    <div className="grid gap-4" data-testid={`key-family-${guide.id}`}>
      <section className="rounded-2xl bg-tolex p-4">
        <h3 className="text-sm font-semibold text-ink">Chords from {guide.name}</h3>
        <p className="mt-1 text-sm text-muted">
          Start with the big three: <strong className="text-ink">I, IV, V</strong> (home, away, tension). Add{" "}
          <strong className="text-ink">vi</strong> when you want a sadder colour.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {guide.chords.map((c) => {
            const highlight = c.roman === "I" || c.roman === "IV" || c.roman === "V" || c.roman === "vi";
            return (
              <li
                key={c.roman}
                className={`rounded-xl px-3 py-2.5 ${highlight ? "bg-panel ring-1 ring-maple/50" : "bg-panel/40 ring-1 ring-line/40"}`}
                data-testid={`chord-card-${guide.id}-${c.name}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-ink">
                    <span className="text-muted">{c.roman}</span> · {c.name}
                  </span>
                  <span className="text-xs text-muted">{c.job}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {c.notes.join(" · ")}
                  <span className="text-faint"> · {qualityLabel(c.quality)}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-tolex p-4">
        <h3 className="text-sm font-semibold text-ink">Power chords from {guide.name}</h3>
        <p className="mt-1 text-sm text-muted">
          Keep only the <strong className="text-ink">root</strong> and the <strong className="text-ink">5th</strong>.
          Same shape — slide it to each root. Great for rock when full chords get muddy.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Power chords in ${guide.name}`}>
          {guide.powerChords.map((p) => (
            <li
              key={p.symbol}
              className="flex flex-col items-center rounded-xl bg-ok/15 px-3 py-2 ring-1 ring-ok/40"
              data-testid={`power-${guide.id}-${p.symbol}`}
            >
              <span className="display text-lg leading-none text-ok">{p.symbol}</span>
              <span className="mt-0.5 text-xs text-muted">{p.notes.join(" + ")}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Example loop:{" "}
          <span className="font-semibold text-ink">
            {guide.powerChords[0]!.symbol} · {guide.powerChords[4]!.symbol} · {guide.powerChords[0]!.symbol} ·{" "}
            {guide.powerChords[4]!.symbol}
          </span>{" "}
          (I5 → V5 → I5 → V5).
        </p>
      </section>
    </div>
  );
}
