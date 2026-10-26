"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Fretboard } from "@/components/Fretboard";
import { BeginnerCorner } from "@/components/home/BeginnerCorner";
import { Notice } from "@/components/AppShell";
import { useApp, useHydrated } from "@/lib/store";
import { api } from "@/lib/api";

// The hero shows the first four notes of the demo solo walking across the neck.
const HERO_NOTES = [
  { string: 1, fret: 0, finger: 0, name: "E" },
  { string: 1, fret: 3, finger: 3, name: "G" },
  { string: 2, fret: 1, finger: 1, name: "C" },
  { string: 2, fret: 3, finger: 3, name: "D" },
];

export default function Home() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { onboarded, prefs, arrangement, melody, setMelody } = useApp();
  const [step, setStep] = useState(0);
  const [demoError, setDemoError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/onboarding");
  }, [hydrated, onboarded, router]);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setStep((s) => (s + 1) % HERO_NOTES.length), 1400);
    return () => clearInterval(t);
  }, []);

  const tryDemo = async () => {
    setDemoError(null);
    try {
      setMelody(await api.demo());
      router.push("/decoder");
    } catch (e) {
      setDemoError((e as Error).message);
    }
  };

  if (!hydrated || !onboarded) return null;
  const cur = HERO_NOTES[step];
  const nxt = HERO_NOTES[(step + 1) % HERO_NOTES.length];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10">
        <section className="pt-4 md:pt-10 lg:col-start-1 lg:row-start-1">
          <h1 className="display text-[2.6rem] leading-[0.98] sm:text-[3.6rem] md:text-[4.6rem] max-w-4xl">
            Hum it.<br />Rock it.<br />Play it.
          </h1>
          <p className="mt-5 max-w-xl text-[1.1rem] leading-relaxed text-muted">
            Hum a few seconds of any tune. Music Decoder finds the notes, adds a rock band, writes you an easy guitar solo, and shows
            your fingers exactly where to go.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/record" className="btn btn-primary">Record a melody</Link>
            <button className="btn btn-ghost" onClick={tryDemo}>Try the demo tune</button>
            <Link href="/riffs" className="btn btn-ghost">Practise a riff</Link>
          </div>
          {demoError && <div className="mt-4 max-w-xl"><Notice tone="error">{demoError}</Notice></div>}
        </section>

        {/* Right-hand column on wide screens: beginner strumming / picking / fingerstyle tutorial. */}
        <div className="mt-10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:pt-10">
          <BeginnerCorner />
        </div>

        <section className="mt-10 surface p-4 md:p-6 lg:col-start-1 lg:row-start-2" aria-label="Example: the first notes of the demo solo">
          <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
            <p className="text-[1.05rem]">
              <span className="text-muted">Now </span>
              <span className="display text-xl">{cur.name}</span>
              <span className="text-muted"> — {cur.fret === 0 ? "thinnest string, no finger" : `fret ${cur.fret}, ${["", "index", "middle", "ring", "pinky"][cur.finger]} finger`}</span>
            </p>
            <p className="text-sm text-next">Next {nxt.name}</p>
          </div>
          <Fretboard
            handedness={prefs.handedness}
            view={prefs.viewMode}
            frets={7}
            current={{ ...cur, status: "target" }}
            next={{ ...nxt, status: "next" }}
          />
        </section>
      </div>

      <section className="mt-12 grid gap-6 md:grid-cols-3" aria-label="How it works">
        {[
          ["Hum or whistle", "5–15 seconds is plenty. One note at a time works best."],
          ["Check the notes", "Uncertain notes are marked in amber so you can fix them. Then pick the chords you like."],
          ["Play along", "Follow the glowing dot. The microphone listens and tells you when you've got it."],
        ].map(([t, d], i) => (
          <div key={t} className="flex gap-4">
            <span className="display text-3xl text-faint" aria-hidden>{i + 1}</span>
            <div>
              <h2 className="text-lg font-bold">{t}</h2>
              <p className="mt-1 text-muted leading-relaxed">{d}</p>
            </div>
          </div>
        ))}
      </section>

      {(arrangement || melody) && (
        <section className="mt-12">
          <h2 className="text-lg font-bold mb-3">Pick up where you left off</h2>
          <div className="flex flex-wrap gap-3">
            {arrangement && <Link className="btn btn-quiet" href="/learn">Practise “{arrangement.title}”</Link>}
            {melody && <Link className="btn btn-quiet" href="/decoder">Back to your decoded tune</Link>}
          </div>
        </section>
      )}
    </div>
  );
}
