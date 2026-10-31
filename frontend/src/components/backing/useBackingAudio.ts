"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { clearHighlights, setHighlight } from "@/components/theory/highlight";
import { lickBar } from "@/lib/music/backingSolo";
import { barSound, countInSound, type BackingTrack } from "@/lib/music/backingTracks";
import { getTheoryPlayer, type LeadSound } from "@/lib/theory/player";
import type { PlayableNote } from "@/lib/types";

export interface LoopSettings {
  bpm: number;
  drums: boolean;
  bass: boolean;
  countIn: boolean;
  /** Lick to play on the lead voice along with the loop (null = backing only). */
  lick?: PlayableNote[] | null;
  leadTone?: "clean" | "crunch";
}

export interface BackingAudio {
  /** Track id that is playing (or counting in), else null. */
  playingId: string | null;
  /** Progression bar sounding now (null while stopped or counting in). */
  bar: number | null;
  /** How many times the loop has come round (0 on the first pass). */
  cycle: number;
  countingIn: boolean;
  /** Beat of the bar sounding now (null while stopped). */
  beat: number | null;
  /** Index (in the lick) of the lick note sounding now. */
  litNote: number | null;
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
  const [beat, setBeat] = useState<number | null>(null);
  const [litNote, setLitNote] = useState<number | null>(null);
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
    setBeat(null);
    setLitNote(null);
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

    const soundAt = (p: number): LeadSound => {
      const cur = settings.current;
      if (p < 0) return countInSound(track, cur.bpm);
      const bar = p % len;
      const s: LeadSound = barSound(track, bar, { bpm: cur.bpm, drums: cur.drums, bass: cur.bass, cycle: Math.floor(p / len) });
      if (!cur.lick?.length) return s;
      const { notes, first } = lickBar(cur.lick, bar, track.drums.beats);
      if (!notes.length) return s;
      const events = [...s.events];
      notes.forEach((n, i) => events.push({ kind: "highlight", beat: n.start_beat, beats: n.duration_beats, velocity: 0, highlight: `ln_${first + i}` }));
      return { ...s, events, lead: notes };
    };

    const onHighlight = (id: string, on: boolean) => {
      if (token.current !== my) return;
      setHighlight(scope.current, id, on);
      if (id.startsWith("ln_")) {
        const k = Number(id.slice(3));
        if (on) setLitNote(k);
        else setLitNote((cur) => (cur === k ? null : cur));
        return;
      }
      if (!on) return;
      if (id.startsWith("beat_")) setBeat(Number(id.slice(5)));
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
        leadTone: s.leadTone ?? "clean",
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
          setBeat(null);
          setLitNote(null);
        }
      });
  }, [scope]);

  const update = useCallback((s: Partial<LoopSettings>) => {
    settings.current = { ...settings.current, ...s };
  }, []);

  return useMemo(
    () => ({ playingId, bar, cycle, countingIn, beat, litNote, start, stop, update }),
    [playingId, bar, cycle, countingIn, beat, litNote, start, stop, update],
  );
}
