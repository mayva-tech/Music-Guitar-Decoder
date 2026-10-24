"use client";

import {
  MINOR_PENTATONIC_DEGREES,
  NATURAL_MINOR_STEPS,
  naturalMinorNotes,
  type PentatonicGuide,
} from "@/lib/music/pentatonicGuides";

/** Keep these natural-minor degrees; drop the 2nd and 6th. */
const KEEP = new Set([0, 3, 5, 7, 10]);

/** Show how five notes are carved out of the seven-note minor scale. */
export function PentatonicBuildSteps({ guide }: { guide: PentatonicGuide }) {
  const full = naturalMinorNotes(guide.root);

  return (
    <div className="grid gap-4" data-testid={`penta-build-${guide.id}`}>
      <section className="rounded-2xl bg-tolex p-4">
        <h3 className="text-sm font-semibold text-ink">1. Start with the natural minor scale</h3>
        <p className="mt-1 text-sm text-muted">
          {guide.root} natural minor has seven notes — the “sad” ladder that belongs with {guide.root} minor chords.
        </p>
        <ol className="mt-3 flex flex-wrap gap-2" aria-label={`${guide.root} natural minor`}>
          {full.map((note, i) => {
            const step = NATURAL_MINOR_STEPS[i]!;
            const keep = KEEP.has(step);
            return (
              <li
                key={`${note}-full`}
                className={`flex min-w-[3rem] flex-col items-center rounded-xl px-2.5 py-2 ${
                  keep ? "bg-panel ring-1 ring-line text-ink" : "bg-panel/40 text-faint ring-1 ring-line/40 line-through"
                }`}
              >
                <span className="text-[0.65rem] font-bold">{i + 1}</span>
                <span className="display text-lg leading-none">{note}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-muted">
          Cross out the <strong className="text-ink">2nd</strong> and <strong className="text-ink">6th</strong> degrees
          (the notes that sound the most “scale-y”). Five notes remain.
        </p>
      </section>

      <section className="rounded-2xl bg-tolex p-4">
        <h3 className="text-sm font-semibold text-ink">2. The five notes — {guide.name}</h3>
        <ol className="mt-3 flex flex-wrap gap-2" aria-label={guide.name}>
          {guide.notes.map((note, i) => (
            <li
              key={`${note}-penta`}
              className={`flex min-w-[3.25rem] flex-col items-center rounded-xl px-3 py-2 ${
                i === 0 ? "bg-ok text-tolex" : "bg-ok/25 text-ink ring-1 ring-ok/40"
              }`}
            >
              <span className="text-[0.65rem] font-bold uppercase tracking-wide">{MINOR_PENTATONIC_DEGREES[i]}</span>
              <span className="display text-xl leading-none">{note}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted">
          Recipe from the root: <strong className="text-ink">R · ♭3 · 4 · 5 · ♭7</strong>
          {" "}(+0, +3, +5, +7, +10 frets / semitones).
        </p>
        <p className="mt-2 text-sm text-muted">
          Same five notes as <strong className="text-ink">{guide.relativeMajor}</strong> — major starts three frets higher
          and feels brighter; minor starts on {guide.root} and feels rock / blues.
        </p>
      </section>

      <section className="rounded-2xl bg-tolex p-4">
        <h3 className="text-sm font-semibold text-ink">3. Fold it into a box on the guitar</h3>
        <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-sm text-muted leading-relaxed">
          <li>Put the <strong className="text-ink">root</strong> under your index finger on the thick E string (fret {guide.rootFret} for this example).</li>
          <li>Use <strong className="text-ink">one finger per fret</strong> across four frets — the “box”.</li>
          <li>Play <strong className="text-ink">two notes on each string</strong>, then move to the next thinner string.</li>
          <li>Slide the whole box to another root fret and you have a new key — same shape.</li>
        </ol>
      </section>
    </div>
  );
}
