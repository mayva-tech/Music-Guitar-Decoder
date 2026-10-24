"use client";

import { useEffect, useRef, useState, type PointerEvent as REPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cancelEnglishSpeech, speakEnglish } from "@/lib/tts/speakEnglish";
import { useApp } from "@/lib/store";

const STORE_KEY = "md-read-aloud-float";
const W = 340;
const DEFAULT = { x: 48, y: 96 };

type Pos = { x: number; y: number };

function loadPos(): Pos {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch { /* ignore */ }
  return DEFAULT;
}

export interface ReadAloudSelection {
  id: string;
  title: string;
  /** Spoken English (Andrew). */
  speakText: string;
  /** Visual body inside the panel. */
  children: ReactNode;
}

interface Props {
  selection: ReadAloudSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Viewport-fixed read-aloud panel. Overlays the whole window; when Auto read
 * is on, selecting an item speaks its English text (Microsoft Andrew).
 */
export function ReadAloudFloat({ selection, open, onOpenChange }: Props) {
  const autoRead = useApp((s) => s.prefs.autoReadAloud);
  const setPrefs = useApp((s) => s.setPrefs);
  const [pos, setPos] = useState<Pos>(DEFAULT);
  const [mounted, setMounted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const speakGen = useRef(0);

  useEffect(() => {
    setMounted(true);
    setPos(clampToViewport(loadPos()));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setPos((p) => clampToViewport(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // Auto-read when selection changes and auto-read is on.
  useEffect(() => {
    if (!open || !selection || !autoRead) {
      if (!autoRead || !open) {
        cancelEnglishSpeech();
        setSpeaking(false);
      }
      return;
    }
    const gen = ++speakGen.current;
    const ac = new AbortController();
    setSpeaking(true);
    void speakEnglish(selection.speakText, { signal: ac.signal });
    // speakEnglish resolves when queued — poll until the utterance actually ends.
    const poll = window.setInterval(() => {
      const synth = window.speechSynthesis;
      if (!synth?.speaking && !synth?.pending) {
        if (speakGen.current === gen) setSpeaking(false);
        window.clearInterval(poll);
      }
    }, 400);
    return () => {
      ac.abort();
      cancelEnglishSpeech();
      window.clearInterval(poll);
      if (speakGen.current === gen) setSpeaking(false);
    };
  }, [open, selection?.id, selection?.speakText, autoRead]);

  const onPointerDown = (e: REPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
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
        sessionStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const replay = () => {
    if (!selection) return;
    const gen = ++speakGen.current;
    setSpeaking(true);
    void speakEnglish(selection.speakText);
    const poll = window.setInterval(() => {
      const synth = window.speechSynthesis;
      if (!synth?.speaking && !synth?.pending) {
        if (speakGen.current === gen) setSpeaking(false);
        window.clearInterval(poll);
      }
    }, 400);
  };

  const stop = () => {
    speakGen.current += 1;
    cancelEnglishSpeech();
    setSpeaking(false);
  };

  if (!open || !mounted || !selection) return null;

  return createPortal(
    <div
      id="read-aloud-float"
      data-testid="read-aloud-float"
      role="dialog"
      aria-label={`Read aloud: ${selection.title}`}
      className="fixed z-[9999] flex max-h-[min(70vh,560px)] w-[min(92vw,340px)] select-none flex-col rounded-2xl border border-line bg-panel-2/95 shadow-2xl backdrop-blur-sm"
      style={{ left: pos.x, top: pos.y, width: W }}
    >
      <div
        className="flex cursor-grab items-center gap-2 border-b border-line px-3 py-2.5 touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="text-[0.65rem] uppercase tracking-wide text-muted" title="Drag anywhere on the window">⠿ Drag</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">Read aloud</span>
        <button type="button" className="btn btn-quiet btn-sm px-2 py-0.5 text-xs" aria-label="Close read aloud"
          onClick={() => onOpenChange(false)}>Close</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <button
          type="button"
          className={`btn btn-sm ${autoRead ? "btn-primary" : "btn-quiet"}`}
          aria-pressed={autoRead}
          data-testid="toggle-auto-read"
          onClick={() => setPrefs({ autoReadAloud: !autoRead })}
        >
          Auto read {autoRead ? "On" : "Off"}
        </button>
        {speaking ? (
          <button type="button" className="btn btn-quiet btn-sm" data-testid="stop-read" onClick={stop}>Stop</button>
        ) : (
          <button type="button" className="btn btn-quiet btn-sm" data-testid="replay-read" onClick={replay}>Speak</button>
        )}
        {speaking && <span className="text-xs text-ok" aria-live="polite">Speaking…</span>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <h3 className="display text-lg leading-snug text-ink">{selection.title}</h3>
        <div className="mt-2 grid gap-2 text-sm leading-relaxed text-muted">
          {selection.children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function clampToViewport(p: Pos): Pos {
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const panelH = 280;
  const maxX = Math.max(8, w - W - 8);
  const maxY = Math.max(8, h - panelH - 8);
  return {
    x: Math.min(maxX, Math.max(8, p.x)),
    y: Math.min(maxY, Math.max(8, p.y)),
  };
}
