"use client";

import type { SoloAudio } from "./useSoloAudio";
import { mapRequestForLick, SectionHead, type ShowMap } from "./shared";
import { LICKS_BY_ID, PLAN, type PlanAction } from "@/lib/music/soloGuide";

export function PlanSteps({ audio, onShowMap }: { audio: SoloAudio; onShowMap: ShowMap }) {
  const run = (a: PlanAction, stepIndex: number) => {
    if (a.kind === "play") {
      const lick = LICKS_BY_ID[a.lickId];
      if (lick) audio.toggleLick(lick, { key: `plan-${stepIndex}` });
    } else if (a.kind === "playSequence") {
      audio.playSequence(`plan-${stepIndex}`, a.lickIds);
    } else if (a.kind === "map") {
      const lick = a.lickId ? LICKS_BY_ID[a.lickId] : undefined;
      onShowMap(lick ? { ...mapRequestForLick(lick), root: a.root, mode: a.mode, box: a.box } : { root: a.root, mode: a.mode, box: a.box });
    }
  };
  return (
    <section aria-labelledby="solo-plan-heading" className="space-y-4" data-testid="solo-plan">
      <SectionHead id="solo-plan-heading" eyebrow="The plan" title="Six steps to a solo">
        Follow them in order the first time. Each step has something to hear or see.
      </SectionHead>
      <ol className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2 min-[900px]:grid-cols-3">
        {PLAN.map((step, i) => (
          <li key={step.title} className="surface flex flex-col gap-2 p-4" data-testid={`plan-step-${i + 1}`}>
            <span className="font-mono text-sm font-bold" style={{ color: "var(--color-next)" }}>{String(i + 1).padStart(2, "0")}</span>
            <h3 className="text-base font-bold leading-tight">{step.title}</h3>
            <p className="text-sm leading-relaxed text-muted">{step.text}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              {step.actions.map((a) => {
                const playingKey = a.kind === "play" ? `lick:plan-${i}` : a.kind === "playSequence" ? `seq:plan-${i}` : null;
                const on = playingKey != null && audio.playingKey === playingKey;
                return a.kind === "jump" ? (
                  <a key={a.label} href={a.anchor} className="btn btn-quiet btn-sm">{a.label}</a>
                ) : (
                  <button
                    key={a.label}
                    type="button"
                    className={`btn btn-sm ${on ? "btn-primary" : "btn-quiet"}`}
                    aria-pressed={playingKey ? on : undefined}
                    onClick={() => run(a, i)}
                  >
                    {playingKey ? <span aria-hidden>{on ? "■" : "▶"}</span> : null}
                    {a.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
