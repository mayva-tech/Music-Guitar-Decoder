"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Notice, PageTitle } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useApp } from "@/lib/store";
import type { ArrangementSummary } from "@/lib/types";

const LEVEL: Record<string, string> = { zero: "First steps", few_notes: "A few notes", basic_chords: "Basic chords", intermediate: "Intermediate", advanced: "Advanced" };

export default function LibraryPage() {
  const router = useRouter();
  const setArrangement = useApp((s) => s.setArrangement);
  const current = useApp((s) => s.arrangement);
  const [items, setItems] = useState<ArrangementSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(() => {
    api.arrangements().then(setItems).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const open = async (id: string) => {
    try {
      setArrangement(await api.arrangement(id));
      router.push("/learn");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const rename = async (id: string) => {
    try {
      const a = await api.rename(id, name);
      if (current?.id === id) setArrangement(a);
      setEditing(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (s: ArrangementSummary) => {
    if (!window.confirm(`Delete “${s.title}” and its practice history? This can't be undone.`)) return;
    try {
      await api.remove(s.id);
      if (current?.id === s.id) setArrangement(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Song library" lead="Every guitar part you make is saved here on your own server." />
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      {items === null && !error && <p className="text-muted">Loading your songs…</p>}
      {items?.length === 0 && (
        <div className="surface p-6">
          <p className="text-muted">No songs yet. Decode a tune and press “Make my guitar part” to save one.</p>
          <Link href="/record" className="btn btn-primary mt-4">Record a melody</Link>
        </div>
      )}
      <ul className="grid gap-2">
        {items?.map((s) => (
          <li key={s.id} className="surface flex flex-wrap items-center gap-3 p-4" data-testid="library-item">
            <div className="min-w-0 flex-1">
              {editing === s.id ? (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void rename(s.id); }}>
                  <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} aria-label="Song name" />
                  <button className="btn btn-primary btn-sm">Save name</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <h2 className="text-lg font-bold truncate">{s.title}</h2>
                  <p className="text-sm text-muted">
                    {s.key}, {Math.round(s.tempo_bpm)} BPM, {s.total_bars} bars. {s.harmonization} chords, {LEVEL[s.skill_level]}.{" "}
                    {s.source === "demo" ? "Demo tune." : ""} Made {new Date(s.created_at).toLocaleDateString()}.
                  </p>
                </>
              )}
            </div>
            {editing !== s.id && (
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => open(s.id)}>Practise</button>
                <button className="btn btn-quiet btn-sm" onClick={() => { setEditing(s.id); setName(s.title); }}>Rename</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(s)}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
