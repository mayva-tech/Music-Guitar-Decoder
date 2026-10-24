// Geometry of a translucent fretting hand drawn over the fretboard.
//
// The hand sits in a "position": the index finger covers fret `base`, middle base+1,
// ring base+2, pinky base+3 (one finger per fret). The base comes from the note data:
// base = fret − finger + 1. Fingers reach over the neck from the thin-string (e) edge;
// the thumb rests behind the neck and peeks over the thick-string (E) edge.
import type { FretboardLayout, Point } from "./fretboardLayout";

export interface HandNote {
  string: number;
  fret: number;
  finger: number;
}

export interface FingerShape {
  finger: 1 | 2 | 3 | 4;
  fret: number;
  tip: Point;
  knuckle: Point;
  pressing: boolean;
  width: number;
  press?: number; // 0 hovering … 1 pressing (set while animating)
}

export interface HandShape {
  base: number;
  fingers: FingerShape[];
  palm: { cx: number; cy: number; rx: number; ry: number };
  thumb: { tip: Point; root: Point; width: number };
  /** +1 when the fingers come from the larger coordinate side of the across axis */
  side: 1 | -1;
  /** extra drawing room needed outside the fretboard on the palm side */
  pad: { edge: "top" | "bottom" | "left" | "right"; amount: number };
}

/** Hand position (index-finger fret) for each note; open strings keep the previous position. */
export function handBases(notes: HandNote[]): number[] {
  const raw = notes.map((n) => (n.fret > 0 && n.finger > 0 ? Math.max(1, n.fret - n.finger + 1) : null));
  const out: number[] = [];
  let last: number | null = null;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] != null) last = raw[i];
    out.push(last ?? raw.find((r) => r != null) ?? 1);
  }
  return out;
}

// ~half a fret wide (~74 SVG units) so the tips read as fingers, not sticks.
const WIDTHS: Record<number, number> = { 1: 34, 2: 36, 3: 34, 4: 30 };

export function computeHand(lay: FretboardLayout, base: number, active: HandNote | null, frets: number): HandShape {
  const vertical = lay.orientation === "vertical";
  const along = (p: Point) => (vertical ? p.y : p.x);
  const across = (p: Point) => (vertical ? p.x : p.y);
  const pt = (al: number, ac: number): Point => (vertical ? { x: ac, y: al } : { x: al, y: ac });

  const acrossOf = (s: number) => across(lay.note(s, 1));
  const side: 1 | -1 = acrossOf(1) > acrossOf(6) ? 1 : -1;
  const boardLo = vertical ? lay.board.x : lay.board.y;
  const boardHi = boardLo + (vertical ? lay.board.w : lay.board.h);
  const fingerEdge = side > 0 ? boardHi : boardLo;
  const thumbEdge = side > 0 ? boardLo : boardHi;

  const b = Math.max(1, Math.min(base, Math.max(1, frets - 3)));
  const alongOf = (f: number) => along(lay.note(1, Math.max(1, Math.min(frets, f))));
  const pressing = active && active.fret > 0 && active.finger > 0 ? active : null;
  const hoverAcross = pressing ? acrossOf(pressing.string) : (acrossOf(3) + acrossOf(4)) / 2;
  const centerAlong = (alongOf(b) + alongOf(b + 3)) / 2;

  const fingers: FingerShape[] = ([1, 2, 3, 4] as const).map((k) => {
    const isActive = !!pressing && pressing.finger === k;
    const fret = isActive ? pressing!.fret : b + k - 1;
    const tipAlong = alongOf(fret);
    const tipAcross = isActive ? acrossOf(pressing!.string) : hoverAcross - side * (pressing ? 15 : 0); // hover just above the neck
    const knuckleAlong = tipAlong + (centerAlong - tipAlong) * 0.18;
    const knuckleAcross = fingerEdge + side * 28;
    return { finger: k, fret, tip: pt(tipAlong, tipAcross), knuckle: pt(knuckleAlong, knuckleAcross), pressing: isActive, width: WIDTHS[k] };
  });

  const span = Math.abs(alongOf(b + 3) - alongOf(b)) + 56;
  const palmAcross = fingerEdge + side * 58;
  const palmC = pt(centerAlong, palmAcross);
  const palm = vertical
    ? { cx: palmC.x, cy: palmC.y, rx: 46, ry: span / 2 }
    : { cx: palmC.x, cy: palmC.y, rx: span / 2, ry: 46 };

  const thumbAlong = alongOf(b + 1);
  const thumb = {
    tip: pt(thumbAlong, thumbEdge - side * 6),
    root: pt(centerAlong + (thumbAlong - centerAlong) * 0.2, thumbEdge + side * 22),
    width: 30,
  };

  const edge = vertical ? (side > 0 ? "right" : "left") : side > 0 ? "bottom" : "top";
  return { base: b, fingers, palm, thumb, side, pad: { edge, amount: 100 } };
}

// ---------------------------------------------------------------- animation

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpP = (a: Point, b: Point, t: number): Point => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** How firmly each finger presses (0 hovering … 1 pressing), so lifting and pressing can fade smoothly. */
export function pressOf(f: FingerShape): number {
  return f.press ?? (f.pressing ? 1 : 0);
}

/** A hand shape part-way between two positions (t = 0 → a, t = 1 → b). */
export function interpolateHand(a: HandShape, b: HandShape, t: number): HandShape {
  const k = Math.max(0, Math.min(1, t));
  const fingers = b.fingers.map((fb, i) => {
    const fa = a.fingers[i] ?? fb;
    const press = lerp(pressOf(fa), pressOf(fb), k);
    return {
      ...fb,
      tip: lerpP(fa.tip, fb.tip, k),
      knuckle: lerpP(fa.knuckle, fb.knuckle, k),
      width: lerp(fa.width, fb.width, k),
      fret: k < 0.5 ? fa.fret : fb.fret,
      pressing: press >= 0.5,
      press,
    };
  });
  return {
    ...b,
    base: k < 0.5 ? a.base : b.base,
    fingers,
    palm: { cx: lerp(a.palm.cx, b.palm.cx, k), cy: lerp(a.palm.cy, b.palm.cy, k), rx: lerp(a.palm.rx, b.palm.rx, k), ry: lerp(a.palm.ry, b.palm.ry, k) },
    thumb: { tip: lerpP(a.thumb.tip, b.thumb.tip, k), root: lerpP(a.thumb.root, b.thumb.root, k), width: lerp(a.thumb.width, b.thumb.width, k) },
  };
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
