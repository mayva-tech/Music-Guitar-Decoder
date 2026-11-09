"use client";

import { useMemo, useState } from "react";
import { parseChord } from "@/lib/music/chordSymbol";
import {
  FAMILIES, VARIATIONS_BY_ID, chordSymbol, compileMotif, degreeLabel, frameChoices, frameWalk, keyLabel,
  lineSound, makeFrame, mod12, pretty, rootChart, usesFlats, variationsFor, noteName,
  type Anchor, type Family, type Frame, type Variation,
} from "@/lib/music/movable";
import type { LeadSound } from "@/lib/theory/player";
import { PatternNeck, type NeckLine } from "./PatternNeck";
import { DotLegend, PlayButton, Pills, SectionTitle, frameDots, frameWindow, type LabelMode } from "./shared";
import type { MovableAudio } from "./useMovableAudio";

export interface FrameState {
  tonic: number;
  family: Family;
  anchor: Anchor;
  /** Index into frameChoices (0 = lowest on the neck). */
  place: number;
  varId: string;
  labels: LabelMode;
}

export function frameOf(s: FrameState): Frame {
  const all = frameChoices(s.tonic, s.family, s.anchor);
  return all[Math.min(s.place, all.length - 1)] ?? makeFrame(s.tonic, s.family, s.anchor, 5);
}

const minorKey = (f: Family) => f === "minor";

/** Sound of a variation: its two-bar phrase over a vamp of its chord. */
export function motifSound(v: Variation, frame: Frame, flats: boolean): { sound: LeadSound; notes: NeckLine } {
  const chord = chordSymbol(frame.tonic, v.vamp, flats);
  const pcs = parseChord(chord)?.pcs ?? [];
  const { notes, roles } = compileMotif(v.id, v.motif, frame, pcs);
  return {
    sound: lineSound([chord, chord], notes, { bpm: 92, style: v.vamp === "7" ? "shuffle" : "pop" }),
    notes: { notes, roles, mode: "rings" },
  };
}

