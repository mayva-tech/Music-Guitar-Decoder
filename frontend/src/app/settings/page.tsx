"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/AppShell";
import { Fretboard } from "@/components/Fretboard";
import { useApp, useHydrated } from "@/lib/store";
import type { InstructionMode, MarkerLabel, SkillLevel, Style, TechniquesMode, ViewMode } from "@/lib/types";

const PREVIEW_CUR = { string: 1, fret: 3, finger: 3, status: "target" as const };
const PREVIEW_NEXT = { string: 2, fret: 1, finger: 1, status: "next" as const };

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-4 md:grid-cols-[16rem_1fr] md:items-center">
      <div>
        <p className="font-semibold">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, name }: { value: T; options: [T, string][]; onChange: (v: T) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {options.map(([v, l]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`chip ${value === v ? "bg-maple text-tolex" : ""}`}>{l}</button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { prefs, setPrefs, resetOnboarding, clearAll } = useApp();
  if (!hydrated) return null;
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Settings" lead="Saved in this browser. No account needed." />
      <section className="surface px-5 divide-y divide-line">
        <Row label="Guitar" hint="Which hand picks the strings.">
          <Segmented name="Handedness" value={prefs.handedness} onChange={(v) => setPrefs({ handedness: v })} options={[["right", "Right-handed"], ["left", "Left-handed"]]} />
        </Row>
        <Row label="Fretboard view" hint="Same notes, different picture.">
          <Segmented<ViewMode> name="Fretboard view" value={prefs.viewMode} onChange={(v) => setPrefs({ viewMode: v })}
            options={[["beginner", "Beginner"], ["chart", "Chart (like TAB)"], ["facing", "Facing a teacher"], ["vertical", "Vertical"]]} />
          <div className="mt-3 rounded-xl bg-tolex p-2">
            <Fretboard handedness={prefs.handedness} view={prefs.viewMode} frets={5} current={PREVIEW_CUR} next={PREVIEW_NEXT}
              hand={prefs.handOverlay ? { base: 1, opacity: prefs.handOpacity } : null} />
          </div>
        </Row>
        <Row label="Experience">
          <Segmented<SkillLevel> name="Experience" value={prefs.skillLevel} onChange={(v) => setPrefs({ skillLevel: v })}
            options={[["zero", "Never played"], ["few_notes", "A few notes"], ["basic_chords", "Basic chords"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]]} />
        </Row>
        <Row label="Music style">
          <Segmented<Style> name="Music style" value={prefs.style} onChange={(v) => setPrefs({ style: v })}
            options={[["classic_rock", "Rock"], ["pop", "Pop"], ["blues", "Blues"], ["ballad", "Ballad"], ["acoustic", "Acoustic"]]} />
        </Row>
        <Row label="Lead solo techniques" hint="Slides, hammer-ons, pull-offs, bends and vibrato.">
          <Segmented<TechniquesMode> name="Lead solo techniques" value={prefs.techniques} onChange={(v) => setPrefs({ techniques: v })}
            options={[["auto", "Match my level"], ["none", "Plain notes"], ["slides", "Slides & legato"], ["all", "Everything"]]} />
        </Row>
        <Row label="Hand on the fretboard" hint="A see-through hand shows where every finger sits.">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented name="Hand overlay" value={prefs.handOverlay ? "on" : "off"} onChange={(v) => setPrefs({ handOverlay: v === "on" })} options={[["on", "Show"], ["off", "Hide"]]} />
            <label className="flex items-center gap-2 text-sm text-muted">
              Opacity
              <input type="range" min={0.1} max={0.9} step={0.05} value={prefs.handOpacity} onChange={(e) => setPrefs({ handOpacity: Number(e.target.value) })} aria-label="Hand opacity" />
              <span className="tabular-nums w-9">{Math.round(prefs.handOpacity * 100)}%</span>
            </label>
          </div>
        </Row>
        <Row label="Animate finger moves" hint="The hand glides between notes and the struck string lights up.">
          <Segmented name="Animate finger moves" value={prefs.animateHand ? "on" : "off"} onChange={(v) => setPrefs({ animateHand: v === "on" })}
            options={[["on", "On"], ["off", "Off"]]} />
        </Row>
        <Row label="Dots on the fretboard show">
          <Segmented<MarkerLabel> name="Dots show" value={prefs.markerLabel} onChange={(v) => setPrefs({ markerLabel: v })}
            options={[["finger", "Finger number"], ["interval", "Interval (R, 3, 5…)"], ["note", "Note name"]]} />
        </Row>
        <Row label="Scale shape" hint="Shows the lead solo's scale positions under the notes.">
          <Segmented name="Scale shape" value={prefs.showScale ? "on" : "off"} onChange={(v) => setPrefs({ showScale: v === "on" })} options={[["on", "Show"], ["off", "Hide"]]} />
        </Row>
        <Row label="Instructions" hint="Voice uses Microsoft Andrew (EN) when your browser provides it (Edge/Windows), otherwise another English voice.">
          <Segmented<InstructionMode> name="Instructions" value={prefs.instructionMode} onChange={(v) => setPrefs({ instructionMode: v })}
            options={[["text", "Text"], ["voice", "Voice"], ["both", "Both"], ["silent", "Silent"]]} />
        </Row>
        <Row label="Auto read aloud" hint="When On, opening Read on Progress speaks the topic overlay in English (Andrew).">
          <Segmented name="Auto read aloud" value={prefs.autoReadAloud ? "on" : "off"} onChange={(v) => setPrefs({ autoReadAloud: v === "on" })}
            options={[["on", "On"], ["off", "Off"]]} />
        </Row>
        <Row label="Frets shown">
          <Segmented name="Frets shown" value={String(prefs.fretsShown)} onChange={(v) => setPrefs({ fretsShown: Number(v) })}
            options={[["5", "5"], ["7", "7"], ["12", "12"], ["15", "15"], ["22", "22"]]} />
        </Row>
        <Row label="Fret spacing" hint="Real guitars have narrower frets further up.">
          <Segmented name="Fret spacing" value={prefs.equalFretSpacing ? "equal" : "real"} onChange={(v) => setPrefs({ equalFretSpacing: v === "equal" })}
            options={[["real", "Like a real guitar"], ["equal", "Evenly spaced"]]} />
        </Row>
        <Row label="Note names on the fretboard">
          <Segmented name="Note names" value={prefs.showNoteNames ? "on" : "off"} onChange={(v) => setPrefs({ showNoteNames: v === "on" })} options={[["on", "Show"], ["off", "Hide"]]} />
        </Row>
        <Row label="Tuning reference" hint="Standard is A = 440 Hz.">
          <label className="flex items-center gap-2">
            A =
            <input type="number" min={415} max={466} className="field w-24" value={prefs.a4} onChange={(e) => setPrefs({ a4: Math.min(466, Math.max(415, Number(e.target.value) || 440)) })} />
            Hz
          </label>
        </Row>
      </section>

      <section className="mt-6 surface px-5 divide-y divide-line">
        <Row label="Developer mode" hint="Unlocks every Progress lesson and marks skills complete in this browser.">
          <Segmented name="Developer mode" value={prefs.developerMode ? "on" : "off"}
            onChange={(v) => setPrefs({ developerMode: v === "on" })} options={[["on", "On"], ["off", "Off"]]} />
        </Row>
        <Row label="Start over" hint="Shows the welcome questions again.">
          <button className="btn btn-quiet btn-sm" onClick={() => { resetOnboarding(); router.push("/onboarding"); }}>Redo the welcome questions</button>
        </Row>
        <Row label="Clear this browser" hint="Removes settings and work in progress here. Saved songs on the server stay.">
          <button className="btn btn-ghost btn-sm text-bad" onClick={() => { if (window.confirm("Clear all Music Decoder data in this browser?")) { clearAll(); router.push("/onboarding"); } }}>
            Clear browser data
          </button>
        </Row>
      </section>
    </div>
  );
}
