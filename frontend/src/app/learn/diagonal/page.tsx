"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DiagonalPractice } from "@/components/diagonal/DiagonalPractice";
import { LickChooser } from "@/components/diagonal/LickChooser";
import { playKey, useDiagonalAudio } from "@/components/diagonal/useDiagonalAudio";
import { ScaleFretmapFloat } from "@/components/ScaleFretmapFloat";
import { SectionHead, chordListFor } from "@/components/solo/shared";
import { DIAGONAL_BY_ID, DIAGONAL_IDEAS, DIAGONAL_LICKS, PRACTICE_STEPS } from "@/lib/music/diagonalLicks";
import { useApp, useHydrated } from "@/lib/store";

const FIRST = DIAGONAL_LICKS[0]!.lick.id;

export default function DiagonalLicksPage() {
  const hydrated = useHydrated();
  const storedTone = useApp((s) => s.prefs.leadTone);
  const leadTone = hydrated ? storedTone : "clean";
  const setPrefs = useApp((s) => s.setPrefs);
  const audio = useDiagonalAudio(leadTone);
  const [selected, setSelected] = useState(FIRST);
  const [mapOpen, setMapOpen] = useState(false);

  // Deep link: /learn/diagonal#dg-blues-ladder
  useEffect(() => {
    const id = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (id && DIAGONAL_BY_ID[id]) setSelected(id);
  }, []);

  const dl = DIAGONAL_BY_ID[selected] ?? DIAGONAL_LICKS[0]!;
  const select = (id: string) => {
    if (id === selected) return;
    audio.stop();
    setSelected(id);
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
  };
  const fullKey = playKey(dl.lick.id, { part: null, melodyOnly: false });

  return (
    <div className="theory-page solo-page mx-auto max-w-6xl space-y-10" data-testid="diagonal-page">
      <header className="surface flex flex-wrap items-end justify-between gap-5 px-5 py-6 md:px-8 md:py-8">
        <div className="max-w-2xl">
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>Speed with a melody</p>
          <h1 className="display text-[2rem] md:text-[2.6rem]">Diagonal licks</h1>
          <p className="mt-2 text-[1.05rem] leading-relaxed text-muted">
            Six 20-second licks that travel across the neck instead of up and down one box. Each one is a small solo with a tune:
            a theme, the theme moved up the neck, a fast phrase, then a peak that comes home. Learn the melody first, then build the speed.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a href="#practice" className="btn btn-primary">Start practising</a>
            <Link href="/learn/solo" className="btn btn-quiet btn-sm">Lead solos</Link>
            <Link href="/learn/caged" className="btn btn-quiet btn-sm">CAGED &amp; pentatonic map</Link>
            <Link href="/learn/backing" className="btn btn-quiet btn-sm">Backing tracks</Link>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted" id="dg-tone-label">Lead tone</p>
          <div role="radiogroup" aria-labelledby="dg-tone-label" className="flex gap-1 rounded-full bg-panel-2 p-1" data-testid="dg-tone">
            {(["clean", "crunch"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={leadTone === t}
                onClick={() => setPrefs({ leadTone: t })}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${leadTone === t ? "bg-maple text-tolex" : "text-muted hover:text-ink"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section aria-labelledby="dg-why-heading" className="space-y-4">
        <SectionHead id="dg-why-heading" eyebrow="Why diagonal" title="Not up and down the scale">
          Running a box up and down builds fingers but sounds like an exercise. These licks move the hand along the neck while the tune keeps going.
        </SectionHead>
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1000px]:grid-cols-4">
          {DIAGONAL_IDEAS.map((idea, i) => (
            <article key={idea.title} className="surface p-4">
              <p className="font-mono text-xs" style={{ color: "var(--color-next)" }}>{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 font-bold leading-tight">{idea.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{idea.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="dg-licks-heading" className="space-y-4">
        <SectionHead id="dg-licks-heading" eyebrow="Lick library" title="Six licks, 20 seconds each">
          Rock, blues, country, hard rock, a ballad and pop. Each plays with drums, bass and chords. All are original, written for this app.
        </SectionHead>
        <LickChooser licks={DIAGONAL_LICKS} selected={dl.lick.id} onSelect={select} />
      </section>

      <DiagonalPractice key={dl.lick.id} dl={dl} audio={audio} onShowMap={() => setMapOpen(true)} />

      <section aria-labelledby="dg-routine-heading" className="space-y-3">
        <SectionHead id="dg-routine-heading" eyebrow="Routine" title="How to practise one lick" />
        <ol className="surface grid gap-3 p-4 min-[760px]:grid-cols-5" data-testid="dg-routine">
          {PRACTICE_STEPS.map((s, i) => (
            <li key={i} className="text-sm leading-relaxed">
              <span className="block font-mono text-xs" style={{ color: "var(--color-next)" }}>Step {i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <p className="flex flex-wrap gap-2 pb-4">
        <Link href="/learn/solo" className="btn btn-quiet btn-sm">Lead solo workshop</Link>
        <Link href="/learn/greats" className="btn btn-quiet btn-sm">Guitar greats</Link>
        <Link href="/learn" className="btn btn-quiet btn-sm">Back to Guitar learning</Link>
      </p>

      <ScaleFretmapFloat
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialRoot={dl.lick.root}
        initialMode={dl.lick.mode}
        initialBox={0}
        chordList={chordListFor(dl.lick)}
        lick={dl.lick}
        onPlayLick={() => audio.toggle(dl, { part: null, melodyOnly: false, pct: 100, loop: false, ramp: false, countIn: false })}
        onClearLick={() => setMapOpen(false)}
        playing={audio.playingKey === fullKey}
      />
    </div>
  );
}
