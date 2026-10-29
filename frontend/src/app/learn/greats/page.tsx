"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { EarFretNeck } from "@/components/ear/EarFretNeck";
import { LickPicker } from "@/components/greats/LickPicker";
import { IconPlay, IconStop } from "@/components/Icons";
import { ScaleFretmapFloat } from "@/components/ScaleFretmapFloat";
import { LickTab } from "@/components/solo/LickTab";
import { LickNeck, chordListFor, mapRequestForLick, type MapRequest } from "@/components/solo/shared";
import { useSoloAudio } from "@/components/solo/useSoloAudio";
import { shapeToStrumSound } from "@/lib/audio/strumChord";
import { GREATS, GREATS_BY_ID, type Great, type GreatLick } from "@/lib/music/greats";
import { useApp, useHydrated } from "@/lib/store";
import { shapeSteps } from "@/lib/theory/earPlayAlong";
import { getTheoryPlayer } from "@/lib/theory/player";

export default function GuitarGreatsPage() {
  const hydrated = useHydrated();
  const storedTone = useApp((s) => s.prefs.leadTone);
  const leadTone = hydrated ? storedTone : "clean";
  const audio = useSoloAudio(leadTone);
  const [id, setId] = useState(GREATS[0]!.id);
  const [pick, setPick] = useState<string | null>(null);
  const [map, setMap] = useState<MapRequest | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const great = GREATS_BY_ID[id] ?? GREATS[0]!;

  // Deep link: /learn/greats#hendrix
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (GREATS_BY_ID[h]) { setId(h); setPick(null); }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const choose = useCallback((next: string, scroll = false) => {
    audio.stop();
    setPick(null);
    setId(next);
    try { window.history.replaceState(null, "", `#${next}`); } catch { /* ignore */ }
    if (scroll) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [audio]);

  const openPicker = (lickId: string) => {
    audio.stop();
    setPick(lickId);
    requestAnimationFrame(() => pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const i = GREATS.findIndex((g) => g.id === great.id);
  const picked = great.licks.find((l) => l.lick.id === pick) ?? null;

  return (
    <div className="theory-page mx-auto max-w-6xl space-y-8" data-testid="greats-page">
      <PageTitle
        title="Guitar greats"
        lead="How eight great players sound, and how to get there yourself: their signature chord shapes and licks on the fretboard, ready to hear and pick note by note."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/learn/solo" className="btn btn-quiet btn-sm">Lead solos</Link>
          <Link href="/learn/caged" className="btn btn-quiet btn-sm">CAGED map</Link>
        </div>
      </PageTitle>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Choose a guitarist" data-testid="greats-roster">
        {GREATS.map((g) => (
          <li key={g.id}>
            <button type="button" role="tab" aria-selected={g.id === great.id} onClick={() => choose(g.id, true)} data-testid={`greats-tab-${g.id}`}
              className={`h-full w-full rounded-xl border p-3 text-left transition-colors hover:bg-panel-2 ${g.id === great.id ? "bg-panel-2" : "border-line"}`}
              style={g.id === great.id ? { borderColor: g.colour } : undefined}>
              <span className="block h-1.5 w-8 rounded-full" style={{ background: g.colour }} aria-hidden />
              <span className="mt-2 block font-bold leading-tight">{g.name}</span>
              <span className="block text-xs text-muted">{g.genre} · {g.years}</span>
            </button>
          </li>
        ))}
      </ul>

      <article ref={panelRef} className="scroll-mt-4 space-y-8" data-testid="greats-panel" data-player={great.id} aria-labelledby="great-name">
        <header className="rounded-2xl border border-line bg-panel/50 p-5" style={{ borderTop: `4px solid ${great.colour}` }}>
          <p className="text-xs uppercase tracking-wide text-muted">{great.genre} · {great.years} · {great.hands}</p>
          <h2 id="great-name" className="display mt-1 text-[2rem] leading-tight md:text-[2.6rem]" style={{ color: great.colour }}>{great.name}</h2>
          <p className="mt-2 max-w-3xl text-[1.1rem] leading-relaxed">{great.sound}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="greats-traits">
            {great.traits.map((t) => (
              <li key={t.title} className="rounded-xl bg-panel p-3">
                <h3 className="font-bold">{t.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t.text}</p>
              </li>
            ))}
          </ul>
        </header>

        <ChordStage great={great} onPlayStop={audio.stop} />

        <section className="space-y-4" aria-labelledby="greats-licks-heading">
          <div>
            <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: great.colour }}>Licks in the style</p>
            <h2 id="greats-licks-heading" className="display text-2xl">Play like {great.name}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted">
              Original licks written to show the techniques, not copies of recordings. Hear each with a band, then press <strong className="text-ink">Pick it</strong> to
              learn it note by note on the neck.
            </p>
          </div>
          <div ref={pickerRef} className="scroll-mt-4">
            {picked && (
              <LickPicker item={picked} colour={great.colour}
                playing={audio.playingKey === `lick:${picked.lick.id}-slow`}
                onPlay={(speed) => audio.toggleLick({ ...picked.lick, bpm: Math.round(picked.lick.bpm * speed) }, { key: `${picked.lick.id}-slow`, scope: picked.lick.id })}
                onClose={() => { audio.stop(); setPick(null); }} />
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {great.licks.map((l) => (
              <GreatLickCard key={l.lick.id} item={l} great={great} audio={audio} picking={pick === l.lick.id}
                onPick={() => openPicker(l.lick.id)} onMap={() => setMap(mapRequestForLick(l.lick))} />
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line p-4" data-testid="greats-listen">
            <h2 className="font-bold">Listen to</h2>
            <p className="text-xs text-muted">Hear the real thing. Listen for the traits above.</p>
            <ul className="mt-2 space-y-1 text-sm">{great.listen.map((x) => <li key={x}>♪ {x}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-line p-4" data-testid="greats-practice">
            <h2 className="font-bold">Practise this week</h2>
            <ol className="mt-2 space-y-1.5 text-sm">{great.practice.map((x, k) => <li key={x}><span className="font-mono text-muted">{k + 1}.</span> {x}</li>)}</ol>
          </div>
        </section>

        <nav className="flex flex-wrap justify-between gap-2" aria-label="Other players">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose(GREATS[(i + GREATS.length - 1) % GREATS.length]!.id, true)}>
            ← {GREATS[(i + GREATS.length - 1) % GREATS.length]!.name}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => choose(GREATS[(i + 1) % GREATS.length]!.id, true)} data-testid="greats-next">
            {GREATS[(i + 1) % GREATS.length]!.name} →
          </button>
        </nav>
      </article>

      <p className="text-xs text-faint">
        Licks on this page are original exercises in each player&apos;s style, written for Music Decoder. They aren&apos;t transcriptions; for the real
        thing, listen to the recordings.
      </p>

      {map && (
        <ScaleFretmapFloat
          open={!!map}
          onOpenChange={(o) => { if (!o) setMap(null); }}
          initialRoot={map.root}
          initialMode={map.mode}
          initialBox={map.box}
          chordList={map.chordList ?? chordListFor(map.lick)}
          lick={map.lick ?? null}
          onPlayLick={(l) => audio.toggleLick(l)}
          playing={!!map.lick && audio.playingKey === `lick:${map.lick.id}`}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ chords */

function ChordStage({ great, onPlayStop }: { great: Great; onPlayStop: () => void }) {
  const [k, setK] = useState(0);
  const [strumming, setStrumming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setK(0), [great.id]);
  const chord = great.chords[Math.min(k, great.chords.length - 1)]!;
  // Phones: the neck scrolls sideways, so bring the shape into view.
  useEffect(() => {
    const box = scrollRef.current;
    const el = box?.querySelector('[data-testid="ef-shape"]');
    if (!box || !el) return;
    const c = box.getBoundingClientRect(), b = el.getBoundingClientRect();
    if (b.left < c.left + 16 || b.right > c.right - 16) box.scrollTo({ left: box.scrollLeft + (b.left + b.width / 2) - (c.left + c.width / 2) });
  }, [chord]);
  const strum = async () => {
    onPlayStop();
    setStrumming(true);
    await getTheoryPlayer().play(shapeToStrumSound(chord.shape, 90), () => undefined);
    setStrumming(false);
  };
  return (
    <section className="space-y-3" aria-labelledby="greats-chords-heading" data-testid="greats-chords">
      <div>
        <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: great.colour }}>Signature chords</p>
        <h2 id="greats-chords-heading" className="display text-2xl">Chord shapes</h2>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chord">
        {great.chords.map((c, n) => (
          <button key={c.name} type="button" role="tab" aria-selected={n === k} onClick={() => setK(n)} data-testid={`greats-chord-${n}`}
            className={`rounded-full border px-3 py-1.5 text-sm font-bold ${n === k ? "border-ink bg-panel-2" : "border-line text-muted"}`}>{c.name}</button>
        ))}
      </div>
      <div className="grid gap-4 rounded-2xl border border-line bg-panel/50 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div ref={scrollRef} className="min-w-0 overflow-x-auto rounded-xl bg-tolex p-2" data-testid="greats-chord-scroll">
          <EarFretNeck frets={12} shape={chord.shape} shapeStyle="full" onTap={() => void strum()} />
        </div>
        <div>
          <h3 className="display text-2xl" data-testid="greats-chord-name">{chord.name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{chord.text}</p>
          <ul className="mt-3 space-y-1 text-sm" data-testid="greats-chord-steps">{shapeSteps(chord.shape).map((s) => <li key={s}>• {s}</li>)}</ul>
          <button type="button" className="btn btn-primary btn-sm mt-3" onClick={() => void strum()} data-testid="greats-strum">
            <IconPlay /> {strumming ? "Strumming…" : "Strum it"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ lick card */

function GreatLickCard({ item, great, audio, picking, onPick, onMap }: {
  item: GreatLick; great: Great; audio: ReturnType<typeof useSoloAudio>; picking: boolean; onPick: () => void; onMap: () => void;
}) {
  const { lick } = item;
  const on = audio.playingKey === `lick:${lick.id}`;
  const over = [...new Set(lick.backing.map(([c]) => c))].join(" – ");
  return (
    <article className="surface flex min-w-0 flex-col gap-3 p-4" data-hl-scope={lick.id} data-testid={`greats-lick-${lick.id}`}>
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {lick.tags.map((t) => <span key={t} className="chip text-xs">{t}</span>)}
          <span className="chip text-xs">over {over}</span>
          <span className="chip text-xs">{lick.bpm} BPM</span>
        </div>
        <h3 className="text-lg font-bold leading-tight">{lick.title}</h3>
        <p className="mt-0.5 text-sm text-muted">{lick.sub}</p>
      </div>
      <div className="min-w-0 overflow-hidden rounded-lg bg-tolex/40 p-1"><LickNeck lick={lick} /></div>
      <LickTab notes={lick.notes} />
      <p className="text-sm leading-relaxed"><strong style={{ color: great.colour }}>Why it works: </strong>{item.why}</p>
      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" className={`btn btn-sm ${on ? "btn-primary" : "btn-quiet"}`} aria-pressed={on} onClick={() => audio.toggleLick(lick)} data-testid={`greats-play-${lick.id}`}>
          {on ? <IconStop /> : <IconPlay />} {on ? "Stop" : "Play with band"}
        </button>
        <button type="button" className={`btn btn-sm ${picking ? "btn-primary" : "btn-ghost"}`} onClick={onPick} data-testid={`greats-pick-${lick.id}`}>Pick it</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onMap} data-testid={`greats-map-${lick.id}`}>Fretboard map</button>
      </div>
    </article>
  );
}
