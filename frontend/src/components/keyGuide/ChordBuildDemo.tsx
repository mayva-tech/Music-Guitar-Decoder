"use client";

import type { KeyChord, KeyGuide } from "@/lib/music/keyGuides";

/** Show “skip one, take one” stacking to build the home chord. */
export function ChordBuildDemo({ guide }: { guide: KeyGuide }) {
  const home = guide.chords[0]!;
  const picked = new Set(home.notes);

  return (
    <figure className="rounded-2xl bg-tolex p-4" data-testid={`chord-build-${guide.id}`}>
      <figcaption className="mb-2 text-sm font-semibold text-ink">
        Build the home chord ({home.name})
      </figcaption>
      <p className="mb-3 text-sm text-muted">
        Start on note <strong className="text-ink">1</strong>, skip one, take one, skip one, take one.
        That is notes <strong className="text-ink">1 · 3 · 5</strong>.
      </p>
      <ol className="flex flex-wrap gap-2" aria-label={`Building ${home.name} from the scale`}>
        {guide.scale.map((note, i) => {
          const step = i + 1;
          const on = picked.has(note) && (step === 1 || step === 3 || step === 5);
          return (
            <li
              key={`${note}-build`}
              className={`flex min-w-[3rem] flex-col items-center rounded-xl px-2.5 py-2 ${
                on ? "bg-ok text-tolex ring-2 ring-ok" : "bg-panel/50 text-faint ring-1 ring-line/50"
              }`}
            >
              <span className="text-[0.65rem] font-bold">{step}</span>
              <span className="display text-lg leading-none">{note}</span>
              {on && <span className="mt-0.5 text-[0.65rem] font-bold">{step === 1 ? "R" : step === 3 ? "3" : "5"}</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-ink">
        {home.name} = <span className="font-semibold">{home.notes.join(" + ")}</span>
        {home.quality === "major" ? " — sounds happy / settled." : ""}
      </p>
    </figure>
  );
}

export function qualityLabel(q: KeyChord["quality"]): string {
  if (q === "major") return "happy";
  if (q === "minor") return "sad";
  return "tense";
}
