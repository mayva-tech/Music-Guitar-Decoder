"use client";

import { BarTimeline, mapRequestForLick, SectionHead, type ShowMap } from "./shared";
import { LickTab } from "./LickTab";
import type { SoloAudio } from "./useSoloAudio";
import { SOLO, SOLO_NOTES, SOLO_SECTIONS } from "@/lib/music/soloGuide";

export function FullSolo({ audio, onShowMap }: { audio: SoloAudio; onShowMap: ShowMap }) {
  const on = audio.playingKey === `lick:${SOLO.id}`;
  const bars = SOLO.backing.map(([c]) => c);
  return (
    <section id="solo" aria-labelledby="solo-full-heading" className="scroll-mt-4 space-y-4" data-hl-scope={SOLO.id} data-testid="solo-full">
      <SectionHead id="solo-full-heading" eyebrow="Put it together" title="A full solo, nine bars">
        Low and simple at the start, climbing to a bend, then home to the root. Follow it on the neck or read along in TAB.
      </SectionHead>
      <div className="surface space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            aria-pressed={on}
            data-testid="solo-play"
            onClick={() => audio.toggleLick(SOLO)}
          >
            <span aria-hidden>{on ? "■" : "▶"}</span> {on ? "Stop" : "Play the solo"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="solo-follow"
            onClick={() => {
              onShowMap({ ...mapRequestForLick(SOLO), box: 0 });
              if (!on) audio.playLick(SOLO);
            }}
          >
            Follow on fretboard
          </button>
          <span className="text-xs text-muted">{SOLO.bpm} BPM · A minor pentatonic</span>
        </div>
        <BarTimeline bars={bars} sections={SOLO_SECTIONS} activeLabel="Nine-bar solo timeline" />
        <LickTab notes={SOLO.notes} barsPerRow={3} />
        <dl className="grid gap-3 min-[760px]:grid-cols-2">
          {SOLO_NOTES.map(([title, text]) => (
            <div key={title}>
              <dt className="text-sm font-bold">{title}</dt>
              <dd className="text-sm leading-relaxed text-muted">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
