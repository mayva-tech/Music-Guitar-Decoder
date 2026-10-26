"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { CagedNeck, type CagedView } from "@/components/caged/CagedNeck";
import { MiniBox, ShapeChordBox } from "@/components/caged/CagedDiagrams";
import { RootHunt } from "@/components/caged/RootHunt";
import { IconPlay, IconStop } from "@/components/Icons";
import { clearHighlights, setHighlight } from "@/components/theory/highlight";
import {
  CAGED_ORDER, CAGED_SHAPES, MEMORY_STEPS, OCTAVE_RULES, boxExample, cagedKey, cagedPositions, pcName, pentaPcs,
  shapeExample, type CagedShapeId, type KeyMode,
} from "@/lib/music/caged";
import { useHydrated } from "@/lib/store";
import { getTheoryPlayer } from "@/lib/theory/player";
import type { TheoryExample } from "@/lib/theory/content";

const VIEWS: { id: CagedView; label: string }[] = [
  { id: "both", label: "Shapes + boxes" },
  { id: "chords", label: "Chord shapes" },
  { id: "boxes", label: "Scale boxes" },
  { id: "roots", label: "Roots + octaves" },
];
const KEYS = Array.from({ length: 12 }, (_, pc) => pc);
const nice = (pc: number) => pcName(pc).replace("#", "♯");

