"use client";

import { useEffect, useMemo, useState } from "react";
import { ChordDiagram } from "@/components/ChordDiagram";
import { IconPlay, IconStop } from "@/components/Icons";
import { KeyChip } from "@/components/KeyChip";
import { ScrollablePracticeNeck } from "@/components/ScrollablePracticeNeck";
import { LickTab } from "@/components/solo/LickTab";
import { LICK_STYLES, lickBar, nextChange, soloPosition, voicingsFor, type LickStyle } from "@/lib/music/backingSolo";
import { chordsOf, scaleLabel, type BackingTrack, type Genre } from "@/lib/music/backingTracks";
import { buildFretmap } from "@/lib/music/scaleFretmap";
import type { PlayableNote } from "@/lib/types";
import type { BackingAudio } from "./useBackingAudio";

export function SoloGuide({
  track, genre, audio, lick, lickStyle, onLickStyle, lickOn, onLickOn, onPlay,
}: {
  track: BackingTrack;
  genre: Genre;
  audio: BackingAudio;
  lick: PlayableNote[];
  lickStyle: LickStyle;
  onLickStyle: (s: LickStyle) => void;
  lickOn: boolean;
  onLickOn: (on: boolean) => void;
  onPlay: () => void;
}) {
  const beats = track.drums.beats;
  const len = track.bars.length;
  const playing = audio.playingId === track.id;
  const live = playing && !audio.countingIn && audio.bar != null;
  const [previewBar, setPreviewBar] = useState(0);
  const [marks, setMarks] = useState(false);
  const [shapeOn, setShapeOn] = useState<string | null>(null);
  const [voicingIdx, setVoicingIdx] = useState<Record<string, number>>({});

  useEffect(() => {
    setPreviewBar(0);
    setShapeOn(null);
    setVoicingIdx({});
  }, [track.id]);

  const bar = live ? audio.bar! : previewBar;
  const beat = live ? audio.beat ?? 0 : 0;
  const pos = useMemo(() => soloPosition(track), [track]);
  const cells = useMemo(() => buildFretmap(track.root, track.mode), [track.root, track.mode]);
  const chords = useMemo(() => chordsOf(track), [track]);
  // While a loop is sounding, show the lick that was scheduled for that bar — not a newer style the user just picked.
  const shownLick = live && audio.soundingLick ? audio.soundingLick : lick;

  const at = bar * beats + beat;
  const change = nextChange(track, at);

  const { notes: barNotes, first } = useMemo(() => lickBar(shownLick, bar, beats), [shownLick, bar, beats]);
  const lit = useMemo(() => {
    const k = audio.litNote;
    return k != null && k >= first && k < first + barNotes.length && playing ? new Set([k - first]) : new Set<number>();
  }, [audio.litNote, first, barNotes.length, playing]);

  // Whole lick on the neck (diagonal style); light the note sounding now — no “next” ghost.
  const neckLick = useMemo(
    () => (shownLick.length ? { notes: shownLick, compact: !marks, route: true } : null),
    [shownLick, marks],
  );
  const litNotes = useMemo(() => {
    if (!playing || audio.litNote == null) return undefined;
    return new Set([audio.litNote]);
  }, [playing, audio.litNote]);

  const shapeVoicings = shapeOn ? voicingsFor(shapeOn) : [];
  const shape = shapeOn ? shapeVoicings[Math.min(voicingIdx[shapeOn] ?? 0, shapeVoicings.length - 1)]?.shape ?? null : null;

  const total = len * beats;
  const playhead = ((bar * beats + beat + (live ? 0.5 : 0)) / total) * 100;

  return (
    <section id="solo-guide" aria-labelledby="solo-guide-heading" className="surface scroll-mt-4 space-y-4 p-4 md:p-5" data-testid="solo-guide" style={{ borderTop: `4px solid ${genre.colour}` }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: genre.colour }}>Solo guide · live fretboard</p>
          <h2 id="solo-guide-heading" className="display text-2xl">Solo over {track.name}</h2>
          <div className="mt-1"><KeyChip root={track.root} mode={track.mode} /></div>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {track.root} {scaleLabel(track.mode)}{pos.box ? ", box 1" : ""}, frets {pos.window.from}–{pos.window.to}.
            Color-coded scale notes with the suggested lick routed across the neck — notes light up as they sound.
          </p>
        </div>
        <button type="button" className="btn btn-primary" aria-pressed={playing} data-testid="guide-toggle" onClick={() => (playing ? audio.stop() : onPlay())}>
          {playing ? <IconStop width={18} height={18} /> : <IconPlay width={18} height={18} />}
          {playing ? "Stop" : "Play loop"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Lick style">
          {LICK_STYLES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={lickStyle === s.id} title={s.hint}
              data-testid={`guide-style-${s.id}`} onClick={() => onLickStyle(s.id)}
              className={`chip text-xs ${lickStyle === s.id ? "bg-maple text-tolex" : "text-muted hover:bg-panel-2"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" aria-pressed={lickOn} data-testid="guide-lick-sound" onClick={() => onLickOn(!lickOn)}
          className={`chip text-xs ${lickOn ? "bg-maple text-tolex" : "text-muted hover:bg-panel-2"}`}>
          Play lick with loop: {lickOn ? "on" : "off"}
        </button>
      </div>
      <p className="text-xs text-faint">{LICK_STYLES.find((s) => s.id === lickStyle)?.hint}</p>

      {/* Chord-change timeline with a playhead */}
      <div className="space-y-2">
        <div className="relative" data-testid="guide-timeline">
          <ol className="grid gap-1" style={{ gridTemplateColumns: `repeat(${len}, minmax(0, 1fr))` }} aria-label="Chord changes">
            {track.bars.map((b, i) => {
              const cur = i === bar;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={live}
                    onClick={() => setPreviewBar(i)}
                    aria-current={cur ? "true" : undefined}
                    data-testid={`guide-bar-${i}`}
                    className={`flex h-11 w-full items-center justify-center gap-1 overflow-hidden rounded-lg border px-0.5 font-mono text-[0.7rem] font-bold sm:text-xs ${cur ? "text-tolex" : "border-line text-muted hover:bg-panel-2"}`}
                    style={cur ? { background: genre.colour, borderColor: genre.colour } : undefined}
                    title={`Bar ${i + 1}: ${b}`}
                  >
                    {b.split(" ").map((c, k) => <span key={k} className="truncate">{c}</span>)}
                  </button>
                </li>
              );
            })}
          </ol>
          <span aria-hidden className="bk-playhead pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded bg-ink"
            style={{ left: `${playhead}%`, opacity: playing ? 1 : 0.35 }} />
        </div>
        <div className="flex flex-wrap items-center gap-3" data-testid="guide-countdown" aria-live="off">
          {change.inBeats === Infinity ? (
            <p className="text-sm text-muted">One chord all the way: no changes to aim for.</p>
          ) : live ? (
            <>
              <p className="text-sm">
                <span className="text-faint">Now </span><strong>{change.current}</strong>
                {change.chord !== change.current && change.inBeats !== Infinity ? (
                  <span className="text-faint"> · <strong className="text-ink">{change.chord}</strong> in <strong className="font-mono text-ink">{Math.ceil(change.inBeats)}</strong> beat{Math.ceil(change.inBeats) === 1 ? "" : "s"}</span>
                ) : null}
              </p>
              <span className="flex gap-1" aria-hidden title="Beats left before the change">
                {[4, 3, 2, 1].map((k) => (
                  <span key={k} className="h-3 w-3 rounded-full bg-panel-2"
                    style={Math.ceil(change.inBeats) >= k && Math.ceil(change.inBeats) <= 4 ? { background: "var(--theory-highlight)" } : undefined} />
                ))}
              </span>
            </>
          ) : (
            <p className="text-sm text-muted">
              Bar {bar + 1}: <strong className="text-ink">{track.bars[bar]}</strong>
              {change.chord !== change.current ? <> · next change to <strong className="text-ink">{change.chord}</strong> in {Math.ceil(change.inBeats)} beats</> : null}.
              {" "}Tap a bar to preview its TAB, or press Play.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <ScrollablePracticeNeck
          cells={cells}
          root={track.root}
          mode={track.mode}
          lick={shape ? null : neckLick}
          litNotes={shape ? undefined : litNotes}
          chordShape={shape}
          data-testid="guide-neck"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          {shape ? (
            <span>Showing the {shapeOn} shape with fingers. <button type="button" className="underline" onClick={() => setShapeOn(null)}>Back to the lick</button></span>
          ) : (
            <>
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                <span><span className="font-bold" style={{ color: "var(--color-next)" }}>···</span> route across the neck</span>
                <span><span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink align-middle" /> melody note</span>
                <span>Notes light up as they sound</span>
              </p>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={marks} onChange={(e) => setMarks(e.target.checked)} data-testid="guide-marks" />
                Show order and technique marks
              </label>
            </>
          )}
        </div>
      </div>

      {!shape && barNotes.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-tolex/60 p-3" data-testid="guide-tab">
          <p className="mb-1 text-[0.65rem] uppercase tracking-wide text-faint">Bar {bar + 1} lick in TAB</p>
          <LickTab notes={barNotes} beatsPerBar={beats} barsPerRow={1} litNotes={lit} />
        </div>
      )}

      {/* Chord shapes with voicing arrows */}
      <div className="space-y-2 border-t border-line pt-4">
        <div>
          <h3 className="font-bold">Chord shapes in this loop</h3>
          <p className="text-xs text-muted">◀ ▶ moves to a lower or higher shape on the neck. <em>On neck</em> shows it on the big fretboard.</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 min-[900px]:grid-cols-4 xl:grid-cols-6" data-testid="guide-chords">
          {chords.map((c) => {
            const vs = voicingsFor(c);
            const i = Math.min(voicingIdx[c] ?? 0, Math.max(0, vs.length - 1));
            const v = vs[i];
            const nowPlaying = live && change.current === c;
            const set = (d: number) => setVoicingIdx((m) => ({ ...m, [c]: Math.max(0, Math.min(vs.length - 1, i + d)) }));
            return (
              <li key={c} className="flex flex-col items-center gap-1 rounded-xl border p-2" data-testid={`guide-chord-${c}`}
                style={{ borderColor: nowPlaying ? genre.colour : "var(--color-line)", background: nowPlaying ? "var(--color-panel-2)" : undefined }}>
                {v ? <ChordDiagram name={c} diagram={v.shape} size={1.1} /> : <p className="py-8 font-bold">{c}</p>}
                <div className="flex items-center gap-1">
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 ring-1 ring-line hover:bg-line disabled:opacity-35"
                    aria-label={`Lower ${c} shape`} disabled={i <= 0} onClick={() => set(-1)} data-testid={`guide-chord-${c}-down`}>◀</button>
                  <span className="min-w-[4.5rem] text-center font-mono text-[0.7rem] text-muted" data-testid={`guide-chord-${c}-label`}>
                    {v ? `${v.label} · ${i + 1}/${vs.length}` : "—"}
                  </span>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 ring-1 ring-line hover:bg-line disabled:opacity-35"
                    aria-label={`Higher ${c} shape`} disabled={i >= vs.length - 1} onClick={() => set(1)} data-testid={`guide-chord-${c}-up`}>▶</button>
                </div>
                <button type="button" aria-pressed={shapeOn === c} data-testid={`guide-chord-${c}-neck`}
                  className={`chip text-[0.7rem] ${shapeOn === c ? "bg-maple text-tolex" : "text-muted hover:bg-panel-2"}`}
                  onClick={() => setShapeOn((cur) => (cur === c ? null : c))}>
                  On neck
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
