"use client";

import { useEffect, useMemo, useState } from "react";
import { LickPicker } from "@/components/greats/LickPicker";
import { IconPlay, IconStop } from "@/components/Icons";
import { ScaleFretmapNeck } from "@/components/ScaleFretmapNeck";
import { BarTimeline } from "@/components/solo/shared";
import { LickTab } from "@/components/solo/LickTab";
import { buildFretmap } from "@/lib/music/scaleFretmap";
import { lickWindow } from "@/lib/music/soloGuide";
import {
  barChords,
  fretSpan,
  phraseNotes,
  type DiagonalLick,
} from "@/lib/music/diagonalLicks";
import { modeName } from "./LickChooser";
import { SpeedTrainer, type TrainerState } from "./SpeedTrainer";
import { playKey, type DiagonalAudio } from "./useDiagonalAudio";

const barsLabel = (start: number, count: number) => (count === 1 ? `Bar ${start + 1}` : `Bars ${start + 1}–${start + count}`);

/** The practice station for one lick: neck with route, phrase loop, speed trainer, melody, TAB, note-by-note picker. */
export function DiagonalPractice({
  dl,
  audio,
  onShowMap,
}: {
  dl: DiagonalLick;
  audio: DiagonalAudio;
  onShowMap: () => void;
}) {
  const { lick } = dl;
  const [part, setPart] = useState<number | null>(null);
  const [marks, setMarks] = useState(false);
  const [picking, setPicking] = useState(false);
  const [trainer, setTrainer] = useState<TrainerState>({ pct: 100, loop: false, ramp: false, countIn: false });

  // A new lick starts from the whole lick, closed picker.
  useEffect(() => {
    setPart(null);
    setPicking(false);
  }, [lick.id]);

  const cells = useMemo(() => buildFretmap(lick.root, lick.mode), [lick.root, lick.mode]);
  const win = useMemo(() => lickWindow(lick.notes), [lick.notes]);
  const melody = useMemo(() => new Set(dl.melody), [dl.melody]);
  const neckLick = useMemo(() => ({ notes: lick.notes, compact: !marks, route: true, accent: melody }), [lick.notes, marks, melody]);
  const bars = useMemo(() => barChords(dl), [dl]);
  const sections = useMemo(
    () => dl.phrases.map((p) => [p.bars[0], p.bars[1], p.label] as [number, number, string]),
    [dl.phrases],
  );

  const fullKey = playKey(lick.id, { part, melodyOnly: false });
  const melodyKey = playKey(lick.id, { part, melodyOnly: true });
  const mine = audio.playingKey?.startsWith(`${lick.id}:`) ?? false;
  const playingFull = audio.playingKey === fullKey;
  const playingMelody = audio.playingKey === melodyKey;
  const pickerKey = playKey(lick.id, { part: null, melodyOnly: false });

  const run = (melodyOnly: boolean) =>
    audio.toggle(dl, { part, melodyOnly, pct: trainer.pct, loop: trainer.loop, ramp: trainer.ramp, countIn: trainer.countIn });

  const changeTrainer = (next: TrainerState) => {
    setTrainer(next);
    if (mine) {
      audio.setRamp(next.ramp);
      audio.setPct(next.pct);
    }
  };

  const choosePart = (p: number | null) => {
    if (mine) audio.stop();
    setPart(p);
  };

  return (
    <section
      id="practice"
      aria-labelledby="dg-practice-title"
      className="surface scroll-mt-4 space-y-5 p-4 md:p-6"
      data-hl-scope={lick.id}
      data-testid="dg-practice"
      data-lick={lick.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="mb-1 flex flex-wrap gap-1.5">
            {lick.tags.map((t) => <span key={t} className="chip text-xs">{t}</span>)}
            <span className="chip text-xs">{dl.level}</span>
          </div>
          <h2 id="dg-practice-title" className="display text-2xl md:text-3xl">{lick.title}</h2>
          <p className="text-sm text-muted">
            {lick.root} {modeName(lick.mode)} · {lick.bpm} BPM · over {bars.join(" ")}
          </p>
          <p className="mt-2 text-[0.98rem] leading-relaxed">{dl.summary}</p>
        </div>
      </div>

      <div role="group" aria-label="What to practise" className="flex flex-wrap gap-1.5" data-testid="dg-parts">
        <button
          type="button"
          aria-pressed={part == null}
          onClick={() => choosePart(null)}
          className={`rounded-full px-3 py-1 text-sm ${part == null ? "bg-next font-semibold text-tolex" : "bg-panel-2 text-muted hover:text-ink"}`}
          data-testid="dg-part-all"
        >
          Whole lick
        </button>
        {dl.phrases.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={part === i}
            onClick={() => choosePart(i)}
            className={`rounded-full px-3 py-1 text-sm ${part === i ? "bg-next font-semibold text-tolex" : "bg-panel-2 text-muted hover:text-ink"}`}
            data-testid={`dg-part-${i}`}
          >
            {i + 1} · {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {/* A 20-second lick spans 10–20 frets: on phones the neck keeps a readable size and scrolls inside its box. */}
        <div className="scroll-x min-w-0 overflow-x-auto rounded-xl bg-tolex/40 p-1" data-testid="dg-neck">
          <div style={{ minWidth: `${(win.to - win.from + 1) * 2.4}rem` }}>
            <ScaleFretmapNeck cells={cells} root={lick.root} mode={lick.mode} box={0} lick={neckLick} fretWindow={win} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <span><span className="font-bold" style={{ color: "var(--color-next)" }}>···</span> route across the neck</span>
            <span><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink align-middle" /> melody note</span>
            <span>Notes light up as they sound</span>
          </p>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={marks} onChange={(e) => setMarks(e.target.checked)} data-testid="dg-marks" />
            Show order and technique marks
          </label>
        </div>
      </div>

      <BarTimeline bars={bars} sections={sections} activeLabel={`${lick.title} bar timeline`} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          aria-pressed={playingFull}
          onClick={() => run(false)}
          data-testid="dg-play"
        >
          {playingFull ? <IconStop /> : <IconPlay />} {playingFull ? "Stop" : part == null ? "Play the lick" : `Play phrase ${part + 1}`}
        </button>
        <button
          type="button"
          className={`btn ${playingMelody ? "btn-primary" : "btn-ghost"}`}
          aria-pressed={playingMelody}
          onClick={() => run(true)}
          data-testid="dg-melody"
        >
          {playingMelody ? <IconStop /> : <IconPlay />} {playingMelody ? "Stop" : "Melody only"}
        </button>
        <button
          type="button"
          className={`btn ${picking ? "btn-primary" : "btn-ghost"}`}
          aria-pressed={picking}
          onClick={() => setPicking((v) => !v)}
          data-testid="dg-pick-notes"
        >
          Pick it note by note
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onShowMap} data-testid="dg-show-map">
          Show on fretboard map
        </button>
      </div>

      {picking && (
        <LickPicker
          item={{ lick, why: dl.summary }}
          colour="var(--color-next)"
          playing={audio.playingKey === pickerKey}
          onPlay={(speed) =>
            audio.toggle(dl, { part: null, melodyOnly: false, pct: Math.round(speed * 100), loop: false, ramp: false, countIn: false })
          }
          onClose={() => setPicking(false)}
        />
      )}

      <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <ol className="space-y-2" data-testid="dg-phrases">
          {dl.phrases.map((p, i) => {
            const span = fretSpan(phraseNotes(dl, i).map((k) => lick.notes[k]!));
            const on = part === i;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => choosePart(on ? null : i)}
                  aria-pressed={on}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${on ? "border-next bg-panel-2" : "border-line hover:border-muted"}`}
                >
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-xs" style={{ color: "var(--color-next)" }}>{i + 1}</span>
                    <span className="font-bold">{p.label}</span>
                    <span className="font-mono text-xs text-muted">
                      {barsLabel(p.bars[0], p.bars[1])} · frets {span.lo === 0 ? "open" : span.lo}–{span.hi}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-muted">{p.text}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <SpeedTrainer
          dl={dl}
          part={part}
          state={trainer}
          onChange={changeTrainer}
          playing={mine && !picking}
          pass={audio.pass}
          livePct={audio.livePct}
        />
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold">TAB</h3>
        <LickTab notes={lick.notes} barsPerRow={4} />
      </div>
    </section>
  );
}
