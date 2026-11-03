"use client";

import Link from "next/link";
import { LeadToneSelector } from "@/components/LeadToneSelector";
import type { LeadTone } from "@/lib/audio/leadTone";

export type { LeadTone };

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
          <Link href="/learn/greats" className="btn btn-quiet btn-sm">Guitar greats</Link>
        </div>
      </div>
      <LeadToneSelector value={leadTone} onChange={onLeadTone} />
    </header>
  );
}
