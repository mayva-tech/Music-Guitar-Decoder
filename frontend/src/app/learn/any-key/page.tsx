"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { FrameStudio, VariationCards, type FrameState } from "@/components/movable/FrameSection";
import { KeyPicker } from "@/components/movable/shared";
import { useMovableAudio } from "@/components/movable/useMovableAudio";
import { AmpRack } from "@/components/AmpRack";
import { AMP_PRESETS, normalizeAmp } from "@/lib/audio/amp";
import { DEFAULT_LEAD_TONE, normalizeLeadTone } from "@/lib/audio/leadTone";
import { ROUTINE } from "@/lib/music/movable";
import { useApp, useHydrated } from "@/lib/store";

/** Defer heavy lower labs so the frame paints first. */
const ChordLab = dynamic(
  () => import("@/components/movable/ChordLab").then((m) => ({ default: m.ChordLab })),
  { ssr: false, loading: () => <div className="surface h-40 animate-pulse rounded-2xl" aria-hidden /> },
);
const ProgressionLab = dynamic(
  () => import("@/components/movable/ProgressionLab").then((m) => ({ default: m.ProgressionLab })),
  { ssr: false, loading: () => <div className="surface h-40 animate-pulse rounded-2xl" aria-hidden /> },
);

const STEPS: [href: string, title: string][] = [
  ["#frame", "The movable frame"],
  ["#variations", "Variations"],
  ["#any-chord", "Any chord"],
  ["#arpeggios", "Melodic arpeggios"],
  ["#progression", "Over a progression"],
];

export default function AnyKeyPage() {
  const hydrated = useHydrated();
  const storedTone = useApp((s) => s.prefs.leadTone);
  const storedAmp = useApp((s) => s.prefs.amp);
  const leadTone = hydrated ? normalizeLeadTone(storedTone) : DEFAULT_LEAD_TONE;
  const amp = hydrated ? normalizeAmp(storedAmp) : AMP_PRESETS.clean;
  const setPrefs = useApp((s) => s.setPrefs);
  const audio = useMovableAudio(leadTone, amp);
  const [frame, setFrame] = useState<FrameState>({ tonic: 9, family: "minor", anchor: 6, place: 0, varId: "minor-pent", labels: "finger" });
  const set = (patch: Partial<FrameState>) => setFrame((f) => ({ ...f, ...patch }));

  return (
    <div className="theory-page solo-page mx-auto max-w-6xl space-y-10" data-testid="any-key-page">
      <header className="surface flex flex-wrap items-end justify-between gap-5 px-5 py-6 md:px-8 md:py-8">
        <div className="max-w-2xl space-y-3">
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>Movable patterns</p>
          <h1 className="display text-[2rem] md:text-[2.6rem]">Solo in any key</h1>
          <p className="text-[1.05rem] leading-relaxed text-muted">
            One hand shape, anchored on the root, gives you every key and every chord. Learn the frame, colour it with variations,
            then turn chord tones into lines that sound like melodies instead of exercises.
          </p>
          <div>
            <p className="mb-1.5 text-xs text-muted">Key for the whole page</p>
            <KeyPicker value={frame.tonic} minor={frame.family === "minor"} testId="mv-key"
              onChange={(pc) => { audio.stop(); set({ tonic: pc, place: 0 }); }} />
          </div>
        </div>
      </header>
      <AmpRack
        tone={leadTone}
        amp={amp}
        onTone={(t) => setPrefs({ leadTone: t })}
        onAmp={(a) => setPrefs({ amp: a })}
        testId="mv-amp"
        compact
      />

      <nav aria-label="Steps" className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3 min-[1000px]:grid-cols-5" data-testid="mv-steps">
        {STEPS.map(([href, title], i) => (
          <a key={href} href={href} className="surface block p-3 hover:bg-panel-2" data-testid={`mv-step-${i + 1}`}>
            <span className="block font-mono text-xs" style={{ color: "var(--color-next)" }}>Step {i + 1}</span>
            <span className="font-bold leading-tight">{title}</span>
          </a>
        ))}
      </nav>

      <FrameStudio state={frame} set={set} audio={audio} />
      <VariationCards state={frame} set={set} audio={audio} />
      <ChordLab keyTonic={frame.tonic} audio={audio} />
      <ProgressionLab keyTonic={frame.tonic} audio={audio} />

      <section aria-labelledby="mv-routine-heading" className="space-y-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>Routine</p>
          <h2 id="mv-routine-heading" className="display text-2xl">Ten minutes a day</h2>
        </div>
        <ol className="surface grid gap-3 p-4 min-[760px]:grid-cols-3" data-testid="mv-routine">
          {ROUTINE.map((s, i) => (
            <li key={i} className="text-sm leading-relaxed">
              <span className="block font-mono text-xs" style={{ color: "var(--color-next)" }}>Step {i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <p className="flex flex-wrap gap-2 pb-4">
        <Link href="/learn/caged" className="btn btn-quiet btn-sm">CAGED &amp; pentatonic map</Link>
        <Link href="/learn/solo" className="btn btn-quiet btn-sm">Lead solo workshop</Link>
        <Link href="/learn/diagonal" className="btn btn-quiet btn-sm">Diagonal licks</Link>
        <Link href="/learn/backing" className="btn btn-quiet btn-sm">Backing tracks</Link>
        <Link href="/learn" className="btn btn-quiet btn-sm">Back to Guitar learning</Link>
      </p>
    </div>
  );
}
