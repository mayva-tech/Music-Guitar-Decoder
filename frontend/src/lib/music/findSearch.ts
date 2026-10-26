/**
 * Parse free-text lookups for chords, single notes, and theory topics.
 */
import { ALL_TERMS, type TheoryTerm } from "@/lib/theory/content";
import { shapesForChord, type ChordVoicing } from "@/lib/music/chordShapes";
import { NOTE_NAMES_FLAT, NOTE_NAMES_SHARP, pitchClassName } from "@/lib/music/theory";
import { MAX_FRET, STANDARD_TUNING, STRING_LABELS, positionsForMidi } from "@/lib/music/guitar";
import type { ChordQuality, FretmapCell } from "@/lib/music/scaleFretmap";
import { FRETMAP_STRINGS } from "@/lib/music/scaleFretmap";

function pcOfName(name: string): number {
  const i = NOTE_NAMES_SHARP.indexOf(name);
  if (i >= 0) return i;
  return NOTE_NAMES_FLAT.indexOf(name);
}

export interface ParsedChord {
  rootName: string;
  quality: ChordQuality;
  /** Display symbol, e.g. B°, Am, G5. */
  symbol: string;
  /** What the user typed (normalized). */
  query: string;
}

export interface NoteHit {
  name: string;
  pc: number;
  /** Open-position midis (octave 3–4) for audition. */
  midis: number[];
  positions: { string: number; fret: number }[];
}

export interface TopicHit {
  id: string;
  term: TheoryTerm;
  score: number;
}

export interface FindResults {
  query: string;
  chord: ParsedChord | null;
  voicings: ChordVoicing[];
  note: NoteHit | null;
  topics: TopicHit[];
}

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
  db: "C#", eb: "D#", gb: "F#", ab: "G#", bb: "A#",
};

const QUALITY_SUFFIX: [RegExp, ChordQuality][] = [
  [/^(dim|diminished|°|o)$/i, "dim"],
  [/^(aug|augmented|\+)$/i, "aug"],
  [/^(5|power)$/i, "5"],
  [/^(m|min|minor|-)$/i, "min"],
  [/^(maj|major|M)?$/i, "maj"],
];

const INTERVALS: Record<ChordQuality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  "5": [0, 7],
};

function normalizeRootToken(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, "");
  if (!t) return null;
  const titled = t[0]!.toUpperCase() + t.slice(1);
  if (FLAT_TO_SHARP[titled]) return FLAT_TO_SHARP[titled]!;
  if (FLAT_TO_SHARP[t]) return FLAT_TO_SHARP[t]!;
  // C#, F#, etc.
  const sharp = titled.replace("♯", "#").replace("♭", "b");
  if (sharp.endsWith("b") && sharp.length === 2) {
    const mapped = FLAT_TO_SHARP[sharp];
    if (mapped) return mapped;
  }
  if (NOTE_NAMES_SHARP.includes(sharp) || NOTE_NAMES_FLAT.includes(sharp)) {
    return FLAT_TO_SHARP[sharp] ?? sharp;
  }
  // Single letter
  if (NOTE_NAMES_SHARP.includes(titled[0]!)) {
    if (titled.length === 1) return titled;
    if (titled[1] === "#" || titled[1] === "♯") return `${titled[0]}#`;
  }
  return pcOfName(sharp) >= 0 ? (FLAT_TO_SHARP[sharp] ?? sharp) : null;
}

function symbolFor(root: string, q: ChordQuality): string {
  if (q === "maj") return root;
  if (q === "min") return `${root}m`;
  if (q === "dim") return `${root}°`;
  if (q === "aug") return `${root}+`;
  return `${root}5`;
}

