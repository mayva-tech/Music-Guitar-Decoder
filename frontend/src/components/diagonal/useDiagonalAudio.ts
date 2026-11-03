"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lightScope } from "@/components/solo/useSoloAudio";
import { nextRampPct, practiceExample, type DiagonalLick } from "@/lib/music/diagonalLicks";
import { getTheoryPlayer } from "@/lib/theory/player";

export interface DiagonalPlay {
  /** Phrase index, or null for the whole lick. */
  part: number | null;
  melodyOnly: boolean;
  /** Tempo, % of the lick's own BPM. */
  pct: number;
  loop: boolean;
  /** Loop only: 5% faster every pass (up to RAMP_MAX). */
  ramp: boolean;
  countIn: boolean;
}

export interface DiagonalAudio {
  /** "<lickId>:<part|all>:<melody|full>" of what is sounding, or null. */
  playingKey: string | null;
  /** Pass number of the loop now playing (1 = first). */
  pass: number;
  /** Tempo (%) of the pass now playing. */
  livePct: number | null;
  play(dl: DiagonalLick, p: DiagonalPlay): void;
  toggle(dl: DiagonalLick, p: DiagonalPlay): void;
  /** Tempo for the next loop (ignored while speed-up is on). */
  setPct(pct: number): void;
  setRamp(on: boolean): void;
  stop(): void;
}

export function playKey(lickId: string, p: Pick<DiagonalPlay, "part" | "melodyOnly">): string {
  return `${lickId}:${p.part ?? "all"}:${p.melodyOnly ? "melody" : "full"}`;
}

/**
 * One transport for the page, through the shared Theory player: backing, the lick on the lead voice,
 * and highlights in the lick's scope (`data-hl-scope="<lick id>"`). Looping reschedules the pass
 * back to back; a tempo change (or the speed-up) applies from the next pass.
 */
export function useDiagonalAudio(leadTone: "clean" | "crunch"): DiagonalAudio {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [pass, setPass] = useState(0);
  const [livePct, setLivePct] = useState<number | null>(null);
  const token = useRef(0);
  const scope = useRef<string | null>(null);
  const tone = useRef(leadTone);
  const pctRef = useRef(100);
  const rampRef = useRef(false);

  useEffect(() => {
    tone.current = leadTone;
  }, [leadTone]);

  const reset = useCallback(() => {
    scope.current = null;
    setPlayingKey(null);
    setPass(0);
    setLivePct(null);
  }, []);

  const stop = useCallback(() => {
    token.current += 1;
    getTheoryPlayer().stop();
    reset();
  }, [reset]);

  useEffect(() => () => {
    token.current += 1;
    getTheoryPlayer().stop();
  }, []);

  const hl = useCallback((id: string, on: boolean) => lightScope(scope.current, id, on), []);

  const play = useCallback((dl: DiagonalLick, p: DiagonalPlay) => {
    const key = playKey(dl.lick.id, p);
    getTheoryPlayer().stop(); // clears the previous scope's highlights first
    const my = ++token.current;
    scope.current = dl.lick.id;
    pctRef.current = p.pct;
    rampRef.current = p.ramp;
    setPlayingKey(key);
    setPass(1);
    setLivePct(p.pct);
    const first = practiceExample(dl, { part: p.part, melodyOnly: p.melodyOnly, pct: p.pct, countIn: p.countIn });
    void getTheoryPlayer()
      .play(first, hl, {
        leadTone: tone.current,
        loop: p.loop,
        nextExample: () => {
          if (rampRef.current) pctRef.current = nextRampPct(pctRef.current);
          const pct = pctRef.current;
          if (token.current === my) {
            setPass((n) => n + 1);
            setLivePct(pct);
          }
          return practiceExample(dl, { part: p.part, melodyOnly: p.melodyOnly, pct });
        },
      })
      .then(() => {
        if (token.current === my) reset();
      });
  }, [hl, reset]);

  const toggle = useCallback((dl: DiagonalLick, p: DiagonalPlay) => {
    if (playingKey === playKey(dl.lick.id, p)) stop();
    else play(dl, p);
  }, [playingKey, play, stop]);

  const setPct = useCallback((pct: number) => {
    if (!rampRef.current) pctRef.current = pct;
  }, []);
  const setRamp = useCallback((on: boolean) => {
    rampRef.current = on;
  }, []);

  return useMemo(
    () => ({ playingKey, pass, livePct, play, toggle, setPct, setRamp, stop }),
    [playingKey, pass, livePct, play, toggle, setPct, setRamp, stop],
  );
}