/** Section 1: the movable frame, its fingering, and where to put it in any key. */
export function FrameStudio({
  state, set, audio,
}: {
  state: FrameState;
  set: (patch: Partial<FrameState>) => void;
  audio: MovableAudio;
}) {
  const keyFlats = usesFlats(state.tonic, minorKey(state.family));
  const frame = frameOf(state);
  const choices = frameChoices(state.tonic, state.family, state.anchor);
  const v = VARIATIONS_BY_ID[state.varId] ?? variationsFor(state.family)[0]!;
  const fam = FAMILIES[state.family];
  const [shown, setShown] = useState<"walk" | "motif">("walk");
  const win = frameWindow(frame);
  const dots = useMemo(() => frameDots(frame, v, state.labels, keyFlats), [frame, v, state.labels, keyFlats]);

  const walk = useMemo(() => frameWalk(frame, v, keyFlats), [frame, v, keyFlats]);
  const motif = useMemo(() => motifSound(v, frame, keyFlats), [v, frame, keyFlats]);
  const line: NeckLine = shown === "walk" ? { notes: walk.notes, roles: walk.notes.map(() => "scale"), mode: "rings" } : motif.notes;

  const vName = /^(Dorian|Mixolydian|Lydian)/.test(v.name) ? v.name : v.name.charAt(0).toLowerCase() + v.name.slice(1);
  const keyName = `${keyLabel(state.tonic, minorKey(state.family))} ${vName}`;
  const rootFinger = fam.rootFinger === 1 ? "index" : "middle";
  const walkKey = `walk:${frame.tonic}:${frame.rootFret}:${state.family}:${state.anchor}:${v.id}`;
  const motifKey = `motif:${frame.tonic}:${frame.rootFret}:${state.family}:${state.anchor}:${v.id}`;
  const move = (d: number) => {
    audio.stop();
    set({ tonic: mod12(state.tonic + d), place: 0 });
  };

  return (
    <section id="frame" aria-labelledby="mv-frame-title" className="surface scroll-mt-4 space-y-4 p-4 md:p-6" data-hl-scope="mv-frame" data-testid="mv-frame">
      <SectionTitle n={1} id="mv-frame-title" eyebrow="The movable frame" title="One hand shape for every key">
        Put the root under one finger, give every other finger its own fret, and the hand covers a whole scale without moving.
        Slide that hand to a new root and you are in a new key with the same fingering.
      </SectionTitle>

      <div className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted">Frame</p>
          <Pills label="Frame" value={state.family} testId="mv-family"
            onChange={(f) => { audio.stop(); set({ family: f, varId: f === "minor" ? "minor-pent" : "major-pent", place: 0 }); }}
            options={[{ value: "minor", label: "Minor · index on root" }, { value: "major", label: "Major · middle on root" }]} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Root on</p>
          <Pills label="Root string" value={state.anchor} testId="mv-anchor"
            onChange={(a) => { audio.stop(); set({ anchor: a, place: 0 }); }}
            options={[{ value: 6, label: "6th string (low E)" }, { value: 5, label: "5th string (A)" }]} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Scale in the frame</p>
          <Pills label="Variation" value={v.id} size="xs" testId="mv-var"
            onChange={(id) => { audio.stop(); set({ varId: id }); }}
            options={variationsFor(state.family).map((x) => ({ value: x.id, label: x.name }))} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">Dot labels</p>
          <Pills label="Labels" value={state.labels} size="xs" testId="mv-labels" onChange={(l) => set({ labels: l })}
            options={[{ value: "finger", label: "Fingers" }, { value: "degree", label: "Degrees" }, { value: "note", label: "Notes" }]} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm" data-testid="mv-frame-summary">
          <span className="font-bold">{keyName}</span>
          <span className="text-muted"> · root {pretty(noteName(state.tonic, keyFlats))} on the {state.anchor === 6 ? "6th" : "5th"} string, fret {frame.rootFret}, {rootFinger} finger · frame frets {frame.lo}–{frame.hi}</span>
        </p>
        <div className="scroll-x overflow-x-auto rounded-xl bg-tolex/40 p-1">
          <PatternNeck from={win.from} to={win.to} frame={frame} dots={dots} line={line}
            ariaLabel={`${keyName} in the ${fam.label.toLowerCase()} at fret ${frame.lo}`} testId="mv-frame-neck" />
        </div>
        <DotLegend />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PlayButton primary playing={audio.playingKey === walkKey} testId="mv-walk"
          onClick={() => { setShown("walk"); audio.toggle(walkKey, "mv-frame", () => lineSound(walk.chords, walk.notes, { bpm: 96, style: "pop" })); }}>
          Walk the frame
        </PlayButton>
        <PlayButton playing={audio.playingKey === motifKey} testId="mv-motif"
          onClick={() => { setShown("motif"); audio.toggle(motifKey, "mv-frame", () => motif.sound); }}>
          Hear it as a phrase
        </PlayButton>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => move(-1)} data-testid="mv-move-down" aria-label="Move the frame down one fret">◀ 1 fret</button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => move(1)} data-testid="mv-move-up" aria-label="Move the frame up one fret">1 fret ▶</button>
        {choices.length > 1 && (
          <button type="button" className="btn btn-quiet btn-sm" data-testid="mv-octave"
            onClick={() => { audio.stop(); set({ place: (state.place + 1) % choices.length }); }}>
            Same key at fret {choices[(state.place + 1) % choices.length]!.rootFret}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        Walk the frame to learn the shape (low string to high, like a drill). Then play the phrase: that is how it should sound in a solo.
        The arrows move the whole hand one fret, which changes the key and nothing else.
      </p>

      <ol className="grid gap-3 border-t border-line pt-4 text-sm leading-relaxed min-[760px]:grid-cols-3">
        <li>
          <span className="block font-mono text-xs" style={{ color: "var(--color-next)" }}>Rule 1</span>
          <span className="font-bold">Anchor the root.</span> Find the key's note on the {state.anchor === 6 ? "6th" : "5th"} string (chart below) and put your {rootFinger} finger on it. {fam.hint}
        </li>
        <li>
          <span className="block font-mono text-xs" style={{ color: "var(--color-next)" }}>Rule 2</span>
          <span className="font-bold">One finger per fret.</span> Index on fret {frame.lo}, middle {frame.lo + 1}, ring {frame.lo + 2}, pinky {frame.hi}. Seven-note scales add a one-fret reach (dashed dots) with the index or pinky.
        </li>
        <li>
          <span className="block font-mono text-xs" style={{ color: "var(--color-next)" }}>Rule 3</span>
          <span className="font-bold">Change key, slide the hand.</span> Every pattern, variation and arpeggio on this page moves with the root. Two anchors (6th and 5th string) give you two places for every key.
        </li>
      </ol>

      <RootChart tonic={state.tonic} minor={minorKey(state.family)} anchor={state.anchor}
        onPick={(pc) => { audio.stop(); set({ tonic: pc, place: 0 }); }} />
    </section>
  );
}

