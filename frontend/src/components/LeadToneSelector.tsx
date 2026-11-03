"use client";

import { LEAD_TONES, leadToneBlurb, type LeadTone } from "@/lib/audio/leadTone";

/** Shared Clean / Crunch / Distortion / Wah / Blues control for practice pages. */
export function LeadToneSelector({
  value,
  onChange,
  testId = "lead-tone",
  hint = true,
  compact = false,
}: {
  value: LeadTone;
  onChange: (t: LeadTone) => void;
  testId?: string;
  hint?: boolean;
  /** Tighter pills for headers with less room. */
  compact?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted" id={`${testId}-label`}>Lead tone</p>
      <div
        role="radiogroup"
        aria-labelledby={`${testId}-label`}
        className={`flex flex-wrap gap-1 rounded-full bg-panel-2 p-1 ${compact ? "" : ""}`}
        data-testid={testId}
      >
        {LEAD_TONES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={value === t.id}
            title={t.blurb}
            data-testid={`${testId}-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`rounded-full font-semibold ${
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${value === t.id ? "bg-maple text-tolex" : "text-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {hint && (
        <p className="mt-1.5 max-w-[18rem] text-xs text-faint">
          {leadToneBlurb(value)} Applies to the next lick or lead note you play.
        </p>
      )}
    </div>
  );
}
