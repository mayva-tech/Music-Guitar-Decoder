"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Notice, PageTitle } from "@/components/AppShell";
import { PianoRoll } from "@/components/PianoRoll";
import { ChordDiagram } from "@/components/ChordDiagram";
import { IconPlay, IconStop } from "@/components/Icons";
import { api, ApiError } from "@/lib/api";
import { getEngine } from "@/lib/audio/engine";
import { melodyPreview } from "@/lib/audio/preview";
import { DEFAULT_TRACKS } from "@/lib/audio/timeline";
import { canRequantize, deleteNote, insertAfter, setDuration, totalBars, transposeNote } from "@/lib/music/edit";
import { useApp, useHydrated } from "@/lib/store";
import { getLastRecording } from "@/lib/session";
import type { DetectedMelody, Harmonization } from "@/lib/types";

const ALL_ON = { ...DEFAULT_TRACKS, melody: true, backing: true, bass: true, drums: false, solo: false };

export default function DecoderPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { melody, setMelody, harmony, setHarmony, prefs, setPrefs, selectedHarmonization, selectHarmonization, setArrangement } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingWhat, setPlayingWhat] = useState<string | null>(null);
  const [playingNote, setPlayingNote] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const raf = useRef(0);
  const recording = typeof window !== "undefined" ? getLastRecording() : null;
  const audioEl = useRef<HTMLAudioElement>(null);

  useEffect(() => () => {
    cancelAnimationFrame(raf.current);
    getEngine().stop();
  }, []);

  const sel = useMemo(() => melody?.notes.find((n) => n.id === selected) ?? null, [melody, selected]);
  const lowCount = melody?.notes.filter((n) => n.low_confidence).length ?? 0;

  if (!hydrated) return null;
  if (!melody) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageTitle title="Music decoder" lead="This is where your hummed tune becomes notes, chords and a guitar part." />
        <div className="surface p-6 flex flex-wrap gap-3 items-center">
          <p className="w-full text-muted">There's no tune here yet. Record one, or start with the demo.</p>
          <Link href="/record" className="btn btn-primary">Record a melody</Link>
          <button className="btn btn-ghost" onClick={async () => { try { setMelody(await api.demo()); } catch (e) { setError((e as Error).message); } }}>Load the demo tune</button>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      </div>
    );
  }

  const update = (m: DetectedMelody) => {
    setMelody(m); // clears harmony: chords must be recomputed for the edited tune
    setDirty(true);
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const play = async (what: string, h?: Harmonization) => {
    const eng = getEngine();
    if (playingWhat === what) {
      eng.stop();
      setPlayingWhat(null);
      setPlayingNote(null);
      return;
    }
    audioEl.current?.pause();
    const sched = melodyPreview(melody, h?.chords);
    setPlayingWhat(what);
    await eng.play(sched, ALL_ON, () => { setPlayingWhat(null); setPlayingNote(null); });
    const tick = () => {
      const t = eng.position();
      if (t < 0) return;
      const cur = sched.events.filter((e) => e.track === "melody" && e.time <= t && t < e.time + e.duration).at(-1);
      setPlayingNote(cur?.eventId ?? null);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const refreshKey = () => run("key", async () => { setMelody(await api.refresh(melody)); setDirty(false); });

  const style = prefs.style;
  const findChords = () => run("chords", async () => {
    const m = dirty ? await api.refresh(melody) : melody;
    if (dirty) { setMelody(m); setDirty(false); }
    const r = await api.harmonize(m, style, prefs.skillLevel, m.key_candidates[0]);
    setHarmony(r);
    selectHarmonization("genre");
  });

  const generate = () => run("solo", async () => {
    const h = harmony?.harmonizations.find((x) => x.kind === selectedHarmonization) ?? harmony?.harmonizations[0];
    if (!h) return;
    getEngine().stop();
    const arr = await api.generateSolo(melody, h, prefs.skillLevel, style, melody.title, prefs.techniques);
    setArrangement(arr);
    router.push("/learn");
  });

  const requantize = (bpm: number, offset = melody.beat_offset) =>
    run("tempo", async () => { setMelody(await api.quantize(melody, bpm, offset)); });

  const key = melody.key_candidates[0];
  const bars = totalBars(melody);

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title={melody.title} lead={melody.source === "demo" ? "The built-in demo tune — a fixed melody, no microphone needed." : "Here's what we heard. Tap any note to fix it."}>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-quiet btn-sm" onClick={() => play("melody")} aria-pressed={playingWhat === "melody"}>
            {playingWhat === "melody" ? <IconStop width={16} /> : <IconPlay width={16} />} Play detected notes
          </button>
          {recording && melody.source !== "demo" && (
            <button className="btn btn-ghost btn-sm" onClick={() => { getEngine().stop(); setPlayingWhat(null); audioEl.current?.play(); }}>Play my recording</button>
          )}
        </div>
      </PageTitle>
      {recording && <audio ref={audioEl} src={recording.url} className="hidden" />}

      <div className="grid gap-3 mb-5">
        {melody.warnings.map((w) => <Notice key={w} tone="warn">{w}</Notice>)}
      </div>

      <section className="surface p-4 md:p-6" aria-labelledby="notes-h">
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
          <h2 id="notes-h" className="text-lg font-bold">Your notes</h2>
          <p className="text-sm text-muted">
            {melody.notes.length} notes · {bars} bar{bars > 1 ? "s" : ""}
            {lowCount > 0 && <span className="text-next"> · {lowCount} to check</span>}
          </p>
        </div>
        <PianoRoll melody={melody} selected={selected} playing={playingNote} onSelect={setSelected} />

        <div className="mt-4 flex flex-wrap gap-1.5" role="list" aria-label="Note names">
          {melody.notes.map((n, i) => (
            <button key={n.id} role="listitem" onClick={() => setSelected(n.id)} data-testid={`note-chip-${i}`}
              className={`chip ${n.id === selected ? "bg-maple text-tolex" : n.low_confidence ? "text-next" : ""}`}>
              {n.name}{n.low_confidence ? "?" : ""}
            </button>
          ))}
        </div>

        {sel && (
          <div className="mt-4 rounded-2xl bg-panel-2 p-4" data-testid="note-editor">
            <div className="flex flex-wrap items-center gap-3">
              <span className="display text-3xl w-20">{sel.name}</span>
              <span className="text-sm text-muted">
                {sel.low_confidence ? "We weren't sure about this one." : sel.source === "edited" ? "Edited by you." : `Confidence ${Math.round((sel.confidence ?? 1) * 100)}%`}
                {" "}Length {sel.duration_beats} beat{sel.duration_beats === 1 ? "" : "s"}.
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-quiet btn-sm" onClick={() => update(transposeNote(melody, sel.id, -1))} aria-label="Lower by a semitone">Lower</button>
              <button className="btn btn-quiet btn-sm" onClick={() => update(transposeNote(melody, sel.id, 1))} aria-label="Raise by a semitone">Higher</button>
              <button className="btn btn-quiet btn-sm" onClick={() => update(transposeNote(melody, sel.id, -12))}>Octave down</button>
              <button className="btn btn-quiet btn-sm" onClick={() => update(transposeNote(melody, sel.id, 12))}>Octave up</button>
              <button className="btn btn-quiet btn-sm" onClick={() => update(setDuration(melody, sel.id, sel.duration_beats - 0.5))}>Shorter</button>
              <button className="btn btn-quiet btn-sm" onClick={() => update(setDuration(melody, sel.id, sel.duration_beats + 0.5))}>Longer</button>
              <button className="btn btn-quiet btn-sm" onClick={() => update(insertAfter(melody, sel.id))}>Add a note after</button>
              <button className="btn btn-quiet btn-sm" onClick={() => getEngine().preview(sel.midi, "melody")}>Listen</button>
              <button className="btn btn-ghost btn-sm text-bad" disabled={melody.notes.length < 2}
                onClick={() => { update(deleteNote(melody, sel.id)); setSelected(null); }}>Delete</button>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-5 border-t border-line pt-5 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Key</h3>
            <p className="mt-1 text-muted text-sm">The home note and scale. Best guess first.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {melody.key_candidates.slice(0, 3).map((k, i) => (
                <span key={k.name} className={`chip ${i === 0 ? "bg-maple text-tolex" : ""}`}>{k.name}{i === 0 ? "" : ` · ${Math.round(k.confidence * 100)}%`}</span>
              ))}
              {dirty && <button className="btn btn-ghost btn-sm" onClick={refreshKey} disabled={!!busy}>Update after edits</button>}
            </div>
          </div>
          <div>
            <h3 className="font-semibold">Tempo</h3>
            <p className="mt-1 text-muted text-sm">If the notes look squashed or stretched, try another tempo.</p>
            {canRequantize(melody) ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {[...new Set([melody.tempo_bpm, ...melody.tempo_candidates.map((t) => t.bpm)])].slice(0, 4).map((b) => (
                  <button key={b} className={`chip ${b === melody.tempo_bpm ? "bg-maple text-tolex" : ""}`} onClick={() => requantize(b)} disabled={!!busy}>{b} BPM</button>
                ))}
                <label className="ml-1 flex items-center gap-2 text-sm text-muted">
                  BPM
                  <input type="number" min={30} max={240} className="field w-20 min-h-0 py-1" defaultValue={melody.tempo_bpm}
                    onKeyDown={(e) => e.key === "Enter" && requantize(Number((e.target as HTMLInputElement).value))} />
                </label>
                <button className="chip" onClick={() => requantize(melody.tempo_bpm, (melody.beat_offset + 0.5) % 4)} disabled={!!busy}>
                  Shift beat by ½
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm"><span className="chip">{melody.tempo_bpm} BPM</span>{melody.source !== "demo" && <span className="ml-2 text-muted">Re-timing is off after adding notes.</span>}</p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 surface p-4 md:p-6" aria-labelledby="chords-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="chords-h" className="text-lg font-bold">Chords</h2>
            <p className="text-sm text-muted mt-1">The band plays these under your tune. You don&apos;t have to play them yourself.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Genre" className="flex gap-1">
              {([["classic_rock", "Rock"], ["pop", "Pop"], ["blues", "Blues"]] as const).map(([st, label]) => (
                <button key={st} role="radio" aria-checked={style === st} data-testid={`decoder-genre-${st}`}
                  onClick={() => { setPrefs({ style: st }); setHarmony(null); }}
                  className={`chip ${style === st ? "bg-maple text-tolex" : ""}`}>{label}</button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={findChords} disabled={!!busy}>{busy === "chords" ? "Finding chords…" : harmony ? "Find chords again" : "Find chords"}</button>
          </div>
        </div>

        {harmony && (
          <>
            <p className="mt-4 max-w-3xl text-muted leading-relaxed">{harmony.explanation}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3" role="radiogroup" aria-label="Harmonization options">
              {harmony.harmonizations.map((h) => {
                const on = h.kind === selectedHarmonization;
                return (
                  <div key={h.kind} role="radio" aria-checked={on} tabIndex={0} data-testid={`harmony-${h.kind}`}
                    onClick={() => selectHarmonization(h.kind)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectHarmonization(h.kind)}
                    className={`cursor-pointer rounded-2xl p-4 transition-colors ${on ? "bg-panel-2 ring-2 ring-maple" : "bg-tolex hover:bg-panel-2"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-bold">{h.label}</h3>
                      <button className="btn btn-quiet btn-sm" onClick={(e) => { e.stopPropagation(); play(h.kind, h); }}>
                        {playingWhat === h.kind ? <IconStop width={16} /> : <IconPlay width={16} />} Listen
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-muted">{h.description}</p>
                    {h.progression_name && <p className="mt-1 text-xs text-faint">{h.progression_name}</p>}
                    <ol className="mt-3 flex flex-wrap gap-1.5">
                      {h.chords.map((c, i) => (
                        <li key={i} className="chip" title={c.function}>
                          <span className="font-bold">{c.symbol}</span>
                          <span className="text-faint text-xs">{c.duration_beats < melody.beats_per_bar ? `${c.duration_beats} beats` : `${c.duration_beats / melody.beats_per_bar} bar${c.duration_beats > melody.beats_per_bar ? "s" : ""}`}</span>
                        </li>
                      ))}
                    </ol>
                    {on && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[...new Map(h.chords.map((c) => [c.symbol, c])).values()].slice(0, 6).map((c) => (
                          <ChordDiagram key={c.symbol} name={c.symbol} diagram={h.use_power_chords ? c.power_diagram : c.diagram} size={0.8} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button className="btn btn-primary" onClick={generate} disabled={!!busy || !selectedHarmonization} data-testid="generate-solo">
                {busy === "solo" ? "Writing your solo…" : "Make my guitar part"}
              </button>
              <p className="text-sm text-muted">Writes an easy solo and a {style === "blues" ? "blues" : style === "pop" ? "pop" : "rock"} lead solo for your level, and sets up the backing band.</p>
            </div>
          </>
        )}
        {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
      </section>
    </div>
  );
}
