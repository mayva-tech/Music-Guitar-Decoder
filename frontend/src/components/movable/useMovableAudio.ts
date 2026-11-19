"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lightScope } from "@/components/solo/useSoloAudio";
import { DEFAULT_AMP, normalizeAmp, type AmpKnobs } from "@/lib/audio/amp";
import type { LeadTone } from "@/lib/audio/leadTone";
import { getTheoryPlayer, type LeadSound } from "@/lib/theory/player";

export interface MovableAudio {
  /** Key of what is sounding, or null. */
  playingKey: string | null;
  /**
   * Plays a sound (backing + lead line) and lights `data-hl` ids inside `data-hl-scope="<scope>"`.
   * With `loop`, `build` is called again before every pass, so tempo or idea changes apply from the next loop.
   */
  play(key: string, scope: string, build: () => LeadSound, loop?: boolean): void;
  toggle(key: string, scope: string, build: () => LeadSound, loop?: boolean): void;
  /** Replace what the next loop pass plays (no effect when nothing loops). */
  update(build: () => LeadSound): void;
  stop(): void;
}

/** One transport for the page through the shared Theory player: starting anything stops the rest. */
export function useMovableAudio(leadTone: LeadTone, amp: AmpKnobs = DEFAULT_AMP): MovableAudio {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const token = useRef(0);
  const scope = useRef<string | null>(null);
  const tone = useRef(leadTone);
  const ampRef = useRef(normalizeAmp(amp));
  const builder = useRef<(() => LeadSound) | null>(null);

  useEffect(() => {
    tone.current = leadTone;
  }, [leadTone]);
  useEffect(() => {
    ampRef.current = normalizeAmp(amp);
  }, [amp]);

  const stop = useCallback(() => {
    token.current += 1;
    getTheoryPlayer().stop();
    scope.current = null;
    builder.current = null;
    setPlayingKey(null);
  }, []);

  useEffect(() => () => {
    token.current += 1;
    getTheoryPlayer().stop();
  }, []);

  const hl = useCallback((id: string, on: boolean) => lightScope(scope.current, id, on), []);

  const play = useCallback((key: string, sc: string, build: () => LeadSound, loop = false) => {
    getTheoryPlayer().stop(); // clears the previous scope's highlights first
    const my = ++token.current;
    scope.current = sc;
    builder.current = build;
    setPlayingKey(key);
    void getTheoryPlayer()
      .play(build(), hl, {
        leadTone: tone.current,
        amp: ampRef.current,
        loop,
        nextExample: () => (builder.current ?? build)(),
      })
      .then(() => {
        if (token.current === my) {
          scope.current = null;
          builder.current = null;
          setPlayingKey((cur) => (cur === key ? null : cur));
        }
      });
  }, [hl]);

  const toggle = useCallback((key: string, sc: string, build: () => LeadSound, loop = false) => {
    if (playingKey === key) stop();
    else play(key, sc, build, loop);
  }, [playingKey, play, stop]);

  const update = useCallback((build: () => LeadSound) => {
    if (builder.current) builder.current = build;
  }, []);

  return useMemo(() => ({ playingKey, play, toggle, update, stop }), [playingKey, play, toggle, update, stop]);
}
