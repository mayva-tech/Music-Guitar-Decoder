"use client";

import { useApp } from "@/lib/store";
import { TECHNIQUE_NAMES } from "@/lib/music/instructions";
import { degreeWords, pitchClassName } from "@/lib/music/theory";
import type { Arrangement, Part, PlayableNote } from "@/lib/types";

const DEGREE_BY_SEMITONE = ["R", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];
const TAB_SYMBOL: Record<string, string> = {
  slide_up: "/7", slide_down: "\\5", hammer_on: "h7", pull_off: "p5", bend: "7b9", bend_release: "7b9r7", vibrato: "7~",
};
const HOW: Record<string, string> = {
  slide_up: "Keep the finger pressed and glide up the string. Only pick the first note.",
  slide_down: "Keep the finger pressed and glide down the string. Only pick the first note.",
  hammer_on: "Pick one note, then tap a higher fret hard enough that it sounds by itself.",
  pull_off: "Have both fingers down, pick, then flick the higher finger off sideways.",
  bend: "Push the string towards the ceiling until it reaches the target pitch. Use 2–3 fingers together.",
  bend_release: "Bend up to the target, then let the string relax back while it rings.",
  vibrato: "Rock a held note slightly up and down — small and even, like a singer's voice.",
};

export function TheoryPanel({ arr, current, part }: { arr: Arrangement; current: PlayableNote | null; part: Part }) {
  const setPrefs = useApp((s) => s.setPrefs);
  const showScale = useApp((s) => s.prefs.showScale);
  const t = arr.theory;
  if (!t) return null;
  const flats = /b/.test(arr.key.name.split(" ")[0]);
  const seq: { roman: string; symbol: string; fn: string }[] = [];
  for (const c of arr.harmonization.chords) {
    if (!seq.length || seq[seq.length - 1].roman !== c.roman) seq.push({ roman: c.roman, symbol: c.symbol, fn: c.function });
  }
  const keyDegree = current ? DEGREE_BY_SEMITONE[((current.midi - arr.key.tonic) % 12 + 12) % 12] : null;
  const tonic = pitchClassName(arr.key.tonic, flats);
  const used = arr.lead?.techniques_used ?? [];

  return (
    <section className="mt-6 surface p-4 md:p-6" aria-labelledby="theory-h" data-testid="theory-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="theory-h" className="text-lg font-bold">Why it sounds like {t.genre_label.toLowerCase()}</h2>
        <p className="text-sm text-muted">{arr.key.name}, {t.feel === "shuffle" ? "shuffle feel" : "straight eighths"}</p>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div>
          <h3 className="font-semibold">The chords</h3>
          <p className="mt-1 text-sm text-muted">{t.progression_name}</p>
          <ol className="mt-3 flex flex-wrap gap-2">
            {seq.map((c, i) => (
              <li key={i} className="rounded-xl bg-tolex px-3 py-2 text-center" title={c.fn}>
                <span className="block display text-lg">{c.symbol}</span>
                <span className="block text-xs text-muted">{c.roman}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-faint">Roman numerals count chords from the home note: I is {tonic}, IV is four steps up, and so on.</p>
        </div>

        <div>
          <h3 className="font-semibold">The solo scale</h3>
          <p className="mt-1 text-sm text-muted">{t.scale_name}</p>
          <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Scale degrees">
            {t.scale_degrees.map((d) => (
              <li key={d} className={`chip ${d === "R" ? "bg-maple text-tolex" : ""}`} title={degreeWords(d)}>{d}</li>
            ))}
          </ol>
          {arr.lead && (
            <button className="btn btn-quiet btn-sm mt-3" onClick={() => setPrefs({ showScale: !showScale })} aria-pressed={showScale}>
              {showScale ? "Hide the shape on the fretboard" : `Show the shape (frets ${arr.lead.position_fret}–${(arr.lead.position_fret ?? 0) + 3})`}
            </button>
          )}
          {current && keyDegree && (
            <p className="mt-3 text-sm" data-testid="key-degree">
              {current.name} is the <span className="font-semibold">{degreeWords(keyDegree)}</span> of the key
              {current.chord_degree ? <> and the <span className="font-semibold">{degreeWords(current.chord_degree)}</span> of the chord under it.</> : "."}
            </p>
          )}
        </div>

        <div>
          <h3 className="font-semibold">Techniques in the lead</h3>
          {used.length === 0 ? (
            <p className="mt-1 text-sm text-muted">This lead is plain picked notes. Choose “Everything” under Lead techniques to add slides and bends.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {used.map((u) => (
                <li key={u} className={`rounded-xl px-3 py-2 ${part === "lead" && current && (current.technique === u || (u === "vibrato" && current.vibrato)) ? "bg-next/15" : "bg-tolex"}`}>
                  <span className="font-semibold">{TECHNIQUE_NAMES[u]}</span>
                  <code className="ml-2 text-xs text-next">{TAB_SYMBOL[u]}</code>
                  <p className="text-sm text-muted">{HOW[u]}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 border-t border-line pt-5">
        {t.guide.map((g) => (
          <details key={g.title} className="rounded-xl bg-tolex px-4 py-3">
            <summary className="cursor-pointer font-semibold">{g.title}</summary>
            <p className="mt-2 text-muted leading-relaxed">{g.body}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
