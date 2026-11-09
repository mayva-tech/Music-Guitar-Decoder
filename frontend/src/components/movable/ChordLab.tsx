"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LickTab } from "@/components/solo/LickTab";
import { parseChord, type ChordQuality } from "@/lib/music/chordSymbol";
import {
  DEVICES_BY_ID, FAMILIES, MELODIC_DEVICES, PICK_QUALITIES, SUGGEST, VARIATIONS_BY_ID,
  arpeggioLine, chordScale, chordSymbol, chordTonesIn, defaultFrame, degreeLabel, familyOf, lineSound,
  mod12, noteName, pretty, usesFlats,
  type Anchor, type DeviceId, type Frame,
} from "@/lib/music/movable";
import { PatternNeck, type NeckDot } from "./PatternNeck";
import { DotLegend, KeyPicker, LineLegend, Pills, PlayButton, SectionTitle, frameDots, frameWindow, lineWindow } from "./shared";
import type { MovableAudio } from "./useMovableAudio";

const TONES = "tones";

/** Chord tones only, labelled by degree (root green, others maple). */
function toneDots(frame: Frame, symbol: string): NeckDot[] {
  const c = parseChord(symbol)!;
  return chordTonesIn(frame, c).map((n) => {
    const iv = mod12(n.midi - c.root);
    return { string: n.string, fret: n.fret, label: degreeLabel(iv), tone: iv === 0 ? "root" : "chord", stretch: n.stretch };
  });
}

