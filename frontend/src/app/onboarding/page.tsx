"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";
import type { Handedness, SkillLevel, Style } from "@/lib/types";

const LEVELS: [SkillLevel, string][] = [
  ["zero", "Never touched a guitar"],
  ["few_notes", "I can play a few notes"],
  ["basic_chords", "I know basic chords"],
  ["intermediate", "Intermediate"],
  ["advanced", "Advanced"],
];
const HANDS: [Handedness, string, string][] = [
  ["right", "Right-handed guitar", "You pick with your right hand. The neck points to your left."],
  ["left", "Left-handed guitar", "You pick with your left hand. The neck points to your right."],
];
const STYLES: [Style, string][] = [
  ["classic_rock", "Rock"], ["pop", "Pop"], ["blues", "Blues"], ["ballad", "Ballad (soft pop)"], ["acoustic", "Acoustic (pop, unplugged)"],
];

export default function Onboarding() {
  const router = useRouter();
  const complete = useApp((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [song, setSong] = useState("");
  const [level, setLevel] = useState<SkillLevel>("zero");
  const [hand, setHand] = useState<Handedness>("right");
  const [style, setStyle] = useState<Style>("classic_rock");
  const total = 5;

  const finish = () => {
    complete({ favoriteSong: song.trim(), skillLevel: level, handedness: hand, style });
    router.push("/record");
  };

  return (
    <main className="min-h-dvh flex flex-col px-5 py-8 md:py-14 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <span className="display text-lg">Music Decoder</span>
        <span className="text-sm text-muted" aria-live="polite">Step {step + 1} of {total}</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-panel-2" aria-hidden>
        <div className="h-full rounded-full bg-maple transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      <section className="mt-12 flex-1">
        {step === 0 && (
          <>
            <h1 className="display text-[2.1rem] md:text-[2.8rem]">What song or melody would you love to play?</h1>
            <p className="mt-3 text-muted">Any tune you can hum. You can change your mind later.</p>
            <label className="mt-8 block">
              <span className="sr-only">Song or melody</span>
              <input autoFocus className="field w-full text-lg" placeholder="e.g. the riff from my favourite song" value={song} onChange={(e) => setSong(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setStep(1)} />
            </label>
          </>
        )}
        {step === 1 && (
          <Choice title="Have you ever played guitar?" name="level" value={level} onChange={setLevel}
            options={LEVELS.map(([v, l]) => ({ value: v, label: l }))} />
        )}
        {step === 2 && (
          <Choice title="Which hand do you use for picking?" name="hand" value={hand} onChange={setHand}
            options={HANDS.map(([v, l, d]) => ({ value: v, label: l, detail: d }))} />
        )}
        {step === 3 && (
          <Choice title="Choose your music style." name="style" value={style} onChange={setStyle}
            options={STYLES.map(([v, l]) => ({ value: v, label: l }))} />
        )}
        {step === 4 && (
          <>
            <h1 className="display text-[2.1rem] md:text-[2.8rem]">Let&apos;s turn your first tune into guitar music!</h1>
            <p className="mt-4 text-muted leading-relaxed">
              Next you&apos;ll hum {song ? <>“{song}”</> : "your tune"} into the microphone. Your browser will ask for permission —
              the recording is only sent to your own Music Decoder server for analysis.
            </p>
          </>
        )}
      </section>

      <div className="mt-10 flex justify-between gap-3">
        <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
        {step < total - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>{step === 0 && !song ? "Skip" : "Continue"}</button>
        ) : (
          <button className="btn btn-primary" onClick={finish}>Open the recorder</button>
        )}
      </div>
    </main>
  );
}

function Choice<T extends string>({ title, name, value, onChange, options }: {
  title: string; name: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; detail?: string }[];
}) {
  return (
    <fieldset>
      <legend className="display text-[2.1rem] md:text-[2.8rem]">{title}</legend>
      <div className="mt-8 grid gap-2.5">
        {options.map((o) => (
          <label key={o.value} className={`flex cursor-pointer items-center gap-4 rounded-2xl px-5 py-4 text-lg transition-colors ${value === o.value ? "bg-maple text-tolex" : "bg-panel hover:bg-panel-2"}`}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${value === o.value ? "border-tolex bg-tolex/80" : "border-faint"}`} aria-hidden />
            <span>
              <span className="block font-semibold">{o.label}</span>
              {o.detail && <span className="block text-sm opacity-75">{o.detail}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
