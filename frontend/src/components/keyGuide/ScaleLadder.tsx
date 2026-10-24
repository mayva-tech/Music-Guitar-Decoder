"use client";

import type { KeyGuide } from "@/lib/music/keyGuides";

/** Big numbered scale steps — easy to scan, not a fret grid. */
export function ScaleLadder({ guide }: { guide: KeyGuide }) {
  return (
    <figure className="rounded-2xl bg-tolex p-4" data-testid={`scale-ladder-${guide.id}`}>
      <figcaption className="mb-3 text-sm font-semibold text-ink">
        {guide.name} scale — seven notes that belong together
      </figcaption>
      <ol className="flex flex-wrap gap-2" aria-label={`${guide.name} scale`}>
        {guide.scale.map((note, i) => (
          <li
            key={`${note}-${i}`}
            className={`flex min-w-[3.25rem] flex-col items-center rounded-xl px-3 py-2 ${
              i === 0 ? "bg-ok text-tolex" : "bg-panel ring-1 ring-line text-ink"
            }`}
          >
            <span className="text-[0.65rem] font-bold uppercase tracking-wide opacity-80">{i + 1}</span>
            <span className="display text-xl leading-none">{note}</span>
          </li>
        ))}
        <li className="flex min-w-[3.25rem] flex-col items-center rounded-xl bg-panel/60 px-3 py-2 text-muted ring-1 ring-line/60">
          <span className="text-[0.65rem] font-bold uppercase tracking-wide">8</span>
          <span className="display text-xl leading-none">{guide.home}</span>
        </li>
      </ol>
      <p className="mt-3 text-sm text-muted">{guide.tip}</p>
    </figure>
  );
}
