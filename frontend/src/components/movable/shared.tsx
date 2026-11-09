"use client";

import type { ReactNode } from "react";
import { IconPlay, IconStop } from "@/components/Icons";
import { MAX_FRET } from "@/lib/music/guitar";
import {
  degreeLabel, keyLabel, mod12, noteName, placeInFrame, pretty,
  type Frame, type Variation,
} from "@/lib/music/movable";
import type { PlayableNote } from "@/lib/types";
import type { NeckDot } from "./PatternNeck";

export type LabelMode = "finger" | "degree" | "note";

/** A row of toggle pills (one choice). */
export function Pills<T extends string | number>({
  label, value, options, onChange, testId, size = "sm",
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  testId?: string;
  size?: "sm" | "xs";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5" data-testid={testId}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`rounded-full ${size === "xs" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm"} ${on ? "bg-next font-semibold text-tolex" : "bg-panel-2 text-muted hover:text-ink"}`}
            data-testid={testId ? `${testId}-${o.value}` : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The twelve keys, spelled the usual way for a major or minor key. */
export function KeyPicker({ value, minor, onChange, testId, label = "Key" }: {
  value: number; minor: boolean; onChange: (pc: number) => void; testId?: string; label?: string;
}) {
  return (
    <Pills
      label={label}
      value={value}
      size="xs"
      onChange={onChange}
      testId={testId}
      options={Array.from({ length: 12 }, (_, pc) => ({ value: pc, label: keyLabel(pc, minor) }))}
    />
  );
}

export function PlayButton({ playing, onClick, children, testId, primary = false, small = false }: {
  playing: boolean; onClick: () => void; children: ReactNode; testId?: string; primary?: boolean; small?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={playing}
      onClick={onClick}
      className={`btn ${primary || playing ? "btn-primary" : "btn-ghost"} ${small ? "btn-sm" : ""}`}
      data-testid={testId}
    >
      {playing ? <IconStop /> : <IconPlay />} {playing ? "Stop" : children}
    </button>
  );
}

/** Frets to show around a frame: the four frets plus two either side. */
export function frameWindow(frame: Frame): { from: number; to: number } {
  const from = Math.max(0, frame.lo - 2);
  return { from, to: Math.min(MAX_FRET, Math.max(from + 7, frame.hi + 2)) };
}

/** Frets to show for a line (at least eight frets wide). */
export function lineWindow(notes: PlayableNote[], frames: Frame[] = []): { from: number; to: number } {
  const fs = [...notes.map((n) => n.fret), ...frames.flatMap((f) => [f.lo, f.hi])];
  let from = Math.max(0, Math.min(...fs) - 1);
  let to = Math.min(MAX_FRET, Math.max(...fs) + 1);
  while (to - from < 7) {
    if (to < MAX_FRET) to++;
    else from--;
  }
  return { from, to };
}

/**
 * Dots for a variation in a frame. Root green, added notes amber, the rest grey; `ringPcs` rings
 * chord tones. Labels: finger number, degree (from `degreeRoot`, default the frame's root) or note name.
 */
export function frameDots(
  frame: Frame,
  v: Pick<Variation, "intervals" | "adds" | "sharp4">,
  labels: LabelMode,
  flats: boolean,
  opts: { ringPcs?: number[]; degreeRoot?: number; extraPcs?: number[] } = {},
): NeckDot[] {
  const iv = [...v.intervals, ...(opts.extraPcs ?? []).map((pc) => mod12(pc - frame.tonic))];
  const degRoot = opts.degreeRoot ?? frame.tonic;
  return placeInFrame(frame, [...new Set(iv)]).map((n) => {
    const pc = mod12(n.midi);
    const fromRoot = mod12(pc - degRoot);
    const label =
      labels === "finger" ? String(n.finger)
        : labels === "degree" ? degreeLabel(fromRoot, v.sharp4)
          : pretty(noteName(pc, flats));
    const inScale = v.intervals.includes(n.interval);
    const tone: NeckDot["tone"] =
      fromRoot === 0 ? "root" : !inScale ? "outside" : v.adds.includes(n.interval) ? "added" : "core";
    return { string: n.string, fret: n.fret, label, tone, ring: opts.ringPcs?.includes(pc), stretch: n.stretch };
  });
}

export function SectionTitle({ n, id, eyebrow, title, children }: { n: number; id: string; eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>
        <span className="font-mono">{String(n).padStart(2, "0")}</span> · {eyebrow}
      </p>
      <h2 id={id} className="display text-2xl">{title}</h2>
      {children ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{children}</p> : null}
    </div>
  );
}

export function DotLegend({ withRing = false, withAdded = true, tones = false }: { withRing?: boolean; withAdded?: boolean; tones?: boolean }) {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span><span className="inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "var(--color-ok)" }} /> root</span>
      {tones
        ? <span><span className="inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "var(--color-maple)" }} /> chord tone</span>
        : <span><span className="inline-block h-2.5 w-2.5 rounded-full border border-faint bg-panel-2 align-middle" /> frame note</span>}
      {withAdded && <span><span className="inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "var(--color-next)" }} /> added by the variation</span>}
      {withRing && <span><span className="inline-block h-2.5 w-2.5 rounded-full border-2 align-middle" style={{ borderColor: "var(--color-maple)" }} /> chord tone</span>}
      <span><span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-ink align-middle" /> stretch / outside</span>
    </p>
  );
}

export function LineLegend() {
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span><span className="inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "var(--color-maple)" }} /> chord tone</span>
      <span><span className="inline-block h-2.5 w-2.5 rounded-full border border-maple bg-panel-2 align-middle" /> scale note</span>
      <span><span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-maple bg-tolex align-middle" /> chromatic</span>
      <span><span className="font-mono" style={{ color: "var(--color-next)" }}>①</span> order</span>
      <span>Notes light up as they sound</span>
    </p>
  );
}
