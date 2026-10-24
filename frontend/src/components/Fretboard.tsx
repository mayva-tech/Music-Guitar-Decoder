"use client";

import { memo, useId, useMemo } from "react";
import { computeLayout, type FretboardLayout, type Point } from "@/lib/music/fretboardLayout";
import { computeHand, pressOf, type HandShape } from "@/lib/music/handLayout";
import { useAnimatedHand } from "@/lib/music/useAnimatedHand";
import { STANDARD_TUNING, stringWords, fretWords, FINGER_NAMES } from "@/lib/music/guitar";
import { midiToName } from "@/lib/music/theory";
import type { Handedness, ScalePosition, ViewMode } from "@/lib/types";

export type MarkerStatus = "target" | "correct" | "wrong" | "next";

export interface FretMarker {
  string: number;
  fret: number;
  finger?: number | null;
  status: MarkerStatus;
  text?: string; // what to print inside the dot (finger number, interval or note name)
  technique?: string | null;
  bend?: number | null;
  fromFret?: number | null; // slide / hammer-on / pull-off start
  vibrato?: boolean;
}

export interface FretboardProps {
  handedness: Handedness;
  view: ViewMode;
  frets: number;
  equalSpacing?: boolean;
  zoom?: number;
  current?: FretMarker | null;
  next?: FretMarker | null;
  ghosts?: { string: number; fret: number }[];
  scale?: ScalePosition[] | null;
  hand?: { base: number; opacity: number } | null;
  /** animate finger changes and show the vibrating part of the pressed string */
  animate?: boolean;
  /** changes whenever a new note should be (re)struck, so the string animation replays */
  pulseKey?: string;
  showNoteNames?: boolean;
  onSelect?: (string: number, fret: number) => void;
  className?: string;
}

const STATUS_FILL: Record<MarkerStatus, string> = {
  target: "var(--color-maple)",
  correct: "var(--color-ok)",
  wrong: "var(--color-bad)",
  next: "transparent",
};

function FretboardImpl(props: FretboardProps) {
  const { handedness, view, frets, equalSpacing, zoom = 1, current, next, ghosts = [], scale, hand, showNoteNames, onSelect, animate = true, pulseKey } = props;
  const lay = useMemo(() => computeLayout({ handedness, view, frets, equalSpacing }), [handedness, view, frets, equalSpacing]);
  const uid = useId().replace(/:/g, "");
  const vertical = lay.orientation === "vertical";
  const visible = (m?: FretMarker | null) => m && m.fret <= frets && (m.fromFret == null || m.fromFret <= frets);

  const handShape = useMemo<HandShape | null>(() => {
    if (!hand) return null;
    const active = current && current.fret > 0 && current.finger ? { string: current.string, fret: current.fret, finger: current.finger } : null;
    return computeHand(lay, hand.base, active, frets);
  }, [hand, lay, current, frets]);

  // Room outside the neck for the palm.
  const pad = { top: 14, bottom: 0, left: 0, right: 0 };
  if (handShape) pad[handShape.pad.edge] += handShape.pad.amount;
  const vb = `${-pad.left} ${-pad.top} ${lay.width + pad.left + pad.right} ${lay.height + pad.top + pad.bottom}`;
  const vbW = lay.width + pad.left + pad.right;

  const label = current
    ? current.fret === 0
      ? `Play ${stringWords(current.string)} open (${midiToName(STANDARD_TUNING[current.string])}).`
      : `Play ${stringWords(current.string)} at the ${fretWords(current.fret)} fret with your ${FINGER_NAMES[current.finger ?? 1]} (${midiToName(STANDARD_TUNING[current.string] + current.fret)}).`
    : "Guitar fretboard";

  return (
    <div className={`scroll-x ${props.className ?? ""}`}>
      <svg
        role="img"
        aria-label={label}
        viewBox={vb}
        width={vertical ? vbW * zoom : undefined}
        style={vertical ? undefined : { width: `${100 * zoom}%`, minWidth: `${Math.round(vbW * 0.62 * zoom)}px` }}
        className="block mx-auto select-none"
        data-testid="fretboard"
        data-nut-side={lay.nutSide}
      >
        <NeckStatic lay={lay} uid={uid} frets={frets} onSelect={onSelect} />

        {scale && <ScaleOverlay lay={lay} frets={frets} scale={scale} />}

        {ghosts.filter((g) => g.fret <= frets).map((g, i) => {
          const p = lay.note(g.string, g.fret);
          return <circle key={`g${i}`} cx={p.x} cy={p.y} r={6} fill="var(--color-ink)" opacity="0.28" pointerEvents="none" />;
        })}

        {visible(current) && current && current.status !== "next" && (
          <PressedString key={pulseKey ?? `${current.string}-${current.fret}`} lay={lay} string={current.string} fret={current.fret} animate={animate} />
        )}

        {handShape && <HandOverlay shape={handShape} opacity={hand!.opacity} animate={animate} />}

        {visible(next) && next && <Marker kind="next" m={next} p={lay.note(next.string, next.fret)} showName={showNoteNames} />}
        {visible(current) && current && <TechniqueGuide m={current} lay={lay} side={handShape?.side ?? sideOf(lay)} />}
        {visible(current) && current && <Marker kind="current" m={current} p={lay.note(current.string, current.fret)} showName={showNoteNames} />}
      </svg>
    </div>
  );
}

