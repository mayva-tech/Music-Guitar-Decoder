"use client";

import { useEffect, useRef, useState, type PointerEvent as REPointerEvent } from "react";
import { createPortal } from "react-dom";

const STORE_KEY = "md-explain-float";
const W = 288;
const DEFAULT = { x: 360, y: 120 };

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

interface Props {
  noteName: string;
  move?: string;
  degree?: string;
  lines: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Viewport-fixed tip card. Portaled to document.body so it can be dragged
 * anywhere on the window and overlap every other UI layer.
 */
export function ExplainFloat({ noteName, move, degree, lines, open, onOpenChange }: Props) {
  const [pos, setPos] = useState<Pos>(DEFAULT);
  const [mounted, setMounted] = useState(false);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

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

  if (!open || !mounted) return null;

  const hasBody = !!(move || degree || lines.length);

  return createPortal(
    <div
      ref={panel}
      data-testid="explain-float"
      role="dialog"
      aria-label="How to play this note"
      className="fixed z-[9999] w-72 select-none rounded-2xl border border-line bg-panel-2/95 p-3 shadow-2xl backdrop-blur-sm"
      style={{ left: pos.x, top: pos.y, width: W }}
    >
      <div
        className="flex cursor-grab items-center gap-2 touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="text-[0.65rem] uppercase tracking-wide text-muted" title="Drag anywhere on the window">⠿ Drag</span>
        <span className="display min-w-0 flex-1 truncate text-lg leading-none">{noteName}</span>
        <button type="button" className="btn btn-quiet btn-sm px-2 py-0.5 text-xs" aria-label="Hide tip"
          onClick={() => onOpenChange(false)}>Hide</button>
      </div>

      {!hasBody && <p className="mt-2 text-sm text-muted">Follow the glowing fret.</p>}

      {move && (
        <p className="mt-2 rounded-lg bg-tolex/80 px-2.5 py-1.5 text-sm leading-snug" data-testid="float-move">
          <span className="text-muted">Move: </span>{move}
        </p>
      )}
      {degree && (
        <p className="mt-1.5 text-xs text-muted" data-testid="float-degree">{degree}</p>
      )}
      {lines.length > 0 && (
        <ol className="mt-2 grid list-decimal gap-1 pl-4 text-sm leading-snug" aria-live="polite" data-testid="float-instructions">
          {lines.map((l) => <li key={l}>{l}</li>)}
        </ol>
      )}
    </div>,
    document.body,
  );
}

function clampToViewport(p: Pos): Pos {
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const panelH = 200;
  const maxX = Math.max(8, w - W - 8);
  const maxY = Math.max(8, h - panelH - 8);
  return {
    x: Math.min(maxX, Math.max(8, p.x)),
    y: Math.min(maxY, Math.max(8, p.y)),
  };
}
