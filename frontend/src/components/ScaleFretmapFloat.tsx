"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as REPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ChordDiagram } from "@/components/ChordDiagram";
import { ScaleFretmapNeck } from "@/components/ScaleFretmapNeck";
import { LickTab } from "@/components/solo/LickTab";
import { shapesForChord } from "@/lib/music/chordShapes";
import { parseChordQuery } from "@/lib/music/findSearch";
import { BOX_MODES, CHORD_TONES, fretRange, lickWindow, pentatonicBox, type Lick } from "@/lib/music/soloGuide";
import { pitchClassName } from "@/lib/music/theory";
import {
  SCALE_KINDS,
  SCALE_ROOTS,
  buildFretmap,
  noteMarkerColors,
  relatedScaleChords,
  scaleDisplayName,
  scaleNoteNames,
  type RelatedChord,
  type ScaleMode,
  type ScaleRoot,
} from "@/lib/music/scaleFretmap";

const STORE_KEY = "md-scale-fretmap-float";
/** The Lead Solo Workshop keeps its own popup position (separate from the progress pages). */
const SOLO_STORE_KEY = "md-solo-fretmap-float";
const DEFAULT = { x: 40, y: 72 };
/** Under this width the solo popup opens centred near the top. */
const PHONE_PX = 520;

type Pos = { x: number; y: number };

function loadPos(key: string): Pos {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch { /* ignore */ }
  return DEFAULT;
}

