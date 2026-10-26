"use client";

import { useId, useMemo } from "react";
import { MAX_FRET } from "@/lib/music/guitar";
import { computeLayout } from "@/lib/music/fretboardLayout";
import {
  SCALE_ROOTS,
  noteMarkerColors,
  rootPc,
  scaleKindPcs,
  type FretmapCell,
  type ScaleMode,
  type ScaleRoot,
} from "@/lib/music/scaleFretmap";
import type { ChordShape } from "@/lib/music/chordShapes";
import { shapeToHighlights } from "@/lib/music/chordShapes";
import {
  BOX_MODES,
  chordToneCells,
  lickOverlay,
  lickWindow,
  pentatonicBox,
  type LickGlyph,
} from "@/lib/music/soloGuide";
import type { PlayableNote } from "@/lib/types";

interface Props {
  cells: FretmapCell[];
  /** Prefer equal spacing so the long neck stays readable when scrolled. */
  equalSpacing?: boolean;
  /** When set, finger placement for this shape is highlighted on the neck. */
  chordShape?: ChordShape | null;
  /** Root / mode of `cells` (inferred from the cells when omitted). Needed for `box` and `chordTones`. */
  root?: ScaleRoot;
  mode?: ScaleMode;
  /** 0 = none; fades scale notes outside the pentatonic box to ~0.16. */
  box?: number;
  /** Ring the tones of this chord (maple); dashed marker for tones outside the scale. */
  chordTones?: string | null;
  /** Draws a lick on the neck (numbered markers + technique glyphs; `compact` = markers only). */
  lick?: { notes: PlayableNote[]; compact?: boolean } | null;
  /** Indices of lick notes sounding now (alternatively toggle `.is-on` on `[data-hl="n<i>"]`). */
  litNotes?: ReadonlySet<number>;
  /** Crop to a fret range (small card diagrams); string letters move to a left gutter. */
  fretWindow?: { from: number; to: number };
}

const BOX_DIM = 0.16;
const LICK_DIM = 0.28;
const PLACE_DIM = 0.22;

/** Best-effort root + mode for a fretmap (the cell list does not carry them). */
function inferScale(cells: FretmapCell[]): { root: ScaleRoot; mode: ScaleMode } | null {
  const pcs = new Set<number>();
  let rootName: string | null = null;
  for (const c of cells) {
    if (!c.inScale) continue;
    pcs.add(((c.midi % 12) + 12) % 12);
    if (c.isRoot) rootName = c.name;
  }
  if (!rootName || !(SCALE_ROOTS as readonly string[]).includes(rootName)) return null;
  const root = rootName as ScaleRoot;
  const tonic = rootPc(root);
  const mode = BOX_MODES.find((m) => {
    const want = scaleKindPcs(tonic, m);
    return want.length === pcs.size && want.every((pc) => pcs.has(pc));
  });
  return { root, mode: mode ?? "major" };
}

/**
 * Real guitar neck with scale notes as solid colored circles.
 * Optional chordShape overlays finger numbers for placement practice. Optional box / chordTones /
 * lick layers (Lead Solo Workshop) draw on top without changing the default rendering.
 */
