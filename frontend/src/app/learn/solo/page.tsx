"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ScaleFretmapFloat } from "@/components/ScaleFretmapFloat";
import { ChordTargeting } from "@/components/solo/ChordTargeting";
import { FullSolo } from "@/components/solo/FullSolo";
import { JamPanel } from "@/components/solo/JamPanel";
import { LickCard } from "@/components/solo/LickCard";
import { PlanSteps } from "@/components/solo/PlanSteps";
import { ScaleChoices } from "@/components/solo/ScaleChoices";
import { SoloHero } from "@/components/solo/SoloHero";
import { TechniqueCard } from "@/components/solo/TechniqueCard";
import { SectionHead, chordListFor, type MapRequest } from "@/components/solo/shared";
import { useSoloAudio } from "@/components/solo/useSoloAudio";
import { JAM_TRACKS, LICKS, TECHNIQUES, TARGET_CHORDS } from "@/lib/music/soloGuide";
import { useApp, useHydrated } from "@/lib/store";

const DEFAULT_MAP: MapRequest = { root: "A", mode: "minor-pentatonic", box: 1, chordList: TARGET_CHORDS };

export default function LeadSoloPage() {
  const hydrated = useHydrated();
  const storedTone = useApp((s) => s.prefs.leadTone);
  const leadTone = hydrated ? storedTone : "clean";
  const setPrefs = useApp((s) => s.setPrefs);
  const audio = useSoloAudio(leadTone);
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState<MapRequest>(DEFAULT_MAP);

  const showMap = useCallback((req: MapRequest) => {
    setMap({ ...req, chordList: req.chordList ?? chordListFor(req.lick) });
    setOpen(true);
  }, []);

  const lick = map.lick ?? null;
  const jamTrack = audio.playingKey?.startsWith("jam:")
    ? JAM_TRACKS.find((t) => `jam:${t.id}` === audio.playingKey)
    : undefined;
  const followChord = jamTrack && audio.jamBar != null ? jamTrack.bars[audio.jamBar % jamTrack.bars.length] : null;

  return (
    <div className="theory-page solo-page mx-auto max-w-6xl space-y-12" data-testid="solo-page">
      <SoloHero
        leadTone={leadTone}
        onLeadTone={(t) => setPrefs({ leadTone: t })}
        onOpenMap={() => showMap(DEFAULT_MAP)}
      />

      <PlanSteps audio={audio} onShowMap={showMap} />

      <section id="techniques" aria-labelledby="solo-tech-heading" className="scroll-mt-4 space-y-4" data-testid="solo-techniques">
        <SectionHead id="solo-tech-heading" eyebrow="Techniques" title="Eight ways to shape a note">
          Each card plays a short lick with its backing. The amber chip is how it looks in TAB.
        </SectionHead>
        <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2 min-[900px]:grid-cols-3">
          {TECHNIQUES.map((t) => (
            <TechniqueCard key={t.id} tech={t} audio={audio} onShowMap={showMap} />
          ))}
        </div>
      </section>

      <ScaleChoices onShowMap={showMap} />

      <ChordTargeting audio={audio} />

      <section id="licks" aria-labelledby="solo-licks-heading" className="scroll-mt-4 space-y-4" data-testid="solo-licks">
        <SectionHead id="solo-licks-heading" eyebrow="Lick library" title="Eight licks to steal">
          Short phrases that work over common chords. Play one, then change a note or two to make it yours.
        </SectionHead>
        <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2 min-[900px]:grid-cols-3">
          {LICKS.map((l) => (
            <LickCard key={l.id} lick={l} audio={audio} onShowMap={showMap} />
          ))}
        </div>
      </section>

      <FullSolo audio={audio} onShowMap={showMap} />

      <JamPanel audio={audio} onShowMap={showMap} />

      <p className="flex flex-wrap gap-2 pb-4">
        <Link href="/learn/theory" className="btn btn-quiet btn-sm">Theory map</Link>
        <Link href="/learn/by-ear" className="btn btn-quiet btn-sm">Play by ear</Link>
        <Link href="/learn" className="btn btn-quiet btn-sm">Back to Guitar learning</Link>
      </p>

      <ScaleFretmapFloat
        open={open}
        onOpenChange={setOpen}
        initialRoot={map.root}
        initialMode={map.mode}
        initialBox={map.box}
        chordList={map.chordList}
        initialChord={map.chord ?? null}
        lick={lick}
        onPlayLick={(l) => audio.toggleLick(l)}
        onClearLick={() => {
          if (lick && audio.playingKey === `lick:${lick.id}`) audio.stop();
          setMap((m) => ({ ...m, lick: null }));
        }}
        playing={lick != null && audio.playingKey === `lick:${lick.id}`}
        followChord={followChord}
      />
    </div>
  );
}
