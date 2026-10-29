"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CagedNeck } from "@/components/caged/CagedNeck";
import { ChordDiagram } from "@/components/ChordDiagram";
import { IconPlay, IconStop } from "@/components/Icons";
import { clearHighlights, setHighlight } from "@/components/theory/highlight";
import { shapeToStrumSound } from "@/lib/audio/strumChord";
import { cagedKey, cagedPositions } from "@/lib/music/caged";
import { api } from "@/lib/api";
import {
  PROGRESSIONS, capoTip, chordShape, keyChords, keyName, keyShort, numeralChord, progressionSound, relativeKey, scaleNotes,
  sectionChords, soloScales, songChords, type Chord, type HooktheoryExamples, type Key, type Meter, type OnlineSong, type SongbookEntry,
} from "@/lib/music/songSearch";
import { getTheoryPlayer } from "@/lib/theory/player";

export type Picked =
  | { kind: "songbook"; song: SongbookEntry }
  | { kind: "online"; song: OnlineSong; key: Key | null; source: string };

/** Key, scale and chords for one song: the full chart for songbook songs, the key's chords for online ones. */
export function SongDetail({ picked }: { picked: Picked }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const runRef = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [focus, setFocus] = useState<Chord | null>(null);
  const [showNeck, setShowNeck] = useState(false);
  const [hook, setHook] = useState<HooktheoryExamples | null>(null);

  const key = picked.kind === "songbook" ? picked.song.key : picked.key;
  const title = picked.song.title;
  const songId = picked.kind === "songbook" ? picked.song.id : picked.song.id;
  const chords = useMemo(() => (picked.kind === "songbook" ? songChords(picked.song) : key ? keyChords(key).filter((c) => c.common) : []), [picked, key]);

  useEffect(() => { setFocus(chords[0] ?? null); setShowNeck(false); stop(); }, [songId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!key) { setHook(null); return; }
    const ac = new AbortController();
    api.hooktheoryExamples(key.mode, { signal: ac.signal })
      .then(setHook)
      .catch(() => { if (!ac.signal.aborted) setHook({ configured: false, progressions: [] }); });
    return () => ac.abort();
  }, [key?.mode, key?.pc]); // eslint-disable-line react-hooks/exhaustive-deps

  function stop() {
    runRef.current++;
    getTheoryPlayer().stop();
    clearHighlights(rootRef.current);
    setPlaying(null);
  }
  async function play(id: string, bars: Chord[][], meter: Meter, bpm: number) {
    if (playing === id) { stop(); return; }
    stop();
    const run = ++runRef.current;
    setPlaying(id);
    const scope = rootRef.current?.querySelector(`[data-prog="${id}"]`) as HTMLElement | null;
    await getTheoryPlayer().play(progressionSound(bars, meter, bpm), (h, on) => setHighlight(scope, h, on));
    if (runRef.current === run) setPlaying(null);
  }
  function strum(c: Chord) {
    stop();
    setFocus(c);
    void getTheoryPlayer().play(shapeToStrumSound(chordShape(c), 96), () => undefined);
  }

  const capo = key ? capoTip(key) : null;
  const meter: Meter = picked.kind === "songbook" ? picked.song.meter : picked.song.time_sig?.startsWith("3") ? "3/4" : "4/4";
  const bpm = picked.kind === "songbook" ? picked.song.bpm : picked.song.tempo ?? 96;

  const chip = (c: Chord, hl?: string) => (
    <button key={hl ?? c.symbol} type="button" onClick={() => strum(c)} data-hl={hl} data-chord={c.symbol}
      className={`song-chip rounded-lg border px-2.5 py-1 text-left ${focus?.symbol === c.symbol ? "border-next" : "border-line"} bg-panel-2 hover:border-ink`}>
      <span className="display block text-lg leading-tight">{c.symbol}</span>
      <span className="block font-mono text-[0.7rem] text-muted">{c.numeral}</span>
    </button>
  );

  return (
    <article ref={rootRef} className="space-y-5" data-testid="song-detail" data-song={songId} data-key={key ? keyShort(key) : ""} aria-labelledby="song-title">
      <header className="rounded-2xl border border-line bg-panel/50 p-5">
        <p className="text-xs uppercase tracking-wide text-muted">
          {picked.kind === "songbook" ? `Songbook · ${picked.song.credit}` : `Online · ${picked.song.artist || "Unknown artist"}`}
        </p>
        <h2 id="song-title" className="display mt-1 text-[1.9rem] leading-tight md:text-[2.4rem]">{title}</h2>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="song-facts">
          <Fact label="Key" value={key ? keyName(key) : "Unknown"} strong />
          {key && <Fact label="Relative" value={keyName(relativeKey(key))} />}
          {bpm ? <Fact label="Tempo" value={`${bpm} BPM`} /> : null}
          <Fact label="Time" value={picked.kind === "songbook" ? picked.song.meter : picked.song.time_sig ? `${picked.song.time_sig}` : "—"} />
          {capo && <Fact label="Capo" value={`Fret ${capo.capo}, play ${keyShort(capo.shapes)} shapes`} />}
        </div>
        {picked.kind === "songbook" && <p className="mt-3 text-sm text-muted">{picked.song.tip}</p>}
      </header>

      {key ? (
        <>
          {/* ------------------------------------------------ chords */}
          <section className="rounded-2xl border border-line p-4 md:p-5" aria-labelledby="song-chords-title" data-testid="song-chords">
            <h3 id="song-chords-title" className="text-lg font-bold">Chords</h3>
            {picked.kind === "songbook" ? (
              <div className="mt-3 space-y-4">
                {picked.song.sections.map((sec, si) => {
                  const bars = sectionChords(picked.song, sec);
                  const id = `s${si}`;
                  let n = 0;
                  return (
                    <div key={sec.name} data-prog={id} data-testid={`song-section-${si}`}>
                      <div className="mb-2 flex items-center gap-3">
                        <p className="text-sm font-bold">{sec.name}</p>
                        <button type="button" className={`btn btn-sm ${playing === id ? "btn-primary" : "btn-quiet"}`} onClick={() => void play(id, bars, picked.song.meter, picked.song.bpm)} data-testid={`song-play-${si}`}>
                          {playing === id ? <IconStop /> : <IconPlay />} {playing === id ? "Stop" : "Play"}
                        </button>
                      </div>
                      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {bars.map((bar, bi) => (
                          <li key={bi} className="flex gap-1 rounded-lg border border-line/60 p-1">
                            {bar.map((c) => chip(c, `pb-${n++}`))}
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 space-y-4">
                <p className="text-sm text-muted" data-testid="song-online-note">
                  The exact chords for this song aren&apos;t available online. These are the chords in <strong className="text-ink">{keyName(key)}</strong>.
                  The highlighted ones turn up in most songs in this key, so try them along with the recording.
                </p>
                <div className="flex flex-wrap gap-1.5" data-testid="song-key-chords">
                  {keyChords(key).map((c) => (
                    <button key={c.symbol + c.numeral} type="button" onClick={() => strum(c)} data-chord={c.symbol}
                      className={`rounded-lg border px-2.5 py-1 text-left ${c.common ? "border-next/70 bg-panel-2" : "border-line text-muted"} ${focus?.symbol === c.symbol ? "ring-2 ring-next" : ""}`}>
                      <span className="display block text-lg leading-tight">{c.symbol}</span>
                      <span className="block font-mono text-[0.7rem] text-muted">{c.numeral}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-bold">Common progressions in {keyShort(key)}</p>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {PROGRESSIONS[key.mode].map((p, pi) => {
                      const bars = p.numerals.map((nm) => [numeralChord(key, nm)]);
                      const id = `p${pi}`;
                      return (
                        <li key={p.name} className="flex items-center gap-2 rounded-xl border border-line p-2" data-prog={id}>
                          <button type="button" className={`btn btn-sm ${playing === id ? "btn-primary" : "btn-quiet"}`} aria-label={`Play ${p.name}`}
                            onClick={() => void play(id, bars, meter, bpm)} data-testid={`song-prog-${pi}`}>
                            {playing === id ? <IconStop /> : <IconPlay />}
                          </button>
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-x-1 text-sm font-bold">
                              {bars.map(([c], k) => (
                                <span key={k} className="flex items-center gap-x-1">
                                  <span data-hl={`pb-${k}`} className="song-prog-chord rounded px-1">{c!.symbol}</span>
                                  {k < bars.length - 1 && <span className="text-faint" aria-hidden>–</span>}
                                </span>
                              ))}
                            </p>
                            <p className="text-xs text-muted">{p.numerals.join(" – ")} · {p.heard}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <p className="rounded-xl bg-panel-2 p-3 text-sm">
                  Want the real chords? <Link href="/record" className="font-bold text-next underline">Hum the tune</Link> and the decoder will work them out from your melody.
                </p>
              </div>
            )}
          </section>

          {/* ------------------------------------------------ shapes */}
          <section className="rounded-2xl border border-line p-4 md:p-5" aria-labelledby="song-shapes-title" data-testid="song-shapes">
            <h3 id="song-shapes-title" className="text-lg font-bold">Chord shapes</h3>
            <p className="text-sm text-muted">Tap a chord to hear it.</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {chords.map((c) => (
                <li key={c.symbol}>
                  <button type="button" onClick={() => strum(c)} className={`rounded-xl border p-1 ${focus?.symbol === c.symbol ? "border-next" : "border-line"}`} data-testid={`song-shape-${c.symbol}`}>
                    <ChordDiagram name={c.symbol} diagram={chordShape(c)} size={0.9} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* ------------------------------------------------ scale */}
          <section className="rounded-2xl border border-line p-4 md:p-5" aria-labelledby="song-scale-title" data-testid="song-scale">
            <h3 id="song-scale-title" className="text-lg font-bold">Scale</h3>
            <p className="mt-1 text-sm"><strong>{keyName(key)}:</strong> <span data-testid="song-scale-notes">{scaleNotes(key).join(" · ")}</span></p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {soloScales(key).map((s) => (
                <li key={s.name} className="rounded-xl bg-panel-2 p-3">
                  <p className="font-bold">{s.name}</p>
                  <p className="font-mono text-sm">{s.notes.join(" ")}</p>
                  <p className="mt-1 text-xs text-muted">{s.tip}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNeck(!showNeck)} aria-expanded={showNeck} data-testid="song-show-neck">
                {showNeck ? "Hide the fretboard" : "Show the pentatonic on the fretboard"}
              </button>
              <Link href="/learn/caged" className="btn btn-quiet btn-sm">CAGED map</Link>
              <Link href="/learn/solo" className="btn btn-quiet btn-sm">Solo over it</Link>
            </div>
            {showNeck && (
              <div className="mt-3 overflow-x-auto rounded-xl bg-tolex p-2" data-testid="song-neck">
                <CagedNeck musicKey={cagedKey(key.pc, key.mode)} positions={cagedPositions(cagedKey(key.pc, key.mode), 15)} frets={15}
                  selected="all" view="boxes" labels="note" testId="song-caged-neck" />
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-line p-4 text-sm" data-testid="song-no-key">
          The online service doesn&apos;t know this song&apos;s key. <Link href="/record" className="font-bold text-next underline">Hum the tune</Link> and the decoder will find the key and chords for you.
        </p>
      )}

      {picked.kind === "songbook" && picked.song.practice && (
        <Link href={picked.song.practice.href} className="btn btn-primary btn-sm">{picked.song.practice.label}</Link>
      )}
      {hook?.configured && key && (
        <section className="rounded-2xl border border-line p-4 md:p-5" aria-labelledby="song-hook-title" data-testid="song-hooktheory">
          <h3 id="song-hook-title" className="text-lg font-bold">TheoryTab examples</h3>
          <p className="mt-1 text-sm text-muted">
            Songs on <a href="https://www.hooktheory.com" target="_blank" rel="noopener noreferrer" className="underline">Hooktheory</a> that use common progressions in {keyName(key)}. Open a link to see the real chord chart there.
          </p>
          <ul className="mt-3 space-y-3">
            {hook.progressions.filter((p) => p.songs.length > 0).slice(0, 3).map((p) => (
              <li key={p.cp}>
                <p className="text-sm font-bold">{p.label}</p>
                <ul className="mt-1 space-y-1">
                  {p.songs.slice(0, 4).map((s) => (
                    <li key={`${s.artist}-${s.song}-${s.section}`}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-next underline">
                          {s.artist} — {s.song}{s.section ? ` (${s.section})` : ""}
                        </a>
                      ) : (
                        <span className="text-sm">{s.artist} — {s.song}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {hook.progressions.every((p) => p.songs.length === 0) && (
            <p className="mt-2 text-sm text-muted">No TheoryTab hits for these progressions right now.</p>
          )}
        </section>
      )}

      {picked.kind === "online" && (
        <p className="text-xs text-faint" data-testid="song-credit">
          Key and tempo data from <a href="https://getsongbpm.com" target="_blank" rel="noopener noreferrer" className="underline">GetSongBPM.com</a>
          {picked.song.uri && <> · <a href={picked.song.uri} target="_blank" rel="noopener noreferrer" className="underline">song page</a></>}
          {hook?.configured && <> · TheoryTab examples from <a href="https://www.hooktheory.com" target="_blank" rel="noopener noreferrer" className="underline">Hooktheory</a></>}
        </p>
      )}
    </article>
  );
}

function Fact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className={`rounded-xl px-3 py-1.5 text-sm ${strong ? "bg-next text-tolex" : "bg-panel-2"}`} data-testid={`song-fact-${label.toLowerCase()}`}>
      <span className={strong ? "font-normal" : "text-muted"}>{label} </span><strong>{value}</strong>
    </span>
  );
}
