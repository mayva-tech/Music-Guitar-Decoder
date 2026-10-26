"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { Glossary } from "@/components/theory/Glossary";
import { Principles } from "@/components/theory/Principles";
import { Recipe } from "@/components/theory/Recipe";
import { TermPanel } from "@/components/theory/TermPanel";
import { TheoryMap } from "@/components/theory/TheoryMap";
import { TourPlayer } from "@/components/theory/TourPlayer";
import { clearHighlights, setHighlight } from "@/components/theory/highlight";
import { ALL_TERMS, MINI_SONG, type TheoryVisual } from "@/lib/theory/content";
import { getTheoryPlayer } from "@/lib/theory/player";
import { useApp } from "@/lib/store";
import { cancelEnglishSpeech, speakEnglish } from "@/lib/tts/speakEnglish";

function termSpeakText(id: string): string {
  const term = ALL_TERMS[id];
  if (!term) return "";
  if (term.narration.trim()) return term.narration.trim();
  return [term.name, term.short, term.body, term.guitar ? `On guitar. ${term.guitar}` : ""]
    .filter(Boolean)
    .join(" ");
}

function TheoryMapPageInner() {
  const searchParams = useSearchParams();
  const termFromUrl = searchParams.get("term");
  const autoRead = useApp((s) => s.prefs.autoReadAloud);
  const setPrefs = useApp((s) => s.setPrefs);
  const [selectedId, setSelectedId] = useState<string | null>(
    termFromUrl && ALL_TERMS[termFromUrl] ? termFromUrl : "chord",
  );
  const [tourIndex, setTourIndex] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(false);
  const [playingLabel, setPlayingLabel] = useState<string | null>(null);
  const [activeVisual, setActiveVisual] = useState<TheoryVisual | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (termFromUrl && ALL_TERMS[termFromUrl]) {
      setSelectedId(termFromUrl);
      setActiveVisual(
        ALL_TERMS[termFromUrl]?.figure ?? ALL_TERMS[termFromUrl]?.examples[0]?.visual ?? null,
      );
      queueMicrotask(() => {
        document.getElementById("theory-map-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }, [termFromUrl]);

  useEffect(() => () => {
    cancelEnglishSpeech();
    getTheoryPlayer().stop();
    clearHighlights(pageRef.current);
  }, []);

  const pauseTour = () => setTourPlaying(false);

  const selectTerm = (id: string | null) => {
    pauseTour();
    getTheoryPlayer().stop();
    cancelEnglishSpeech();
    setPlayingLabel(null);
    setSelectedId(id);
    setActiveVisual(id ? ALL_TERMS[id]?.figure ?? ALL_TERMS[id]?.examples[0]?.visual ?? null : null);
    if (id) {
      document.getElementById("theory-map-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (autoRead) {
        const text = termSpeakText(id);
        if (text) void speakEnglish(text).catch(() => undefined);
      }
    }
  };

  const playExample = async (termId: string, exampleIndex: number) => {
    const key = `${termId}:${exampleIndex}`;
    if (playingLabel === key) {
      getTheoryPlayer().stop();
      setPlayingLabel(null);
      return;
    }
    pauseTour();
    cancelEnglishSpeech();
    const term = ALL_TERMS[termId];
    const ex = term?.examples[exampleIndex];
    if (!ex) return;
    setSelectedId(termId);
    setActiveVisual(ex.visual);
    setPlayingLabel(key);
    const root = pageRef.current;
    await getTheoryPlayer().play(ex, (id, on) => setHighlight(root, id, on));
    setPlayingLabel((cur) => (cur === key ? null : cur));
  };

  const toggleMini = async () => {
    if (playingLabel === "mini") {
      getTheoryPlayer().stop();
      setPlayingLabel(null);
      return;
    }
    pauseTour();
    cancelEnglishSpeech();
    setPlayingLabel("mini");
    setActiveVisual(MINI_SONG.visual);
    const root = pageRef.current;
    await getTheoryPlayer().play(MINI_SONG, (id, on) => setHighlight(root, id, on));
    setPlayingLabel((cur) => (cur === "mini" ? null : cur));
  };

  return (
    <div ref={pageRef} className="theory-page space-y-8" data-testid="theory-page">
      <PageTitle
        title="Theory map"
        lead="Every music term on one page — hear it, see it light up, and see how the terms connect."
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm ${autoRead ? "btn-primary" : "btn-quiet"}`}
            aria-pressed={autoRead}
            onClick={() => setPrefs({ autoReadAloud: !autoRead })}
            data-testid="theory-auto-read"
          >
            Auto read {autoRead ? "On" : "Off"}
          </button>
          <Link href="/learn/by-ear" className="btn btn-primary btn-sm" data-testid="theory-next-ear">
            Next: play by ear
          </Link>
          <Link href="/learn/solo" className="btn btn-quiet btn-sm" data-testid="theory-solo-link">Lead solos</Link>
          <Link href="/learn" className="btn btn-quiet btn-sm">Back to Guitar learning</Link>
        </div>
      </PageTitle>

      <TourPlayer
        tourIndex={tourIndex}
        tourPlaying={tourPlaying}
        onIndex={setTourIndex}
        onPlaying={setTourPlaying}
        onSelectTerm={(id) => {
          setSelectedId(id);
          if (id) setActiveVisual(ALL_TERMS[id]?.figure ?? ALL_TERMS[id]?.examples[0]?.visual ?? null);
        }}
        stageRef={stageRef}
      />

      <div id="theory-map-panel" className="grid gap-4 theory-map-layout">
        <TheoryMap selectedId={selectedId} onSelect={selectTerm} />
        <TermPanel
          selectedId={selectedId}
          playingLabel={playingLabel}
          activeVisual={activeVisual}
          onSelectRelated={selectTerm}
          onPlayExample={playExample}
        />
      </div>

      <Principles
        playingLabel={playingLabel}
        onPlayExample={playExample}
        onJumpTerm={selectTerm}
      />

      <Recipe playingMini={playingLabel === "mini"} onToggleMini={() => void toggleMini()} />

      <Glossary onSelect={selectTerm} />
    </div>
  );
}

export default function TheoryMapPage() {
  return (
    <Suspense fallback={<div className="theory-page p-4 text-sm text-muted">Loading Theory map…</div>}>
      <TheoryMapPageInner />
    </Suspense>
  );
}