export const Fretboard = memo(FretboardImpl);

function sideOf(lay: FretboardLayout): 1 | -1 {
  const a = (p: Point) => (lay.orientation === "vertical" ? p.x : p.y);
  return a(lay.note(1, 1)) > a(lay.note(6, 1)) ? 1 : -1;
}

/** Wood, frets, nut, strings, labels and click targets — only re-rendered when the layout changes. */
const NeckStatic = memo(function NeckStatic({ lay, uid, frets, onSelect }: {
  lay: FretboardLayout; uid: string; frets: number; onSelect?: (string: number, fret: number) => void;
}) {
  const vertical = lay.orientation === "vertical";
  const nutCaption = vertical
    ? { x: lay.board.x - 6, y: lay.nut.y1 - 4, anchor: "end" as const }
    : { x: lay.nut.x1, y: lay.board.y - 5, anchor: "middle" as const };
  return (
    <g>
      <defs>
        <linearGradient id={`wood-${uid}`} x1="0" y1="0" x2={vertical ? "1" : "0"} y2={vertical ? "0" : "1"}>
          <stop offset="0" stopColor="#5f3b28" />
          <stop offset="0.5" stopColor="#4a2e1f" />
          <stop offset="1" stopColor="#3d2519" />
        </linearGradient>
        <pattern id={`grain-${uid}`} width={vertical ? 7 : 140} height={vertical ? 140 : 7} patternUnits="userSpaceOnUse">
          {vertical
            ? <path d="M3 0 C1 40 5 90 3 140" stroke="#2b1a11" strokeOpacity="0.35" fill="none" strokeWidth="1" />
            : <path d="M0 3 C40 1 90 5 140 3" stroke="#2b1a11" strokeOpacity="0.35" fill="none" strokeWidth="1" />}
        </pattern>
      </defs>
      <rect x={lay.board.x} y={lay.board.y} width={lay.board.w} height={lay.board.h} rx="6" fill={`url(#wood-${uid})`} />
      <rect x={lay.board.x} y={lay.board.y} width={lay.board.w} height={lay.board.h} rx="6" fill={`url(#grain-${uid})`} />
      {lay.inlays.map((inl) =>
        inl.points.map((p, i) => <circle key={`${inl.fret}-${i}`} cx={p.x} cy={p.y} r={7} fill="#e9ddc3" opacity="0.55" />),
      )}
      {lay.fretWires.map((w) => (
        <line key={w.fret} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke="#c9c3b6" strokeWidth="3" strokeLinecap="round" data-fret-wire={w.fret} />
      ))}
      <line x1={lay.nut.x1} y1={lay.nut.y1} x2={lay.nut.x2} y2={lay.nut.y2} stroke="#e9ddc3" strokeWidth="10" strokeLinecap="round" data-testid="nut" />
      <text x={nutCaption.x} y={nutCaption.y} textAnchor={nutCaption.anchor} fontSize="12" fill="var(--color-muted)">Nut</text>
      {lay.strings.map((s) => (
        <g key={s.string} data-string={s.string}>
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.string >= 4 ? "#cdb98e" : "#dcd6ca"} strokeWidth={s.gauge} />
          <text x={s.labelPos.x} y={s.labelPos.y} textAnchor="middle" dominantBaseline="central" fontSize={vertical ? 13 : 17}
            fill="var(--color-ink)" data-string-label={s.string}>
            {vertical ? s.label.split(" · ")[1] : s.label}
          </text>
        </g>
      ))}
      {lay.fretNumbers.map((f) => (
        <text key={f.fret} x={f.pos.x} y={f.pos.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fill="var(--color-muted)" data-fret-number={f.fret}>
          {f.fret}
        </text>
      ))}
      {onSelect &&
        lay.strings.map((s) =>
          Array.from({ length: frets + 1 }, (_, f) => {
            const p = lay.note(s.string, f);
            return (
              <rect key={`${s.string}-${f}`} x={p.x - 22} y={p.y - 15} width={44} height={30} fill="transparent" className="cursor-pointer"
                onClick={() => onSelect(s.string, f)} aria-label={`${stringWords(s.string)}, ${f === 0 ? "open" : `fret ${f}`}`} />
            );
          }),
        )}
    </g>
  );
});