/** Parse "Bdim", "Am", "G5", "C#maj", "Bb°", etc. */
export function parseChordQuery(raw: string): ParsedChord | null {
  const q = raw.trim().replace(/\s+/g, "");
  if (!q) return null;
  const m = /^(?<root>[A-Ga-g](?:#|b|♯|♭)?)(?<qual>.*)$/.exec(q);
  if (!m?.groups?.root) return null;
  const rootName = normalizeRootToken(m.groups.root);
  if (!rootName) return null;
  const qualRaw = (m.groups.qual ?? "").replace(/[°º]/g, "°");
  let quality: ChordQuality | null = null;
  for (const [re, qv] of QUALITY_SUFFIX) {
    if (re.test(qualRaw)) {
      quality = qv;
      break;
    }
  }
  // Bare root with no suffix → major chord (also offered as a note hit separately).
  if (quality == null) {
    if (qualRaw === "") quality = "maj";
    else return null;
  }
  return {
    rootName,
    quality,
    symbol: symbolFor(rootName, quality),
    query: q,
  };
}

/** Parse a lone note name (no chord quality). */
export function parseNoteQuery(raw: string): NoteHit | null {
  const q = raw.trim().replace(/\s+/g, "");
  if (!q) return null;
  // Reject clear chord suffixes so "Am" / "Bdim" stay chords.
  if (/^(?:[A-Ga-g](?:#|b|♯|♭)?)(?:m|min|maj|dim|aug|5|°|\+|power)/i.test(q)) return null;
  const root = normalizeRootToken(q);
  if (!root || q.length > 2) return null;
  // Only pure note tokens (C, C#, Bb, …).
  if (!/^[A-Ga-g](?:#|b|♯|♭)?$/i.test(q)) return null;
  const pc = pcOfName(root);
  if (pc < 0) return null;
  const midis = [48 + pc, 60 + pc].filter((m) => m <= 76);
  const positions = positionsForMidi(60 + pc, 12).concat(positionsForMidi(48 + pc, 12));
  // Dedupe positions
  const seen = new Set<string>();
  const uniq = positions.filter((p) => {
    const k = `${p.string}:${p.fret}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { name: root, pc, midis, positions: uniq };
}

function topicScore(term: TheoryTerm, needle: string): number {
  const n = needle.toLowerCase();
  if (!n) return 0;
  const id = term.id.toLowerCase();
  const name = term.name.toLowerCase();
  const short = term.short.toLowerCase();
  const body = term.body.toLowerCase();
  if (id === n || name === n) return 100;
  if (name.startsWith(n) || id.startsWith(n)) return 80;
  if (name.includes(n) || id.includes(n)) return 60;
  if (short.includes(n)) return 40;
  if (body.includes(n) || (term.guitar ?? "").toLowerCase().includes(n)) return 20;
  if ((term.glossaryExample ?? "").toLowerCase().includes(n)) return 15;
  return 0;
}

export function searchTopics(raw: string, limit = 8): TopicHit[] {
  const needle = raw.trim();
  if (!needle) {
    return Object.values(ALL_TERMS)
      .slice(0, limit)
      .map((term) => ({ id: term.id, term, score: 1 }));
  }
  return Object.values(ALL_TERMS)
    .map((term) => ({ id: term.id, term, score: topicScore(term, needle) }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.term.name.localeCompare(b.term.name))
    .slice(0, limit);
}

/** Chord-tone cells so the neck shows which notes belong to the chord. */
export function buildChordToneFretmap(rootName: string, quality: ChordQuality, maxFret = MAX_FRET): FretmapCell[] {
  const tonic = pcOfName(rootName);
  if (tonic < 0) return [];
  const pcs = INTERVALS[quality].map((i) => (tonic + i) % 12);
  const cells: FretmapCell[] = [];
  for (const s of FRETMAP_STRINGS) {
    for (let fret = 0; fret <= maxFret; fret++) {
      const midi = STANDARD_TUNING[s]! + fret;
      const pc = ((midi % 12) + 12) % 12;
      const degree = pcs.indexOf(pc);
      cells.push({
        string: s,
        fret,
        midi,
        name: pitchClassName(midi),
        stringLabel: STRING_LABELS[s]!,
        degree,
        inScale: degree >= 0,
        isRoot: degree === 0,
      });
    }
  }
  return cells;
}

export function findSearch(raw: string): FindResults {
  const query = raw.trim();
  const chord = parseChordQuery(query);
  const voicings = chord ? shapesForChord(chord.rootName, chord.quality) : [];
  // Note hit only when not a multi-char quality chord, or when bare root.
  let note = parseNoteQuery(query);
  if (!note && chord && chord.quality === "maj" && /^[A-Ga-g](?:#|b|♯|♭)?$/i.test(query)) {
    note = parseNoteQuery(chord.rootName);
  }
  const topics = searchTopics(query);
  return { query, chord: chord && voicings.length ? chord : null, voicings, note, topics };
}
