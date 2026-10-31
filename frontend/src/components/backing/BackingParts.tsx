"use client";

import Link from "next/link";
import { useMemo, type RefObject } from "react";
import { IconPlay, IconStop } from "@/components/Icons";
import {
  DRUM_LABEL, DRUM_VOICES, FEEL_LABEL, LESSON_LINKS, GENRES, bassBar, chordsOf, drumBar, keyName, meterOf,
  progressionText, scaleLabel, tempoBand, tempoRange, tempoStep, trackLessons, tracksFor,
  type BackingTrack, type Genre, type GenreId, type LessonId, type TempoBand,
} from "@/lib/music/backingTracks";
import { pitchClassName } from "@/lib/music/theory";
import type { BackingAudio, LoopSettings } from "./useBackingAudio";

/* ------------------------------------------------------------ genre picker */

export function GenrePicker({ value, onChange }: { value: GenreId; onChange: (g: GenreId) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-3 min-[900px]:grid-cols-5" role="tablist" aria-label="Genre" data-testid="backing-genres">
      {GENRES.map((g) => {
        const sel = g.id === value;
        const bpms = tracksFor(g.id).map((t) => t.bpm);
        return (
          <li key={g.id}>
            <button
              type="button"
              role="tab"
              aria-selected={sel}
              data-testid={`backing-genre-${g.id}`}
              onClick={() => onChange(g.id)}
              className={`h-full w-full rounded-xl border p-3 text-left transition-colors hover:bg-panel-2 ${sel ? "bg-panel-2" : "border-line"}`}
              style={sel ? { borderColor: g.colour } : undefined}
            >
              <span className="block h-1.5 w-8 rounded-full" style={{ background: g.colour }} aria-hidden />
              <span className="mt-2 block font-bold leading-tight">{g.name}</span>
              <span className="block font-mono text-[0.7rem] text-muted">
                20 loops · {Math.min(...bpms)}–{Math.max(...bpms)} BPM
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------------- lessons */

export function LessonChips({ ids, testId }: { ids: LessonId[]; testId?: string }) {
  return (
    <ul className="flex flex-wrap gap-2" data-testid={testId}>
      {ids.map((id) => {
        const l = LESSON_LINKS[id];
        return (
          <li key={id}>
            <Link href={l.href} className="chip text-xs hover:bg-panel-2" data-testid={`lesson-link-${id}`}>
              <span className="text-faint">{l.kind}</span>
              <span className="text-ink">{l.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function GenreIntro({ genre }: { genre: Genre }) {
  return (
    <header
      className="rounded-2xl border border-line bg-panel/50 p-5"
      style={{ borderTop: `4px solid ${genre.colour}` }}
      data-testid="backing-genre-intro"
    >
      <h2 className="display text-[1.8rem] leading-tight md:text-[2.2rem]" style={{ color: genre.colour }}>{genre.name}</h2>
      <p className="mt-2 max-w-3xl text-[1.05rem] leading-relaxed">{genre.blurb}</p>
      <div className="mt-4 grid gap-4 min-[760px]:grid-cols-2">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-faint">On guitar, try</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
            {genre.play.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-faint">Lessons for {genre.name.toLowerCase()}</p>
          <LessonChips ids={genre.lessons} testId="backing-genre-lessons" />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------ tempo arrows */

/**
 * ▼ value ▲: steps the tempo to the previous / next standard metronome marking
 * (…96, 100, 104, 108, 112, 116, 120, 126, 132…), within half to 1.5× the loop's own tempo.
 */
export function TempoArrows({
  track, bpm, onChange, size = "sm", testId,
}: {
  track: BackingTrack;
  bpm: number;
  onChange: (bpm: number) => void;
  size?: "sm" | "md";
  testId: string;
}) {
  const range = tempoRange(track);
  const down = tempoStep(bpm, -1, range);
  const up = tempoStep(bpm, 1, range);
  const changed = bpm !== track.bpm;
  const btn = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[0.7rem]";
  return (
    <span className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`Tempo for ${track.name}`}>
      <button
        type="button"
        className={`grid ${btn} place-items-center rounded-full bg-panel-2 text-ink ring-1 ring-line hover:bg-line disabled:opacity-35`}
        aria-label={`Slower: ${down} BPM`}
        title={`Slower: ${down} BPM`}
        disabled={bpm <= range.min}
        data-testid={`${testId}-down`}
        onClick={() => onChange(down)}
      >
        ▼
      </button>
      <span
        className={`min-w-[2.6rem] text-center font-mono ${size === "md" ? "text-base" : "text-xs"} ${changed ? "text-next" : "text-ink"}`}
        title={changed ? `Original tempo ${track.bpm} BPM` : undefined}
        aria-live="polite"
        data-testid={`${testId}-value`}
      >
        {bpm}
      </span>
      <button
        type="button"
        className={`grid ${btn} place-items-center rounded-full bg-panel-2 text-ink ring-1 ring-line hover:bg-line disabled:opacity-35`}
        aria-label={`Faster: ${up} BPM`}
        title={`Faster: ${up} BPM`}
        disabled={bpm >= range.max}
        data-testid={`${testId}-up`}
        onClick={() => onChange(up)}
      >
        ▲
      </button>
    </span>
  );
}

/* ------------------------------------------------------------ track list */

const BANDS: { id: TempoBand | "all"; label: string }[] = [
  { id: "all", label: "All tempos" },
  { id: "slow", label: "Slow (<85)" },
  { id: "medium", label: "Medium" },
  { id: "fast", label: "Fast (>130)" },
];

export function TrackList({
  genre, tracks, selectedId, band, onBand, onSelect, onToggle, audio, bpmFor, onBpm,
}: {
  genre: Genre;
  tracks: BackingTrack[];
  selectedId: string;
  band: TempoBand | "all";
  onBand: (b: TempoBand | "all") => void;
  onSelect: (t: BackingTrack) => void;
  onToggle: (t: BackingTrack) => void;
  audio: BackingAudio;
  /** This loop's current tempo (its own, or what the user set). */
  bpmFor: (t: BackingTrack) => number;
  onBpm: (t: BackingTrack, bpm: number) => void;
}) {
  const shown = band === "all" ? tracks : tracks.filter((t) => tempoBand(t.bpm) === band);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tempo">
        {BANDS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={band === b.id}
            data-testid={`backing-band-${b.id}`}
            onClick={() => onBand(b.id)}
            className={`chip text-xs ${band === b.id ? "bg-maple text-tolex" : "text-muted hover:bg-panel-2"}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <ol className="surface divide-y divide-line px-1.5" aria-label={`${genre.name} loops`} data-testid="backing-tracks">
        {shown.map((t) => {
          const sel = t.id === selectedId;
          const playing = audio.playingId === t.id;
          return (
            <li key={t.id} className={`flex items-center gap-2 rounded-xl px-1.5 ${sel ? "bg-panel-2" : ""}`}>
              <button
                type="button"
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${playing ? "bg-maple text-tolex" : "bg-panel-2 text-ink hover:bg-line"}`}
                aria-label={`${playing ? "Stop" : "Play"} ${t.name}`}
                aria-pressed={playing}
                data-testid={`backing-play-${t.id}`}
                onClick={() => onToggle(t)}
              >
                {playing ? <IconStop width={16} height={16} /> : <IconPlay width={16} height={16} />}
              </button>
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 text-left"
                aria-current={sel ? "true" : undefined}
                data-testid={`backing-track-${t.id}`}
                onClick={() => onSelect(t)}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.7rem] text-faint">{String(t.n).padStart(2, "0")}</span>
                  <span className="truncate text-sm font-bold">{t.name}</span>
                </span>
                <span className="truncate text-xs text-muted">
                  {keyName(t)} · {FEEL_LABEL[t.drums.feel]}
                  {meterOf(t) === "3/4" ? " · 3/4" : ""} · {t.bars.length} bars
                  {bpmFor(t) !== t.bpm ? <span className="text-faint"> · orig. {t.bpm}</span> : null}
                </span>
              </button>
              <span className="flex shrink-0 flex-col items-center">
                <TempoArrows track={t} bpm={bpmFor(t)} onChange={(v) => onBpm(t, v)} testId={`backing-row-bpm-${t.id}`} />
                <span className="text-[0.6rem] uppercase tracking-wide text-faint">BPM</span>
              </span>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-4 text-sm text-muted">No {genre.name.toLowerCase()} loops at this tempo.</li>}
      </ol>
    </div>
  );
}

/* --------------------------------------------------------------- drum grid */

/** Drum rows + the bass line of one bar. Columns light as `st_<k>` plays. */
export function DrumGrid({ track, bar, colour }: { track: BackingTrack; bar: number; colour: string }) {
  const d = track.drums;
  const hits = useMemo(() => drumBar(track, bar, 1), [track, bar]);
  const bassHits = useMemo(() => bassBar(track, bar), [track, bar]);
  const voices = DRUM_VOICES.filter((v) => hits.some((h) => h.voice === v));
  const spb = d.steps / d.beats;
  const cols = Array.from({ length: d.steps }, (_, k) => k);
  const cellBg = (vel: number) => `color-mix(in srgb, ${colour} ${Math.round(30 + 70 * vel)}%, var(--color-panel-2))`;
  const counts = d.triplet ? ["", "trip", "let"] : spb === 4 ? ["", "e", "+", "a"] : ["", "+"];

  return (
    <div className="bk-grid min-w-0 overflow-x-auto" data-testid="backing-grid" aria-label="Drum and bass pattern for this bar">
      <table className="w-full min-w-[300px] table-fixed border-separate border-spacing-0 text-[0.65rem]">
        <thead>
          <tr>
            <th className="w-14 pr-1 text-left font-normal text-faint" scope="col">Count</th>
            {cols.map((k) => (
              <th key={k} scope="col" data-hl={`st_${k}`} className={`bk-step h-4 font-mono font-normal ${k % spb === 0 ? "text-ink" : "text-faint"}`}>
                {k % spb === 0 ? k / spb + 1 : counts[k % spb] === "+" ? "+" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {voices.map((v) => (
            <tr key={v}>
              <th scope="row" className="pr-1 text-left font-normal text-muted">{DRUM_LABEL[v]}</th>
              {cols.map((k) => {
                const h = hits.find((x) => x.voice === v && x.step === k);
                return (
                  <td key={k} className={`bk-cell ${k % spb === 0 ? "bk-beat" : ""}`}>
                    <span
                      data-hl={`st_${k}`}
                      className="bk-step block h-3.5 rounded-[3px]"
                      style={{ background: h ? cellBg(h.vel) : undefined }}
                      title={h ? `${DRUM_LABEL[v]} on ${k / spb + 1 | 0}` : undefined}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th scope="row" className="pr-1 text-left font-normal text-muted">Bass</th>
            {cols.map((k) => {
              const n = bassHits.find((x) => x.step === k);
              return (
                <td key={k} className={`bk-cell ${k % spb === 0 ? "bk-beat" : ""}`}>
                  <span
                    data-hl={`st_${k}`}
                    className="bk-step block h-5 overflow-visible whitespace-nowrap rounded-[3px] text-center font-mono font-bold leading-5"
                    style={n ? { background: "var(--color-maple)", color: "var(--color-tolex)", opacity: 0.45 + 0.55 * n.vel } : undefined}
                  >
                    {n ? pitchClassName(n.midi) : ""}
                  </span>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------- the player */

export function LoopPlayer({
  track, genre, audio, settings, onSettings, onOpenMap, scopeRef,
}: {
  track: BackingTrack;
  genre: Genre;
  audio: BackingAudio;
  settings: LoopSettings;
  onSettings: (s: Partial<LoopSettings>) => void;
  onOpenMap: () => void;
  scopeRef: RefObject<HTMLDivElement | null>;
}) {
  const playing = audio.playingId === track.id;
  const len = track.bars.length;
  const bar = playing && audio.bar != null ? audio.bar : 0;
  const chordNow = track.bars[bar]!;
  const chordNext = track.bars[(bar + 1) % len]!;
  const { min: minBpm, max: maxBpm } = tempoRange(track);
  const lessons = useMemo(() => trackLessons(track), [track]);

  return (
    <div ref={scopeRef} className="surface space-y-4 p-4 md:p-5" data-testid="backing-player" data-track={track.id}>
      <div>
        <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: genre.colour }}>
          {genre.name} · loop {track.n} of 20
        </p>
        <h2 className="display text-[1.6rem] leading-tight" data-testid="backing-player-title">{track.name}</h2>
        <p className="text-sm text-muted">
          {keyName(track)} · {FEEL_LABEL[track.drums.feel]}{track.drums.name !== FEEL_LABEL[track.drums.feel] ? ` (${track.drums.name.toLowerCase()})` : ""} · {meterOf(track)} · bass: {track.bass.name.toLowerCase()}
        </p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-faint">
            {playing ? (audio.countingIn ? "Count-in" : "Now") : "Starts on"}
          </p>
          <p className="display truncate text-[2.6rem] leading-none" data-testid="backing-chord" aria-live="off">{chordNow}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs uppercase tracking-wide text-faint">Next</p>
          <p className="truncate text-2xl font-bold text-muted" data-testid="backing-next">{chordNext}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="Beat">
        {Array.from({ length: track.drums.beats }, (_, b) => (
          <span key={b} data-hl={`beat_${b}`} className="theory-cell h-4 w-4 rounded-full bg-panel-2" />
        ))}
        <span className="ml-2 font-mono text-xs text-muted" data-testid="backing-bar-label">
          {playing && !audio.countingIn && audio.bar != null
            ? `Bar ${bar + 1} of ${len}${audio.cycle > 0 ? ` · repeat ${audio.cycle}` : ""}`
            : `${len} bars, loops until you stop`}
        </span>
      </div>

      <ol className="flex flex-wrap gap-1.5" aria-label="Progression" data-testid="backing-progression">
        {track.bars.map((b, i) => (
          <li key={i} data-hl={`b_${i}`} className="song-prog-chord chip font-mono text-xs">
            {b.replace(" ", " · ")}
          </li>
        ))}
      </ol>

      <DrumGrid track={track} bar={bar} colour={genre.colour} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          aria-pressed={playing}
          data-testid="backing-toggle"
          onClick={() => (playing ? audio.stop() : audio.start(track, settings))}
        >
          {playing ? <IconStop width={18} height={18} /> : <IconPlay width={18} height={18} />}
          {playing ? "Stop" : "Play loop"}
        </button>
        <label className="flex min-w-[13rem] flex-1 items-center gap-2 text-sm text-muted">
          Tempo
          <input
            type="range"
            min={minBpm}
            max={maxBpm}
            step={1}
            value={settings.bpm}
            data-testid="backing-bpm"
            aria-label="Tempo in beats per minute"
            className="min-w-0 flex-1"
            onChange={(e) => onSettings({ bpm: Number(e.target.value) })}
          />
        </label>
        <TempoArrows track={track} bpm={settings.bpm} onChange={(v) => onSettings({ bpm: v })} size="md" testId="backing-bpm" />
        <span className="-ml-2 text-xs text-muted">BPM</span>
        {settings.bpm !== track.bpm && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => onSettings({ bpm: track.bpm })} data-testid="backing-bpm-reset">
            Reset to {track.bpm}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Parts">
        {([
          ["drums", "Drums"],
          ["bass", "Bass"],
          ["countIn", "Count-in"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={settings[k]}
            data-testid={`backing-part-${k}`}
            className={`chip text-xs ${settings[k] ? "bg-maple text-tolex" : "text-muted hover:bg-panel-2"}`}
            onClick={() => onSettings({ [k]: !settings[k] })}
          >
            {label} {settings[k] ? "on" : "off"}
          </button>
        ))}
        <button type="button" className="btn btn-ghost btn-sm ml-auto" data-testid="backing-show-map" onClick={onOpenMap}>
          Show {track.root} {scaleLabel(track.mode)} on fretboard
        </button>
      </div>
      {playing && <p className="text-xs text-faint">Tempo and part changes apply from the next bar.</p>}

      <div className="space-y-2 border-t border-line pt-4">
        <p className="text-sm">
          <span className="text-faint">Solo with </span>
          <strong>{track.root} {scaleLabel(track.mode)}</strong>
          <span className="text-faint"> over </span>
          <span className="font-mono">{progressionText(track)}</span>
        </p>
        <p className="text-xs uppercase tracking-wide text-faint">Lessons for this loop</p>
        <LessonChips ids={lessons} testId="backing-track-lessons" />
        <p className="text-xs text-faint">Chords in this loop: {chordsOf(track).join(", ")}</p>
      </div>
    </div>
  );
}
