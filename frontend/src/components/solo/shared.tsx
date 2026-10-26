"use client";

import { useMemo, type ReactNode } from "react";
import { ScaleFretmapNeck } from "@/components/ScaleFretmapNeck";
import { buildFretmap, type ScaleMode, type ScaleRoot } from "@/lib/music/scaleFretmap";
import { CHORD_TONES, lickWindow, TARGET_CHORDS, type Lick } from "@/lib/music/soloGuide";

/** What the fretboard map popup should show. */
export interface MapRequest {
  root: ScaleRoot;
  mode: ScaleMode;
  box: number;
  lick?: Lick | null;
  chordList?: string[];
  chord?: string | null;
}

export type ShowMap = (req: MapRequest) => void;

/** Chords whose tones the popup can ring: the lick's own backing, else Am – G – F. */
export function chordListFor(lick?: Lick | null): string[] {
  const own = lick ? [...new Set(lick.backing.map(([c]) => c))].filter((c) => CHORD_TONES[c]) : [];
  return own.length ? own : TARGET_CHORDS;
}

export function mapRequestForLick(lick: Lick): MapRequest {
  return { root: lick.root, mode: lick.mode, box: lick.box, lick, chordList: chordListFor(lick) };
}

export function SectionHead({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>{eyebrow}</p>
      <h2 id={id} className="display text-2xl">{title}</h2>
      {children ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{children}</p> : null}
    </div>
  );
}

/** Small cropped neck for a lick (technique and lick cards). Lit by `data-hl` ids inside the card's scope. */
export function LickNeck({ lick }: { lick: Lick }) {
  const cells = useMemo(() => buildFretmap(lick.root, lick.mode), [lick.root, lick.mode]);
  const win = useMemo(() => lickWindow(lick.notes), [lick.notes]);
  return (
    <ScaleFretmapNeck
      cells={cells}
      root={lick.root}
      mode={lick.mode}
      box={lick.box}
      lick={{ notes: lick.notes, compact: lick.compact }}
      fretWindow={win}
    />
  );
}

/** Row of bars lit by `data-hl="b_<i>"` (use inside an element with `data-hl-scope`). */
export function BarTimeline({
  bars,
  sections,
  activeLabel,
}: {
  bars: string[];
  sections?: [start: number, bars: number, label: string][];
  activeLabel?: string;
}) {
  const cols = { gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` };
  return (
    <div className="space-y-1" aria-label={activeLabel ?? "Bar timeline"}>
      {sections && (
        <div className="grid gap-1" style={cols}>
          {sections.map(([start, n, label]) => (
            <div
              key={start}
              className="truncate rounded border border-dashed border-line px-1 py-0.5 text-[0.62rem] leading-tight text-muted"
              style={{ gridColumn: `${start + 1} / span ${n}` }}
              title={label}
            >
              {label}
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-1" style={cols} data-testid="bar-timeline">
        {bars.map((c, i) => (
          <div
            key={i}
            data-hl={`b_${i}`}
            className="theory-block rounded bg-panel-2 px-1 py-1.5 text-center text-xs font-bold text-white"
          >
            {c}
            <span className="block font-mono text-[0.55rem] font-normal text-white/60">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
