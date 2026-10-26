"use client";

import { useMemo, useState } from "react";
import { ScaleFretmapNeck } from "@/components/ScaleFretmapNeck";
import { BarTimeline, SectionHead } from "./shared";
import type { SoloAudio } from "./useSoloAudio";
import { buildFretmap, noteMarkerColors } from "@/lib/music/scaleFretmap";
import { CHORD_TONES, TARGETING, TARGET_CHORDS, TARGET_PROGRESSION, TARGET_TEXT, WANDERING } from "@/lib/music/soloGuide";
import { pitchClassName } from "@/lib/music/theory";

const SCOPE = "target";
const WINDOW = { from: 3, to: 9 };

export function ChordTargeting({ audio }: { audio: SoloAudio }) {
  const [chord, setChord] = useState<string | null>("Am");
  const cells = useMemo(() => buildFretmap("A", "minor-pentatonic"), []);
  const bars = TARGET_PROGRESSION.map(([c]) => c);
  const tones = chord ? CHORD_TONES[chord].map((pc) => pitchClassName(pc + 60)) : [];
  const items = [
    { lick: WANDERING, key: "wandering", label: "Wandering", text: "Bars start on notes that aren't in the chord. It sounds lost, even though every note is in the scale." },
    { lick: TARGETING, key: "targeting", label: "Targeting", text: "Same box, same speed, but every bar starts on a chord tone. It sounds like it belongs." },
  ];
  return (
    <section id="target" aria-labelledby="solo-target-heading" className="scroll-mt-4 space-y-4" data-hl-scope={SCOPE} data-testid="solo-target">
      <SectionHead id="solo-target-heading" eyebrow="Land on chord tones" title="Wandering vs targeting">
        The scale tells you what is allowed. The chord tells you where to land. Pick a chord to ring its notes on the neck, then hear the same box played two ways over Am – G – F – G.
      </SectionHead>
      <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="surface space-y-3 p-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Chord to target">
            {TARGET_CHORDS.map((c) => {
              const { fill, ink } = noteMarkerColors(c.match(/^[A-G]#?/)?.[0] ?? c);
              const active = chord === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  data-testid={`target-chord-${c}`}
                  onClick={() => setChord(active ? null : c)}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold ${active ? "ring-2 ring-maple ring-offset-2 ring-offset-panel" : ""}`}
                  style={{ background: fill, color: ink }}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <p className="min-h-[3.5rem] text-sm leading-relaxed text-muted" data-testid="target-text">
            {chord ? (
              <>
                <span className="font-semibold text-ink">{chord}: {tones.join(" ")}.</span> {TARGET_TEXT[chord]}
              </>
            ) : (
              "Pick a chord to see its notes on the neck."
            )}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map(({ lick, key, label, text }) => {
              const on = audio.playingKey === `lick:${key}`;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  data-testid={`target-play-${key}`}
                  onClick={() => audio.toggleLick(lick, { key, scope: SCOPE })}
                  className={`btn flex h-auto min-h-0 flex-col items-start gap-1 rounded-2xl px-3 py-2.5 text-left ${on ? "btn-primary" : "btn-quiet"}`}
                >
                  <span className="text-sm font-bold"><span aria-hidden>{on ? "■" : "▶"}</span> {label}</span>
                  <span className={`text-xs font-normal leading-snug ${on ? "text-tolex/80" : "text-muted"}`}>{text}</span>
                </button>
              );
            })}
          </div>
          <BarTimeline bars={bars} activeLabel="Four bars: Am, G, F, G" />
        </div>
        <div className="surface min-w-0 p-3">
          <ScaleFretmapNeck cells={cells} root="A" mode="minor-pentatonic" box={1} chordTones={chord} fretWindow={WINDOW} />
          <p className="mt-2 text-xs text-muted">
            A minor pentatonic, box 1, frets 3–9. Ringed = a chord tone you can land on. Dashed = a chord tone outside the scale.
          </p>
        </div>
      </div>
    </section>
  );
}