export function ScaleFretmapNeck({
  cells,
  equalSpacing = true,
  chordShape = null,
  root: rootProp,
  mode: modeProp,
  box = 0,
  chordTones = null,
  lick = null,
  litNotes,
  fretWindow,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const frets = MAX_FRET;
  const lay = useMemo(
    () => computeLayout({ handedness: "right", view: "beginner", frets, equalSpacing }),
    [equalSpacing, frets],
  );

  const scaleCells = cells.filter((c) => c.inScale && c.fret <= frets);
  const highlights = useMemo(
    () => (chordShape ? shapeToHighlights(chordShape) : []),
    [chordShape],
  );
  const placing = highlights.length > 0;
  const lickNotes = lick?.notes ?? null;
  const compact = !!lick?.compact;

  const inferred = useMemo(
    () => (rootProp && modeProp ? null : inferScale(cells)),
    [cells, rootProp, modeProp],
  );
  const root = rootProp ?? inferred?.root;
  const mode = modeProp ?? inferred?.mode;

  const nearFret = useMemo(() => (lickNotes && lickNotes.length ? lickWindow(lickNotes).from : undefined), [lickNotes]);

  const boxCells = useMemo(() => {
    if (!box || !root || !mode) return null;
    return pentatonicBox(root, mode, box, nearFret);
  }, [box, root, mode, nearFret]);
  const inBox = useMemo(
    () => (boxCells ? new Set(boxCells.map((c) => `${c.string}:${c.fret}`)) : null),
    [boxCells],
  );

  const ringCells = useMemo(() => {
    if (!chordTones || !root || !mode) return [];
    return chordToneCells(chordTones, root, mode, box, frets, nearFret).filter((c) => c.fret <= frets);
  }, [chordTones, root, mode, box, frets, nearFret]);

  const overlay = useMemo(() => (lickNotes ? lickOverlay(lickNotes) : null), [lickNotes]);

  const at = (s: number, f: number) => (f === 0 ? lay.openMarker(s) : lay.note(s, f));

  // Headroom above string 1 for bend arrows / hammer arcs.
  const pad = useMemo(() => {
    if (!overlay || compact) return 0;
    let p = 0;
    for (const g of overlay.glyphs) {
      if (g.kind === "bend" || g.kind === "bend_release") p = Math.max(p, 58);
      else if (g.kind === "hammer_on" || g.kind === "pull_off") p = Math.max(p, 36);
    }
    return p;
  }, [overlay, compact]);

  // Crop geometry for card diagrams.
  const crop = useMemo(() => {
    if (!fretWindow) return null;
    const from = Math.max(0, Math.min(fretWindow.from, frets - 1));
    const to = Math.max(from + 1, Math.min(fretWindow.to, frets));
    const wireX = (f: number) => lay.fretWires.find((w) => w.fret === f)?.x1 ?? lay.nut.x1;
    const left = from === 0 ? lay.nut.x1 - 44 : wireX(from - 1) + 2;
    const right = wireX(to) + 6;
    const gutter = 26;
    return { from, to, x: left - gutter, w: right - left + gutter, gutterX: left - gutter / 2 };
  }, [fretWindow, lay, frets]);

  const viewBox = crop
    ? `${crop.x} ${-pad} ${crop.w} ${lay.height + pad}`
    : `0 ${-pad} ${lay.width} ${lay.height + pad}`;

  const dimLayer = lickNotes ? LICK_DIM : placing ? PLACE_DIM : 1;
  const label = placing
    ? "Guitar fretboard with chord finger placement"
    : lickNotes
      ? "Guitar fretboard showing a lick"
      : "Guitar fretboard with scale notes highlighted";

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={viewBox}
      {...(crop ? {} : { width: lay.width, height: lay.height + pad })}
      className={crop ? "block h-auto w-full select-none" : "block select-none"}
      data-testid="scale-fretmap-board"
      data-nut-side={lay.nutSide}
      data-chord-highlight={placing ? "true" : undefined}
      data-box={box ? String(box) : undefined}
      data-lick={lickNotes ? "true" : undefined}
    >
      <defs>
        <linearGradient id={`wood-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5f3b28" />
          <stop offset="0.5" stopColor="#4a2e1f" />
          <stop offset="1" stopColor="#3d2519" />
        </linearGradient>
        <pattern id={`grain-${uid}`} width="140" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 3 C40 1 90 5 140 3" stroke="#2b1a11" strokeOpacity="0.35" fill="none" strokeWidth="1" />
        </pattern>
        <marker id={`arrow-${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--color-maple)" />
        </marker>
      </defs>

      <rect x={lay.board.x} y={lay.board.y} width={lay.board.w} height={lay.board.h} rx="6" fill={`url(#wood-${uid})`} />
      <rect x={lay.board.x} y={lay.board.y} width={lay.board.w} height={lay.board.h} rx="6" fill={`url(#grain-${uid})`} />

      {lay.inlays.map((inl) =>
        inl.points.map((p, i) => (
          <circle key={`${inl.fret}-${i}`} cx={p.x} cy={p.y} r={7} fill="#e9ddc3" opacity="0.55" />
        )),
      )}

      {lay.fretWires.map((w) => (
        <line key={w.fret} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
          stroke="#c9c3b6" strokeWidth="3" strokeLinecap="round" />
      ))}

      <line x1={lay.nut.x1} y1={lay.nut.y1} x2={lay.nut.x2} y2={lay.nut.y2}
        stroke="#e9ddc3" strokeWidth="10" strokeLinecap="round" data-testid="nut" />
      {!crop && (
        <text x={lay.nut.x1} y={lay.board.y - 5} textAnchor="middle" fontSize="12" fill="var(--color-muted)">Nut</text>
      )}

      {lay.strings.map((s) => (
        <g key={s.string}>
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={s.string >= 4 ? "#cdb98e" : "#dcd6ca"} strokeWidth={s.gauge} />
          {crop ? (
            <text x={crop.gutterX} y={s.labelPos.y} textAnchor="middle" dominantBaseline="central"
              fontSize="15" fontWeight="700" fill="var(--color-muted)" data-string-letter={s.string}>
              {s.label.split("· ")[1] ?? s.label}
            </text>
          ) : (
            <text x={s.labelPos.x} y={s.labelPos.y} textAnchor="middle" dominantBaseline="central"
              fontSize="15" fill="var(--color-ink)">
              {s.label}
            </text>
          )}
        </g>
      ))}

      {lay.fretNumbers
        .filter((f) => !crop || (f.fret >= crop.from && f.fret <= crop.to))
        .map((f) => (
          <text key={f.fret} x={f.pos.x} y={f.pos.y} textAnchor="middle" dominantBaseline="central"
            fontSize="13" fill="var(--color-muted)">
            {f.fret}
          </text>
        ))}

      {/* Scale notes — dimmed while a chord placement or a lick is shown; faded outside the box */}
      <g opacity={dimLayer} data-testid="scale-note-layer">
        {scaleCells.map((cell) => {
          const p = at(cell.string, cell.fret);
          const r = 13;
          const { fill, ink } = noteMarkerColors(cell.name);
          const inside = !inBox || inBox.has(`${cell.string}:${cell.fret}`);
          return (
            <g
              key={`${cell.string}-${cell.fret}`}
              transform={`translate(${p.x} ${p.y})`}
              data-in-scale="true"
              data-note={cell.name}
              data-in-box={inBox ? String(inside) : undefined}
              data-pos={inBox ? `${cell.string}:${cell.fret}` : undefined}
              opacity={inBox && !inside ? BOX_DIM : undefined}
            >
              <circle r={r} fill={fill} />
              <text textAnchor="middle" dominantBaseline="central"
                fontSize={cell.name.length > 1 ? 10 : 12} fontWeight="800" fill={ink}>
                {cell.name}
              </text>
            </g>
          );
        })}
      </g>

      {/* Chord tones: maple ring around scale tones, dashed marker where the tone is outside the scale */}
      {ringCells.length > 0 && (
        <g data-testid="chord-tone-layer" data-chord={chordTones ?? undefined}>
          {ringCells.map((c) => {
            const p = at(c.string, c.fret);
            if (c.inScale) {
              return (
                <circle key={`ring-${c.string}-${c.fret}`} cx={p.x} cy={p.y} r={17} fill="none"
                  stroke="var(--color-maple)" strokeWidth="3" data-chord-ring={`${c.string}:${c.fret}`} />
              );
            }
            const { fill } = noteMarkerColors(c.name);
            return (
              <g key={`out-${c.string}-${c.fret}`} transform={`translate(${p.x} ${p.y})`}
                data-chord-outside={`${c.string}:${c.fret}`} data-note={c.name}>
                <circle r={14} fill="#1a1b1e" fillOpacity="0.55" stroke="var(--color-maple)" strokeWidth="2.5" strokeDasharray="4 3" />
                <text textAnchor="middle" dominantBaseline="central"
                  fontSize={c.name.length > 1 ? 10 : 12} fontWeight="800" fill={fill}>
                  {c.name}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Chord finger placement */}
      {placing && (
        <g data-testid="chord-place-layer">
          {highlights.map((h) => {
            if (h.muted) {
              const p = lay.openMarker(h.string);
              return (
                <text key={`x-${h.string}`} x={p.x} y={p.y + 5} textAnchor="middle"
                  fontSize="16" fontWeight="900" fill="var(--color-muted)">
                  ×
                </text>
              );
            }
            const p = h.fret === 0 ? lay.openMarker(h.string) : lay.note(h.string, h.fret);
            const open = h.fret === 0;
            return (
              <g key={`h-${h.string}-${h.fret}`} transform={`translate(${p.x} ${p.y})`}
                data-place-string={h.string} data-place-fret={h.fret}>
                <circle r={16} fill="none" stroke="var(--color-maple)" strokeWidth="3" opacity="0.85" />
                <circle r={14} fill="var(--color-maple)" />
                <text textAnchor="middle" dominantBaseline="central" fontSize={open ? 14 : 15}
                  fontWeight="900" fill="var(--color-tolex)">
                  {open ? "O" : String(h.finger ?? "")}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Lick layer */}
      {overlay && (
        <g data-testid="lick-layer">
          {!compact && overlay.glyphs.map((g, gi) => (
            <GlyphShape key={`g-${gi}`} g={g} at={at} arrowId={`arrow-${uid}`} />
          ))}
          {overlay.markers.map((m) => {
            const p = at(m.string, m.fret);
            const { fill, ink } = noteMarkerColors(m.name);
            return (
              <g key={`m-${m.string}-${m.fret}`} transform={`translate(${p.x} ${p.y})`}
                data-lick-marker={`${m.string}:${m.fret}`} data-note={m.name}>
                {m.noteIndices.map((ni, k) => (
                  <g key={ni} className={`solo-hl${litNotes?.has(ni) ? " is-on" : ""}`} data-hl={`n${ni}`}>
                    <circle className="solo-ring" r={19} fill="none" stroke="var(--color-maple)" strokeWidth="3.5" />
                    {k === 0 && (
                      <>
                        <circle r={14} fill={fill} stroke="#1a1b1e" strokeWidth="2.5" />
                        <text textAnchor="middle" dominantBaseline="central"
                          fontSize={m.name.length > 1 ? 10 : 12} fontWeight="800" fill={ink}>
                          {m.name}
                        </text>
                        {!compact && (
                          <g data-order-badge={m.order}>
                            <circle cx={12} cy={-12} r={7.5} fill="var(--color-maple)" stroke="#1a1b1e" strokeWidth="1.5" />
                            <text x={12} y={-11.5} textAnchor="middle" dominantBaseline="central"
                              fontSize="9.5" fontWeight="900" fill="#1a1b1e">
                              {m.order}
                            </text>
                          </g>
                        )}
                      </>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

function GlyphShape({
  g,
  at,
  arrowId,
}: {
  g: LickGlyph;
  at: (s: number, f: number) => { x: number; y: number };
  arrowId: string;
}) {
  const stroke = "var(--color-maple)";
  const text = { fontSize: 11, fontWeight: 800, fill: "var(--color-maple)", textAnchor: "middle" as const };
  switch (g.kind) {
    case "bend": {
      const p = at(g.string, g.fret);
      return (
        <g data-glyph="bend">
          <path d={`M${p.x} ${p.y - 18} L${p.x} ${p.y - 42}`} stroke={stroke} strokeWidth="2.5" fill="none" markerEnd={`url(#${arrowId})`} />
          <text x={p.x} y={p.y - 48} {...text}>{g.label}</text>
        </g>
      );
    }
    case "bend_release": {
      const p = at(g.string, g.fret);
      return (
        <g data-glyph="bend_release">
          <path d={`M${p.x - 5} ${p.y - 18} L${p.x - 5} ${p.y - 40} Q${p.x - 5} ${p.y - 46} ${p.x + 2} ${p.y - 46} Q${p.x + 9} ${p.y - 46} ${p.x + 9} ${p.y - 32}`}
            stroke={stroke} strokeWidth="2.5" fill="none" markerEnd={`url(#${arrowId})`} />
          <text x={p.x} y={p.y - 52} {...text}>{g.label} ↺</text>
        </g>
      );
    }
    case "slide": {
      const a = at(g.string, g.fromFret);
      const b = at(g.string, g.toFret);
      const dir = b.x >= a.x ? 1 : -1;
      const y = a.y + 21;
      return (
        <g data-glyph="slide">
          <path d={`M${a.x + dir * 4} ${y} L${b.x - dir * 6} ${y}`} stroke={stroke} strokeWidth="2.5" fill="none" markerEnd={`url(#${arrowId})`} />
          <text x={(a.x + b.x) / 2} y={y + 14} {...text}>{g.dir === "up" ? "/" : "\\"}</text>
        </g>
      );
    }
    case "hammer_on":
    case "pull_off": {
      const a = at(g.string, g.fromFret);
      const b = at(g.string, g.toFret);
      const mid = (a.x + b.x) / 2;
      const top = a.y - 34;
      return (
        <g data-glyph={g.kind}>
          <path d={`M${a.x} ${a.y - 16} Q${mid} ${top - 6} ${b.x} ${b.y - 16}`} stroke={stroke} strokeWidth="2.5" fill="none" />
          <text x={mid} y={top - 7} {...text}>{g.kind === "hammer_on" ? "h" : "p"}</text>
        </g>
      );
    }
    case "vibrato": {
      const p = at(g.string, g.fret);
      const x0 = p.x + 17;
      let d = `M${x0} ${p.y}`;
      for (let i = 0; i < 4; i++) d += ` q3 ${i % 2 ? 6 : -6} 6 0`;
      return <path data-glyph="vibrato" d={d} stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />;
    }
    case "double_stop": {
      const a = at(g.strings[0], g.frets[0]);
      const b = at(g.strings[1], g.frets[1]);
      return (
        <line data-glyph="double_stop" x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={stroke} strokeWidth="2.5" strokeDasharray="4 3" />
      );
    }
  }
}
