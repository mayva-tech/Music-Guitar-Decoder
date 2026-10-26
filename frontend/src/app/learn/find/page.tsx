"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { ChordDiagram } from "@/components/ChordDiagram";
import { ScaleFretmapNeck } from "@/components/ScaleFretmapNeck";
import { playChordStrum, stopChordStrum } from "@/lib/audio/strumChord";
import { FINGER_NAMES, midiAt, stringWords } from "@/lib/music/guitar";
import {
  buildChordToneFretmap,
  findSearch,
  type ParsedChord,
} from "@/lib/music/findSearch";
import { getTheoryPlayer } from "@/lib/theory/player";
import { noteMarkerColors } from "@/lib/music/scaleFretmap";

const SUGGESTIONS = ["Bdim", "Am", "G", "C", "Em", "D5", "chord", "scale", "tempo", "F#"];

export default function FindPage() {
  const [query, setQuery] = useState("Bdim");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => findSearch(deferred), [deferred]);
  const [voicingIdx, setVoicingIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const voicings = results.voicings;
  const voicing = voicings.length
    ? voicings[((voicingIdx % voicings.length) + voicings.length) % voicings.length]!
    : null;
  const chord = results.chord;

  useEffect(() => {
    setVoicingIdx(0);
  }, [chord?.symbol, chord?.rootName, chord?.quality]);

  useEffect(() => () => {
    stopChordStrum();
  }, []);

  const cells = useMemo(() => {
    if (!chord) return [];
    return buildChordToneFretmap(chord.rootName, chord.quality);
  }, [chord]);

  const playChord = async () => {
    if (!voicing) return;
    if (playing) {
      stopChordStrum();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    try {
      await playChordStrum(voicing.shape);
    } finally {
      setPlaying(false);
    }
  };

  const playNote = async (midi: number, string?: number) => {
    stopChordStrum();
    setPlaying(true);
    try {
      await getTheoryPlayer().play(
        {
          bpm: 100,
          lengthBeats: 2.5,
          events: [{ kind: "pluck", midi, beat: 0, beats: 2.2, velocity: 0.9, timbre: "normal" }],
        },
        () => undefined,
      );
    } finally {
      setPlaying(false);
    }
    void string;
  };

  return (
    <div className="theory-page mx-auto max-w-5xl space-y-6" data-testid="find-page">
      <PageTitle
        title="Find"
        lead="Type a chord, note, or theory topic. Chords show finger placement on the fretboard — press Play to hear the strum."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/learn/theory" className="btn btn-quiet btn-sm">Theory map</Link>
          <Link href="/learn/by-ear" className="btn btn-quiet btn-sm">Play by ear</Link>
        </div>
      </PageTitle>

      <div className="rounded-2xl border border-line bg-panel/60 p-4">
        <label htmlFor="find-query" className="text-[0.65rem] uppercase tracking-wide text-muted">
          Search
        </label>
        <input
          id="find-query"
          type="search"
          className="field mt-1.5 w-full text-lg"
          placeholder="e.g. Bdim, Am, G5, F#, chord, tempo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          data-testid="find-input"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="chip text-xs hover:bg-panel-2"
              onClick={() => setQuery(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {chord && voicing ? (
        <ChordResult
          chord={chord}
          voicingLabel={voicing.label}
          voicingIdx={voicingIdx}
          voicingCount={voicings.length}
          shape={voicing.shape}
          cells={cells}
          playing={playing}
          onPrev={() => setVoicingIdx((i) => i - 1)}
          onNext={() => setVoicingIdx((i) => i + 1)}
          onPlay={() => void playChord()}
        />
      ) : null}

      {results.note && !chord ? (
        <NoteResult note={results.note} playing={playing} onPlay={(m, s) => void playNote(m, s)} />
      ) : null}

      {results.note && chord && chord.quality === "maj" && /^[A-Ga-g](?:#|b)?$/i.test(deferred.trim()) ? (
        <NoteResult note={results.note} playing={playing} onPlay={(m, s) => void playNote(m, s)} compact />
      ) : null}

      <section className="space-y-2" aria-labelledby="find-topics-heading">
        <h2 id="find-topics-heading" className="display text-xl">
          {deferred.trim() ? "Matching topics" : "Theory topics"}
        </h2>
        {results.topics.length === 0 ? (
          <p className="text-sm text-muted">No topics match that search.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {results.topics.map(({ id, term }) => (
              <li key={id}>
                <Link
                  href={`/learn/theory?term=${encodeURIComponent(id)}`}
                  className="block rounded-xl border border-line bg-panel-2/50 px-3 py-3 no-underline transition hover:bg-panel-2"
                  data-testid={`find-topic-${id}`}
                >
                  <span className="text-[0.65rem] uppercase tracking-wide" style={{ color: `var(--lane-${term.lane})` }}>
                    {term.lane}
                  </span>
                  <span className="mt-0.5 block font-bold text-ink">{term.name}</span>
                  <span className="mt-1 block text-sm text-muted">{term.short}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ChordResult({
  chord,
  voicingLabel,
  voicingIdx,
  voicingCount,
  shape,
  cells,
  playing,
  onPrev,
  onNext,
  onPlay,
}: {
  chord: ParsedChord;
  voicingLabel: string;
  voicingIdx: number;
  voicingCount: number;
  shape: import("@/lib/music/chordShapes").ChordShape;
  cells: import("@/lib/music/scaleFretmap").FretmapCell[];
  playing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
}) {
  const { fill, ink } = noteMarkerColors(chord.rootName);
  const placement = shape.frets.map((fret, i) => {
    const string = 6 - i;
    const finger = shape.fingers[i];
    if (fret == null) return { string, text: `${stringWords(string)} — muted (×)` };
    if (fret === 0) return { string, text: `${stringWords(string)} — open (O)` };
    const fingerName = finger != null && finger > 0 ? FINGER_NAMES[finger] : "a finger";
    return {
      string,
      text: `${stringWords(string)}, fret ${fret} — ${fingerName}`,
      midi: midiAt(string, fret),
    };
  });

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-panel/50 p-4" data-testid="find-chord-result">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="rounded-full px-3 py-1 text-lg font-bold"
          style={{ background: fill, color: ink }}
          data-testid="find-chord-symbol"
        >
          {chord.symbol}
        </span>
        <span className="text-sm text-muted">
          {chord.rootName} · {chord.quality === "maj" ? "major" : chord.quality === "min" ? "minor" : chord.quality === "dim" ? "diminished" : chord.quality === "aug" ? "augmented" : "power"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-quiet btn-sm" disabled={voicingCount <= 1} onClick={onPrev} aria-label="Previous voicing">
            ◀
          </button>
          <span className="font-mono text-xs text-muted" data-testid="find-voicing-label">
            {voicingLabel} · {((voicingIdx % voicingCount) + voicingCount) % voicingCount + 1}/{voicingCount}
          </span>
          <button type="button" className="btn btn-quiet btn-sm" disabled={voicingCount <= 1} onClick={onNext} aria-label="Next voicing">
            ▶
          </button>
          <button
            type="button"
            className={`btn btn-sm ${playing ? "btn-primary" : "btn-primary"}`}
            onClick={onPlay}
            data-testid="find-chord-play"
            aria-pressed={playing}
          >
            {playing ? "Stop" : "Play"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
        <ChordDiagram name={chord.symbol} diagram={shape} size={1.15} />
        <div>
          <p className="mb-2 text-[0.65rem] uppercase tracking-wide text-muted">Finger placement</p>
          <ol className="space-y-1.5 text-sm">
            {placement.map((p) => (
              <li key={p.string} className="text-ink">
                {p.text}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-panel p-2" data-scroll>
        <p className="mb-2 px-1 text-[0.65rem] uppercase tracking-wide text-muted">
          Fretboard map — coloured dots are chord tones; numbered dots are this voicing
        </p>
        <ScaleFretmapNeck cells={cells} chordShape={shape} />
      </div>
    </section>
  );
}

function NoteResult({
  note,
  playing,
  onPlay,
  compact,
}: {
  note: import("@/lib/music/findSearch").NoteHit;
  playing: boolean;
  onPlay: (midi: number, string?: number) => void;
  compact?: boolean;
}) {
  const { fill, ink } = noteMarkerColors(note.name);
  return (
    <section className="rounded-2xl border border-line bg-panel/50 p-4" data-testid="find-note-result">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full px-3 py-1 text-lg font-bold" style={{ background: fill, color: ink }}>
          {note.name}
        </span>
        <span className="text-sm text-muted">{compact ? "Also a note" : "Note on the fretboard"}</span>
        <button
          type="button"
          className="btn btn-primary btn-sm ml-auto"
          disabled={playing}
          onClick={() => onPlay(note.midis[0] ?? 60)}
          data-testid="find-note-play"
        >
          Play note
        </button>
      </div>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        {note.positions.slice(0, 8).map((p) => (
          <li key={`${p.string}-${p.fret}`}>
            <button
              type="button"
              className="btn btn-quiet btn-sm w-full justify-start text-left"
              onClick={() => onPlay(midiAt(p.string, p.fret), p.string)}
            >
              {stringWords(p.string)}, {p.fret === 0 ? "open" : `fret ${p.fret}`}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
