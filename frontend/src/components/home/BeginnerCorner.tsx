"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconPlay, IconStop } from "@/components/Icons";
import { clearHighlights, setHighlight } from "@/components/theory/highlight";
import { BEGINNER_LESSONS, exerciseExample, type BeginnerTab } from "@/lib/music/beginnerTechniques";
import { getTheoryPlayer } from "@/lib/theory/player";

/**
 * Home page "Beginner corner": how to strum, pick and pluck, each with an illustration,
 * four steps and a short exercise that plays and lights up in sync.
 */
export function BeginnerCorner() {
  const [tab, setTab] = useState<BeginnerTab>("strum");
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const runRef = useRef(0);
  const lesson = BEGINNER_LESSONS.find((l) => l.id === tab)!;

  const stop = () => {
    runRef.current++;
    getTheoryPlayer().stop();
    clearHighlights(rootRef.current);
    setPlaying(false);
  };

  useEffect(() => () => {
    getTheoryPlayer().stop();
    clearHighlights(rootRef.current);
  }, []);

  const play = async () => {
    if (playing) { stop(); return; }
    const run = ++runRef.current;
    setPlaying(true);
    await getTheoryPlayer().play(exerciseExample(lesson.exercise, slow ? 0.7 : 1), (id, on) => setHighlight(rootRef.current, id, on));
    if (runRef.current === run) setPlaying(false);
  };

  const choose = (id: BeginnerTab) => {
    if (id === tab) return;
    stop();
    setTab(id);
  };

  const slots = lesson.exercise.slots;

  return (
    <aside ref={rootRef} className="surface p-4 sm:p-5" aria-labelledby="beginner-corner-title" data-testid="beginner-corner">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted">Beginner corner</p>
      <h2 id="beginner-corner-title" className="display mt-1 text-[1.6rem]">Strum, pick or pluck</h2>

      <div role="tablist" aria-label="Playing technique" className="mt-3 flex rounded-full bg-panel-2 p-1">
        {BEGINNER_LESSONS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            id={`bc-tab-${l.id}`}
            aria-selected={tab === l.id}
            aria-controls="bc-panel"
            data-testid={`beginner-tab-${l.id}`}
            onClick={() => choose(l.id)}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition ${tab === l.id ? "bg-maple text-tolex" : "text-muted hover:text-ink"}`}
          >
            {l.tab}
          </button>
        ))}
      </div>

      <div id="bc-panel" role="tabpanel" aria-labelledby={`bc-tab-${tab}`} className="mt-4">
        <figure className="overflow-hidden rounded-xl bg-tolex">
          {tab === "strum" && <StrumArt />}
          {tab === "pick" && <PickArt />}
          {tab === "fingers" && <FingersArt />}
          <figcaption className="px-3 pb-2.5 text-[0.8rem] leading-snug text-muted">{lesson.caption}</figcaption>
        </figure>

        <h3 className="mt-4 text-lg font-bold">{lesson.title}</h3>
        <p className="mt-1 text-[0.95rem] leading-relaxed text-muted">{lesson.summary}</p>

        <ol className="mt-3 grid gap-2.5" data-testid="beginner-steps">
          {lesson.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[0.92rem] leading-snug">
              <span className="display mt-0.5 w-4 shrink-0 text-base text-next" aria-hidden>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-xl bg-panel-2 p-3" data-testid="beginner-exercise">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-bold tracking-wide">{lesson.exercise.title}</p>
            <p className="shrink-0 text-xs text-muted">{Math.round(lesson.exercise.bpm * (slow ? 0.7 : 1))} BPM</p>
          </div>
          <p className="mt-0.5 text-[0.85rem] text-muted">{lesson.exercise.sub}</p>
          <div className="mt-2.5 grid grid-cols-8 gap-1" aria-label="Pattern">
            {slots.map((s, i) => (
              <div
                key={i}
                data-hl={`slot-${i}`}
                className={`bc-slot flex flex-col items-center rounded-md py-1 ${s.mark ? "bg-tolex" : "bg-tolex/40"}`}
              >
                <span className={`text-base font-extrabold leading-tight ${s.mark ? "" : "text-faint"}`}>{s.mark || "·"}</span>
                <span className="text-[0.62rem] leading-tight text-muted">{s.note ?? s.count}</span>
              </div>
            ))}
          </div>
          {slots.some((s) => s.note) && (
            <p className="mt-1.5 text-[0.72rem] text-faint">Small letters: string{tab === "pick" ? " and fret" : ""}. Count: {slots.slice(0, 8).map((s) => s.count).join(" ")}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={play} aria-pressed={playing} data-testid="beginner-play">
              {playing ? <IconStop width={16} height={16} /> : <IconPlay width={16} height={16} />}
              {playing ? "Stop" : "Hear it"}
            </button>
            <button type="button" className={`btn btn-sm ${slow ? "btn-primary" : "btn-quiet"}`} aria-pressed={slow} onClick={() => { stop(); setSlow((v) => !v); }}>
              Slow (70%)
            </button>
          </div>
        </div>

        <p className="mt-3 text-[0.85rem] leading-relaxed text-muted"><span className="font-semibold text-ink">Tip: </span>{lesson.tip}</p>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ illustrations */

const SKIN = "#d9a37f";
const SKIN_DARK = "#b9825f";
const STRING_Y = (s: number) => 40 + (6 - s) * 22; // player's view: low E (6) on top
const GAUGE: Record<number, number> = { 1: 1.1, 2: 1.4, 3: 1.8, 4: 2.2, 5: 2.6, 6: 3 };
const LETTERS: Record<number, string> = { 1: "e", 2: "B", 3: "G", 4: "D", 5: "A", 6: "E" };

function Art({ label, children, inset }: { label: string; children: ReactNode; inset: ReactNode }) {
  return (
    <svg viewBox="0 0 360 192" role="img" aria-label={label} className="block w-full select-none">
      <defs>
        <marker id="bc-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M1 1L9 5L1 9z" fill="context-stroke" />
        </marker>
      </defs>
      {/* guitar top, sound hole, end of the fretboard */}
      <rect x="114" y="18" width="246" height="156" fill="#6b4a33" />
      <circle cx="214" cy="95" r="58" fill="#141416" stroke="#e9ddc3" strokeOpacity="0.5" strokeWidth="4" />
      <circle cx="214" cy="95" r="66" fill="none" stroke="#e9ddc3" strokeOpacity="0.25" strokeWidth="2" />
      <rect x="114" y="26" width="46" height="138" fill="#4a2e1f" />
      <line x1="160" y1="26" x2="160" y2="164" stroke="#c9c3b6" strokeWidth="3" />
      {[1, 2, 3, 4, 5, 6].map((s) => (
        <g key={s}>
          <line className="bc-str" data-hl={`str-${s}`} x1="114" y1={STRING_Y(s)} x2="360" y2={STRING_Y(s)}
            stroke={s >= 4 ? "#cdb98e" : "#dcd6ca"} strokeWidth={GAUGE[s]} />
          <text x="126" y={STRING_Y(s) - 4} fontSize="9" fill="#e9ddc3" fontWeight="700">{LETTERS[s]}</text>
        </g>
      ))}
      <g>{inset}</g>
      {children}
    </svg>
  );
}

function Inset({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <rect x="6" y="18" width="100" height="156" rx="12" fill="#2c2f34" />
      <text x="56" y="36" textAnchor="middle" fontSize="10" fontWeight="700" fill="#a7a196" letterSpacing="1">{title.toUpperCase()}</text>
      {children}
    </>
  );
}

function StrumArt() {
  return (
    <Art
      label="Strumming: hold the pick between thumb and index finger, strum down across all six strings and up across the top four, over the sound hole"
      inset={
        <Inset title="Grip">
          <rect x="16" y="86" width="80" height="26" rx="13" fill={SKIN_DARK} />
          <path d="M40 98 L84 98 Q86 99 85 101 L64 140 Q62 143 60 140 L39 101 Q38 99 40 98 Z" fill="#f3ae3d" />
          <ellipse cx="62" cy="94" rx="27" ry="14" fill={SKIN} stroke={SKIN_DARK} strokeWidth="1.5" />
          <text x="62" y="70" textAnchor="middle" fontSize="10" fill="#eee8dc">thumb on top</text>
          <text x="22" y="125" fontSize="9" fill="#a7a196">index</text>
          <line x1="84" y1="122" x2="84" y2="141" stroke="#eee8dc" strokeWidth="1" />
          <line x1="80" y1="122" x2="88" y2="122" stroke="#eee8dc" strokeWidth="1" />
          <line x1="80" y1="141" x2="88" y2="141" stroke="#eee8dc" strokeWidth="1" />
          <text x="56" y="160" textAnchor="middle" fontSize="10" fill="#eee8dc">2–3 mm showing</text>
        </Inset>
      }
    >
      <g className="bc-arrow" data-hl="dir-down" stroke="#e9ddc3">
        <line x1="290" y1="28" x2="290" y2="160" strokeWidth="5" strokeLinecap="round" markerEnd="url(#bc-head)" />
        <text x="290" y="182" textAnchor="middle" fontSize="13" fontWeight="800" fill="currentColor" stroke="none">D</text>
      </g>
      <g className="bc-arrow" data-hl="dir-up" stroke="#e9ddc3">
        <line x1="330" y1="160" x2="330" y2="80" strokeWidth="5" strokeLinecap="round" markerEnd="url(#bc-head)" />
        <text x="330" y="182" textAnchor="middle" fontSize="13" fontWeight="800" fill="currentColor" stroke="none">U</text>
      </g>
    </Art>
  );
}

function PickArt() {
  return (
    <Art
      label="Picking: the side of the palm rests on the bridge; the pick plays one string with small down and up strokes"
      inset={
        <Inset title="Strokes">
          <g className="bc-hl" data-hl="dir-down" color="#eee8dc">
            <text x="30" y="84" fontSize="28" fontWeight="800" fill="currentColor">⊓</text>
            <text x="62" y="80" fontSize="11" fill="currentColor">down</text>
          </g>
          <g className="bc-hl" data-hl="dir-up" color="#eee8dc">
            <text x="31" y="132" fontSize="26" fontWeight="800" fill="currentColor">V</text>
            <text x="62" y="126" fontSize="11" fill="currentColor">up</text>
          </g>
          <text x="56" y="160" textAnchor="middle" fontSize="9.5" fill="#a7a196">down on the beat</text>
        </Inset>
      }
    >
      {/* bridge + resting palm */}
      <rect x="320" y="26" width="14" height="138" rx="3" fill="#1d1d20" />
      <line x1="327" y1="26" x2="327" y2="164" stroke="#e9ddc3" strokeWidth="2" />
      <path d="M318 70 Q306 120 322 176 L360 176 L360 60 Q336 56 318 70 Z" fill={SKIN} fillOpacity="0.92" stroke={SKIN_DARK} />
      <text x="341" y="190" textAnchor="middle" fontSize="9" fill="#a7a196">palm</text>
      {/* pick on the A string, slightly angled */}
      <g transform="rotate(-15 262 52)">
        <path d="M246 30 L278 30 Q281 31 279 34 L264 60 Q262 63 260 60 L245 34 Q243 31 246 30 Z" fill="#f3ae3d" />
      </g>
      <g className="bc-arrow" data-hl="dir-down" stroke="#e9ddc3">
        <line x1="232" y1="34" x2="232" y2="74" strokeWidth="3.5" strokeLinecap="round" markerEnd="url(#bc-head)" />
        <text x="220" y="30" fontSize="14" fontWeight="800" fill="currentColor" stroke="none">⊓</text>
      </g>
      <g className="bc-arrow" data-hl="dir-up" stroke="#e9ddc3">
        <line x1="296" y1="76" x2="296" y2="38" strokeWidth="3.5" strokeLinecap="round" markerEnd="url(#bc-head)" />
        <text x="292" y="92" fontSize="13" fontWeight="800" fill="currentColor" stroke="none">V</text>
      </g>
    </Art>
  );
}

function FingersArt() {
  const fingers: { f: "i" | "m" | "a"; s: number; x: number }[] = [
    { f: "i", s: 3, x: 262 }, { f: "m", s: 2, x: 276 }, { f: "a", s: 1, x: 290 },
  ];
  return (
    <Art
      label="Fingerstyle: thumb p on the E, A and D strings; index i on G, middle m on B, ring a on high e"
      inset={
        <Inset title="Fingers">
          {([["p", "thumb", "E A D"], ["i", "index", "G"], ["m", "middle", "B"], ["a", "ring", "e"]] as const).map(([f, name, strs], k) => (
            <g key={f} className="bc-hl" data-hl={`fin-${f}`} color="#eee8dc">
              <text x="18" y={62 + k * 26} fontSize="16" fontWeight="800" fill="currentColor">{f}</text>
              <text x="40" y={57 + k * 26} fontSize="9.5" fill="currentColor">{name}</text>
              <text x="40" y={68 + k * 26} fontSize="9" fill="#a7a196">{strs}</text>
            </g>
          ))}
        </Inset>
      }
    >
      <g className="bc-fin" data-hl="fin-p">
        <rect x="222" y="28" width="24" height="68" rx="12" fill={SKIN} stroke={SKIN_DARK} />
        <text x="234" y="66" textAnchor="middle" fontSize="13" fontWeight="800" fill="#1a1b1e">p</text>
      </g>
      {fingers.map(({ f, s, x }) => (
        <g key={f} className="bc-fin" data-hl={`fin-${f}`}>
          <circle cx={x} cy={STRING_Y(s)} r="10.5" fill={SKIN} stroke={SKIN_DARK} />
          <text x={x} y={STRING_Y(s) + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#1a1b1e">{f}</text>
        </g>
      ))}
      <g stroke="#e9ddc3">
        <line x1="208" y1="48" x2="208" y2="94" strokeWidth="3" strokeLinecap="round" markerEnd="url(#bc-head)" />
        <line x1="316" y1="156" x2="316" y2="112" strokeWidth="3" strokeLinecap="round" markerEnd="url(#bc-head)" />
      </g>
      <text x="192" y="110" fontSize="9" fill="#eee8dc">push</text>
      <text x="304" y="174" fontSize="9" fill="#eee8dc">pull up</text>
    </Art>
  );
}
