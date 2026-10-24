"use client";

import { useEffect, useMemo, useState } from "react";
import { Notice, PageTitle } from "@/components/AppShell";
import { LessonContent } from "@/components/LessonContent";
import { ReadAloudFloat } from "@/components/ReadAloudFloat";
import { ScaleFretmapFloat } from "@/components/ScaleFretmapFloat";
import { api } from "@/lib/api";
import { LESSONS, lessonSpeakText } from "@/lib/music/lessons";
import { useApp, useHydrated } from "@/lib/store";
import type { PracticeSessionRecord, ProgressSummary, Skill } from "@/lib/types";

const MODE: Record<string, string> = { follow_me: "Follow me", play_with_band: "With the band", manual: "Step by step (not listening)" };

export default function ProgressPage() {
  const hydrated = useHydrated();
  const local = useApp((s) => s.recentSessions);
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);
  const [data, setData] = useState<{ progress: ProgressSummary; history: PracticeSessionRecord[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [floatOpen, setFloatOpen] = useState(false);
  const [fretmapOpen, setFretmapOpen] = useState(false);

  useEffect(() => {
    api.progress().then(setData).catch((e) => setError(e.message));
  }, []);

  const selectedLesson = useMemo(
    () => (selectedId ? LESSONS.find((l) => l.id === selectedId) ?? null : null),
    [selectedId],
  );

  if (!hydrated) return null;
  const dev = prefs.developerMode;
  const achieved = new Set(
    dev
      ? (data?.progress.skills.map((s) => s.key) ?? LESSONS.map((l) => l.unlockedBy).filter(Boolean) as string[])
      : (data?.progress.skills.filter((s) => s.achieved).map((s) => s.key) ?? []),
  );
  const skills: Skill[] = (data?.progress.skills ?? []).map((s) => (
    dev ? { ...s, achieved: true, progress: 1 } : s
  ));
  const history = data?.history ?? local;

  const selectLesson = (id: string) => {
    const lesson = LESSONS.find((l) => l.id === id);
    if (lesson?.detailHref) {
      window.open(lesson.detailHref, "_blank", "noopener,noreferrer");
      return;
    }
    if (selectedId === id && floatOpen) {
      setFloatOpen(false);
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    setFloatOpen(true);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="My progress" lead="Skills only count when the microphone heard you play them." />
      {error && <div className="mb-4"><Notice tone="warn">{error} Showing practice saved on this device.</Notice></div>}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel px-4 py-3" data-testid="developer-mode">
        <div>
          <p className="font-semibold">Developer mode</p>
          <p className="text-sm text-muted">Unlocks every lesson and marks all skills complete (this browser only).</p>
        </div>
        <button
          type="button"
          className={`btn btn-sm ${dev ? "btn-primary" : "btn-quiet"}`}
          aria-pressed={dev}
          data-testid="toggle-developer-mode"
          onClick={() => setPrefs({ developerMode: !dev })}
        >
          {dev ? "On — all unlocked" : "Off"}
        </button>
      </div>

      {(data || dev) && (
        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">Skills</h2>
              <p className="text-sm text-muted">
                {dev ? "Developer unlock" : `${data?.progress.practice_minutes ?? 0} minutes practised in ${data?.progress.sessions ?? 0} sessions`}
              </p>
            </div>
            {!dev && data?.progress.next_skill && <p className="mt-2 text-sm">Next up: <span className="font-semibold">{data.progress.next_skill}</span></p>}
            {dev && <p className="mt-2 text-sm text-ok">All skills unlocked for testing.</p>}
            <ul className="mt-4 grid gap-3" data-testid="skills">
              {skills.map((s) => (
                <li key={s.key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={s.achieved ? "text-ok font-semibold" : ""}>{s.achieved ? "✓ " : ""}{s.label}</span>
                    <span className="text-sm text-muted">{Math.round(s.progress * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-tolex" role="progressbar" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={s.label}>
                    <div className={`h-full rounded-full ${s.achieved ? "bg-ok" : "bg-maple"}`} style={{ width: `${s.progress * 100}%` }} />
                  </div>
                  {!s.achieved && <p className="mt-1 text-xs text-faint">{s.how}</p>}
                </li>
              ))}
            </ul>
          </div>

          <div className="surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">Why it works</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-quiet"
                  data-testid="progress-fretmap"
                  onClick={() => setFretmapOpen(true)}
                >
                  Fretboard map
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${prefs.autoReadAloud ? "btn-primary" : "btn-quiet"}`}
                  aria-pressed={prefs.autoReadAloud}
                  data-testid="progress-auto-read"
                  onClick={() => setPrefs({ autoReadAloud: !prefs.autoReadAloud })}
                >
                  Auto read {prefs.autoReadAloud ? "On" : "Off"}
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted">
              {dev
                ? "Developer mode: every topic is open. Some open a full guide tab; others use the read-aloud overlay."
                : "Short ideas behind what you\u2019re playing. New ones open as your skills grow. “Open guide” starts a clearer page in a new tab."}
            </p>
            <ul className="mt-4 grid gap-2">
              {LESSONS.map((l) => {
                const unlocked = dev || !l.unlockedBy || achieved.has(l.unlockedBy);
                const isOpen = floatOpen && selectedId === l.id;
                const label = !unlocked ? "Locked" : l.detailHref ? "Open guide" : isOpen ? "Close" : "Read";
                return (
                  <li key={l.id} className={`rounded-xl bg-tolex ${isOpen ? "ring-1 ring-maple/60" : ""}`}>
                    <button
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left disabled:text-faint"
                      disabled={!unlocked}
                      onClick={() => selectLesson(l.id)}
                      aria-expanded={l.detailHref ? undefined : isOpen}
                      aria-controls={!l.detailHref && isOpen ? "read-aloud-float" : undefined}
                    >
                      <span>{l.title}</span>
                      <span className="text-xs text-muted">{label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-6 surface p-5">
        <h2 className="text-lg font-bold">Practice history</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-muted">No practice yet. Open a song in Guitar learning and press Follow me.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {history.slice(0, 20).map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span>{MODE[s.result.mode]} · {s.result.part === "solo" ? "solo" : "melody"} at {Math.round(s.result.tempo_factor * 100)}% speed</span>
                <span className="text-muted">{Math.round(s.accuracy * 100)}% right · {new Date(s.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ReadAloudFloat
        open={floatOpen && !!selectedLesson}
        onOpenChange={(next) => {
          setFloatOpen(next);
          if (!next) setSelectedId(null);
        }}
        selection={
          selectedLesson
            ? {
                id: selectedLesson.id,
                title: selectedLesson.title,
                speakText: lessonSpeakText(selectedLesson),
                children: <LessonContent lesson={selectedLesson} />,
              }
            : null
        }
      />

      <ScaleFretmapFloat open={fretmapOpen} onOpenChange={setFretmapOpen} />
    </div>
  );
}