function ScaleOverlay({ lay, frets, scale }: { lay: FretboardLayout; frets: number; scale: ScalePosition[] }) {
  return (
    <g pointerEvents="none" data-testid="scale-overlay">
      {scale.filter((p) => p.fret <= frets).map((p) => {
        const c = lay.note(p.string, p.fret);
        return (
          <g key={`${p.string}-${p.fret}`} transform={`translate(${c.x} ${c.y})`} opacity="0.8">
            <circle r={10} fill={p.is_root ? "var(--color-maple)" : "var(--color-tolex)"} fillOpacity={p.is_root ? 0.9 : 0.75}
              stroke="var(--color-maple)" strokeWidth={1.4} strokeDasharray={p.is_blue ? "3 2" : undefined} />
            <text textAnchor="middle" dominantBaseline="central" fontSize="9.5" fontWeight="700"
              fill={p.is_root ? "var(--color-tolex)" : "var(--color-maple)"}>{p.degree}</text>
          </g>
        );
      })}
    </g>
  );
}

function capsule(a: Point, b: Point, w: number): string {
  // Rounded "finger" from a (tip) to b (knuckle) as a path.
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
  return `M${a.x + nx},${a.y + ny} L${b.x + nx},${b.y + ny} A${w / 2},${w / 2} 0 0 0 ${b.x - nx},${b.y - ny} L${a.x - nx},${a.y - ny} A${w / 2},${w / 2} 0 0 0 ${a.x + nx},${a.y + ny}Z`;
}

/**
 * The part of the string that actually sounds: from the pressed fret (or the nut, for an open
 * string) to the far end. It lights up and shimmers when the note is struck; a ripple marks
 * where the fingertip presses.
 */
function PressedString({ lay, string, fret, animate }: { lay: FretboardLayout; string: number; fret: number; animate: boolean }) {
  const s = lay.strings.find((x) => x.string === string);
  if (!s) return null;
  const vertical = lay.orientation === "vertical";
  const wire = fret > 0 ? lay.fretWires[fret - 1] : null;
  const start = wire ? (vertical ? { x: s.x1, y: wire.y1 } : { x: wire.x1, y: s.y1 }) : { x: s.x1, y: s.y1 };
  const end = { x: s.x2, y: s.y2 };
  const contact = lay.note(string, fret);
  return (
    <g pointerEvents="none" data-testid="pressed-string" data-string={string} data-fret={fret}>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="var(--color-maple)" strokeWidth={s.gauge + 5}
        strokeLinecap="round" opacity="0.28" className={animate ? "string-glow" : undefined} />
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#fff6e4" strokeWidth={s.gauge + 0.6} strokeLinecap="round"
        className={animate ? (vertical ? "string-vibrate-x" : "string-vibrate-y") : undefined} />
      {animate && fret > 0 && <circle cx={contact.x} cy={contact.y} r={12} fill="none" stroke="var(--color-maple)" strokeWidth="2.5" className="press-ripple" />}
    </g>
  );
}

