"use client";

import Link from "next/link";

export type LeadTone = "clean" | "crunch";

export function SoloHero({
  leadTone,
  onLeadTone,
  onOpenMap,
}: {
  leadTone: LeadTone;
  onLeadTone: (t: LeadTone) => void;
  onOpenMap: () => void;
}) {
  return (
    <header className="surface flex flex-wrap items-end justify-between gap-5 px-5 py-6 md:px-8 md:py-8" data-testid="solo-hero">
      <div className="max-w-2xl">
        <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: "var(--lane-song)" }}>Improvise</p>
        <h1 className="display text-[2rem] md:text-[2.6rem]">Lead solo workshop</h1>
        <p className="mt-2 text-[1.05rem] leading-relaxed text-muted">
          How to add a lead solo to a song: pick a scale, learn one box, land on chord tones, phrase like a singer, then jam over a backing track. Everything here is playable and lights up the neck.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={onOpenMap} data-testid="solo-open-map">
            Open fretboard map
          </button>
          <Link href="/learn/theory" className="btn btn-quiet btn-sm">Theory map</Link>
          <Link href="/learn/by-ear" className="btn btn-quiet btn-sm">Play by ear</Link>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs text-muted" id="lead-tone-label">Lead tone</p>
        <div role="radiogroup" aria-labelledby="lead-tone-label" className="flex gap-1 rounded-full bg-panel-2 p-1" data-testid="lead-tone">
          {(["clean", "crunch"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={leadTone === t}
              data-testid={`lead-tone-${t}`}
              onClick={() => onLeadTone(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${
                leadTone === t ? "bg-maple text-tolex" : "text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-1.5 max-w-[16rem] text-xs text-faint">Crunch adds a little amp drive to the lead voice. Applies from the next note you play.</p>
      </div>
    </header>
  );
}
