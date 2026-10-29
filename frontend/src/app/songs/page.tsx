"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Notice, PageTitle } from "@/components/AppShell";
import { IconSearch } from "@/components/Icons";
import { SongDetail, type Picked } from "@/components/songs/SongDetail";
import { api } from "@/lib/api";
import { keyShort, parseKey, searchSongbook, SONGBOOK, type OnlineSearch } from "@/lib/music/songSearch";

const EXAMPLES = ["Amazing Grace", "House of the Rising Sun", "Canon in D", "Jingle Bells"];

export default function SongsPage() {
  return (
    <Suspense fallback={null}>
      <SongSearch />
    </Suspense>
  );
}

type Online = { q: string; status: "idle" | "loading" | "done" | "error"; data?: OnlineSearch; error?: string };

function SongSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const urlQ = params.get("q") ?? "";
  const [text, setText] = useState(urlQ);
  const [query, setQuery] = useState(urlQ);
  const [online, setOnline] = useState<Online>({ q: "", status: "idle" });
  const [picked, setPicked] = useState<Picked | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // The sidebar search (or a shared link) changes ?q=.
  useEffect(() => { setText(urlQ); setQuery(urlQ); }, [urlQ]);

  const local = useMemo(() => searchSongbook(text), [text]);
  const results = useMemo(() => searchSongbook(query), [query]);

  // Online lookup: after a pause in typing, or straight away on submit.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setOnline({ q: "", status: "idle" }); return; }
    const ac = new AbortController();
    setOnline({ q, status: "loading" });
    api.songSearch(q, { signal: ac.signal })
      .then((data) => setOnline({ q, status: "done", data }))
      .catch((e: Error) => { if (!ac.signal.aborted) setOnline({ q, status: "error", error: e.message }); });
    return () => ac.abort();
  }, [query]);
  useEffect(() => {
    const t = setTimeout(() => { if (text.trim().length >= 3 && text !== query) setQuery(text); }, 700);
    return () => clearTimeout(t);
  }, [text, query]);

  // Show the best songbook match straight away (same rule as pressing Enter).
  useEffect(() => {
    if (results[0] && results[0].score >= 60) setPicked({ kind: "songbook", song: results[0].song });
  }, [results]);

  const submit = (e?: FormEvent, value = text) => {
    e?.preventDefault();
    const q = value.trim();
    setOpen(false);
    setQuery(q);
    router.replace(q ? `${path}?q=${encodeURIComponent(q)}` : path, { scroll: false });
    const best = searchSongbook(q)[0];
    if (best && best.score >= 60) choose({ kind: "songbook", song: best.song });
  };
  const choose = (p: Picked) => {
    setPicked(p);
    setOpen(false);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const onlineHits = online.data?.results ?? [];
  const showResults = query.trim().length >= 2;

  return (
    <div className="mx-auto max-w-5xl space-y-6" data-testid="songs-page">
      <PageTitle title="Song search" lead="Type a song title to get its key, its scale and the chords to play." />

      <form role="search" onSubmit={submit} className="relative" data-testid="song-search-form">
        <label htmlFor="song-q" className="sr-only">Song title</label>
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-4 py-2 focus-within:border-ink">
          <IconSearch />
          <input
            ref={inputRef} id="song-q" type="search" autoComplete="off" spellCheck={false}
            placeholder="Song title, e.g. Amazing Grace" value={text}
            className="min-w-0 flex-1 bg-transparent py-2 text-[1.1rem] outline-none placeholder:text-faint"
            role="combobox" aria-expanded={open && local.length > 0} aria-controls="song-suggest" aria-autocomplete="list"
            aria-activedescendant={open && local[active] ? `sug-${local[active]!.song.id}` : undefined}
            onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (!open || !local.length) return;
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % local.length); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + local.length) % local.length); }
              if (e.key === "Enter" && local[active] && active > 0) { e.preventDefault(); submit(undefined, local[active]!.song.title); }
              if (e.key === "Escape") setOpen(false);
            }}
            data-testid="song-search-input"
          />
          <button type="submit" className="btn btn-primary btn-sm" data-testid="song-search-go">Search</button>
        </div>
        {open && local.length > 0 && (
          <ul id="song-suggest" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-line bg-panel shadow-xl" data-testid="song-suggestions">
            {local.map((r, i) => (
              <li key={r.song.id} id={`sug-${r.song.id}`} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setText(r.song.title); submit(undefined, r.song.title); }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${i === active ? "bg-panel-2" : ""}`}>
                  <span><span className="font-bold">{r.song.title}</span> <span className="text-sm text-muted">· {r.song.credit}</span></span>
                  <span className="chip text-xs">{keyShort(r.song.key)} · chords</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {!showResults && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Try:</span>
          {EXAMPLES.map((x) => (
            <button key={x} type="button" className="chip hover:bg-panel-2" onClick={() => { setText(x); submit(undefined, x); }} data-testid={`song-example-${x}`}>{x}</button>
          ))}
        </div>
      )}

      {showResults && (
        <section className="grid gap-4 md:grid-cols-2" aria-label="Results" data-testid="song-results">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Songbook · full chords</h2>
            {results.length ? (
              <ul className="mt-2 space-y-1.5" data-testid="song-results-songbook">
                {results.map((r) => (
                  <li key={r.song.id}>
                    <ResultRow title={r.song.title} sub={r.song.credit} keyText={keyShort(r.song.key)} badge="Chords"
                      on={picked?.kind === "songbook" && picked.song.id === r.song.id} onClick={() => choose({ kind: "songbook", song: r.song })} testId={`song-result-${r.song.id}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Not in the songbook. It has {SONGBOOK.length} public-domain songs with full chord charts.</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Online · key and tempo</h2>
            <div className="mt-2" data-testid="song-results-online" data-status={online.status}>
              {online.status === "loading" && <p className="text-sm text-muted">Looking up “{online.q}”…</p>}
              {online.status === "error" && <Notice tone="warn">{online.error}</Notice>}
              {online.status === "done" && online.data && !online.data.configured && (
                <p className="text-sm text-muted" data-testid="song-online-off">
                  Online lookup is off. In <code>backend/.env</code> set <code>GETSONGBPM_API_KEY</code> from{" "}
                  <a href="https://getsongbpm.com/api" target="_blank" rel="noopener noreferrer" className="underline">getsongbpm.com/api</a>
                  , then restart the backend. Optional: <code>HOOKTHEORY_USERNAME</code> / <code>HOOKTHEORY_PASSWORD</code> for TheoryTab examples.
                </p>
              )}
              {online.status === "done" && online.data?.configured && !onlineHits.length && <p className="text-sm text-muted">No songs found online for “{online.q}”.</p>}
              {onlineHits.length > 0 && (
                <ul className="space-y-1.5">
                  {onlineHits.map((s) => {
                    const k = parseKey(s.key);
                    return (
                      <li key={s.id || s.title + s.artist}>
                        <ResultRow title={s.title} sub={s.artist} keyText={k ? keyShort(k) : "?"} badge={s.tempo ? `${s.tempo} BPM` : "Key"}
                          on={picked?.kind === "online" && picked.song.id === s.id && picked.song.title === s.title}
                          onClick={() => choose({ kind: "online", song: s, key: k, source: online.data!.source })} testId={`song-online-${s.id}`} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <div ref={detailRef} className="scroll-mt-4">
        {picked && <SongDetail picked={picked} />}
      </div>
    </div>
  );
}

function ResultRow({ title, sub, keyText, badge, on, onClick, testId }: {
  title: string; sub: string; keyText: string; badge: string; on: boolean; onClick: () => void; testId: string;
}) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} aria-pressed={on}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:bg-panel-2 ${on ? "border-next bg-panel-2" : "border-line"}`}>
      <span className="display w-12 shrink-0 text-center text-xl">{keyText}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      <span className="chip shrink-0 text-xs">{badge}</span>
    </button>
  );
}