/** The translucent fretting hand: palm outside the neck, four fingers reaching over it, thumb behind. */
function HandOverlay({ shape: target, opacity, animate }: { shape: HandShape; opacity: number; animate: boolean }) {
  const { shown, animating } = useAnimatedHand(target, animate);
  const shape = shown ?? target;
  const skin = "#e8c4a2";
  const edge = "#9b7556";
  return (
    <g pointerEvents="none" data-testid="hand-overlay" data-hand-base={target.base} data-animating={animating ? "true" : "false"} style={{ opacity }}>
      <path d={capsule(shape.thumb.tip, shape.thumb.root, shape.thumb.width)} fill={skin} fillOpacity="0.45" stroke={edge}
        strokeWidth="1.5" strokeDasharray="5 4" data-testid="hand-thumb" />
      <ellipse cx={shape.palm.cx} cy={shape.palm.cy} rx={shape.palm.rx} ry={shape.palm.ry} fill={skin} stroke={edge} strokeWidth="2" />
      {shape.fingers.map((f, i) => {
        const press = pressOf(f);
        const finalPressing = target.fingers[i]?.pressing ?? false;
        return (
          <g key={f.finger} data-testid={`hand-finger-${f.finger}`} data-fret={target.fingers[i]?.fret} data-pressing={finalPressing ? "true" : "false"}
            data-tip-x={f.tip.x.toFixed(1)} data-tip-y={f.tip.y.toFixed(1)}>
            <path d={capsule(f.tip, f.knuckle, f.width)} fill={skin} fillOpacity={0.7 + 0.3 * press} stroke={edge}
              strokeWidth={1.5 + press} strokeDasharray={press > 0.5 ? undefined : "5 4"} />
            {press < 0.5 && (
              <text x={f.tip.x} y={f.tip.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="900" fill="#1a1b1e"
                opacity={1 - press * 2}>{f.finger}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}

/** Arrows for bends (push towards the thick strings), slides and hammer-on/pull-off arcs. */
function TechniqueGuide({ m, lay, side }: { m: FretMarker; lay: FretboardLayout; side: 1 | -1 }) {
  const vertical = lay.orientation === "vertical";
  const p = lay.note(m.string, m.fret);
  const color = "var(--color-next)";
  const arrowHead = (to: Point, from: Point) => {
    const a = Math.atan2(to.y - from.y, to.x - from.x);
    const s = 7;
    return `M${to.x},${to.y} L${to.x - s * Math.cos(a - 0.5)},${to.y - s * Math.sin(a - 0.5)} L${to.x - s * Math.cos(a + 0.5)},${to.y - s * Math.sin(a + 0.5)}Z`;
  };
  const items: React.ReactNode[] = [];
  if ((m.technique === "bend" || m.technique === "bend_release") && m.bend) {
    const len = 20 + 12 * m.bend;
    const from = vertical ? { x: p.x - side * 17, y: p.y } : { x: p.x, y: p.y - side * 17 };
    const to = vertical ? { x: p.x - side * (17 + len), y: p.y } : { x: p.x, y: p.y - side * (17 + len) };
    items.push(
      <g key="bend" data-testid="guide-bend">
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth="3" />
        <path d={arrowHead(to, from)} fill={color} />
        <text x={to.x + (vertical ? -side * 4 : 14)} y={to.y + (vertical ? -10 : 0)} fontSize="12" fontWeight="800" fill={color} dominantBaseline="central">
          {m.bend === 2 ? "full" : "½"}{m.technique === "bend_release" ? " ↺" : ""}
        </text>
      </g>,
    );
  }
  if ((m.technique === "slide_up" || m.technique === "slide_down") && m.fromFret != null && m.fromFret > 0) {
    const a = lay.note(m.string, m.fromFret);
    items.push(
      <g key="slide" data-testid="guide-slide">
        <circle cx={a.x} cy={a.y} r={8} fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 2" />
        <line x1={a.x} y1={a.y} x2={p.x} y2={p.y} stroke={color} strokeWidth="3" strokeDasharray="6 3" />
        <path d={arrowHead(vertical ? { x: p.x, y: p.y - Math.sign(p.y - a.y) * 17 } : { x: p.x - Math.sign(p.x - a.x) * 17, y: p.y }, a)} fill={color} />
      </g>,
    );
  }
  if ((m.technique === "hammer_on" || m.technique === "pull_off") && m.fromFret != null && m.fromFret > 0) {
    const a = lay.note(m.string, m.fromFret);
    const mid = { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2 };
    const ctrl = vertical ? { x: mid.x + side * 28, y: mid.y } : { x: mid.x, y: mid.y - side * 28 };
    items.push(
      <g key="arc" data-testid="guide-legato">
        <path d={`M${a.x},${a.y} Q${ctrl.x},${ctrl.y} ${p.x},${p.y}`} fill="none" stroke={color} strokeWidth="2.5" />
        <text x={ctrl.x} y={ctrl.y + (vertical ? 0 : -side * 4)} textAnchor="middle" fontSize="12" fontWeight="800" fill={color}>
          {m.technique === "hammer_on" ? "h" : "p"}
        </text>
      </g>,
    );
  }
  if (m.vibrato) {
    const o = vertical ? { x: p.x + side * 22, y: p.y } : { x: p.x + 20, y: p.y + side * 20 };
    const d = vertical
      ? `M${o.x},${o.y - 12} q4,4 0,8 q-4,4 0,8 q4,4 0,8`
      : `M${o.x - 12},${o.y} q4,-4 8,0 q4,4 8,0 q4,-4 8,0`;
    items.push(<path key="vib" d={d} fill="none" stroke={color} strokeWidth="2.2" data-testid="guide-vibrato" />);
  }
  return <g pointerEvents="none">{items}</g>;
}

function Marker({ m, p, kind, showName }: { m: FretMarker; p: Point; kind: "current" | "next"; showName?: boolean }) {
  const r = 15;
  const open = m.fret === 0;
  // The pitch you hear: a bend sounds higher than the fret it is played on.
  const name = midiToName(STANDARD_TUNING[m.string] + m.fret + (m.technique === "bend" ? m.bend ?? 0 : 0));
  const fill = STATUS_FILL[m.status];
  const stroke = m.status === "next" ? "var(--color-next)" : fill;
  const text = m.text ?? (open ? "O" : String(m.finger ?? ""));
  const textColor = m.status === "next" ? "var(--color-next)" : "var(--color-tolex)";
  return (
    <g
      className="marker"
      style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
      pointerEvents="none"
      data-testid={`marker-${kind}`}
      data-string={m.string}
      data-fret={m.fret}
      data-status={m.status}
      data-x={p.x.toFixed(1)}
    >
      {kind === "current" && m.status === "target" && <circle r={r} fill="none" stroke={stroke} strokeWidth="3" className="pulse" />}
      <circle
        r={kind === "next" ? r - 2 : r}
        fill={kind === "next" ? "var(--color-tolex)" : fill}
        fillOpacity={kind === "next" ? 0.75 : 1}
        stroke={stroke}
        strokeWidth={kind === "next" ? 2.5 : open ? 4 : 0}
        strokeDasharray={kind === "next" ? "4 3" : undefined}
      />
      <text textAnchor="middle" dominantBaseline="central" fontSize={text.length > 1 ? 12 : kind === "next" ? 13 : 16} fontWeight="800" fill={textColor}>
        {text}
      </text>
      {showName && kind === "current" && (
        <text y={-r - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-ink)">{name}</text>
      )}
    </g>
  );
}
