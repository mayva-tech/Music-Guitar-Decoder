"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AmpKnob } from "@/components/AmpKnob";
import { LeadToneSelector } from "@/components/LeadToneSelector";
import {
  AMP_KNOB_META,
  AMP_PRESETS,
  MAX_SAVED_AMP_PRESETS,
  ampPresetMatches,
  createAmpPreset,
  nextTonePresetName,
  normalizeAmp,
  type AmpKnobs,
  type SavedAmpPreset,
} from "@/lib/audio/amp";
import { normalizeLeadTone, type LeadTone } from "@/lib/audio/leadTone";
import { useApp } from "@/lib/store";
import { getTheoryPlayer } from "@/lib/theory/player";
import type { PlayableNote } from "@/lib/types";

function previewNote(midi: number, string: number, fret: number): PlayableNote {
  return {
    id: `amp-preview-${midi}`,
    midi,
    name: "A",
    start_beat: 0,
    duration_beats: 2.5,
    string,
    fret,
    finger: 1,
    source: "riff",
    technique: null,
    bend_semitones: null,
    slide_from_fret: null,
    vibrato: false,
  } as PlayableNote;
}

const FACEPLATE: CSSProperties = {
  background: "linear-gradient(165deg, #2a2d33 0%, #1c1e22 55%, #15171a 100%)",
  boxShadow: "inset 0 1px 0 rgba(233,221,195,.08)",
};

