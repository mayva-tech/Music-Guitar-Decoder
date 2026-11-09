"use client";

import { useEffect, useMemo, useState } from "react";
import { LickTab } from "@/components/solo/LickTab";
import {
  DEVICES_BY_ID, MELODIC_DEVICES, MIX, PROGRESSIONS, PROGRESSIONS_BY_ID,
  arpeggioLine, lineSound, placeInFrame, planProgression, pretty,
  type Anchor, type DeviceId, type FrameMode,
} from "@/lib/music/movable";
import { PatternNeck, type NeckDot } from "./PatternNeck";
import { LineLegend, Pills, PlayButton, SectionTitle, lineWindow } from "./shared";
import type { MovableAudio } from "./useMovableAudio";

type Choice = DeviceId | "mix";

/** Section 5: a progression in the page's key, one melodic arpeggio line, voice-led bar to bar. */
export function ProgressionLab({ keyTonic, audio }: { keyTonic: number; audio: MovableAudio }) {
  const [progId, setProgId] = useState("pop");
  const [mode, setMode] = useState<FrameMode>("stay");
  const [anchor, setAnchor] = useState<Anchor>(6);
  const [choice, setChoice] = useState<Choice>("mix");
  const [bpm, setBpm] = useState(PROGRESSIONS_BY_ID.pop!.bpm);
  const [loop, setLoop] = useState(true);
  const [countIn, setCountIn] = useState(false);

  const prog = PROGRESSIONS_BY_ID[progId]!;
  const plan = useMemo(() => planProgression(prog, keyTonic, mode, anchor), [prog, keyTonic, mode, anchor]);
  const devices: DeviceId[] = choice === "mix" ? MIX.slice(0, plan.bars.length) : [choice];
  const line = useMemo(
    () => arpeggioLine(plan.bars, devices, () => plan.scale, "mv-prog"),
    // devices is derived from choice + bar count
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, choice],
  );
  const chords = plan.bars.map((b) => b.chord);
  const frames = plan.bars.map((b) => b.frame);
  const win = lineWindow(line.notes, frames);
  const keyFrame = frames[0]!;
  const sound = () => lineSound(chords, line.notes, { bpm, style: prog.style, countIn });
  const key = "prog";
  const playing = audio.playingKey === key;

  // Changes apply from the next loop while playing.
  useEffect(() => {
    if (playing) audio.update(() => lineSound(chords, line.notes, { bpm, style: prog.style }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, bpm, playing]);

  const dots: NeckDot[] = useMemo(() => {
    if (mode !== "stay") return [];
    return placeInFrame(keyFrame, plan.scale.map((pc) => (pc - keyFrame.tonic + 12) % 12)).map((n) => ({
      string: n.string, fret: n.fret, label: "", tone: n.interval === 0 ? "root" : "core", stretch: n.stretch,
    }));
  }, [mode, keyFrame, plan.scale]);

  const pickProg = (id: string) => {
    audio.stop();
    setProgId(id);
    setBpm(PROGRESSIONS_BY_ID[id]!.bpm);
  };

  return (
    <section id="progression" aria-labelledby="mv-prog-title" className="surface scroll-mt-4 space-y-4 p-4 md:p-6" data-hl-scope="mv-prog" data-testid="mv-progression">
      <SectionTitle n={5} id="mv-prog-title" eyebrow="Over a progression" title={`Arpeggios through the changes in ${plan.key}`}>
        Each bar starts on the chord tone nearest the note you just played, so the line flows from chord to chord instead of jumping back to
        each root. Stay in one frame and only the target notes change, or move the frame to each chord's root.
      </SectionTitle>

      <div className="space-y-2">
        <Pills label="Progression" value={progId} size="xs" testId="mv-prog" onChange={pickProg}
          options={PROGRESSIONS.map((p) => ({ value: p.id, label: `${p.name} · ${p.romans.join(" ")}` }))} />
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Pills label="Frame mode" value={mode} size="xs" testId="mv-mode" onChange={(m) => { audio.stop(); setMode(m); }}
            options={[{ value: "stay", label: "Stay in the key's frame" }, { value: "follow", label: "Move the frame with each chord" }]} />
          <Pills label="Root string" value={anchor} size="xs" testId="mv-prog-anchor" onChange={(a) => { audio.stop(); setAnchor(a); }}
            options={[{ value: 6, label: "Key frame on 6th string" }, { value: 5, label: "on 5th string" }]} />
        </div>
        <Pills label="Arpeggio idea" value={choice} size="xs" testId="mv-prog-device" onChange={setChoice}
          options={[{ value: "mix" as Choice, label: "Mix (a new idea each bar)" }, ...MELODIC_DEVICES.map((d) => ({ value: d.id as Choice, label: d.name }))]} />
        <p className="text-xs leading-relaxed text-muted">{prog.text}</p>
      </div>

      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${plan.bars.length}, minmax(0, 1fr))` }} data-testid="mv-prog-bars">
        {line.bars.map((b, i) => (
          <li key={i} data-hl={`b_${i}`} className="theory-block rounded-lg bg-panel-2 px-1.5 py-2 text-center">
            <span className="block font-mono text-[0.65rem] text-white/60">{prog.romans[i]}</span>
            <span className="block text-lg font-bold text-white">{pretty(b.chord)}</span>
            <span className="block truncate text-[0.65rem] text-white/70">{DEVICES_BY_ID[b.device].name}</span>
            <span className="block text-[0.65rem] text-white/70">starts on {b.startDegree}{mode === "follow" ? ` · fret ${b.frame.lo}` : ""}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-2">
        <div className="scroll-x overflow-x-auto rounded-xl bg-tolex/40 p-1">
          <PatternNeck from={win.from} to={win.to} frame={mode === "stay" ? keyFrame : null} dots={dots}
            line={{ notes: line.notes, roles: line.roles, labels: line.degrees, mode: "full" }}
            ariaLabel={`Arpeggio line over ${chords.join(" ")}`} testId="mv-prog-neck" />
        </div>
        <LineLegend />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PlayButton primary playing={playing} testId="mv-prog-play" onClick={() => audio.toggle(key, "mv-prog", sound, loop)}>
          Play over the band
        </PlayButton>
        <label className="flex items-center gap-2 text-sm" htmlFor="mv-bpm">
          Tempo
          <input id="mv-bpm" type="range" min={50} max={140} step={2} value={bpm} onChange={(e) => setBpm(Number(e.target.value))}
            className="w-32 accent-[var(--color-next)]" data-testid="mv-bpm" aria-valuetext={`${bpm} BPM`} />
          <span className="w-16 font-mono text-xs">{bpm} BPM</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={loop} onChange={(e) => { audio.stop(); setLoop(e.target.checked); }} data-testid="mv-prog-loop" /> Loop
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} data-testid="mv-prog-countin" /> Count in
        </label>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold">TAB</h3>
        <LickTab notes={line.notes} barsPerRow={4} perBarGrid />
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Try it yourself: loop the band with the line, then play your own version. Keep the first note of each bar (shown above) and change
        everything after it.
      </p>
    </section>
  );
}
