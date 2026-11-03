// TAB layout computed strictly from note events (same algorithm as backend/app/music/tab.py).
// Standard convention: thin e string (1) on top, thick E (6) at the bottom.

export const TAB_STRING_ORDER = [1, 2, 3, 4, 5, 6];
export const TAB_LABELS: Record<number, string> = { 1: "e", 2: "B", 3: "G", 4: "D", 5: "A", 6: "E" };

export interface TabInput {
  id?: string;
  start_beat: number;
  string: number;
  fret: number;
  technique?: string | null;
  bend_semitones?: number | null;
  vibrato?: boolean;
}

const PREFIX: Record<string, string> = { slide_up: "/", slide_down: "\\", hammer_on: "h", pull_off: "p" };

/** TAB text for one note — identical to backend/app/music/tab.py note_token(). */
export function noteToken(n: TabInput): string {
  let tok = (n.technique ? PREFIX[n.technique] ?? "" : "") + String(n.fret);
  const bend = n.bend_semitones ?? 0;
  if (n.technique === "bend") tok += `b${n.fret + bend}`;
  else if (n.technique === "bend_release") tok += `b${n.fret + bend}r${n.fret}`;
  if (n.vibrato) tok += "~";
  return tok;
}

export interface TabCell {
  index: number; // global cell index
  bar: number;
  beat: number; // start beat of the cell
  width: number; // characters used by the fret number
  col: number; // character column where the number starts
  notes: { id?: string; string: number; fret: number; token: string }[];
}

export interface TabLayout {
  resolution: number;
  cellsPerBar: number;
  totalBars: number;
  cells: TabCell[];
  barLineCols: number[]; // column of each "|" after a bar
  lineLength: number;
}

export function gridResolution(notes: { start_beat: number }[]): number {
  // Straight grids first (unchanged behaviour), then triplet / swing grids.
  for (const r of [1, 2, 4, 3, 6, 12]) {
    if (notes.every((n) => Math.abs(n.start_beat * r - Math.round(n.start_beat * r)) < 1e-6)) return r;
  }
  return 4;
}

/**
 * `perBar`: each bar gets the coarsest grid its own notes need (frontend-only option, off by default so
 * the layout stays identical to the backend). Long lines that mix triplets and sixteenths otherwise put
 * every bar on a 12-per-beat grid and become several times wider than needed.
 */
export function layoutTab(notes: TabInput[], beatsPerBar = 4, totalBars?: number, opts: { perBar?: boolean } = {}): TabLayout {
  const bars = totalBars ?? Math.max(1, Math.floor(Math.max(0, ...notes.map((n) => n.start_beat)) / beatsPerBar) + 1);
  const whole = gridResolution(notes);
  const barRes = Array.from({ length: bars }, (_, b) => {
    if (!opts.perBar) return whole;
    const own = notes.filter((n) => n.start_beat >= b * beatsPerBar - 1e-9 && n.start_beat < (b + 1) * beatsPerBar - 1e-9);
    return own.length ? gridResolution(own) : 1;
  });
  const res = Math.max(...barRes);
  const cellsPerBar = beatsPerBar * res;
  const firstCell: number[] = [];
  const cells: TabCell[] = [];
  barRes.forEach((r, b) => {
    firstCell.push(cells.length);
    for (let k = 0; k < beatsPerBar * r; k++) {
      cells.push({ index: cells.length, bar: b, beat: b * beatsPerBar + k / r, width: 1, col: 0, notes: [] });
    }
  });
  for (const n of notes) {
    if (n.string < 1 || n.string > 6 || n.fret < 0) throw new RangeError(`Invalid TAB position ${n.string}/${n.fret}`);
    const b = Math.floor(n.start_beat / beatsPerBar + 1e-9);
    if (b >= bars) throw new RangeError(`Note at beat ${n.start_beat} is outside ${bars} bars`);
    const r = barRes[b]!;
    const c = firstCell[b]! + Math.round((n.start_beat - b * beatsPerBar) * r);
    if (cells[c].notes.some((x) => x.string === n.string)) throw new Error(`Two notes on string ${n.string} at beat ${n.start_beat}`);
    const token = noteToken(n);
    cells[c].notes.push({ id: n.id, string: n.string, fret: n.fret, token });
    cells[c].width = Math.max(cells[c].width, token.length);
  }
  let col = 2; // after "e|"
  const barLineCols: number[] = [];
  for (let b = 0; b < bars; b++) {
    for (let k = 0; k < beatsPerBar * barRes[b]!; k++) {
      const cell = cells[firstCell[b]! + k];
      col += 2;
      cell.col = col;
      col += cell.width;
    }
    col += 2;
    barLineCols.push(col);
    col += 1;
  }
  return { resolution: res, cellsPerBar, totalBars: bars, cells, barLineCols, lineLength: col };
}

export function renderAsciiTab(notes: TabInput[], beatsPerBar = 4, totalBars?: number): string {
  const lay = layoutTab(notes, beatsPerBar, totalBars);
  return TAB_STRING_ORDER.map((s) => {
    const chars = Array(lay.lineLength).fill("-");
    chars[0] = TAB_LABELS[s];
    chars[1] = "|";
    for (const c of lay.barLineCols) chars[c] = "|";
    for (const cell of lay.cells) {
      const n = cell.notes.find((x) => x.string === s);
      if (n) n.token.split("").forEach((ch, i) => (chars[cell.col + i] = ch));
    }
    return chars.join("");
  }).join("\n");
}