/** Full amp faceplate: model pills + knobs + saved presets + try / reset / float. */
export function AmpRack({
  tone,
  amp,
  onTone,
  onAmp,
  testId = "amp-rack",
  compact = false,
}: {
  tone: LeadTone;
  amp: AmpKnobs;
  onTone: (t: LeadTone) => void;
  onAmp: (a: AmpKnobs) => void;
  testId?: string;
  compact?: boolean;
}) {
  const knobs = normalizeAmp(amp);
  const liveTone = normalizeLeadTone(tone);
  const [trying, setTrying] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [floating, setFloating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tryToken = useRef(0);

  const ampPresets = useApp((s) => s.prefs.ampPresets ?? []);
  const activeAmpPresetId = useApp((s) => s.prefs.activeAmpPresetId ?? null);
  const setPrefs = useApp((s) => s.setPrefs);

  useEffect(() => setMounted(true), []);

  const setKnob = (id: keyof AmpKnobs, v: number) => {
    onAmp({ ...knobs, [id]: v });
    // Dialing freely clears the active preset highlight.
    if (activeAmpPresetId) setPrefs({ activeAmpPresetId: null });
  };

  const chooseTone = (t: LeadTone) => {
    onTone(t);
    onAmp({ ...AMP_PRESETS[t] });
    if (activeAmpPresetId) setPrefs({ activeAmpPresetId: null });
  };

  const activatePreset = (preset: SavedAmpPreset) => {
    onTone(preset.tone);
    onAmp({ ...normalizeAmp(preset.amp) });
    setPrefs({ activeAmpPresetId: preset.id });
  };

  const savePreset = (explicitName?: string) => {
    if (ampPresets.length >= MAX_SAVED_AMP_PRESETS) return;
    const name = (explicitName ?? saveName).trim() || nextTonePresetName(liveTone, ampPresets);
    const preset = createAmpPreset(name, liveTone, knobs);
    setPrefs({
      ampPresets: [...ampPresets, preset],
      activeAmpPresetId: preset.id,
    });
    setSaveName("");
  };

  const saveToneAuto = () => {
    savePreset(nextTonePresetName(liveTone, ampPresets));
  };

  const deletePreset = (id: string) => {
    const next = ampPresets.filter((p) => p.id !== id);
    setPrefs({
      ampPresets: next,
      activeAmpPresetId: activeAmpPresetId === id ? null : activeAmpPresetId,
    });
  };

  const tryAmp = useCallback(async () => {
    const my = ++tryToken.current;
    setTrying(true);
    const player = getTheoryPlayer();
    player.stop();
    // High Palm → metal chug preview on the low E; otherwise a singing lead sample.
    const chug = knobs.mute >= 3;
    const notes = chug
      ? [
          { ...previewNote(40, 6, 0), id: "amp-preview-0", start_beat: 0, duration_beats: 0.35, technique: "palm_mute" as const },
          { ...previewNote(40, 6, 0), id: "amp-preview-1", start_beat: 0.4, duration_beats: 0.35, technique: "palm_mute" as const },
          { ...previewNote(43, 6, 3), id: "amp-preview-2", start_beat: 0.85, duration_beats: 0.55 },
          { ...previewNote(40, 6, 0), id: "amp-preview-3", start_beat: 1.5, duration_beats: 0.35, technique: "palm_mute" as const },
          { ...previewNote(40, 6, 0), id: "amp-preview-4", start_beat: 1.9, duration_beats: 0.35, technique: "palm_mute" as const },
          { ...previewNote(43, 6, 3), id: "amp-preview-5", start_beat: 2.35, duration_beats: 1.2 },
        ]
      : [
          previewNote(57, 3, 2), // A on G string
          { ...previewNote(64, 1, 5), id: "amp-preview-2", start_beat: 0.75, duration_beats: 2 },
        ];
    try {
      await player.play(
        { bpm: chug ? 108 : 96, lengthBeats: 4, events: [] },
        () => {},
        { lead: notes, leadTone: liveTone, amp: knobs },
      );
    } finally {
      if (tryToken.current === my) setTrying(false);
    }
  }, [liveTone, knobs]);

  useEffect(() => () => { tryToken.current += 1; getTheoryPlayer().stop(); }, []);

  // Escape docks the floating strip.
  useEffect(() => {
    if (!floating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFloating(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [floating]);

  const canSave = ampPresets.length < MAX_SAVED_AMP_PRESETS;
  const nextAutoName = nextTonePresetName(liveTone, ampPresets);

  const knobsRow = (opts: { float?: boolean; testSuffix?: string } = {}) => (
    <div
      className={
        opts.float
          ? "flex w-full min-w-0 flex-nowrap items-end justify-between gap-0.5"
          : "mt-4 flex flex-wrap justify-center gap-3 rounded-xl px-2 py-3 sm:justify-between"
      }
      style={opts.float ? undefined : { background: "rgba(0,0,0,.25)" }}
      role="group"
      aria-label="Amp knobs"
    >
      {AMP_KNOB_META.map((k) => (
        <AmpKnob
          key={k.id}
          label={k.label}
          value={knobs[k.id]}
          onChange={(v) => setKnob(k.id, v)}
          testId={`${testId}${opts.testSuffix ?? ""}-${k.id}`}
          fit={opts.float}
        />
      ))}
    </div>
  );

  const sideBtn =
    "inline-flex h-9 min-w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-panel-2 px-3 text-[0.7rem] font-semibold text-muted hover:text-ink disabled:opacity-40";

  const floatBar = floating && mounted
    ? createPortal(
        <div
          className="fixed inset-x-0 top-0 z-[9998] border-b border-line"
          style={{
            ...FACEPLATE,
            boxShadow: "0 6px 18px rgba(0,0,0,.4), inset 0 1px 0 rgba(233,221,195,.08)",
            paddingTop: "env(safe-area-inset-top)",
          }}
          role="toolbar"
          aria-label="Floating lead amp"
          data-testid={`${testId}-float`}
        >
          {/* Balanced strip: tones | knobs (no scroll) | save/dock */}
          <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[minmax(12rem,auto)_minmax(0,1fr)_minmax(12rem,auto)] items-center gap-3 px-3 py-2">
            <div className="flex min-w-0 flex-col items-start justify-center gap-1">
              <LeadToneSelector
                value={liveTone}
                onChange={chooseTone}
                testId={`${testId}-float-tone`}
                hint={false}
                compact
                hideLabel
              />
              {ampPresets.length > 0 && (
                <div className="flex max-w-full flex-wrap items-center gap-1" role="list" aria-label="Saved amp presets">
                  {ampPresets.map((preset) => {
                    const active = activeAmpPresetId === preset.id
                      || (!activeAmpPresetId && ampPresetMatches(preset, liveTone, knobs));
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="listitem"
                        aria-pressed={active}
                        title={preset.name}
                        className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${
                          active ? "bg-maple text-tolex" : "bg-panel-2 text-muted"
                        }`}
                        data-testid={`${testId}-float-preset-${preset.id}`}
                        onClick={() => activatePreset(preset)}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="min-w-0 px-1">
              {knobsRow({ float: true, testSuffix: "-float" })}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className={sideBtn}
                disabled={!canSave}
                title={canSave ? `Save as ${nextAutoName}` : `Max ${MAX_SAVED_AMP_PRESETS} presets`}
                data-testid={`${testId}-float-save`}
                onClick={saveToneAuto}
              >
                Save {nextAutoName}
              </button>
              <button
                type="button"
                className={sideBtn}
                data-testid={`${testId}-dock`}
                onClick={() => setFloating(false)}
              >
                Dock
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  if (floating) {
    return (
      <>
        <div
          className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-1.5"
          style={FACEPLATE}
          data-testid={testId}
          data-floating="true"
        >
          <p className="text-xs text-muted">Amp floating at top</p>
          <button
            type="button"
            className="btn btn-primary px-2 py-0.5 text-[0.65rem]"
            data-testid={`${testId}-dock-inline`}
            onClick={() => setFloating(false)}
          >
            Dock
          </button>
        </div>
        {floatBar}
      </>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-line ${compact ? "p-3" : "p-4 md:p-5"}`}
      style={FACEPLATE}
      data-testid={testId}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-wide text-faint">Guitar amp</p>
          <p className="display text-xl leading-none">Lead amp</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn btn-sm ${trying ? "btn-primary" : "btn-quiet"}`} data-testid={`${testId}-try`}
            onClick={() => (trying ? getTheoryPlayer().stop() : void tryAmp())}>
            {trying ? "Stop" : "Try amp"}
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            data-testid={`${testId}-float-btn`}
            onClick={() => setFloating(true)}
            title="Keep knobs on screen while you scroll"
          >
            Float amp
          </button>
          <button type="button" className="btn btn-quiet btn-sm" data-testid={`${testId}-reset`}
            onClick={() => {
              onAmp({ ...AMP_PRESETS[liveTone] });
              if (activeAmpPresetId) setPrefs({ activeAmpPresetId: null });
            }}>
            Reset knobs
          </button>
        </div>
      </div>

      <LeadToneSelector
        value={liveTone}
        onChange={chooseTone}
        testId={`${testId}-tone`}
        hint={!compact}
        compact={compact}
      />

      <div className="mt-4 space-y-2" data-testid={`${testId}-presets`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.65rem] uppercase tracking-wide text-faint">Saved presets</p>
          {!canSave && (
            <p className="text-xs text-faint">Max {MAX_SAVED_AMP_PRESETS} saved</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Saved amp presets">
          {ampPresets.length === 0 && (
            <p className="text-xs text-faint">Save a dial-in, then click it anytime to make it active.</p>
          )}
          {ampPresets.map((preset) => {
            const active = activeAmpPresetId === preset.id
              || (!activeAmpPresetId && ampPresetMatches(preset, liveTone, knobs));
            return (
              <div key={preset.id} className="flex items-center gap-0.5" role="listitem">
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`Use preset ${preset.name}`}
                  className={`chip ${active ? "bg-maple text-tolex" : ""}`}
                  data-testid={`${testId}-preset-${preset.id}`}
                  onClick={() => activatePreset(preset)}
                >
                  {preset.name}
                  {active ? " · active" : ""}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm px-1.5 text-faint"
                  aria-label={`Delete preset ${preset.name}`}
                  data-testid={`${testId}-preset-delete-${preset.id}`}
                  onClick={() => deletePreset(preset.id)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="field w-40 text-sm"
            placeholder="Preset name"
            maxLength={28}
            value={saveName}
            disabled={!canSave}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                savePreset();
              }
            }}
            aria-label="New amp preset name"
            data-testid={`${testId}-preset-name`}
          />
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            disabled={!canSave}
            data-testid={`${testId}-preset-save`}
            onClick={() => savePreset()}
            title={saveName.trim() ? undefined : `Empty name saves as ${nextAutoName}`}
          >
            Save amp
          </button>
        </div>
      </div>

      {knobsRow({})}
      <p className="mt-2 text-xs text-faint">
        Knobs apply the next time a lick or lead note plays. Use <span className="text-muted">Float amp</span> to keep a knob strip on screen while you scroll.
      </p>
    </div>
  );
}
