"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { ScaleFretmapFloat } from "@/components/ScaleFretmapFloat";
import { GenreIntro, GenrePicker, LoopPlayer, TrackList } from "@/components/backing/BackingParts";
import { useBackingAudio, type LoopSettings } from "@/components/backing/useBackingAudio";
import {
  GENRES, GENRES_BY_ID, TRACKS_BY_ID, chordsOf, tracksFor,
  type BackingTrack, type GenreId, type TempoBand,
} from "@/lib/music/backingTracks";
import { BOX_MODES } from "@/lib/music/soloGuide";

const DEFAULT_SETTINGS = (t: BackingTrack): LoopSettings => ({ bpm: t.bpm, drums: true, bass: true, countIn: true });

export default function BackingTracksPage() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const audio = useBackingAudio(scopeRef);
  const [genreId, setGenreId] = useState<GenreId>("rock");
  const [trackId, setTrackId] = useState<string>(tracksFor("rock")[0]!.id);
  const [band, setBand] = useState<TempoBand | "all">("all");
  const [settings, setSettings] = useState<LoopSettings>(() => DEFAULT_SETTINGS(tracksFor("rock")[0]!));
  const [mapOpen, setMapOpen] = useState(false);

  const genre = GENRES_BY_ID[genreId];
  const tracks = useMemo(() => tracksFor(genreId), [genreId]);
  const track = TRACKS_BY_ID[trackId] ?? tracks[0]!;

  // Deep links: /learn/backing#blues or /learn/backing#blues-03
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (TRACKS_BY_ID[h]) {
        const t = TRACKS_BY_ID[h]!;
        setGenreId(t.genre);
        setTrackId(t.id);
        setSettings(DEFAULT_SETTINGS(t));
      } else if (GENRES_BY_ID[h as GenreId]) {
        const g = h as GenreId;
        setGenreId(g);
        setTrackId(tracksFor(g)[0]!.id);
        setSettings(DEFAULT_SETTINGS(tracksFor(g)[0]!));
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const setHash = (h: string) => {
    try { window.history.replaceState(null, "", `#${h}`); } catch { /* ignore */ }
  };

  const chooseGenre = (g: GenreId) => {
    if (g === genreId) return;
    audio.stop();
    const first = tracksFor(g)[0]!;
    setGenreId(g);
    setTrackId(first.id);
    setSettings(DEFAULT_SETTINGS(first));
    setBand("all");
    setHash(g);
  };

  const select = useCallback((t: BackingTrack, play = false) => {
    const fresh = DEFAULT_SETTINGS(t);
    const next = { ...fresh, drums: settings.drums, bass: settings.bass, countIn: settings.countIn };
    setTrackId(t.id);
    setSettings(next);
    setHash(t.id);
    if (play) audio.start(t, next);
    else if (audio.playingId && audio.playingId !== t.id) audio.stop();
    if (window.matchMedia?.("(max-width: 899px)").matches) {
      requestAnimationFrame(() => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [audio, settings.drums, settings.bass, settings.countIn]);

  const toggle = (t: BackingTrack) => {
    if (audio.playingId === t.id) audio.stop();
    else select(t, true);
  };

  const changeSettings = (s: Partial<LoopSettings>) => {
    setSettings((cur) => ({ ...cur, ...s }));
    audio.update(s);
  };

  const followChord = audio.playingId === track.id && audio.bar != null ? track.bars[audio.bar]!.split(" ")[0]! : null;
  const total = GENRES.length * 20;

  return (
    <div className="theory-page mx-auto max-w-6xl space-y-8" data-testid="backing-page">
      <PageTitle
        title="Backing tracks"
        lead={`Drum and bass loops to play guitar over: ${GENRES.length} genres, 20 loops each (${total} in all), from slow grooves to fast ones. Every loop shows its chords, its scale and the lessons that go with it.`}
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/learn/solo" className="btn btn-quiet btn-sm">Lead solos</Link>
          <Link href="/riffs" className="btn btn-quiet btn-sm">Riff practice</Link>
        </div>
      </PageTitle>

      <GenrePicker value={genreId} onChange={chooseGenre} />

      <GenreIntro genre={genre} />

      <div className="grid gap-5 min-[900px]:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <TrackList
          genre={genre}
          tracks={tracks}
          selectedId={track.id}
          band={band}
          onBand={setBand}
          onSelect={(t) => select(t)}
          onToggle={toggle}
          audio={audio}
        />
        <div ref={playerRef} className="bk-sticky scroll-mt-4 min-[900px]:self-start">
          <LoopPlayer
            track={track}
            genre={genre}
            audio={audio}
            settings={settings}
            onSettings={changeSettings}
            onOpenMap={() => setMapOpen(true)}
            scopeRef={scopeRef}
          />
        </div>
      </div>

      <p className="flex flex-wrap gap-2 pb-4">
        <Link href="/learn/theory?term=groove" className="btn btn-quiet btn-sm">Theory map: groove</Link>
        <Link href="/learn/by-ear" className="btn btn-quiet btn-sm">Play by ear</Link>
        <Link href="/learn" className="btn btn-quiet btn-sm">Back to Guitar learning</Link>
      </p>

      <ScaleFretmapFloat
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialRoot={track.root}
        initialMode={track.mode}
        initialBox={BOX_MODES.includes(track.mode) ? 1 : 0}
        chordList={chordsOf(track)}
        followChord={followChord}
      />
    </div>
  );
}
