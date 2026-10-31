"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionHead, type ShowMap } from "./shared";
import type { SoloAudio } from "./useSoloAudio";
import { JAM_IDEAS, JAM_TRACKS, CHORD_TONES } from "@/lib/music/soloGuide";

export function JamPanel({ audio, onShowMap }: { audio: SoloAudio; onShowMap: ShowMap }) {
  const [trackId, setTrackId] = useState(JAM_TRACKS[0]!.id);
  const [bpmByTrack, setBpmByTrack] = useState<Record<string, number>>(() =>
    Object.fromEntries(JAM_TRACKS.map((t) => [t.id, t.bpm])),
  );
  const track = JAM_TRACKS.find((t) => t.id === trackId) ?? JAM_TRACKS[0]!;
  const bpm = bpmByTrack[track.id] ?? track.bpm;
  const jamming = audio.playingKey === `jam:${track.id}`;
  const bar = jamming ? audio.jamBar ?? 0 : null;
  const current = bar != null ? track.bars[bar % track.bars.length] : track.bars[0]!;
  const next = bar != null ? track.bars[(bar + 1) % track.bars.length] : track.bars[1] ?? track.bars[0]!;
  const chords = [...new Set(track.bars)].filter((c) => CHORD_TONES[c]);

  const choose = (id: string) => {
    setTrackId(id);
    const t = JAM_TRACKS.find((x) => x.id === id)!;
    // Switching track while jamming restarts on the new one.
    if (audio.playingKey?.startsWith("jam:")) audio.startJam(t, bpmByTrack[id] ?? t.bpm);
  };

  return (
    <section id="jam" aria-labelledby="solo-jam-heading" className="scroll-mt-4 space-y-4" data-testid="solo-jam">
      <SectionHead id="solo-jam-heading" eyebrow="Jam" title="Play over a backing track">
        Four loops that run until you stop them. Open the map, ring the current chord, and improvise.{" "}
        <Link href="/learn/backing" className="underline decoration-line underline-offset-2 hover:text-ink" data-testid="jam-more-backing">
          200 more drum and bass loops in ten genres
        </Link>
        .
      </SectionHead>
      <div className="grid gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div role="radiogroup" aria-label="Backing track" className="surface divide-y divide-line px-2">
          {JAM_TRACKS.map((t) => {
            const sel = t.id === track.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={sel}
                data-testid={`jam-track-${t.id}`}
                onClick={() => choose(t.id)}
                className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-3 text-left ${sel ? "bg-panel-2" : "hover:bg-panel-2/50"}`}
              >
                <span className="text-sm font-bold">{t.name}</span>
                <span className="text-xs text-muted">{t.description} · {t.bpm} BPM</span>
              </button>
            );
          })}
        </div>

        <div className="surface space-y-4 p-4 md:p-5" data-hl-scope={`jam:${track.id}`}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-faint">{jamming ? "Now" : "Starts on"}</p>
              <p className="display text-[3rem] leading-none" data-testid="jam-chord" aria-live="off">{current}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-faint">Next</p>
              <p className="text-2xl font-bold text-muted" data-testid="jam-next">{next}</p>
            </div>
          </div>
          <div className="flex items-center gap-2" aria-label="Beat">
            {[0, 1, 2, 3].map((b) => (
              <span
                key={b}
                data-hl={`beat_${b}`}
                className="theory-cell h-4 w-4 rounded-full bg-panel-2"
              />
            ))}
            <span className="ml-2 text-xs text-muted" data-testid="jam-bar-label">
              {jamming && bar != null ? `Bar ${(bar % track.bars.length) + 1} of ${track.bars.length}` : `${track.bars.length} bars`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              aria-pressed={jamming}
              data-testid="jam-toggle"
              onClick={() => (jamming ? audio.stop() : audio.startJam(track, bpm))}
            >
              <span aria-hidden>{jamming ? "■" : "▶"}</span> {jamming ? "Stop" : "Start"}
            </button>
            <label className="flex min-w-[12rem] flex-1 items-center gap-2 text-sm text-muted">
              Tempo
              <input
                type="range"
                min={60}
                max={140}
                step={1}
                value={bpm}
                data-testid="jam-bpm"
                aria-label="Tempo in beats per minute"
                className="min-w-0 flex-1"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBpmByTrack((m) => ({ ...m, [track.id]: v }));
                  if (jamming) audio.setJamBpm(v);
                }}
              />
              <span className="w-16 text-right font-mono text-ink">{bpm} BPM</span>
            </label>
          </div>
          {jamming && <p className="text-xs text-faint">Tempo changes apply from the next loop.</p>}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            data-testid="jam-show-map"
            onClick={() => onShowMap({ root: track.root, mode: track.mode, box: track.box, chordList: chords })}
          >
            Show scale on fretboard
          </button>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-faint">Ideas to try</p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
              {JAM_IDEAS.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
