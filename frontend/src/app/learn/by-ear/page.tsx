"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { CheatSheet } from "@/components/ear/CheatSheet";
import { Drill } from "@/components/ear/Drill";
import { MethodStep } from "@/components/ear/MethodStep";
import { StepStrip } from "@/components/ear/StepStrip";
import { WorkedSong } from "@/components/ear/WorkedSong";
import { clearHighlights, setHighlight } from "@/components/theory/highlight";
import { DRILLS, EAR_STEPS, WORKED_SONGS, type Sound } from "@/lib/theory/ear";
import type { TheoryExample } from "@/lib/theory/content";
import { getTheoryPlayer } from "@/lib/theory/player";

export default function PlayByEarPage() {
  const [playingLabel, setPlayingLabel] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    getTheoryPlayer().stop();
    clearHighlights(pageRef.current);
  }, []);

  const stopSound = () => {
    getTheoryPlayer().stop();
    clearHighlights(pageRef.current);
    setPlayingLabel(null);
  };

  const playExample = async (key: string, ex: TheoryExample) => {
    if (playingLabel === key) {
      stopSound();
      return;
    }
    setPlayingLabel(key);
    const root = pageRef.current;
    await getTheoryPlayer().play(ex, (id, on) => setHighlight(root, id, on));
    setPlayingLabel((cur) => (cur === key ? null : cur));
  };

  const playSound = async (key: string, sound: Sound) => {
    if (playingLabel === key) {
      stopSound();
      return;
    }
    setPlayingLabel(key);
    await getTheoryPlayer().play(sound, () => undefined);
    setPlayingLabel((cur) => (cur === key ? null : cur));
  };

  return (
    <div ref={pageRef} className="theory-page ear-page mx-auto max-w-5xl space-y-10" data-testid="ear-page">
      <PageTitle
        title="Play any song by ear"
        lead="A seven-step method for working out a song from listening alone — find home, decide major or minor, follow the bass, then chords, melody and rhythm."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/learn/theory" className="btn btn-quiet btn-sm">Theory map</Link>
          <Link href="/learn" className="btn btn-quiet btn-sm">Guitar learning</Link>
        </div>
      </PageTitle>

      <StepStrip />

      <section className="space-y-4" aria-labelledby="ear-method-heading">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>The method</p>
          <h2 id="ear-method-heading" className="display text-2xl">Seven steps</h2>
          <p className="mt-1 text-sm text-muted">Each step has examples you can hear. Press one to light up the visual.</p>
        </div>
        <div className="space-y-4">
          {EAR_STEPS.map((step, i) => (
            <MethodStep
              key={step.id}
              step={step}
              index={i}
              playingLabel={playingLabel}
              onPlayExample={(key, ex) => void playExample(key, ex)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="ear-worked-heading">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>Worked examples</p>
          <h2 id="ear-worked-heading" className="display text-2xl">Two songs, stage by stage</h2>
          <p className="mt-1 text-sm text-muted">Twinkle, Twinkle in C and Amazing Grace in G — built from home note to full arrangement.</p>
        </div>
        <div className="space-y-4">
          {WORKED_SONGS.map((song) => (
            <WorkedSong
              key={song.id}
              song={song}
              playingLabel={playingLabel}
              onPlayExample={(key, ex) => void playExample(key, ex)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="ear-drills-heading">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>Ear drills</p>
          <h2 id="ear-drills-heading" className="display text-2xl">Train your ear</h2>
          <p className="mt-1 text-sm text-muted">Listen, pick an answer, then try a new question.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {DRILLS.map((d) => (
            <Drill
              key={d.id}
              drill={d}
              playingLabel={playingLabel}
              onPlaySound={(key, sound) => void playSound(key, sound)}
              onStop={stopSound}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="ear-cheat-heading">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>Cheat sheet</p>
          <h2 id="ear-cheat-heading" className="display text-2xl">Progressions and fixes</h2>
        </div>
        <CheatSheet />
      </section>
    </div>
  );
}