function chordKey(c: RelatedChord): string {
  return `${c.roman}:${c.symbol}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional starting root (e.g. from the key tab on the guide page). */
  initialRoot?: ScaleRoot;
  initialMode?: ScaleMode;
  /* ---- Lead Solo Workshop (all optional; without them the popup behaves as before) ---- */
  /** Starting pentatonic box (0 = All). Shows the Box row for pentatonic / blues scales. */
  initialBox?: number;
  /** Header pills become chord-TONE toggles (rings on the neck) instead of chord shapes. */
  chordList?: string[];
  initialChord?: string | null;
  /** Shows the lick bar (Play, TAB, Clear) and draws the lick on the neck. */
  lick?: Lick | null;
  onPlayLick?: (lick: Lick) => void;
  /** Called when the lick bar's Clear lick is pressed (the page can stop audio). */
  onClearLick?: () => void;
  playing?: boolean;
  litNotes?: ReadonlySet<number>;
  /** While a chord-tone pill is on, its rings jump to this chord (e.g. the jam's current bar). */
  followChord?: string | null;
}

/**
 * Draggable overlay: real guitar neck with horizontal scroll, C–B roots and
 * common scales. Related chords show classic box diagrams; tap a chord to
 * highlight finger placement. Left/right arrows cycle higher fret voicings.
 */
export function ScaleFretmapFloat({
  open,
  onOpenChange,
  initialRoot = "C",
  initialMode = "major",
  initialBox,
  chordList,
  initialChord = null,
  lick = null,
  onPlayLick,
  onClearLick,
  playing = false,
  litNotes,
  followChord = null,
}: Props) {
  const solo =
    initialBox !== undefined || chordList !== undefined || lick !== null || onPlayLick !== undefined;
  const storeKey = solo ? SOLO_STORE_KEY : STORE_KEY;
  const [pos, setPos] = useState<Pos>(DEFAULT);
  const [mounted, setMounted] = useState(false);
  const [root, setRoot] = useState<ScaleRoot>(initialRoot);
  const [mode, setMode] = useState<ScaleMode>(initialMode);
  const [selected, setSelected] = useState<RelatedChord | null>(null);
  const [voicingIdx, setVoicingIdx] = useState(0);
  const [box, setBox] = useState(initialBox ?? 0);
  const [tonesChord, setTonesChord] = useState<string | null>(initialChord);
  const [lickCleared, setLickCleared] = useState(false);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shownLick = lick && !lickCleared ? lick : null;

  useEffect(() => {
    setMounted(true);
    setPos(clampToViewport(loadPos(storeKey)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    setRoot(initialRoot);
    setMode(initialMode);
    setSelected(null);
    setVoicingIdx(0);
    setBox(initialBox ?? 0);
    setTonesChord(initialChord);
  }, [open, initialRoot, initialMode, initialBox, initialChord]);

  useEffect(() => {
    setLickCleared(false);
  }, [lick]);

  useEffect(() => {
    if (!followChord || !chordList?.includes(followChord)) return;
    setTonesChord((cur) => (cur ? followChord : cur));
  }, [followChord, chordList]);

  // Phones: open centred near the top instead of at the remembered drag position.
  useEffect(() => {
    if (!open || !solo || typeof window === "undefined" || window.innerWidth >= PHONE_PX) return;
    const w = Math.min(window.innerWidth * 0.96, 960);
    setPos({ x: Math.max(8, (window.innerWidth - w) / 2), y: 56 });
  }, [open, solo]);

  useEffect(() => {
    if (!open || !solo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, solo, onOpenChange]);

  useEffect(() => {
    setSelected(null);
    setVoicingIdx(0);
  }, [root, mode]);

  // Scroll the neck so a newly shown lick is in view.
  useEffect(() => {
    if (!open || !shownLick) return;
    const t = window.setTimeout(() => {
      const sc = scrollRef.current;
      const marks = sc?.querySelectorAll("[data-lick-marker]");
      if (!sc || !marks || !marks.length) return;
      let min = Infinity;
      marks.forEach((m) => { min = Math.min(min, m.getBoundingClientRect().left); });
      sc.scrollTo({ left: Math.max(0, sc.scrollLeft + min - sc.getBoundingClientRect().left - 90) });
    }, 30);
    return () => window.clearTimeout(t);
  }, [open, shownLick]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setPos((p) => clampToViewport(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  const cells = useMemo(() => buildFretmap(root, mode), [root, mode]);
  const notes = useMemo(() => scaleNoteNames(root, mode), [root, mode]);
  const chords = useMemo(() => relatedScaleChords(root, mode), [root, mode]);

  /** Progress map: scale diatonic chords. Solo/improvise: the jam/lick chord list. */
  const diagramChords = useMemo((): RelatedChord[] => {
    if (!chordList?.length) return chords;
    return chordList.flatMap((sym) => {
      const p = parseChordQuery(sym);
      if (!p) return [];
      return [{ roman: sym, symbol: sym, rootName: p.rootName, quality: p.quality }];
    });
  }, [chordList, chords]);

  const chordVoicings = useMemo(
    () =>
      diagramChords.map((c) => ({
        chord: c,
        voicings: shapesForChord(c.rootName, c.quality),
      })),
    [diagramChords],
  );

  const selectedVoicings = useMemo(() => {
    if (!selected) return [];
    return shapesForChord(selected.rootName, selected.quality);
  }, [selected]);

  const selectedShape = useMemo(() => {
    if (!selectedVoicings.length) return null;
    const i = ((voicingIdx % selectedVoicings.length) + selectedVoicings.length) % selectedVoicings.length;
    return selectedVoicings[i]!.shape;
  }, [selectedVoicings, voicingIdx]);

  const selectedVoicingLabel = useMemo(() => {
    if (!selectedVoicings.length) return null;
    const i = ((voicingIdx % selectedVoicings.length) + selectedVoicings.length) % selectedVoicings.length;
    return selectedVoicings[i]!.label;
  }, [selectedVoicings, voicingIdx]);

  const onPointerDown = (e: REPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button, [data-scroll]")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e: REPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const d = drag.current;
    setPos(clampToViewport({
      x: d.px + (e.clientX - d.ox),
      y: d.py + (e.clientY - d.oy),
    }));
  };
  const onPointerUp = (e: REPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { /* already released */ }
    setPos((p) => {
      const next = clampToViewport(p);
      try {
        sessionStorage.setItem(storeKey, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const selectChord = (c: RelatedChord, idx = 0) => {
    setSelected(c);
    setVoicingIdx(idx);
  };

  const toggleChord = (c: RelatedChord) => {
    if (selected && chordKey(selected) === chordKey(c)) {
      setSelected(null);
      setVoicingIdx(0);
      if (chordList) setTonesChord(null);
      return;
    }
    selectChord(c, 0);
    if (chordList) setTonesChord(c.symbol);
  };

  const stepVoicing = (c: RelatedChord, delta: number, count: number) => {
    if (count <= 1) return;
    if (!selected || chordKey(selected) !== chordKey(c)) {
      const next = ((delta % count) + count) % count;
      selectChord(c, next);
      return;
    }
    setVoicingIdx((i) => ((i + delta) % count + count) % count);
  };

  const boxAvailable = solo && BOX_MODES.includes(mode);
  const activeBox = boxAvailable ? box : 0;
  const lickNear = shownLick && shownLick.notes.length ? lickWindow(shownLick.notes).from : undefined;
  const boxRange = useMemo(() => {
    if (!activeBox) return null;
    const cs = pentatonicBox(root, mode, activeBox, lickNear);
    return cs ? fretRange(cs) : null;
  }, [activeBox, root, mode, lickNear]);
  const toneChord = chordList && tonesChord && CHORD_TONES[tonesChord] ? tonesChord : null;
  const toneNames = toneChord ? CHORD_TONES[toneChord]!.map((pc) => pitchClassName(pc + 60)) : [];

  if (!open || !mounted) return null;

  return createPortal(
    <div
      id="scale-fretmap-float"
      data-testid="scale-fretmap-float"
      data-hl-scope={shownLick?.id}
      role="dialog"
      aria-label={`${scaleDisplayName(root, mode)} fretboard map`}
      className="fixed z-[9999] flex w-[min(96vw,960px)] min-w-[280px] max-w-[96vw] resize flex-col overflow-hidden rounded-2xl border border-line bg-panel-2/95 shadow-2xl backdrop-blur-sm"
      style={{ left: pos.x, top: pos.y, maxHeight: solo ? "min(92vh, 900px)" : "min(82vh, 760px)" }}
    >
      <div
        className="flex cursor-grab items-center gap-2 border-b border-line px-3 py-2.5 touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className={`text-[0.65rem] uppercase tracking-wide text-muted ${solo ? "max-[519px]:hidden" : ""}`}>⠿ Drag</span>
        <span className="shrink-0 text-sm font-semibold">Fretboard map</span>
        <div
          className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto"
          data-testid="scale-related-chords"
          title={chordList ? "Tap a chord to ring its notes on the neck" : "Tap a chord to show finger placement on the neck"}
        >
          <span className={`shrink-0 text-[0.65rem] uppercase tracking-wide text-muted ${solo ? "max-[519px]:hidden" : ""}`}>
            {chordList ? "Chord tones" : "Chords"}
          </span>
          {chordList?.map((sym) => {
            const rootName = sym.match(/^[A-G]#?/)?.[0] ?? sym;
            const { fill, ink } = noteMarkerColors(rootName);
            const active = tonesChord === sym;
            return (
              <button
                key={sym}
                type="button"
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold transition ring-offset-1 ${
                  active ? "ring-2 ring-maple" : ""
                }`}
                style={{ background: fill, color: ink }}
                title={`${sym} — tap to ring its chord tones`}
                aria-pressed={active}
                data-testid={`chord-pill-${sym}`}
                onClick={() => setTonesChord((cur) => (cur === sym ? null : sym))}
              >
                {sym}
              </button>
            );
          })}
          {!chordList && chords.map((c) => {
            const { fill, ink } = noteMarkerColors(c.rootName);
            const active = selected != null && chordKey(selected) === chordKey(c);
            return (
              <button
                key={chordKey(c)}
                type="button"
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold transition ring-offset-1 ${
                  active ? "ring-2 ring-maple" : ""
                }`}
                style={{ background: fill, color: ink }}
                title={`${c.roman} · ${c.symbol} — tap for finger placement`}
                aria-pressed={active}
                data-testid={`chord-pill-${c.symbol}`}
                onClick={() => toggleChord(c)}
              >
                {c.symbol}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-quiet btn-sm shrink-0 px-2 py-0.5 text-xs" aria-label="Close fretboard map"
          onClick={() => onOpenChange(false)}>Close</button>
      </div>

      <div className="grid gap-2 border-b border-line px-3 py-2" data-testid="scale-fretmap-controls">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Root</span>
          {SCALE_ROOTS.map((r) => (
            <button
              key={r}
              type="button"
              className={`btn btn-sm min-w-[2rem] px-2 ${root === r ? "btn-primary" : "btn-quiet"}`}
              aria-pressed={root === r}
              data-testid={`scale-root-${r}`}
              onClick={() => setRoot(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Scale</span>
          {SCALE_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`btn btn-sm ${mode === k.id ? "btn-primary" : "btn-quiet"}`}
              aria-pressed={mode === k.id}
              data-testid={`scale-mode-${k.id}`}
              onClick={() => setMode(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
        {boxAvailable && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="scale-box-row">
            <span className="mr-1 text-xs text-muted">Box</span>
            {[0, 1, 2, 3, 4, 5].map((b) => (
              <button
                key={b}
                type="button"
                className={`btn btn-sm min-w-[2rem] px-2 ${box === b ? "btn-primary" : "btn-quiet"}`}
                aria-pressed={box === b}
                data-testid={`scale-box-${b}`}
                onClick={() => setBox(b)}
              >
                {b === 0 ? "All" : b}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="border-b border-line px-3 py-2 text-sm text-muted" data-testid="scale-fretmap-legend">
        <span className="font-semibold text-ink">{scaleDisplayName(root, mode)}</span>
        {" · "}
        {notes.join(" · ")}
        {boxRange && (
          <span data-testid="scale-box-legend">{` · Box ${activeBox}, frets ${boxRange.lo}–${boxRange.hi}`}</span>
        )}
        {toneChord && (
          <span data-testid="scale-chord-legend">{` · ${toneChord} chord tones ringed: ${toneNames.join(" ")}`}</span>
        )}
        <span className="text-faint">
          {selected
            ? ` — ${selected.symbol} ${selectedVoicingLabel ?? ""} (${voicingIdx + 1}/${selectedVoicings.length}). Use ◀ ▶ for higher/lower shapes.`
            : chordList
              ? " — tap a chord diagram for the box shape; header pills ring chord tones on the neck."
              : " — tap a chord for the box diagram; ◀ ▶ flips through higher fret versions."}
        </span>
      </p>

      {shownLick && (
        <div className="grid gap-2 border-b border-line px-3 py-2" data-testid="lick-bar">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm ${playing ? "btn-primary" : "btn-quiet"}`}
              aria-pressed={playing}
              data-testid="lick-play"
              onClick={() => onPlayLick?.(shownLick)}
            >
              <span aria-hidden>{playing ? "■" : "▶"}</span> {playing ? "Stop" : "Play"}
            </button>
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-semibold text-ink">{shownLick.title}</span>
              <span className="text-muted">{` · ${shownLick.sub}`}</span>
            </span>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              data-testid="lick-clear"
              onClick={() => {
                setLickCleared(true);
                onClearLick?.();
              }}
            >
              Clear lick
            </button>
          </div>
          <LickTab notes={shownLick.notes} litNotes={litNotes} barsPerRow={shownLick.compact ? 3 : 4} className="max-h-40 overflow-y-auto" />
        </div>
      )}

      <div
        data-scroll
        className="flex gap-3 overflow-x-auto border-b border-line px-3 py-2"
        data-testid="scale-chord-diagrams"
        aria-label="Chord diagrams"
      >
        {chordVoicings.map(({ chord, voicings }) => {
          const active = selected != null && chordKey(selected) === chordKey(chord);
          const idx = active
            ? ((voicingIdx % voicings.length) + voicings.length) % voicings.length
            : 0;
          const voicing = voicings[idx] ?? voicings[0];
          if (!voicing) return null;
          const n = voicings.length;
          return (
            <div
              key={`diag-${chordKey(chord)}`}
              className={`flex shrink-0 flex-col items-center rounded-lg px-1 py-1 transition ${
                active ? "bg-panel ring-2 ring-maple" : "hover:bg-panel/60"
              }`}
              data-testid={`chord-diagram-${chord.symbol}`}
            >
              <button
                type="button"
                className="rounded-md"
                aria-pressed={active}
                title={`Tap to place ${chord.symbol} on the fretboard`}
                onClick={() => toggleChord(chord)}
              >
                <ChordDiagram name={chord.symbol} diagram={voicing.shape} size={0.85} />
              </button>
              <div className="mt-0.5 flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-quiet btn-sm h-6 w-6 px-0 text-sm disabled:opacity-30"
                  aria-label={`Previous ${chord.symbol} shape`}
                  data-testid={`chord-voicing-prev-${chord.symbol}`}
                  disabled={n <= 1}
                  onClick={() => stepVoicing(chord, -1, n)}
                >
                  ◀
                </button>
                <span className="min-w-[3.2rem] text-center text-[0.65rem] text-muted" data-testid={`chord-voicing-label-${chord.symbol}`}>
                  {voicing.label}
                  {n > 1 ? ` · ${idx + 1}/${n}` : ""}
                </span>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm h-6 w-6 px-0 text-sm disabled:opacity-30"
                  aria-label={`Next ${chord.symbol} shape`}
                  data-testid={`chord-voicing-next-${chord.symbol}`}
                  disabled={n <= 1}
                  onClick={() => stepVoicing(chord, 1, n)}
                >
                  ▶
                </button>
              </div>
              <span className="text-center text-[0.65rem] text-faint">{chord.roman}</span>
            </div>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        data-scroll
        className="scroll-x min-h-0 flex-1 overflow-x-auto overflow-y-auto px-2 py-3"
        data-testid="scale-fretmap-scroll"
      >
        <ScaleFretmapNeck
          cells={cells}
          chordShape={selectedShape}
          {...(solo
            ? {
                root,
                mode,
                box: activeBox,
                chordTones: toneChord,
                lick: shownLick ? { notes: shownLick.notes, compact: shownLick.compact } : null,
                litNotes,
              }
            : {})}
        />
      </div>

      {solo && (
        <p className="border-t border-line px-3 py-1.5 text-xs text-muted" data-testid="scale-fretmap-key">
          {shownLick && !shownLick.compact
            ? "Number = play order · ↑ bend (full or ½) · ↺ bend and release · / \\ slide · h hammer-on · p pull-off · ~ vibrato · dashed line = double stop"
            : shownLick
              ? "Lit note = the note sounding now. The solo plays through the box; scale notes are dimmed."
              : "Ring = chord tone · dashed ring = chord tone outside the scale · dimmed = outside the box"}
        </p>
      )}
    </div>,
    document.body,
  );
}

function clampToViewport(p: Pos): Pos {
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const panelH = 360;
  const panelW = 300;
  return {
    x: Math.min(Math.max(8, w - panelW - 8), Math.max(8, p.x)),
    y: Math.min(Math.max(8, h - panelH - 8), Math.max(8, p.y)),
  };
}
