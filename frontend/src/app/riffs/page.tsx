"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Notice, PageTitle } from "@/components/AppShell";
import { IconMic, IconPlay, IconStop } from "@/components/Icons";
import { api, ApiError } from "@/lib/api";
import { getEngine } from "@/lib/audio/engine";
import { buildSchedule } from "@/lib/audio/timeline";
import { useApp, useHydrated } from "@/lib/store";
import type { Genre, RiffInfo } from "@/lib/types";

const GENRE_LABEL: Record<Genre, string> = { rock: "Rock", pop: "Pop", blues: "Blues" };
const LEVEL_LABEL = ["", "Easy", "Medium", "Harder"];
type Filter<T> = T | "all";

export default function RiffsPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { prefs, setArrangement } = useApp();
  const [riffs, setRiffs] = useState<RiffInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [genre, setGenre] = useState<Filter<Genre>>("all");
  const [level, setLevel] = useState<Filter<number>>("all");
  const [source, setSource] = useState<Filter<RiffInfo["source"] | "modern">>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    api.riffs().then(setRiffs).catch((e) => setError(e.message));
    return () => getEngine().stop();
  }, []);

  const shown = useMemo(
    () => (riffs ?? []).filter((r) => (genre === "all" || r.genre === genre) && (level === "all" || r.difficulty === level)
      && (source === "all" || (source === "modern" ? !!r.vibe : r.source === source && (source !== "original" || !r.vibe)))),
    [riffs, genre, level, source],
  );

  const listen = async (r: RiffInfo) => {
    const eng = getEngine();
    if (playing === r.id) {
      eng.stop();
      setPlaying(null);
      return;
    }
    setBusy(`listen-${r.id}`);
    try {
      const arr = await api.riffArrangement(r.id, prefs.skillLevel, prefs.techniques, false);
      setPlaying(r.id);
      await eng.play(buildSchedule(arr, { part: "melody" }), { melody: true, solo: false, lead: false, backing: true, bass: true, drums: true },
        () => setPlaying(null));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const practise = async (r: RiffInfo) => {
    setBusy(`practise-${r.id}`);
    try {
      getEngine().stop();
      setArrangement(await api.riffArrangement(r.id, prefs.skillLevel, prefs.techniques));
      router.push("/learn");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setBusy(null);
    }
  };

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle title="Riff practice"
        lead="Short riffs to play with the band: classics from before 1929, technique riffs, and original riffs in modern styles from grunge to neo-soul." />

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3" role="group" aria-label="Filters">
        <FilterChips label="Genre" value={genre} onChange={setGenre}
          options={[["all", "All"], ["rock", "Rock"], ["pop", "Pop"], ["blues", "Blues"]]} />
        <FilterChips label="Level" value={level} onChange={setLevel}
          options={[["all", "All"], [1, "Easy"], [2, "Medium"], [3, "Harder"]]} />
        <FilterChips label="Type" value={source} onChange={setSource}
          options={[["all", "All"], ["public_domain", "Classics"], ["original", "Technique riffs"], ["modern", "Modern styles"]]} />
      </div>

      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {riffs === null && !error && <p className="text-muted">Loading riffs…</p>}

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {shown.map((r) => (
          <li key={r.id} className="surface flex min-w-0 flex-col p-5" data-testid={`riff-${r.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold leading-tight">{r.title}</h2>
                <p className="mt-1 text-sm text-muted">{r.credit}</p>
                {r.vibe && <p className="mt-2"><span className="chip bg-next/15 text-next" data-testid={`vibe-${r.id}`}>{r.vibe}</span></p>}
              </div>
              <span className="chip shrink-0" title={`${r.bars} bars, ${r.note_count} notes`}>{LEVEL_LABEL[r.difficulty]}</span>
            </div>
            <p className="mt-3 text-sm text-muted">
              {GENRE_LABEL[r.genre]}, {r.key_name}, {Math.round(r.tempo_bpm)} BPM, {r.bars} bars
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="What it practises">
              {r.focus.map((f) => <li key={f} className="chip">{f}</li>)}
            </ul>
            <pre className="scroll-x mt-4 max-w-full rounded-xl bg-tolex p-3 text-[0.7rem] leading-[1.35] text-ink/90" aria-label={`TAB for ${r.title}`}>
              {r.tab_preview}
            </pre>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <button className="btn btn-primary" onClick={() => practise(r)} disabled={!!busy} data-testid={`practise-${r.id}`}>
                {busy === `practise-${r.id}` ? "Setting up…" : "Practise this riff"}
              </button>
              <button className="btn btn-quiet" onClick={() => listen(r)} disabled={busy === `listen-${r.id}`} aria-pressed={playing === r.id}>
                {playing === r.id ? <IconStop width={18} /> : <IconPlay width={18} />} {playing === r.id ? "Stop" : "Listen"}
              </button>
            </div>
          </li>
        ))}
        {riffs && (
          <li className="surface flex flex-col justify-between gap-4 p-5 lg:col-span-2 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold">A riff from a song you love</h2>
              <p className="mt-1 text-muted leading-relaxed">
                Riffs from copyrighted songs aren&apos;t included here. Hum or whistle the riff instead — Music Decoder writes it out
                for you, adds a band, and you can practise it with all the same tools.
              </p>
            </div>
            <Link href="/record" className="btn btn-primary shrink-0"><IconMic width={18} /> Hum a riff</Link>
          </li>
        )}
      </ul>
      {riffs && shown.length === 0 && <p className="mt-4 text-muted">No riffs match these filters.</p>}
    </div>
  );
}

function FilterChips<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map(([v, l]) => (
          <button key={String(v)} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className={`chip ${value === v ? "bg-maple text-tolex" : ""}`}>{l}</button>
        ))}
      </div>
    </div>
  );
}
