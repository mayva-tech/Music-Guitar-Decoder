"use client";

import { Fragment, useMemo } from "react";
import { TAB_LABELS, TAB_STRING_ORDER, layoutTab } from "@/lib/music/tab";
import type { PlayableNote } from "@/lib/types";

interface Seg { text: string; idx?: number }

/**
 * ASCII TAB for a lick (built on layoutTab). Every note token is a span with `data-hl="n<i>"`,
 * so it lights with the same ids as the neck markers (see components/theory/highlight.ts).
 */
export function LickTab({
  notes,
  beatsPerBar = 4,
  barsPerRow = 4,
  className = "",
  litNotes,
}: {
  notes: PlayableNote[];
  beatsPerBar?: number;
  barsPerRow?: number;
  className?: string;
  litNotes?: ReadonlySet<number>;
}) {
  const rows = useMemo(() => {
    if (!notes.length) return [];
    const idxById = new Map(notes.map((n, i) => [n.id, i] as const));
    const lastBeat = Math.max(...notes.map((n) => n.start_beat + n.duration_beats));
    const bars = Math.max(1, Math.ceil(lastBeat / beatsPerBar - 1e-9), Math.floor(Math.max(...notes.map((n) => n.start_beat)) / beatsPerBar) + 1);
    const lay = layoutTab(notes, beatsPerBar, bars);

    // Full-width character grid + token positions per string.
    const grid: Record<number, string[]> = {};
    const toks: Record<number, { col: number; len: number; idx: number; text: string }[]> = {};
    for (const s of TAB_STRING_ORDER) {
      const chars = Array<string>(lay.lineLength).fill("-");
      for (const c of lay.barLineCols) chars[c] = "|";
      grid[s] = chars;
      toks[s] = [];
    }
    for (const cell of lay.cells) {
      for (const n of cell.notes) {
        const idx = n.id != null ? idxById.get(n.id) : undefined;
        if (idx == null) continue;
        toks[n.string].push({ col: cell.col, len: n.token.length, idx, text: n.token });
      }
    }
    const barStart = (b: number) => (b === 0 ? 2 : lay.barLineCols[b - 1] + 1);

    const out: { label: string; segs: Seg[] }[][] = [];
    for (let first = 0; first < bars; first += barsPerRow) {
      const last = Math.min(bars - 1, first + barsPerRow - 1);
      const from = barStart(first);
      const to = lay.barLineCols[last]; // inclusive "|"
      out.push(
        TAB_STRING_ORDER.map((s) => {
          const segs: Seg[] = [{ text: `${TAB_LABELS[s]}|` }];
          let cur = from;
          for (const t of toks[s].filter((x) => x.col >= from && x.col <= to).sort((a, b) => a.col - b.col)) {
            if (t.col > cur) segs.push({ text: grid[s].slice(cur, t.col).join("") });
            segs.push({ text: t.text, idx: t.idx });
            cur = t.col + t.len;
          }
          if (cur <= to) segs.push({ text: grid[s].slice(cur, to + 1).join("") });
          return { label: TAB_LABELS[s], segs };
        }),
      );
    }
    return out;
  }, [notes, beatsPerBar, barsPerRow]);

  return (
    <div
      className={`scroll-x max-w-full overflow-x-auto font-mono text-[0.78rem] leading-[1.35] text-muted ${className}`}
      data-testid="lick-tab"
      role="img"
      aria-label="Guitar TAB for this lick"
    >
      {rows.map((row, ri) => (
        <pre key={ri} className="m-0 mb-1.5 w-max font-mono">
          {row.map((line, li) => (
            <Fragment key={li}>
              {line.segs.map((seg, si) =>
                seg.idx == null ? (
                  <Fragment key={si}>{seg.text}</Fragment>
                ) : (
                  <span
                    key={si}
                    data-hl={`n${seg.idx}`}
                    className={`tab-tok${litNotes?.has(seg.idx) ? " is-on" : ""}`}
                  >
                    {seg.text}
                  </span>
                ),
              )}
              {li < row.length - 1 ? "\n" : null}
            </Fragment>
          ))}
        </pre>
      ))}
    </div>
  );
}