/** Sections 3 and 4: any chord in the frame, then melodic arpeggio ideas over it. */
export function ChordLab({ keyTonic, audio }: { keyTonic: number; audio: MovableAudio }) {
  const [root, setRoot] = useState(keyTonic);
  const [quality, setQuality] = useState<ChordQuality>("m7");
  const [anchor, setAnchor] = useState<Anchor>(6);
  const [view, setView] = useState<string>(TONES);
  const [device, setDevice] = useState<DeviceId>("skip");
  const [loop, setLoop] = useState(false);

  // The page key picker moves the chord root too (only when it changes, not on first render).
  const lastKey = useRef(keyTonic);
  useEffect(() => {
    if (lastKey.current === keyTonic) return;
    lastKey.current = keyTonic;
    setRoot(keyTonic);
  }, [keyTonic]);

  const family = familyOf(quality);
  const flats = usesFlats(root, family === "minor");
  const symbol = chordSymbol(root, quality, flats);
  const chord = parseChord(symbol)!;
  const frame = defaultFrame(root, family, anchor);
  const suggest = SUGGEST[quality] ?? { ids: [], why: "" };
  const win = frameWindow(frame);

  const dots = useMemo(() => {
    if (view === TONES) return toneDots(frame, symbol);
    const v = VARIATIONS_BY_ID[view]!;
    return frameDots(frame, v, "degree", flats, { ringPcs: chord.pcs, extraPcs: chord.pcs, degreeRoot: chord.root });
  }, [view, frame, symbol, flats, chord.pcs, chord.root]);

  const scalePcs = useMemo(() => chordScale(quality).map((i) => mod12(root + i)), [quality, root]);
  const lineFor = (d: DeviceId) => arpeggioLine([{ chord: symbol, frame }, { chord: symbol, frame }], [d, d], () => scalePcs, `mv-${d}`);
  const line = useMemo(() => lineFor(device), [device, symbol, frame, scalePcs]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineWin = lineWindow(line.notes, [frame]);
  const style = quality === "7" ? "shuffle" : "pop";
  const keyOf = (d: DeviceId) => `chord:${symbol}:${anchor}:${d}:${loop}`;
  const play = (d: DeviceId) => {
    setDevice(d);
    const l = lineFor(d);
    audio.toggle(keyOf(d), "mv-chord", () => lineSound([symbol, symbol], l.notes, { bpm: 84, style }), loop);
  };

  // Leaving this chord (or loop setting) stops what this section was playing.
  useEffect(() => {
    if (audio.playingKey?.startsWith("chord:")) audio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, anchor, loop]);

  const rootName = pretty(noteName(root, flats));
  const sameString = anchor === 6 ? "6th" : "5th";

  return (
    <>
      <section id="any-chord" aria-labelledby="mv-chord-title" className="surface scroll-mt-4 space-y-4 p-4 md:p-6" data-testid="mv-chord">
        <SectionTitle n={3} id="mv-chord-title" eyebrow="Any chord" title="Put the frame on the chord's root">
          Every chord has a root, and every root has a place on the 6th and 5th strings. Chords with a minor 3rd use the minor frame;
          the rest use the major frame. Then the chord's own notes are already under your fingers.
        </SectionTitle>
        <div className="space-y-2">
          <KeyPicker value={root} minor={family === "minor"} onChange={(pc) => setRoot(pc)} testId="mv-chord-root" label="Chord root" />
          <Pills label="Chord type" value={quality} testId="mv-quality"
            onChange={(q) => { setQuality(q); setView(TONES); }}
            options={PICK_QUALITIES.map((q) => ({ value: q.id, label: q.label }))} />
          <Pills label="Root on" value={anchor} size="xs" testId="mv-chord-anchor" onChange={setAnchor}
            options={[{ value: 6, label: "Root on 6th string" }, { value: 5, label: "Root on 5th string" }]} />
        </div>

        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="space-y-2">
            <div className="scroll-x overflow-x-auto rounded-xl bg-tolex/40 p-1">
              <PatternNeck from={win.from} to={win.to} frame={frame} dots={dots}
                ariaLabel={`${pretty(symbol)}: ${view === TONES ? "chord tones" : VARIATIONS_BY_ID[view]!.name} in the frame`} testId="mv-chord-neck" />
            </div>
            <DotLegend withRing={view !== TONES} withAdded={view !== TONES} tones={view === TONES} />
          </div>
          <div className="space-y-3 rounded-2xl border border-line bg-panel p-4" data-testid="mv-chord-card">
            <p className="display text-3xl" data-testid="mv-chord-name">{pretty(symbol)}</p>
            <p className="text-sm leading-relaxed">
              <span className="font-bold">{FAMILIES[family].label}</span>: {rootName} on the {sameString} string, fret {frame.rootFret}, under your{" "}
              {family === "minor" ? "index" : "middle"} finger. Frame frets {frame.lo}–{frame.hi}.
            </p>
            <p className="text-sm">
              Chord tones: {chord.pcs.map((pc, i) => (
                <span key={pc} className="font-mono">{i ? " · " : ""}{degreeLabel(mod12(pc - chord.root))} {pretty(noteName(pc, flats))}</span>
              ))}
            </p>
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Show on the neck</p>
              <Pills label="Neck view" value={view} size="xs" testId="mv-chord-view" onChange={setView}
                options={[{ value: TONES, label: "Chord tones" }, ...suggest.ids.map((id) => ({ value: id, label: VARIATIONS_BY_ID[id]!.name }))]} />
              <p className="text-xs leading-relaxed text-muted">{suggest.why}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="arpeggios" aria-labelledby="mv-arp-title" className="surface scroll-mt-4 space-y-4 p-4 md:p-6" data-hl-scope="mv-chord" data-testid="mv-arpeggios">
        <SectionTitle n={4} id="mv-arp-title" eyebrow="Melodic arpeggios" title={`Play ${pretty(symbol)} like a melody, not an exercise`}>
          The notes are the chord tones above. What makes them musical is the order and the rhythm: skip and turn back, approach from a fret away,
          leave a gap. Each idea below plays two bars over {pretty(symbol)} in the same frame.
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-panel p-3" data-testid="mv-ab">
          <span className="text-sm font-bold">Hear the difference:</span>
          <PlayButton small playing={audio.playingKey === keyOf("robot")} testId="mv-ab-robot" onClick={() => play("robot")}>
            Straight up and down
          </PlayButton>
          <PlayButton small primary playing={audio.playingKey === keyOf("skip")} testId="mv-ab-melodic" onClick={() => play("skip")}>
            Skip and turn back
          </PlayButton>
          <label className="ml-auto flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} data-testid="mv-chord-loop" /> Loop
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[1000px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="space-y-2 min-[1000px]:sticky min-[1000px]:top-3 min-[1000px]:self-start" data-testid="mv-arp-viewer">
            <p className="text-sm">
              <span className="font-bold">{DEVICES_BY_ID[device].name}</span>{" "}
              <span className="font-mono text-xs text-muted">{DEVICES_BY_ID[device].shape}</span>
            </p>
            <div className="scroll-x overflow-x-auto rounded-xl bg-tolex/40 p-1">
              <PatternNeck from={lineWin.from} to={lineWin.to} frame={frame} dots={toneDots(frame, symbol)}
                line={{ notes: line.notes, roles: line.roles, labels: line.degrees, mode: "full" }}
                ariaLabel={`${DEVICES_BY_ID[device].name} over ${pretty(symbol)}`} testId="mv-arp-neck" />
            </div>
            <LineLegend />
            <div>
              <h3 className="mb-1 text-sm font-bold">TAB</h3>
              <LickTab notes={line.notes} barsPerRow={2} />
              <p className="mt-1 font-mono text-xs text-muted" data-testid="mv-arp-degrees">
                {line.bars.map((_, b) => line.degrees.filter((__, i) => Math.floor(line.notes[i]!.start_beat / 4) === b).join(" ")).join("  |  ")}
              </p>
            </div>
          </div>

          <ul className="grid gap-2 min-[640px]:grid-cols-2 min-[1000px]:grid-cols-1" data-testid="mv-devices">
            {MELODIC_DEVICES.map((d) => {
              const on = device === d.id;
              return (
                <li key={d.id} className={`rounded-xl border p-3 ${on ? "border-next bg-panel-2" : "border-line"}`} data-testid={`mv-device-${d.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold leading-tight">{d.name}</h3>
                      <p className="font-mono text-xs" style={{ color: "var(--color-next)" }}>{d.shape}</p>
                    </div>
                    <PlayButton small playing={audio.playingKey === keyOf(d.id)} testId={`mv-play-${d.id}`} onClick={() => play(d.id)}>
                      Play
                    </PlayButton>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{d.idea}</p>
                  {on && (
                    <ul className="mt-1 list-disc pl-5 text-xs leading-relaxed text-muted">
                      {d.tips.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  )}
                  {!on && (
                    <button type="button" className="mt-1 text-xs text-muted underline decoration-line underline-offset-2 hover:text-ink"
                      onClick={() => setDevice(d.id)} data-testid={`mv-show-${d.id}`}>
                      Show on the neck
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
