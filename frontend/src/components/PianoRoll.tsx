"use client";

import { useMemo, useRef, useState } from "react";
import type { DetectedMelody } from "@/lib/types";
import { moveNote, totalBars } from "@/lib/music/edit";

interface Props {
  melody: DetectedMelody;
  selected: string | null;
  playing?: string | null;
  onSelect: (id: string) => void;
  onChange?: (melody: DetectedMelody) => void;
}

const BEAT_W = 46;
const ROW = 13;
const RESIZE_PX = 8;

type Drag =
  | { mode: "move"; id: string; originX: number; originY: number; startBeat: number; midi: number }
  | { mode: "resize"; id: string; originX: number; duration: number };

function svgCoords(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/** Detected notes as blocks over the raw pitch contour of the recording. */
export function PianoRoll({ melody, selected, playing, onSelect, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const movedRef = useRef(false);
  const [dragMidi, setDragMidi] = useState<number | null>(null);

  const bars = totalBars(melody);
  const beats = bars * melody.beats_per_bar;
  const mids = melody.notes.map((n) => n.midi);
  const loBase = Math.min(...mids) - 2;
  const hiBase = Math.max(...mids) + 2;
  const lo = dragMidi != null ? Math.min(loBase, dragMidi - 2) : loBase;
  const hi = dragMidi != null ? Math.max(hiBase, dragMidi + 2) : hiBase;
  const height = (hi - lo + 1) * ROW + 24;
  const width = Math.max(beats, ...melody.notes.map((n) => n.start_beat + n.duration_beats)) * BEAT_W + 20;
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

  const melodyRef = useRef(melody);
  melodyRef.current = melody;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const applyDrag = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    const change = onChangeRef.current;
    const cur = melodyRef.current;
    if (!drag || !svg || !change) return;
    const { x, y: py } = svgCoords(svg, clientX, clientY);
    if (drag.mode === "move") {
      const dxBeats = (x - drag.originX) / BEAT_W;
      const dyRows = (drag.originY - py) / ROW;
      const next = moveNote(cur, drag.id, {
        start_beat: drag.startBeat + dxBeats,
        midi: drag.midi + dyRows,
      });
      const note = next.notes.find((n) => n.id === drag.id);
      const prev = cur.notes.find((n) => n.id === drag.id);
      if (note) setDragMidi(note.midi);
      if (note && prev && (note.start_beat !== prev.start_beat || note.midi !== prev.midi)) {
        movedRef.current = true;
        change(next);
      }
    } else {
      const dxBeats = (x - drag.originX) / BEAT_W;
      const next = moveNote(cur, drag.id, { duration_beats: drag.duration + dxBeats });
      const note = next.notes.find((n) => n.id === drag.id);
      const prev = cur.notes.find((n) => n.id === drag.id);
      if (note && prev && note.duration_beats !== prev.duration_beats) {
        movedRef.current = true;
        change(next);
      }
    }
  };

  const endDrag = (pointerId: number) => {
    if (!dragRef.current) return;
    const svg = svgRef.current;
    try { svg?.releasePointerCapture(pointerId); } catch { /* ignore */ }
    dragRef.current = null;
    setDragMidi(null);
  };

  const startMove = (e: React.PointerEvent, id: string, startBeat: number, midi: number) => {
    if (!onChange || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const { x, y: py } = svgCoords(svg, e.clientX, e.clientY);
    dragRef.current = { mode: "move", id, originX: x, originY: py, startBeat, midi };
    movedRef.current = false;
    onSelect(id);
    svg.setPointerCapture(e.pointerId);
  };

  const startResize = (e: React.PointerEvent, id: string, duration: number) => {
    if (!onChange || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const { x } = svgCoords(svg, e.clientX, e.clientY);
    dragRef.current = { mode: "resize", id, originX: x, duration };
    movedRef.current = false;
    onSelect(id);
    svg.setPointerCapture(e.pointerId);
  };

  return (
    <div className="scroll-x rounded-2xl bg-tolex p-2">
      {onChange && (
        <p className="mb-1.5 px-1 text-xs text-muted">
          Drag a note to move it. Drag its right edge to stretch or shorten.
        </p>
      )}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="group"
        aria-label="Detected notes"
        data-testid="piano-roll"
        className="touch-none select-none"
        onPointerMove={(e) => { if (dragRef.current) applyDrag(e.clientX, e.clientY); }}
        onPointerUp={(e) => endDrag(e.pointerId)}
        onPointerCancel={(e) => endDrag(e.pointerId)}
      >
        {Array.from({ length: hi - lo + 1 }, (_, i) => {
          const m = hi - i;
          const black = [1, 3, 6, 8, 10].includes(m % 12);
          return <rect key={m} x={10} y={y(m)} width={width - 20} height={ROW} fill={black ? "#202226" : "transparent"} />;
        })}
        {Array.from({ length: Math.ceil((width - 20) / BEAT_W) + 1 }, (_, b) => (
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
          const nx = 10 + n.start_beat * BEAT_W + 1;
          const ny = y(n.midi) + 1;
          const nw = Math.max(8, n.duration_beats * BEAT_W - 3);
          const nh = ROW - 2;
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              className={onChange ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
              onClick={() => { if (!movedRef.current) onSelect(n.id); movedRef.current = false; }}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(n.id)}
              onPointerDown={(e) => startMove(e, n.id, n.start_beat, n.midi)}
              aria-label={`Note ${i + 1}, ${n.name}${n.low_confidence ? ", uncertain" : ""}. Drag to move.`}
              data-testid={`roll-note-${i}`}
            >
              <rect x={nx} y={ny} width={nw} height={nh} rx="3"
                fill={fill} stroke={sel ? "#fff" : "none"} strokeWidth="2" />
              <text x={nx + 4} y={ny - 4} fontSize="11" fontWeight="700" fill={n.low_confidence ? "var(--color-next)" : "var(--color-ink)"}
                style={{ pointerEvents: "none" }}>
                {n.name}{n.low_confidence ? "?" : ""}
              </text>
              {onChange && (
                <rect
                  x={nx + nw - RESIZE_PX}
                  y={ny}
                  width={RESIZE_PX}
                  height={nh}
                  fill="transparent"
                  className="cursor-ew-resize"
                  data-testid={`roll-resize-${i}`}
                  onPointerDown={(e) => startResize(e, n.id, n.duration_beats)}
                  aria-label={`Resize note ${i + 1}`}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
