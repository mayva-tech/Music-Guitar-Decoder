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
  for (const r of [1, 2, 4]) {
    if (notes.every((n) => Math.abs(n.start_beat * r - Math.round(n.start_beat * r)) < 1e-6)) return r;
  }
  return 4;
}

export function layoutTab(notes: TabInput[], beatsPerBar = 4, totalBars?: number): TabLayout {
  const res = gridResolution(notes);
  const bars = totalBars ?? Math.max(1, Math.floor(Math.max(0, ...notes.map((n) => n.start_beat)) / beatsPerBar) + 1);
  const cellsPerBar = beatsPerBar * res;
  const nCells = bars * cellsPerBar;
  const cells: TabCell[] = Array.from({ length: nCells }, (_, i) => ({
    index: i, bar: Math.floor(i / cellsPerBar), beat: i / res, width: 1, col: 0, notes: [],
  }));
  for (const n of notes) {
    if (n.string < 1 || n.string > 6 || n.fret < 0) throw new RangeError(`Invalid TAB position ${n.string}/${n.fret}`);
    const c = Math.round(n.start_beat * res);
    if (c >= nCells) throw new RangeError(`Note at beat ${n.start_beat} is outside ${bars} bars`);
    if (cells[c].notes.some((x) => x.string === n.string)) throw new Error(`Two notes on string ${n.string} at beat ${n.start_beat}`);
    const token = noteToken(n);
    cells[c].notes.push({ id: n.id, string: n.string, fret: n.fret, token });
    cells[c].width = Math.max(cells[c].width, token.length);
  }
  let col = 2; // after "e|"
  const barLineCols: number[] = [];
  for (let b = 0; b < bars; b++) {
    for (let k = 0; k < cellsPerBar; k++) {
      const cell = cells[b * cellsPerBar + k];
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
