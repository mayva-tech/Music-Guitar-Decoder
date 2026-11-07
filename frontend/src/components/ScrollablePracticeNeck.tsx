"use client";

import { useEffect, useRef } from "react";
import { ScaleFretmapNeck } from "@/components/ScaleFretmapNeck";
import type { ChordShape } from "@/lib/music/chordShapes";
import type { FretmapCell, ScaleMode, ScaleRoot } from "@/lib/music/scaleFretmap";
import type { PlayableNote } from "@/lib/types";

interface Props {
  cells: FretmapCell[];
  root: ScaleRoot;
  mode: ScaleMode;
  lick?: { notes: PlayableNote[]; compact?: boolean; route?: boolean; accent?: ReadonlySet<number> } | null;
  litNotes?: ReadonlySet<number>;
  /** Optional chord finger placement (backing “On neck”). */
  chordShape?: ChordShape | null;
  /** Test id on the scroll container. */
  "data-testid"?: string;
}

/** Nudge horizontally only when the target sits outside the visible area (with a small pad). */
function ensureHorizontalVisible(scroller: HTMLElement, el: Element) {
  const view = scroller.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const pad = 32;
  let dx = 0;
  if (box.left < view.left + pad) dx = box.left - view.left - pad;
  else if (box.right > view.right - pad) dx = box.right - view.right + pad;
  if (dx !== 0) scroller.scrollBy({ left: dx, behavior: "auto" });
}

/**
 * Full guitar neck at native fret size. Scrolls horizontally when the board
 * is wider than the page — used by Guitar Learning and Diagonal practice.
 * Stays put while notes light; only slides if a lit note would leave the view.
 */
export function ScrollablePracticeNeck({
  cells,
  root,
  mode,
  lick = null,
  litNotes,
  chordShape = null,
  "data-testid": testId,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const lickKey = lick?.notes?.map((n) => `${n.string}:${n.fret}@${n.start_beat}`).join("|") ?? "";

  // New lick / phrase: jump once so the first note is on screen.
  useEffect(() => {
    const rootEl = scroller.current;
    if (!rootEl || !lickKey) return;
    const first = rootEl.querySelector<Element>('[data-hl="n0"]');
    if (first) ensureHorizontalVisible(rootEl, first);
  }, [lickKey]);

  // Guitar Learning: correct only when the lit note would leave the viewport.
  useEffect(() => {
    const rootEl = scroller.current;
    if (!rootEl || !litNotes?.size) return;
    const el = rootEl.querySelector<Element>(`[data-hl="n${[...litNotes][0]}"]`);
    if (el) ensureHorizontalVisible(rootEl, el);
  }, [litNotes]);

  // Diagonal / Theory audio lights via `.is-on` — same rule, no centering chase.
  useEffect(() => {
    const rootEl = scroller.current;
    if (!rootEl) return;
    const mo = new MutationObserver(() => {
      const lit = rootEl.querySelector(".solo-hl.is-on");
      if (lit) ensureHorizontalVisible(rootEl, lit);
    });
    mo.observe(rootEl, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  return (
    <div
      ref={scroller}
      className="scroll-x min-w-0 overflow-x-auto rounded-xl bg-tolex/40 p-1"
      data-testid={testId}
    >
      <ScaleFretmapNeck
        cells={cells}
        root={root}
        mode={mode}
        box={0}
        chordShape={chordShape}
        lick={lick}
        litNotes={litNotes}
      />
    </div>
  );
}