/** Where the root sits on the 6th and 5th strings for all twelve keys. */
function RootChart({ tonic, minor, anchor, onPick }: { tonic: number; minor: boolean; anchor: Anchor; onPick: (pc: number) => void }) {
  const rows = rootChart();
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-bold">Where to put the frame: root frets for all 12 keys</h3>
      <div className="scroll-x overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-center text-sm" data-testid="mv-root-chart">
          <thead>
            <tr className="text-xs text-muted">
              <th className="px-2 py-1.5 text-left font-normal">Key</th>
              {rows.map((r) => (
                <th key={r.pc} className="px-1 py-1.5">
                  <button type="button" onClick={() => onPick(r.pc)}
                    className={`rounded-full px-2 py-0.5 font-bold ${r.pc === tonic ? "bg-next text-tolex" : "text-ink hover:bg-panel-2"}`}
                    aria-pressed={r.pc === tonic} data-testid={`mv-chart-${r.pc}`}>
                    {keyLabel(r.pc, minor)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {([[6, "6th string"], [5, "5th string"]] as const).map(([s, name]) => (
              <tr key={s} className={`border-t border-line ${anchor === s ? "" : "text-muted"}`}>
                <td className="px-2 py-1.5 text-left font-sans text-xs">{name}</td>
                {rows.map((r) => {
                  const f = s === 6 ? r.low : r.a;
                  return (
                    <td key={r.pc} className={`px-1 py-1.5 ${r.pc === tonic && anchor === s ? "font-bold" : ""}`}
                      style={r.pc === tonic && anchor === s ? { color: "var(--color-next)" } : undefined}>
                      {f === 0 ? "0/12" : f}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Fret 0 means the open string: play the frame at fret 12 instead (or with open strings).</p>
    </div>
  );
}

/** Section 2: every variation of the current frame as a card, with its phrase. */
export function VariationCards({
  state, set, audio,
}: {
  state: FrameState;
  set: (patch: Partial<FrameState>) => void;
  audio: MovableAudio;
}) {
  const frame = frameOf(state);
  const keyFlats = usesFlats(state.tonic, minorKey(state.family));
  const win = frameWindow(frame);
  const list = variationsFor(state.family);

  return (
    <section id="variations" aria-labelledby="mv-var-title" className="scroll-mt-4 space-y-4" data-testid="mv-variations">
      <SectionTitle n={2} id="mv-var-title" eyebrow="Variations" title="Same frame, different colours">
        Every variation keeps the frame and the fingering. Most add one or two notes (amber) to the pentatonic; the arpeggios strip it
        back to chord tones. Learn the core first, then add one variation at a time.
      </SectionTitle>
      <Pills label="Frame" value={state.family} testId="mv-var-family"
        onChange={(f) => { audio.stop(); set({ family: f, varId: f === "minor" ? "minor-pent" : "major-pent", place: 0 }); }}
        options={[{ value: "minor", label: "Minor frame variations" }, { value: "major", label: "Major frame variations" }]} />
      <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {list.map((v) => {
          const key = `card:${v.id}:${frame.tonic}:${frame.rootFret}:${state.anchor}`;
          const m = motifSound(v, frame, keyFlats);
          const dots = frameDots(frame, v, "degree", keyFlats);
          const scope = `mv-var-${v.id}`;
          return (
            <article key={v.id} className="surface flex flex-col gap-2 p-3" data-hl-scope={scope} data-testid={`mv-card-${v.id}`}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold leading-tight">{v.name}</h3>
                <span className="text-[0.65rem] uppercase tracking-wide text-muted">{v.arpeggio ? "arpeggio" : v.adds.length ? `+${v.adds.length} note${v.adds.length > 1 ? "s" : ""}` : "core"}</span>
              </div>
              <p className="flex flex-wrap gap-1" aria-label="Formula">
                {v.intervals.map((i) => (
                  <span key={i} className="rounded px-1.5 py-0.5 font-mono text-xs"
                    style={v.adds.includes(i) ? { background: "var(--color-next)", color: "var(--color-tolex)" } : { background: "var(--color-panel-2)" }}>
                    {degreeLabel(i, v.sharp4)}
                  </span>
                ))}
              </p>
              <p className="text-xs text-muted"><span className="text-ink">Over:</span> {v.useOver}</p>
              <p className="text-sm leading-relaxed">{v.text}</p>
              <div className="rounded-lg bg-tolex/40 p-1">
                <PatternNeck compact from={win.from} to={win.to} frame={frame} dots={dots} line={m.notes}
                  ariaLabel={`${v.name} in the frame`} />
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <PlayButton small playing={audio.playingKey === key} testId={`mv-hear-${v.id}`}
                  onClick={() => audio.toggle(key, scope, () => m.sound)}>
                  Hear it over {pretty(chordSymbol(frame.tonic, v.vamp, keyFlats))}
                </PlayButton>
                <a href="#frame" className="btn btn-quiet btn-sm" onClick={() => { audio.stop(); set({ varId: v.id }); }} data-testid={`mv-use-${v.id}`}>
                  Show in the frame
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