export default function CagedPage() {
  const hydrated = useHydrated();
  const [tonic, setTonic] = useState(0);
  const [mode, setMode] = useState<KeyMode>("major");
  const [selected, setSelected] = useState<CagedShapeId | "all">("all");
  const [view, setView] = useState<CagedView>("both");
  const [labels, setLabels] = useState<"degree" | "note">("degree");
  const [fullNeck, setFullNeck] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const neckRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef(0);

  const key = useMemo(() => cagedKey(tonic, mode), [tonic, mode]);
  const frets = fullNeck ? 22 : 15;
  const positions = useMemo(() => cagedPositions(key, frets), [key, frets]);
  // One of each shape, in the order they appear from the nut.
  const chain = useMemo(() => {
    const seen = new Set<CagedShapeId>();
    return positions.filter((p) => !seen.has(p.shape) && seen.add(p.shape));
  }, [positions]);
  const focus = selected === "all" ? null : chain.find((p) => p.shape === selected) ?? null;

  const stop = () => {
    runRef.current++;
    getTheoryPlayer().stop();
    clearHighlights(rootRef.current);
    setPlaying(null);
  };
  useEffect(() => () => { getTheoryPlayer().stop(); clearHighlights(rootRef.current); }, []);

  const play = async (id: string, ex: TheoryExample) => {
    if (playing === id) { stop(); return; }
    stop();
    const run = ++runRef.current;
    setPlaying(id);
    await getTheoryPlayer().play(ex, (h, on) => setHighlight(rootRef.current, h, on));
    if (runRef.current === run) setPlaying(null);
  };

  // Keep the focused shape in view on narrow screens (the neck scrolls sideways).
  useEffect(() => {
    const box = neckRef.current;
    if (!box || selected === "all") return;
    const el = box.querySelector(`[data-band="${selected}"]`);
    if (!el) return;
    const c = box.getBoundingClientRect(), b = el.getBoundingClientRect();
    box.scrollTo({ left: box.scrollLeft + (b.left + b.width / 2) - (c.left + c.width / 2), behavior: "smooth" });
  }, [selected, positions]);

  const choose = (id: CagedShapeId | "all") => { stop(); setSelected(id); };
  const showOnNeck = (v: CagedView, id: CagedShapeId | "all" = "all") => {
    choose(id);
    setView(v);
    neckRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const step = (dir: 1 | -1) => {
    if (!focus) return;
    const i = CAGED_ORDER.indexOf(focus.shape);
    choose(CAGED_ORDER[(i + dir + 5) % 5]!);
  };

  if (!hydrated) return null;

  const scale = pentaPcs(key).map(nice);
  const PlayIcon = ({ id }: { id: string }) => (playing === id ? <IconStop /> : <IconPlay />);

  return (
    <div ref={rootRef} className="mx-auto max-w-6xl" data-testid="caged-page">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href="/learn" className="text-muted hover:text-ink">← Guitar learning</Link>
        <span className="text-faint">·</span>
        <span className="text-muted">CAGED &amp; pentatonic map</span>
      </div>
      <PageTitle
        title="CAGED & pentatonic map"
        lead="Five chord shapes, five scale boxes, one neck. Learn where each one sits and how they link, and you can play and solo anywhere on the guitar."
      />

      <section className="surface p-4 md:p-5" aria-label="The idea">
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            ["Five shapes", "Every major chord can be played in five shapes, named after the open chords C, A, G, E and D."],
            ["One loop", "Move up the neck in C-A-G-E-D order and the shapes lock together like puzzle pieces. After D comes C again, 12 frets higher."],
            ["A box around each", "Each shape sits inside one pentatonic box. Learn the chord, and the box around it is the scale to solo with."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="display text-2xl text-faint" aria-hidden>{i + 1}</span>
              <div><h2 className="font-bold">{t}</h2><p className="mt-0.5 text-sm leading-relaxed text-muted">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------ controls + neck */}
      <section className="mt-5 surface p-4 md:p-5" aria-label="Fretboard map">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Key</span>
            <select className="rounded-lg border border-line bg-panel-2 px-2 py-1.5 text-ink" value={tonic}
              onChange={(e) => { stop(); setTonic(Number(e.target.value)); }} data-testid="caged-key">
              {KEYS.map((pc) => <option key={pc} value={pc}>{nice(pc)}</option>)}
            </select>
          </label>
          <div className="flex gap-1 rounded-full bg-panel-2 p-1" role="radiogroup" aria-label="Major or minor">
            {(["major", "minor"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} data-testid={`caged-mode-${m}`}
                className={`rounded-full px-3 py-1 text-sm capitalize ${mode === m ? "bg-ink text-tolex font-bold" : "text-muted"}`}
                onClick={() => { stop(); setMode(m); }}>{m}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 rounded-full bg-panel-2 p-1" role="radiogroup" aria-label="What to show">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={view === v.id} data-testid={`caged-view-${v.id}`}
                className={`rounded-full px-3 py-1 text-sm ${view === v.id ? "bg-ink text-tolex font-bold" : "text-muted"}`}
                onClick={() => setView(v.id)}>{v.label}</button>
            ))}
          </div>
          <div className="flex gap-2 text-sm">
            <button type="button" className="chip" aria-pressed={labels === "note"} onClick={() => setLabels(labels === "degree" ? "note" : "degree")}
              data-testid="caged-labels">{labels === "degree" ? "Show note names" : "Show degrees"}</button>
            <button type="button" className="chip" aria-pressed={fullNeck} onClick={() => setFullNeck(!fullNeck)}
              data-testid="caged-frets">{fullNeck ? "Frets 0–15" : "All 22 frets"}</button>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted" data-testid="caged-key-line">
          <strong className="text-ink">{key.name} pentatonic</strong> · {scale.join(" · ")} ·{" "}
          same notes as <strong className="text-ink">{key.partner.replace("#", "♯")}</strong>
          {mode === "minor" && <> · chord shapes are {nice(key.majorPc)} major, the relative major</>}
        </p>

        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Focus a shape">
          {(["all", ...CAGED_ORDER] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={selected === id} data-testid={`caged-shape-${id}`}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold ${selected === id ? "border-ink bg-panel-2 text-ink" : "border-line text-muted"}`}
              onClick={() => choose(id)}>
              {id !== "all" && <span className="h-3 w-3 rounded-full" style={{ background: CAGED_SHAPES[id].colour }} aria-hidden />}
              {id === "all" ? "All five" : `${id} shape`}
            </button>
          ))}
        </div>

        <div ref={neckRef} className="mt-4 overflow-x-auto rounded-xl bg-tolex p-2" data-testid="caged-neck-scroll">
          <CagedNeck musicKey={key} positions={positions} frets={frets} selected={selected} view={view} labels={labels}
            onSelect={(id) => choose(selected === id ? "all" : id)} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-label="Legend">
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-ok" />Root ({nice(key.tonic)})</li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-maple" />Ring = chord note of the shape</li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-faint bg-panel-2" />Other pentatonic notes</li>
          <li>Coloured bars = where each shape sits. Tap one to focus it.</li>
        </ul>

        {focus ? (
          <div className="mt-4 grid gap-4 rounded-xl border border-line p-4 sm:grid-cols-[132px_minmax(0,1fr)]" data-testid="caged-focus">
            <ShapeChordBox pos={focus} musicKey={key} />
            <div>
              <h3 className="display text-xl">
                <span style={{ color: CAGED_SHAPES[focus.shape].colour }}>{focus.shape} shape</span>
                <span className="text-muted"> · box {focus.boxNo} · frets {focus.lo}–{focus.hi}</span>
              </h3>
              <p className="mt-1 text-sm leading-relaxed">{CAGED_SHAPES[focus.shape].anchor}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                It's the open {focus.shape} chord {focus.offset === 0 ? "itself, right at the nut" : `slid up ${focus.offset} frets, with your index finger playing the nut's job`}.
                The {nice(key.majorPc)} major chord notes (rings) are your safe landing notes inside pentatonic box {focus.boxNo}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-sm" data-testid="caged-play-shape"
                  onClick={() => play("shape", shapeExample(focus, `${focus.shape} shape`))}>
                  <PlayIcon id="shape" /> {playing === "shape" ? "Stop" : "Hear chord, then box"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(-1)}>← {CAGED_ORDER[(CAGED_ORDER.indexOf(focus.shape) + 4) % 5]} shape</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(1)} data-testid="caged-next">{CAGED_ORDER[(CAGED_ORDER.indexOf(focus.shape) + 1) % 5]} shape →</button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Pick a shape above, or tap a coloured bar, to see its chord, fingering and box.</p>
        )}
      </section>

      {/* ------------------------------------------------ chain */}
      <section className="mt-5 surface p-4 md:p-5" aria-labelledby="chain-title">
        <h2 id="chain-title" className="text-lg font-bold">How the shapes link in {nice(key.majorPc)} major</h2>
        <p className="mt-1 text-sm text-muted">
          Left to right is up the neck. Each shape shares a fret or two with the next one, so you're never lost: the top of one shape is the bottom of the next.
        </p>
        <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="caged-chain">
          {chain.map((p, i) => (
            <li key={p.shape}>
              <button type="button" onClick={() => showOnNeck(view === "roots" ? "both" : view, p.shape)}
                className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-panel-2 ${selected === p.shape ? "border-ink" : "border-line"}`}
                data-testid={`caged-chain-${p.shape}`}>
                <div className="flex items-baseline justify-between">
                  <span className="display text-2xl" style={{ color: CAGED_SHAPES[p.shape].colour }}>{p.shape}</span>
                  <span className="text-xs text-faint">{i + 1} of 5</span>
                </div>
                <div className="mx-auto mt-1 max-w-[120px]"><ShapeChordBox pos={p} musicKey={key} /></div>
                <p className="mt-1 text-xs text-muted">Frets {p.lo}–{p.hi} · box {p.boxNo}</p>
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------ memorise */}
      <section className="mt-5 surface p-4 md:p-5" aria-labelledby="memo-title">
        <h2 id="memo-title" className="text-lg font-bold">Memorise the five pentatonic boxes</h2>
        <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <ol className="space-y-3" data-testid="caged-steps">
            {MEMORY_STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-panel-2 text-xs font-bold">{i + 1}</span>
                <div><h3 className="font-bold">{s.title}</h3><p className="text-sm leading-relaxed text-muted">{s.body}</p></div>
              </li>
            ))}
          </ol>
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="caged-boxes">
              {[1, 2, 3, 4, 5].map((n) => {
                const p = chain.find((x) => x.boxNo === n);
                if (!p) return null;
                const id = `box-${n}`;
                return (
                  <div key={n} className="rounded-xl border border-line p-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">Box {n}</span>
                      <span className="text-xs" style={{ color: CAGED_SHAPES[p.shape].colour }}>{p.shape} shape</span>
                    </div>
                    <MiniBox box={p.box} musicKey={key} colour={CAGED_SHAPES[p.shape].colour} />
                    <button type="button" className="btn btn-quiet btn-sm mt-1 w-full justify-center" data-testid={`caged-play-box-${n}`}
                      onClick={() => play(id, boxExample(p.box, `Box ${n}`))}>
                      <PlayIcon id={id} /> {playing === id ? "Stop" : "Up & down"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-faint">Box 1 starts on the {nice(key.minorPc)} minor root on low E. Green dots are {nice(key.tonic)}, home.</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-line p-4">
          <h3 className="font-bold">Octave shapes: find any root fast</h3>
          <ul className="mt-2 grid gap-1.5 text-sm text-muted sm:grid-cols-2">
            {OCTAVE_RULES.map((r) => <li key={r.from}>• {r.say}</li>)}
          </ul>
          <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => showOnNeck("roots")} data-testid="caged-show-roots">
            Show every {nice(key.tonic)} on the neck
          </button>
        </div>
      </section>

      {/* ------------------------------------------------ drill */}
      <section className="mt-5 surface p-4 md:p-5" aria-labelledby="hunt-title">
        <h2 id="hunt-title" className="text-lg font-bold">Drill: root hunt</h2>
        <p className="mt-1 text-sm text-muted">
          Every CAGED shape and every box hangs off a root on the low E, A or D string. Find them without counting and the whole map falls into place.
        </p>
        <div className="mt-3"><RootHunt /></div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/progress/pentatonic-box" className="btn btn-quiet btn-sm">Start with box 1</Link>
        <Link href="/learn/theory" className="btn btn-quiet btn-sm">Theory map</Link>
      </div>
    </div>
  );
}
