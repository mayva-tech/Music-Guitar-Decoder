"use client";

import { useMemo } from "react";
import type { DetectedMelody } from "@/lib/types";
import { totalBars } from "@/lib/music/edit";

interface Props {
  melody: DetectedMelody;
  selected: string | null;
  playing?: string | null;
  onSelect: (id: string) => void;
}

const BEAT_W = 46;
const ROW = 13;

/** Detected notes as blocks over the raw pitch contour of the recording. */
export function PianoRoll({ melody, selected, playing, onSelect }: Props) {
  const bars = totalBars(melody);
  const beats = bars * melody.beats_per_bar;
  const mids = melody.notes.map((n) => n.midi);
  const lo = Math.min(...mids) - 2;
  const hi = Math.max(...mids) + 2;
  const height = (hi - lo + 1) * ROW + 24;
  const width = beats * BEAT_W + 20;
  const y = (m: number) => 22 + (hi - m) * ROW;

  const contour = useMemo(() => {
    const c = melody.contour;
    const first = melody.notes.find((n) => n.start_sec != null);
    if (!c || !first || first.start_sec == null) return [];
    const spb = 60 / melody.tempo_bpm;
    const segs: string[] = [];
    let cur: string[] = [];
    c.times.forEach((t, i) => {
      const m = c.midi[i];
      const beat = (t - first.start_sec!) / spb + melody.beat_offset;
      if (m == null || beat < -0.5 || beat > beats) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
        return;
      }
      cur.push(`${(10 + beat * BEAT_W).toFixed(1)},${(y(m) + ROW / 2).toFixed(1)}`);
    });
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs;
  }, [melody, beats, hi]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scroll-x rounded-2xl bg-tolex p-2">
      <svg width={width} height={height} role="group" aria-label="Detected notes" data-testid="piano-roll">
        {Array.from({ length: hi - lo + 1 }, (_, i) => {
          const m = hi - i;
          const black = [1, 3, 6, 8, 10].includes(m % 12);
          return <rect key={m} x={10} y={y(m)} width={beats * BEAT_W} height={ROW} fill={black ? "#202226" : "transparent"} />;
        })}
        {Array.from({ length: beats + 1 }, (_, b) => (
          <line key={b} x1={10 + b * BEAT_W} x2={10 + b * BEAT_W} y1={18} y2={height} stroke={b % melody.beats_per_bar === 0 ? "var(--color-faint)" : "#2c2f34"} strokeWidth={b % melody.beats_per_bar === 0 ? 1.5 : 1} />
        ))}
        {Array.from({ length: bars }, (_, b) => (
          <text key={b} x={14 + b * melody.beats_per_bar * BEAT_W} y={12} fontSize="11" fill="var(--color-muted)">Bar {b + 1}</text>
        ))}
        {contour.map((pts, i) => <polyline key={i} points={pts} fill="none" stroke="var(--color-muted)" strokeOpacity="0.55" strokeWidth="1.5" />)}
        {melody.notes.map((n, i) => {
          const sel = n.id === selected;
          const isPlaying = n.id === playing;
          const fill = isPlaying ? "var(--color-ok)" : n.low_confidence ? "var(--color-next)" : "var(--color-maple)";
          return (
            <g key={n.id} role="button" tabIndex={0} className="cursor-pointer" onClick={() => onSelect(n.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(n.id)}
              aria-label={`Note ${i + 1}, ${n.name}${n.low_confidence ? ", uncertain" : ""}`} data-testid={`roll-note-${i}`}>
              <rect x={10 + n.start_beat * BEAT_W + 1} y={y(n.midi) + 1} width={Math.max(8, n.duration_beats * BEAT_W - 3)} height={ROW - 2} rx="3"
                fill={fill} stroke={sel ? "#fff" : "none"} strokeWidth="2" />
              <text x={10 + n.start_beat * BEAT_W + 5} y={y(n.midi) - 3} fontSize="11" fontWeight="700" fill={n.low_confidence ? "var(--color-next)" : "var(--color-ink)"}>
                {n.name}{n.low_confidence ? "?" : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
