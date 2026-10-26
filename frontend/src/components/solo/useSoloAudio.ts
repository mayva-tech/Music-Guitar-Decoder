"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setHighlight } from "@/components/theory/highlight";
import { jamExample, LICKS_BY_ID, lickExample, type JamTrack, type Lick } from "@/lib/music/soloGuide";
import { getTheoryPlayer } from "@/lib/theory/player";

/** Elements that show a lick (card, TAB, popup, timeline) carry `data-hl-scope="<scope>"`; ids like `n3` are unique inside one scope. */
export function lightScope(scope: string | null, id: string, on: boolean) {
  if (!scope || typeof document === "undefined") return;
  const safe = scope.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  document.querySelectorAll<HTMLElement>(`[data-hl-scope="${safe}"]`).forEach((root) => {
    // The scope element may itself be the lit element (a TAB token never is, but a bar might).
    setHighlight(root, id, on);
    if (root.dataset.hl === id) root.classList.toggle("is-on", on);
  });
}

export interface SoloAudio {
  /** What is sounding now: "lick:<key>", "seq:<key>" or "jam:<trackId>". */
  playingKey: string | null;
  /** Current bar of the jam loop (null when not jamming). */
  jamBar: number | null;
  playLick(lick: Lick, opts?: { key?: string; scope?: string }): void;
  toggleLick(lick: Lick, opts?: { key?: string; scope?: string }): void;
  playSequence(key: string, lickIds: string[]): void;
  startJam(track: JamTrack, bpm: number): void;
  setJamBpm(bpm: number): void;
  stop(): void;
}

/**
 * One transport for the whole workshop: starting anything stops whatever played before,
 * leaving the page stops everything. Backing + lead go through the shared Theory player.
 */
export function useSoloAudio(leadTone: "clean" | "crunch"): SoloAudio {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [jamBar, setJamBar] = useState<number | null>(null);
  const token = useRef(0);
  const scope = useRef<string | null>(null);
  const tone = useRef(leadTone);
  const jamBpm = useRef(90);
  const jamTrack = useRef<JamTrack | null>(null);

  useEffect(() => {
    tone.current = leadTone;
  }, [leadTone]);

  const stop = useCallback(() => {
    token.current += 1;
    getTheoryPlayer().stop();
    scope.current = null;
    setPlayingKey(null);
    setJamBar(null);
  }, []);

  useEffect(() => () => {
    token.current += 1;
    getTheoryPlayer().stop();
  }, []);

  const hl = useCallback((id: string, on: boolean) => {
    lightScope(scope.current, id, on);
    if (on && id.startsWith("b_") && jamTrack.current && scope.current?.startsWith("jam:")) {
      const n = Number(id.slice(2));
      if (Number.isFinite(n)) setJamBar(n);
    }
  }, []);

  /** Plays one lick; resolves when it ends or is stopped. Returns false if superseded. */
  const runLick = useCallback(async (lick: Lick, myToken: number, sc: string): Promise<boolean> => {
    scope.current = sc;
    await getTheoryPlayer().play(lickExample(lick), hl, { lead: lick.notes, leadTone: tone.current });
    return token.current === myToken;
  }, [hl]);

  const playLick = useCallback((lick: Lick, opts?: { key?: string; scope?: string }) => {
    const key = `lick:${opts?.key ?? lick.id}`;
    getTheoryPlayer().stop(); // clears the previous scope's highlights first
    const my = ++token.current;
    jamTrack.current = null;
    setJamBar(null);
    setPlayingKey(key);
    void runLick(lick, my, opts?.scope ?? lick.id).then((ok) => {
      if (ok) setPlayingKey((cur) => (cur === key ? null : cur));
    });
  }, [runLick]);

  const toggleLick = useCallback((lick: Lick, opts?: { key?: string; scope?: string }) => {
    const key = `lick:${opts?.key ?? lick.id}`;
    if (playingKey === key) stop();
    else playLick(lick, opts);
  }, [playingKey, playLick, stop]);

  const playSequence = useCallback((key: string, lickIds: string[]) => {
    const k = `seq:${key}`;
    if (playingKey === k) { stop(); return; }
    getTheoryPlayer().stop(); // clears the previous scope's highlights first
    const my = ++token.current;
    jamTrack.current = null;
    setJamBar(null);
    setPlayingKey(k);
    void (async () => {
      for (const id of lickIds) {
        const lick = LICKS_BY_ID[id];
        if (!lick) continue;
        if (!(await runLick(lick, my, lick.id))) return;
      }
      if (token.current === my) setPlayingKey((cur) => (cur === k ? null : cur));
    })();
  }, [playingKey, runLick, stop]);

  const startJam = useCallback((track: JamTrack, bpm: number) => {
    const key = `jam:${track.id}`;
    getTheoryPlayer().stop(); // clears the previous scope's highlights first
    const my = ++token.current;
    jamTrack.current = track;
    jamBpm.current = bpm;
    scope.current = key;
    setJamBar(0);
    setPlayingKey(key);
    void getTheoryPlayer()
      .play(jamExample(track, bpm), hl, {
        loop: true,
        nextExample: () => jamExample(track, jamBpm.current),
      })
      .then(() => {
        if (token.current === my) {
          setPlayingKey((cur) => (cur === key ? null : cur));
          setJamBar(null);
        }
      });
  }, [hl]);

  const setJamBpm = useCallback((bpm: number) => {
    jamBpm.current = bpm;
  }, []);

  return useMemo(
    () => ({ playingKey, jamBar, playLick, toggleLick, playSequence, startJam, setJamBpm, stop }),
    [playingKey, jamBar, playLick, toggleLick, playSequence, startJam, setJamBpm, stop],
  );
}
