"use client";

import { useCallback, useId, useRef, type PointerEvent as ReactPointerEvent } from "react";

/** Rotary amp knob, 0–10. Drag up/right to raise, down/left to lower. */
export function AmpKnob({
  label,
  value,
  onChange,
  testId,
  fit = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  testId?: string;
  /** Spread evenly in a row (float amp) — same shape, flexible width. */
  fit?: boolean;
}) {
  const id = useId();
  const drag = useRef<{ y: number; v: number } | null>(null);
  // −135° … +135° sweep
  const angle = -135 + (Math.max(0, Math.min(10, value)) / 10) * 270;

  const setFromPointer = useCallback((clientY: number, start: { y: number; v: number }) => {
    const delta = (start.y - clientY) / 8; // ~8px per 0.1
    const next = Math.max(0, Math.min(10, Math.round((start.v + delta) * 10) / 10));
    onChange(next);
  }, [onChange]);

  const onPointerDown = (e: ReactPointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, v: value };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setFromPointer(e.clientY, drag.current);
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <div
      className={
        fit
          ? "flex min-w-0 flex-1 flex-col items-center gap-1"
          : "flex w-[4.25rem] shrink-0 flex-col items-center gap-1.5"
      }
      data-testid={testId}
    >
      <button
        type="button"
        id={id}
        aria-label={`${label} ${value.toFixed(1)}`}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={value}
        aria-valuetext={value.toFixed(1)}
        role="slider"
        tabIndex={0}
        className={`amp-knob relative grid place-items-center rounded-full select-none touch-none ${
          fit ? "h-12 w-12 max-w-full" : "h-14 w-14"
        }`}
        style={{
          background: "radial-gradient(circle at 35% 30%, #3a3d44 0%, #1e2024 55%, #141518 100%)",
          boxShadow: "inset 0 1px 0 #5a5e66, inset 0 -2px 4px #0a0b0c, 0 2px 4px rgba(0,0,0,.45)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); onChange(Math.min(10, Math.round((value + 0.5) * 10) / 10)); }
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); onChange(Math.max(0, Math.round((value - 0.5) * 10) / 10)); }
        }}
      >
        <span
          aria-hidden
          className={`absolute left-1/2 top-1/2 w-1 origin-bottom rounded-full bg-maple ${fit ? "h-5" : "h-[1.35rem]"}`}
          style={{ transform: `translate(-50%, -100%) rotate(${angle}deg)` }}
        />
        <span aria-hidden className="h-2 w-2 rounded-full bg-nickel/80" />
      </button>
      <label
        htmlFor={id}
        className={`font-semibold uppercase tracking-wide text-muted ${fit ? "text-[0.58rem] leading-none" : "text-[0.65rem]"}`}
      >
        {label}
      </label>
      <span className={`font-mono tabular-nums text-faint ${fit ? "text-[0.65rem] leading-none" : "text-xs"}`}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}
