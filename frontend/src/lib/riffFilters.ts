import type { RiffInfo } from "@/lib/types";

export type TypeFilter = RiffInfo["source"] | "modern" | "blues_rock";

/** Which riffs each "Type" chip shows. The blues-rock set has its own chip, so it is left out of Modern styles. */
export function matchesType(r: RiffInfo, type: TypeFilter): boolean {
  if (type === "blues_rock") return r.collection === "blues_rock";
  if (type === "modern") return !!r.vibe && !r.collection;
  return r.source === type && (type !== "original" || !r.vibe);
}

/** "E7 E7 A7 A7 …" → "E7 ×2 · A7 ×2 · …" so a 12-bar progression fits on a line. */
export function chordLine(bars: string[]): string {
  const out: { chord: string; n: number }[] = [];
  for (const c of bars) {
    const last = out[out.length - 1];
    if (last && last.chord === c) last.n += 1;
    else out.push({ chord: c, n: 1 });
  }
  return out.map(({ chord, n }) => (chord.includes(" ") ? `(${chord})` : chord) + (n > 1 ? ` ×${n}` : "")).join(" · ");
}
