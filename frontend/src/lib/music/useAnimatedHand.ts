"use client";

import { useEffect, useRef, useState } from "react";
import { easeInOut, interpolateHand, type HandShape } from "./handLayout";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Smoothly moves the drawn hand from where it is now to `target`: the hand slides along the
 * neck, the old finger lifts and the new one presses. Interruptions continue from the current
 * in-between pose, so fast passages never jump. Respects "reduce motion".
 */
export function useAnimatedHand(target: HandShape | null, enabled: boolean, ms = 260) {
  const [shown, setShown] = useState<HandShape | null>(target);
  const [animating, setAnimating] = useState(false);
  const current = useRef<HandShape | null>(target);
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = current.current;
    if (!target || !from || !enabled || prefersReducedMotion()) {
      current.current = target;
      setShown(target);
      setAnimating(false);
      return;
    }
    const start = performance.now();
    setAnimating(true);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const pose = interpolateHand(from, target, easeInOut(t));
      current.current = pose;
      setShown(pose);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else setAnimating(false);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, enabled, ms]);

  return { shown, animating };
}
