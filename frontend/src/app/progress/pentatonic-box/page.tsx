"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { PentatonicBoxDiagram } from "@/components/keyGuide/PentatonicBoxDiagram";
import { PentatonicBuildSteps } from "@/components/keyGuide/PentatonicBuildSteps";
import { ReadAloudFloat } from "@/components/ReadAloudFloat";
import { ScaleFretmapFloat } from "@/components/ScaleFretmapFloat";
import { PENTATONIC_GUIDES, type PentatonicGuide } from "@/lib/music/pentatonicGuides";
import type { ScaleRoot } from "@/lib/music/scaleFretmap";
import { useApp, useHydrated } from "@/lib/store";
import { cancelEnglishSpeech, speakEnglish } from "@/lib/tts/speakEnglish";

function guideSpeakText(g: PentatonicGuide): string {
  return [
    g.name,
    g.tip,
    `The five notes are ${g.notes.join(", ")}.`,
    "Build it by starting with the natural minor scale, then drop the second and sixth degrees.",
    `That leaves root, flat third, fourth, fifth, and flat seventh.`,
    `On the guitar, put the root at fret ${g.rootFret} on the thick E string, then play two notes per string in a four-fret box.`,
    `The same notes are also ${g.relativeMajor}.`,
  ].join(" ");
}

export default function PentatonicBoxPage() {
  const hydrated = useHydrated();
  const autoRead = useApp((s) => s.prefs.autoReadAloud);
  const setPrefs = useApp((s) => s.setPrefs);
  const [guideId, setGuideId] = useState(PENTATONIC_GUIDES[0]!.id);
  const [floatOpen, setFloatOpen] = useState(false);
  const [fretmapOpen, setFretmapOpen] = useState(false);

  const guide = useMemo(
    () => PENTATONIC_GUIDES.find((g) => g.id === guideId) ?? PENTATONIC_GUIDES[0]!,
    [guideId],
  );
  const fretmapRoot = (guide.root as ScaleRoot) || "A";

  useEffect(() => {
    if (!autoRead || !hydrated) return;
    const ac = new AbortController();
    void speakEnglish(guideSpeakText(guide), { signal: ac.signal });
    return () => {
      ac.abort();
      cancelEnglishSpeech();
    };
  }, [guide, autoRead, hydrated]);

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/progress" className="text-muted hover:text-ink">← My progress</Link>
        <span className="text-faint">·</span>
        <span className="text-muted">The pentatonic box</span>
      </div>

      <PageTitle
        title="The pentatonic box"
        lead="Five notes, one shape. See how the minor pentatonic is carved from the minor scale, then parked in a four-fret box on the neck."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm ${autoRead ? "btn-primary" : "btn-quiet"}`}
            aria-pressed={autoRead}
            onClick={() => setPrefs({ autoReadAloud: !autoRead })}
          >
            Auto read {autoRead ? "On" : "Off"}
          </button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => setFloatOpen(true)}>
            Open read panel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-testid="open-scale-fretmap"
            onClick={() => setFretmapOpen(true)}
          >
            Fretboard map
          </button>
        </div>
      </PageTitle>

      <section className="mb-6 surface p-5">
        <h2 className="text-lg font-bold">The simple idea</h2>
        <ol className="mt-3 grid list-decimal gap-2 pl-5 text-muted leading-relaxed">
          <li>A full minor scale has <strong className="text-ink">seven</strong> notes.</li>
          <li>Drop two of them (the 2nd and 6th) → <strong className="text-ink">five</strong> notes = minor pentatonic.</li>
          <li>On guitar those five notes sit in a <strong className="text-ink">box</strong>: four frets wide, two notes per string.</li>
          <li>Slide the box to a new root fret and you change key without learning a new shape.</li>
        </ol>
      </section>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Example keys">
        {PENTATONIC_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === guideId}
            className={`btn btn-sm ${g.id === guideId ? "btn-primary" : "btn-quiet"}`}
            data-testid={`penta-tab-${g.id}`}
            onClick={() => setGuideId(g.id)}
          >
            {g.root} minor
          </button>
        ))}
      </div>

      <div className="grid gap-4" role="tabpanel" aria-label={guide.name}>
        <p className="text-sm text-muted">{guide.tip}</p>
        <PentatonicBuildSteps guide={guide} />
        <section className="surface p-5">
          <h2 className="text-lg font-bold">{guide.name} on the fretboard</h2>
          <p className="mt-1 text-sm text-muted">
            Index at the root, then fill the box. Gold dots are the other four notes; green is home.
          </p>
          <div className="mt-3">
            <PentatonicBoxDiagram guide={guide} />
          </div>
        </section>
      </div>

      <section className="mt-4 surface p-5">
        <h2 className="text-lg font-bold">See every note on the neck</h2>
        <p className="mt-1 text-sm text-muted">
          Open the fretboard map, pick root <strong className="text-ink">{guide.root}</strong> and{" "}
          <strong className="text-ink">minor</strong> — the map highlights the seven-note minor scale.
          The pentatonic box uses five of those (skip the 2nd and 6th).
        </p>
        <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => setFretmapOpen(true)}>
          Open fretboard map
        </button>
      </section>

      <ReadAloudFloat
        open={floatOpen}
        onOpenChange={setFloatOpen}
        selection={{
          id: guide.id,
          title: guide.name,
          speakText: guideSpeakText(guide),
          children: (
            <>
              <p>{guide.tip}</p>
              <p>Notes: {guide.notes.join(" · ")}</p>
              <p>Also {guide.relativeMajor}.</p>
              <p>Box root at fret {guide.rootFret} on the thick E string.</p>
            </>
          ),
        }}
      />

      <ScaleFretmapFloat
        open={fretmapOpen}
        onOpenChange={setFretmapOpen}
        initialRoot={fretmapRoot}
        initialMode="minor"
      />
    </div>
  );
}
