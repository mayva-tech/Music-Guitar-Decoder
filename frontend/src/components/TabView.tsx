"use client";

import { useEffect, useMemo, useRef } from "react";
import { TAB_LABELS, TAB_STRING_ORDER, layoutTab } from "@/lib/music/tab";
import { FINGER_NAMES, stringWords } from "@/lib/music/guitar";
import { TECHNIQUE_NAMES } from "@/lib/music/instructions";
import type { PlayableNote } from "@/lib/types";

export type NoteStatus = "correct" | "wrong" | undefined;

interface Props {
  notes: PlayableNote[];
  beatsPerBar: number;
  totalBars: number;
  barChords: string[];
  current: number;
  next: number;
  statuses?: Record<string, NoteStatus>;
  mode: "beginner" | "standard";
  onSelect: (index: number) => void;
}

export function TabView(p: Props) {
  return p.mode === "standard" ? <StandardTab {...p} /> : <BeginnerTab {...p} />;
}

const CH = 13; // px per character column
const ROW = 18;

function StandardTab({ notes, beatsPerBar, totalBars, barChords, current, next, statuses = {}, onSelect }: Props) {
  const lay = useMemo(() => layoutTab(notes, beatsPerBar, totalBars), [notes, beatsPerBar, totalBars]);
  const index = useMemo(() => new Map(notes.map((n, i) => [n.id, i])), [notes]);
  const scroller = useRef<HTMLDivElement>(null);
  const width = lay.lineLength * CH + 8;
  const top = 26;
  const height = top + ROW * 6 + 8;
  const yOf = (s: number) => top + TAB_STRING_ORDER.indexOf(s) * ROW + ROW / 2;

  useEffect(() => {
    const el = scroller.current?.querySelector<SVGGElement>('[data-current="true"]');
    el?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [current]);

  const barStartCol = (b: number) => (b === 0 ? 2 : lay.barLineCols[b - 1] + 1);

  return (
    <div ref={scroller} className="scroll-x rounded-xl bg-tolex/60 p-2" data-testid="tab-standard">
      <svg width={width} height={height} role="group" aria-label="Guitar TAB. Thin e string on top, thick E at the bottom." className="font-mono">
        {barChords.map((c, b) => (
          <text key={b} x={(barStartCol(b) + 2) * CH} y={14} fontSize="13" fontWeight="700" fill="var(--color-muted)">{c}</text>
        ))}
        {TAB_STRING_ORDER.map((s) => (
          <g key={s}>
            <text x={2} y={yOf(s)} dominantBaseline="central" fontSize="14" fill="var(--color-ink)" data-tab-label={s}>{TAB_LABELS[s]}</text>
            <line x1={CH * 1.5} x2={lay.lineLength * CH} y1={yOf(s)} y2={yOf(s)} stroke="var(--color-line)" strokeWidth="1.2" />
          </g>
        ))}
        {[1, ...lay.barLineCols].map((c, i) => (
          <line key={i} x1={(c + 0.5) * CH} x2={(c + 0.5) * CH} y1={yOf(1)} y2={yOf(6)} stroke="var(--color-faint)" strokeWidth="1.5" />
        ))}
        {lay.cells.flatMap((cell) =>
          cell.notes.map((n) => {
            const i = index.get(n.id!) ?? -1;
            const isCur = i === current;
            const isNext = i === next;
            const st = statuses[n.id!];
            const txt = n.token;
            const x = cell.col * CH;
            const w = Math.max(txt.length, 1) * CH + 6;
            const color = st === "correct" ? "var(--color-ok)" : st === "wrong" ? "var(--color-bad)" : "var(--color-ink)";
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={`Note ${i + 1}: ${stringWords(n.string)}, ${n.fret === 0 ? "open" : `fret ${n.fret}`}`}
                aria-current={isCur ? "step" : undefined}
                data-current={isCur ? "true" : undefined}
                data-next={isNext ? "true" : undefined}
                data-testid={`tab-note-${i}`}
                data-string={n.string}
                data-fret={n.fret}
                className="cursor-pointer"
                onClick={() => onSelect(i)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(i)}
              >
                <rect x={x - 3} y={yOf(n.string) - 10} width={w} height={20} rx="5"
                  fill={isCur ? "var(--color-maple)" : "var(--color-tolex)"}
                  stroke={isNext ? "var(--color-next)" : "none"} strokeWidth="2" />
                <text x={x + (w - 6) / 2} y={yOf(n.string)} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="700"
                  fill={isCur ? "var(--color-tolex)" : color}>{txt}</text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

const THICK: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7 };

function BeginnerTab({ notes, beatsPerBar, current, next, statuses = {}, onSelect }: Props) {
  const scroller = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[aria-current="step"]');
    el?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [current]);
  return (
    <ol ref={scroller} className="scroll-x flex gap-2 pb-2" data-testid="tab-beginner">
      {notes.map((n, i) => {
        const isCur = i === current;
        const isNext = i === next;
        const st = statuses[n.id];
        const barStart = i === 0 || Math.floor(n.start_beat / beatsPerBar) !== Math.floor(notes[i - 1].start_beat / beatsPerBar);
        return (
          <li key={n.id} className={`flex items-stretch ${barStart && i > 0 ? "ml-3" : ""}`}>
            <button
              onClick={() => onSelect(i)}
              aria-current={isCur ? "step" : undefined}
              data-testid={`card-note-${i}`}
              className={`w-[6rem] shrink-0 rounded-2xl px-2 py-3 text-left transition-colors ${
                isCur ? "bg-maple text-tolex" : "bg-panel-2 text-ink"
              } ${isNext ? "ring-2 ring-next" : ""} ${st === "correct" && !isCur ? "ring-2 ring-ok" : ""} ${st === "wrong" && !isCur ? "ring-2 ring-bad" : ""}`}
            >
              <span className="block text-[0.7rem] opacity-70">Bar {Math.floor(n.start_beat / beatsPerBar) + 1}</span>
              <span className="display block text-[2rem] leading-none mt-1">{n.fret === 0 ? "O" : n.fret}</span>
              <span className="mt-2 block h-[7px] rounded-full" style={{ background: "currentColor", opacity: 0.55, height: THICK[n.string] }} aria-hidden />
              <span className="mt-1.5 block text-[0.72rem] leading-tight">
                {n.string === 1 ? "thinnest" : n.string === 6 ? "thickest" : `string ${n.string}`}
              </span>
              <span className="block text-[0.72rem] opacity-75">{n.fret === 0 ? "open" : FINGER_NAMES[n.finger].replace(" finger", "")}</span>
              {(n.technique || n.vibrato) && (
                <span className={`mt-1 block rounded-md px-1 text-[0.68rem] font-bold ${isCur ? "bg-tolex/15" : "bg-next/15 text-next"}`} data-testid={`card-technique-${i}`}>
                  {n.technique ? TECHNIQUE_NAMES[n.technique] : ""}{n.technique && n.bend_semitones ? (n.bend_semitones === 2 ? " full" : " ½") : ""}{n.vibrato ? (n.technique ? " + vib." : "Vibrato") : ""}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
