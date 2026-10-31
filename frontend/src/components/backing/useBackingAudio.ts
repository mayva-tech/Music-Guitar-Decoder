"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { clearHighlights, setHighlight } from "@/components/theory/highlight";
import { barSound, countInSound, type BackingTrack } from "@/lib/music/backingTracks";
import { getTheoryPlayer } from "@/lib/theory/player";

export interface LoopSettings {
  bpm: number;
  drums: boolean;
  bass: boolean;
  countIn: boolean;
}

export interface BackingAudio {
  /** Track id that is playing (or counting in), else null. */
  playingId: string | null;
  /** Progression bar sounding now (null while stopped or counting in). */
  bar: number | null;
  /** How many times the loop has come round (0 on the first pass). */
  cycle: number;
  countingIn: boolean;
  start(track: BackingTrack, settings: LoopSettings): void;
  stop(): void;
  /** Applies from the next bar. */
  update(settings: Partial<LoopSettings>): void;
}

/**
 * Loops a backing track one bar at a time through the shared Theory player, so tempo and
 * mute changes land on the next bar. Highlights (`b_<i>`, `beat_<n>`, `st_<k>`, `count_<n>`)
 * are toggled imperatively inside `scope`. Leaving the page stops the loop.
 */
export function useBackingAudio(scope: RefObject<HTMLElement | null>): BackingAudio {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [bar, setBar] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const [countingIn, setCountingIn] = useState(false);
  const settings = useRef<LoopSettings>({ bpm: 100, drums: true, bass: true, countIn: true });
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current += 1;
    getTheoryPlayer().stop();
    clearHighlights(scope.current);
    setPlayingId(null);
    setBar(null);
    setCycle(0);
    setCountingIn(false);
  }, [scope]);

  useEffect(() => () => {
    token.current += 1;
    getTheoryPlayer().stop();
  }, []);

  const start = useCallback((track: BackingTrack, s: LoopSettings) => {
    getTheoryPlayer().stop();
    clearHighlights(scope.current);
    const my = ++token.current;
    settings.current = { ...s };
    let pos = s.countIn ? -1 : 0; // -1 = the count-in bar
    const len = track.bars.length;

    const soundAt = (p: number) => {
      const cur = settings.current;
      if (p < 0) return countInSound(track, cur.bpm);
      return barSound(track, p % len, { bpm: cur.bpm, drums: cur.drums, bass: cur.bass, cycle: Math.floor(p / len) });
    };

    const onHighlight = (id: string, on: boolean) => {
      if (token.current !== my) return;
      setHighlight(scope.current, id, on);
      if (!on) return;
      if (id.startsWith("count_")) {
        setCountingIn(true);
      } else if (id.startsWith("b_")) {
        const n = Number(id.slice(2));
        if (Number.isFinite(n)) {
          setCountingIn(false);
          setBar(n);
        }
      }
    };

    setPlayingId(track.id);
    setBar(null);
    setCycle(0);
    setCountingIn(s.countIn);
    const first = soundAt(pos);
    void getTheoryPlayer()
      .play(first, onHighlight, {
        loop: true,
        nextExample: () => {
          pos += 1;
          if (pos >= 0 && pos % len === 0) {
            const c = Math.floor(pos / len);
            // Bars are scheduled ~0.35 s ahead; the cycle count is only for display.
            setTimeout(() => { if (token.current === my) setCycle(c); }, 300);
          }
          return soundAt(pos);
        },
      })
      .then(() => {
        if (token.current === my) {
          setPlayingId(null);
          setBar(null);
          setCountingIn(false);
        }
      });
  }, [scope]);

  const update = useCallback((s: Partial<LoopSettings>) => {
    settings.current = { ...settings.current, ...s };
  }, []);

  return useMemo(
    () => ({ playingId, bar, cycle, countingIn, start, stop, update }),
    [playingId, bar, cycle, countingIn, start, stop, update],
  );
}
