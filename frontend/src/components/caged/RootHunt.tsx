"use client";

import { useEffect, useRef, useState } from "react";
import { CagedNeck, type HuntMark } from "@/components/caged/CagedNeck";
import { cagedKey, pcName, rootFrets, type StringNo } from "@/lib/music/caged";
import { STANDARD_TUNING } from "@/lib/music/guitar";

const NATURALS = [0, 2, 4, 5, 7, 9, 11];
const STRINGS: StringNo[] = [6, 5, 4];
const STRING_NAME: Record<number, string> = { 6: "low E", 5: "A", 4: "D" };
const ROUNDS = 10;
const FRETS = 12;

interface Target { string: StringNo; pc: number }

function nextTarget(prev?: Target): Target {
  for (;;) {
    const t = { string: STRINGS[Math.floor(Math.random() * STRINGS.length)]!, pc: NATURALS[Math.floor(Math.random() * NATURALS.length)]! };
    if (!prev || t.string !== prev.string || t.pc !== prev.pc) return t;
  }
}

/** Drill: find a named note on the low E, A or D string. Ten rounds. */
export function RootHunt() {
  const [target, setTarget] = useState<Target | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [marks, setMarks] = useState<HuntMark[]>([]);
  const [missed, setMissed] = useState(false);
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const done = round >= ROUNDS;
  const start = () => {
    setRound(0); setScore(0); setMarks([]); setMissed(false); setLocked(false);
    setTarget(nextTarget());
  };
  const advance = () => {
    timer.current = setTimeout(() => {
      setRound((r) => r + 1);
      setMarks([]); setMissed(false); setLocked(false);
      setTarget((t) => nextTarget(t ?? undefined));
    }, 900);
  };

  const pick = (s: number, f: number) => {
    if (!target || locked || done) return;
    const pc = (STANDARD_TUNING[s] + f) % 12;
    const ok = s === target.string && pc === target.pc;
    setMarks((m) => [...m, { string: s, fret: f, ok, label: pcName(pc) }]);
    if (ok) {
      if (!missed) setScore((x) => x + 1);
      setLocked(true);
      advance();
    } else setMissed(true);
  };

  const reveal = () => {
    if (!target || locked) return;
    setMissed(true);
    setLocked(true);
    setMarks((m) => [...m, ...rootFrets(target.pc, target.string, FRETS).map((f) => ({ string: target.string, fret: f, ok: true, label: pcName(target.pc) }))]);
    advance();
  };

  return (
    <div data-testid="root-hunt">
      <div className="flex flex-wrap items-center gap-3">
        {!target || done ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={start} data-testid="hunt-start">
            {done ? "Play again" : "Start the drill"}
          </button>
        ) : (
          <>
            <p className="text-[1.05rem]" data-testid="hunt-prompt" data-string={target.string} data-pc={target.pc}>
              <span className="text-muted">Round {Math.min(round + 1, ROUNDS)}/{ROUNDS} · Tap </span>
              <span className="display text-xl">{pcName(target.pc)}</span>
              <span className="text-muted"> on the </span>
              <strong>{STRING_NAME[target.string]}</strong>
              <span className="text-muted"> string</span>
            </p>
            <button type="button" className="btn btn-quiet btn-sm" onClick={reveal} disabled={locked}>Show me</button>
          </>
        )}
        <span className="ml-auto text-sm text-muted" data-testid="hunt-score">Score {score}/{ROUNDS}</span>
      </div>
      {done && (
        <p className="mt-2 text-sm" data-testid="hunt-done">
          {score >= 8 ? "Great — you know these strings. Try it with your eyes on the guitar, not the screen." : "Keep at it: learn the natural notes on low E first (E F · G · A · B C · D · E), then the A string."}
        </p>
      )}
      <div className="mt-3 overflow-x-auto rounded-xl bg-tolex p-2">
        <CagedNeck musicKey={cagedKey(0, "major")} positions={[]} frets={FRETS} selected="all" view="roots" labels="note"
          quiz={{ onPick: pick, marks }} testId="hunt-neck" />
      </div>
      <p className="mt-2 text-xs text-faint">Landmarks: the dots at 3, 5, 7, 9 and the double dot at 12, where every string starts again.</p>
    </div>
  );
}
