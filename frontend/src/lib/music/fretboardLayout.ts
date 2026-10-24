// Fretboard geometry. Every view is computed from the same string/fret data —
// nothing is mirrored with CSS. Coordinates are SVG user units.
import type { Handedness, ViewMode } from "../types";
import { STRING_LABELS } from "./guitar";

export interface LayoutConfig {
  handedness: Handedness;
  view: ViewMode;
  frets: number; // number of frets drawn (>= 5)
  equalSpacing?: boolean;
  scale?: number; // zoom multiplier
}

export interface Point {
  x: number;
  y: number;
}

export interface FretboardLayout {
  width: number;
  height: number;
  orientation: "horizontal" | "vertical";
  nutSide: "left" | "right" | "top";
  /** strings in display order: first = top (horizontal) or left (vertical) */
  stringOrder: number[];
  board: { x: number; y: number; w: number; h: number };
  nut: { x1: number; y1: number; x2: number; y2: number };
  strings: { string: number; label: string; x1: number; y1: number; x2: number; y2: number; gauge: number; labelPos: Point }[];
  fretWires: { fret: number; x1: number; y1: number; x2: number; y2: number }[];
  fretNumbers: { fret: number; pos: Point }[];
  inlays: { fret: number; points: Point[] }[];
  note: (string: number, fret: number) => Point;
  openMarker: (string: number) => Point;
  mutedMarker: (string: number) => Point;
}

const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const GAUGE: Record<number, number> = { 1: 1.2, 2: 1.5, 3: 1.9, 4: 2.4, 5: 2.9, 6: 3.4 };

/** Distance of each fret wire from the nut, 0..length. Real guitars use the 12th-root-of-2 rule. */
export function fretPositions(frets: number, length: number, equal = false): number[] {
  const out: number[] = [];
  if (equal) {
    for (let n = 0; n <= frets; n++) out.push((n / frets) * length);
    return out;
  }
  const d = (n: number) => 1 - Math.pow(2, -n / 12);
  const total = d(frets);
  for (let n = 0; n <= frets; n++) out.push((d(n) / total) * length);
  return out;
}

/** All fretboard views match standard TAB: thin e (1) first, thick E (6) last. */
export function displayStringOrder(_view: ViewMode, _handedness: Handedness): number[] {
  return [1, 2, 3, 4, 5, 6];
}

export function nutSideFor(view: ViewMode, handedness: Handedness): "left" | "right" | "top" {
  if (view === "vertical") return "top";
  const right = handedness === "right";
  if (view === "facing") return right ? "right" : "left"; // seeing a teacher face-to-face
  return right ? "left" : "right";
}

export function computeLayout(cfg: LayoutConfig): FretboardLayout {
  const frets = Math.max(5, Math.min(24, Math.round(cfg.frets)));
  const k = cfg.scale ?? 1;
  const nutSide = nutSideFor(cfg.view, cfg.handedness);
  const order = displayStringOrder(cfg.view, cfg.handedness);
  const vertical = nutSide === "top";

  const stringGap = 34 * k;
  const edgePad = 14 * k;
  const across = stringGap * 5 + edgePad * 2;
  const perFret = (vertical ? 62 : 74) * k;
  const along = perFret * frets * (cfg.equalSpacing ? 1 : 1.12);
  const labelGutter = 64 * k; // string names
  const openZone = 46 * k; // where "O" / "X" sit, outside the nut
  const farPad = 18 * k;
  const numberGutter = 34 * k;
  const topPad = 16 * k;

  const wires = fretPositions(frets, along, cfg.equalSpacing);
  let width: number, height: number, boardX: number, boardY: number;

  if (!vertical) {
    width = labelGutter + openZone + along + farPad;
    height = topPad + across + numberGutter;
    boardY = topPad;
    boardX = nutSide === "left" ? labelGutter + openZone : farPad;
  } else {
    width = across + 2 * 24 * k;
    height = topPad + openZone + along + numberGutter;
    boardX = 24 * k;
    boardY = topPad + openZone;
  }

  // along-neck coordinate of a distance d from the nut
  const alongCoord = (d: number): number => {
    if (vertical) return boardY + d;
    return nutSide === "left" ? boardX + d : boardX + along - d;
  };
  const acrossCoord = (s: number): number => {
    const i = order.indexOf(s);
    return (vertical ? boardX : boardY) + edgePad + i * stringGap;
  };
  const toPoint = (alongV: number, acrossV: number): Point => (vertical ? { x: acrossV, y: alongV } : { x: alongV, y: acrossV });

  const nutPos = alongCoord(0);
  const openDist = -openZone * 0.5;

  const board = vertical ? { x: boardX, y: boardY, w: across, h: along } : { x: boardX, y: boardY, w: along, h: across };
  const nut = vertical
    ? { x1: boardX, y1: nutPos, x2: boardX + across, y2: nutPos }
    : { x1: nutPos, y1: boardY, x2: nutPos, y2: boardY + across };

  const farEnd = alongCoord(along);
  const strings = order.map((s) => {
    const a = acrossCoord(s);
    const p1 = toPoint(nutPos, a);
    const p2 = toPoint(farEnd, a);
    const labelPos = vertical
      ? { x: a, y: boardY + along + numberGutter * 0.6 }
      : { x: nutSide === "left" ? labelGutter * 0.45 : width - labelGutter * 0.45, y: a };
    return { string: s, label: `${s} · ${STRING_LABELS[s]}`, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, gauge: GAUGE[s] * k, labelPos };
  });

  const fretWires = wires.slice(1).map((d, i) => {
    const c = alongCoord(d);
    return vertical
      ? { fret: i + 1, x1: boardX, y1: c, x2: boardX + across, y2: c }
      : { fret: i + 1, x1: c, y1: boardY, x2: c, y2: boardY + across };
  });

  const centerOfFret = (f: number) => alongCoord(wires[f - 1] + 0.55 * (wires[f] - wires[f - 1]));
  const fretNumbers = Array.from({ length: frets }, (_, i) => {
    const f = i + 1;
    const c = centerOfFret(f);
    return { fret: f, pos: vertical ? { x: boardX + across + 14 * k, y: c } : { x: c, y: boardY + across + numberGutter * 0.62 } };
  });

  const mid = (vertical ? boardX : boardY) + across / 2;
  const inlays = INLAY_FRETS.filter((f) => f <= frets).map((f) => {
    const c = centerOfFret(f);
    if (f % 12 === 0) {
      const a1 = acrossCoord(order[1]) + stringGap / 2;
      const a2 = acrossCoord(order[3]) + stringGap / 2;
      return { fret: f, points: [toPoint(c, a1), toPoint(c, a2)] };
    }
    return { fret: f, points: [toPoint(c, mid)] };
  });

  const note = (s: number, f: number): Point => {
    if (f === 0) return toPoint(alongCoord(openDist), acrossCoord(s));
    if (f > frets) throw new RangeError(`Fret ${f} is beyond the ${frets} frets shown`);
    return toPoint(centerOfFret(f), acrossCoord(s));
  };

  return {
    width, height, orientation: vertical ? "vertical" : "horizontal", nutSide, stringOrder: order,
    board, nut, strings, fretWires, fretNumbers, inlays, note,
    openMarker: (s) => note(s, 0),
    mutedMarker: (s) => note(s, 0),
  };
}
