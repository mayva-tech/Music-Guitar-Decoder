"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { PowerChordShapeDiagram } from "@/components/PowerChordShapeDiagram";
import { ChordBuildDemo } from "@/components/keyGuide/ChordBuildDemo";
import { KeyFamilyBoard } from "@/components/keyGuide/KeyFamilyBoard";
import { ScaleLadder } from "@/components/keyGuide/ScaleLadder";
import { ReadAloudFloat } from "@/components/ReadAloudFloat";
import { ScaleFretmapFloat } from "@/components/ScaleFretmapFloat";
import { KEY_GUIDES, type KeyGuide } from "@/lib/music/keyGuides";
import type { ScaleRoot } from "@/lib/music/scaleFretmap";
import { useApp, useHydrated } from "@/lib/store";
import { cancelEnglishSpeech, speakEnglish } from "@/lib/tts/speakEnglish";

function guideSpeakText(g: KeyGuide): string {
  const chordLine = g.chords
    .filter((c) => ["I", "IV", "V", "vi"].includes(c.roman))
    .map((c) => `${c.roman} ${c.name}: ${c.notes.join(" ")}`)
    .join(". ");
  const powerLine = g.powerChords.map((p) => p.symbol).join(", ");
  return [
    g.name,
    g.tip,
    `The scale is ${g.scale.join(", ")}.`,
    `Home chord ${g.chords[0]!.name} is ${g.chords[0]!.notes.join(", ")}.`,
    `Main chords: ${chordLine}.`,
    `Power chords: ${powerLine}.`,
  ].join(" ");
}

export default function BuildingChordsPage() {
  const hydrated = useHydrated();
  const autoRead = useApp((s) => s.prefs.autoReadAloud);
  const setPrefs = useApp((s) => s.setPrefs);
  const [keyId, setKeyId] = useState(KEY_GUIDES[0]!.id);
  const [floatOpen, setFloatOpen] = useState(false);
  const [fretmapOpen, setFretmapOpen] = useState(false);

  const guide = useMemo(
    () => KEY_GUIDES.find((k) => k.id === keyId) ?? KEY_GUIDES[0]!,
    [keyId],
  );
  const fretmapRoot = (guide.home as ScaleRoot) || "C";

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
        <span className="text-muted">From tune to chords</span>
      </div>

      <PageTitle
        title="From tune to chords"
        lead="Pick a key, see its scale, build the home chord, then list every chord and power chord you get. Same idea in C, D, or G."
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
          <li>Your tune has a <strong className="text-ink">home note</strong> — that names the key (C → C major).</li>
          <li>A <strong className="text-ink">scale</strong> is the seven notes that belong in that key.</li>
          <li>A <strong className="text-ink">chord</strong> is three of those notes: take 1, skip, take, skip, take (1 · 3 · 5).</li>
          <li>Do that on every scale step and you get the <strong className="text-ink">chord family</strong>. Rock often keeps just root + 5th = <strong className="text-ink">power chords</strong>.</li>
        </ol>
      </section>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Example keys">
        {KEY_GUIDES.map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={k.id === keyId}
            className={`btn btn-sm ${k.id === keyId ? "btn-primary" : "btn-quiet"}`}
            data-testid={`key-tab-${k.id}`}
            onClick={() => setKeyId(k.id)}
          >
            {k.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4" role="tabpanel" aria-label={guide.name}>
        <ScaleLadder guide={guide} />
        <ChordBuildDemo guide={guide} />
        <KeyFamilyBoard guide={guide} />
        <section className="surface p-5">
          <h2 className="text-lg font-bold">One power-chord shape</h2>
          <p className="mt-1 text-sm text-muted">
            Index on the root, ring two frets higher on the next thinner string. Slide that shape to every power chord above.
          </p>
          <div className="mt-3">
            <PowerChordShapeDiagram />
          </div>
        </section>
      </div>

      <section className="mt-4 surface p-5">
        <h2 className="text-lg font-bold">See it on the whole neck</h2>
        <p className="mt-1 text-sm text-muted">
          Open the fretboard map to see every note from open to fret 22. Pick C–B and major or minor — matching notes light up. Drag the panel smaller and scroll sideways to keep reading frets.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm mt-3"
          onClick={() => setFretmapOpen(true)}
        >
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
              <p>Scale: {guide.scale.join(" · ")}</p>
              <p>Home: {guide.chords[0]!.name} = {guide.chords[0]!.notes.join(" + ")}</p>
              <p>Power chords: {guide.powerChords.map((p) => p.symbol).join(", ")}</p>
            </>
          ),
        }}
      />

      <ScaleFretmapFloat
        open={fretmapOpen}
        onOpenChange={setFretmapOpen}
        initialRoot={fretmapRoot}
        initialMode="major"
      />
    </div>
  );
}
