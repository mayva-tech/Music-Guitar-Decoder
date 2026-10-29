/**
 * Song search: type a title, get the key, the scale and the chords.
 *
 * Two sources:
 *  - SONGBOOK: public-domain and traditional songs with their real chord charts (works offline).
 *  - Online key lookup (backend /api/song-search → GetSongBPM): the key and tempo of almost any song.
 *    For those we can't know the exact chords, so we show the chords that belong to the key,
 *    common progressions in it, and suggest humming the tune into the decoder for the real ones.
 *
 * Chords in the songbook are written as Roman numerals and turned into chord names for the key,
 * so the spelling is always right (B♭ in F, A♯ in F♯…).
 */
import { shapeForChord, type ChordShape } from "@/lib/music/chordShapes";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import type { TheoryEvent } from "@/lib/theory/content";
import type { Sound } from "@/lib/theory/ear";

export type Mode = "major" | "minor";
export type Meter = "4/4" | "3/4" | "6/8";

/* ------------------------------------------------------------- spelling */

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Usual name for a key's home note (flats for F, B♭, E♭…; sharps for F♯m, C♯m…). */
const MAJOR_TONIC = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const MINOR_TONIC = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"];

export interface Spelled { letter: number; acc: number }
const ACC_TEXT: Record<number, string> = { [-2]: "𝄫", [-1]: "♭", 0: "", 1: "♯", 2: "𝄪" };
export const spellText = (s: Spelled) => `${LETTERS[s.letter]}${ACC_TEXT[s.acc] ?? ""}`;
const spelledPc = (s: Spelled) => mod12(LETTER_PC[s.letter]! + s.acc);

/** Parse "C", "F#", "Bb", "E♭", "c#" into a spelled note. */
export function parseNoteName(raw: string): Spelled | null {
  const m = /^\s*([A-Ga-g])\s*(##|bb|#|b|♯|♭|𝄪|𝄫)?/.exec(raw);
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1]!.toUpperCase() as (typeof LETTERS)[number]);
  const a = m[2] ?? "";
  const acc = a === "#" || a === "♯" ? 1 : a === "b" || a === "♭" ? -1 : a === "##" || a === "𝄪" ? 2 : a === "bb" || a === "𝄫" ? -2 : 0;
  return { letter, acc };
}

function spellPc(pc: number, mode: Mode): Spelled {
  return parseNoteName((mode === "major" ? MAJOR_TONIC : MINOR_TONIC)[mod12(pc)]!)!;
}

/** Letter `steps` letters above `from`, with whatever accidental makes pitch class `pc`. */
function spellOnLetter(from: Spelled, steps: number, pc: number): Spelled {
  const letter = (from.letter + steps) % 7;
  let acc = mod12(pc - LETTER_PC[letter]!);
  if (acc > 6) acc -= 12;
  return { letter, acc };
}

/* ------------------------------------------------------------------ keys */

export interface Key { tonic: Spelled; pc: number; mode: Mode }

export function makeKey(pc: number, mode: Mode, tonicName?: string): Key {
  const given = tonicName ? parseNoteName(tonicName) : null;
  const tonic = given && spelledPc(given) === mod12(pc) ? given : spellPc(pc, mode);
  return { tonic, pc: mod12(pc), mode };
}

/** Parse key text such as "G", "Em", "F♯ minor", "Bb major", "C#m". */
export function parseKey(raw: string | null | undefined): Key | null {
  if (!raw) return null;
  const t = raw.trim();
  const note = parseNoteName(t);
  if (!note) return null;
  const rest = t.replace(/^\s*[A-Ga-g]\s*(##|bb|#|b|♯|♭|𝄪|𝄫)?/, "").trim().toLowerCase();
  const minor = /^(m|min|minor|-)(\b|$)/.test(rest);
  return makeKey(spelledPc(note), minor ? "minor" : "major", spellText(note));
}

export const keyName = (k: Key) => `${spellText(k.tonic)} ${k.mode}`;
export const keyShort = (k: Key) => `${spellText(k.tonic)}${k.mode === "minor" ? "m" : ""}`;

/** The seven notes of the key's scale, spelled with one of each letter. */
export function scaleNotes(k: Key): string[] {
  const steps = k.mode === "major" ? MAJOR : MINOR;
  return steps.map((s, i) => spellText(spellOnLetter(k.tonic, i, k.pc + s)));
}

/** Relative major/minor: same notes, different home. */
export function relativeKey(k: Key): Key {
  return k.mode === "major"
    ? { tonic: spellOnLetter(k.tonic, 5, k.pc + 9), pc: mod12(k.pc + 9), mode: "minor" }
    : { tonic: spellOnLetter(k.tonic, 2, k.pc + 3), pc: mod12(k.pc + 3), mode: "major" };
}

/* --------------------------------------------------------------- chords */

export type Quality = "maj" | "min" | "dim" | "aug";
export type Seventh = "" | "7" | "maj7" | "m7";
export interface Chord { symbol: string; numeral: string; rootPc: number; root: string; quality: Quality; seventh: Seventh }

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** "IV" → F in C major; "♭VII" → G in A minor; "ii7" → Dm7; "II7" → D7 (secondary dominant); "vii°" → B°. */
export function numeralChord(k: Key, numeral: string): Chord {
  const m = /^(♭|b|♯|#)?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°|\+)?(maj7|m7|7)?$/.exec(numeral.trim());
  if (!m) throw new Error(`Bad numeral: ${numeral}`);
  const acc = m[1] === "♭" || m[1] === "b" ? -1 : m[1] ? 1 : 0;
  const upper = m[2] === m[2]!.toUpperCase();
  const deg = ROMAN.indexOf(m[2]!.toUpperCase());
  const quality: Quality = m[3] === "°" ? "dim" : m[3] === "+" ? "aug" : upper ? "maj" : "min";
  let seventh: Seventh = (m[4] ?? "") as Seventh;
  if (seventh === "7" && quality === "min") seventh = "m7";
  const pc = mod12(k.pc + MAJOR[deg]! + acc);
  const root = spellText(spellOnLetter(k.tonic, deg, pc));
  const symbol = `${root}${quality === "min" && seventh !== "m7" ? "m" : ""}${quality === "dim" ? "°" : quality === "aug" ? "+" : ""}${seventh}`;
  return { symbol, numeral, rootPc: pc, root, quality, seventh };
}

const DIATONIC: Record<Mode, string[]> = {
  major: ["I", "ii", "iii", "IV", "V", "vi", "vii°"],
  minor: ["i", "ii°", "♭III", "iv", "v", "♭VI", "♭VII"],
};
/** The chords most songs in a key use: I IV V vi (major), i iv v ♭VI ♭VII (minor), plus the V major chord minor songs borrow. */
const COMMON: Record<Mode, string[]> = { major: ["I", "IV", "V", "vi"], minor: ["i", "iv", "♭VI", "♭VII", "V"] };

export interface KeyChord extends Chord { common: boolean }
export function keyChords(k: Key): KeyChord[] {
  const list = DIATONIC[k.mode].map((n) => ({ ...numeralChord(k, n), common: COMMON[k.mode].includes(n) }));
  // Minor songs very often use a major V (E in A minor) for a stronger pull home.
  if (k.mode === "minor") list.push({ ...numeralChord(k, "V"), common: true });
  return list;
}

export const PROGRESSIONS: Record<Mode, { name: string; numerals: string[]; heard: string }[]> = {
  major: [
    { name: "Pop loop", numerals: ["I", "V", "vi", "IV"], heard: "Pop, rock, ballads" },
    { name: "Three-chord", numerals: ["I", "IV", "V", "I"], heard: "Folk, country, rock'n'roll" },
    { name: "Fifties", numerals: ["I", "vi", "IV", "V"], heard: "Doo-wop, oldies" },
    { name: "Sad start", numerals: ["vi", "IV", "I", "V"], heard: "Emotional pop" },
  ],
  minor: [
    { name: "Minor rock", numerals: ["i", "♭VII", "♭VI", "♭VII"], heard: "Rock, metal" },
    { name: "Minor three-chord", numerals: ["i", "iv", "v", "i"], heard: "Folk, ballads" },
    { name: "Descending", numerals: ["i", "♭VII", "♭VI", "V"], heard: "Flamenco, dramatic rock" },
    { name: "Epic", numerals: ["i", "♭VI", "♭III", "♭VII"], heard: "Anthems, film music" },
  ],
};

/** Notes of a chord as pitch classes. */
export function chordPcs(c: Chord): number[] {
  const tri = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8] }[c.quality];
  const sev = c.seventh === "7" || c.seventh === "m7" ? [10] : c.seventh === "maj7" ? [11] : [];
  return [...tri, ...sev].map((x) => mod12(c.rootPc + x));
}

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/** Open shapes for 7th chords (strings 6→1); other chords use the app's shape library. */
const SEVENTHS: Record<string, ChordShape> = {
  "7:7": { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] }, // G7
  "0:7": { frets: [null, 3, 2, 3, 1, 0], fingers: [null, 3, 2, 4, 1, 0] }, // C7
  "2:7": { frets: [null, null, 0, 2, 1, 2], fingers: [null, null, 0, 2, 1, 3] }, // D7
  "9:7": { frets: [null, 0, 2, 0, 2, 0], fingers: [null, 0, 2, 0, 3, 0] }, // A7
  "4:7": { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] }, // E7
  "11:7": { frets: [null, 2, 1, 2, 0, 2], fingers: [null, 2, 1, 3, 0, 4] }, // B7
  "9:m7": { frets: [null, 0, 2, 0, 1, 0], fingers: [null, 0, 2, 0, 1, 0] }, // Am7
  "4:m7": { frets: [0, 2, 0, 0, 3, 0], fingers: [0, 2, 0, 0, 3, 0] }, // Em7
  "2:m7": { frets: [null, null, 0, 2, 1, 1], fingers: [null, null, 0, 2, 1, 1] }, // Dm7
  "0:maj7": { frets: [null, 3, 2, 0, 0, 0], fingers: [null, 3, 2, 0, 0, 0] }, // Cmaj7
  "5:maj7": { frets: [null, null, 3, 2, 1, 0], fingers: [null, null, 3, 2, 1, 0] }, // Fmaj7
};
export function chordShape(c: Chord): ChordShape {
  const own = c.seventh ? SEVENTHS[`${c.rootPc}:${c.seventh}`] : undefined;
  return own ?? shapeForChord(SHARP[c.rootPc]!, c.quality);
}

/* ------------------------------------------------------------------ capo */

const EASY: Record<Mode, number[]> = { major: [7, 0, 2, 9, 4], minor: [9, 4, 2] }; // G C D A E / Am Em Dm
/** For awkward keys: capo fret and the easy key whose shapes you play. Null when the key is already easy. */
export function capoTip(k: Key): { capo: number; shapes: Key } | null {
  if (EASY[k.mode].includes(k.pc)) return null;
  let best: { capo: number; shapes: Key; score: number } | null = null;
  for (let c = 1; c <= 7; c++) {
    const pc = mod12(k.pc - c);
    const rank = EASY[k.mode].indexOf(pc);
    if (rank < 0) continue;
    const score = c + (k.mode === "major" && rank >= 3 ? 1.5 : 0); // prefer G C D shapes over A and E
    if (!best || score < best.score) best = { capo: c, shapes: makeKey(pc, k.mode), score };
  }
  return best ? { capo: best.capo, shapes: best.shapes } : null;
}

/* ----------------------------------------------------------- soloing */

export function soloScales(k: Key): { name: string; notes: string[]; tip: string }[] {
  const rel = relativeKey(k);
  const pent = (key: Key) => {
    const all = scaleNotes(key);
    return key.mode === "major" ? [all[0], all[1], all[2], all[4], all[5]] : [all[0], all[2], all[3], all[4], all[6]];
  };
  if (k.mode === "major") {
    return [
      { name: `${spellText(k.tonic)} major pentatonic`, notes: pent(k) as string[], tip: "Bright and safe over every chord in the key." },
      { name: `${spellText(rel.tonic)} minor pentatonic`, notes: pent(rel) as string[], tip: "Same five notes, starting from the relative minor. Gives a bluesier feel." },
    ];
  }
  return [
    { name: `${spellText(k.tonic)} minor pentatonic`, notes: pent(k) as string[], tip: "The rock and blues box. Works over the whole song." },
    { name: `${spellText(k.tonic)} natural minor`, notes: scaleNotes(k), tip: "All seven notes of the key, for melodic lines." },
  ];
}

/* ------------------------------------------------------------ songbook */

export interface SongSection { name: string; bars: string[] }
export interface SongbookEntry {
  id: string;
  title: string;
  aliases: string[];
  credit: string;
  key: Key;
  meter: Meter;
  bpm: number;
  sections: SongSection[];
  tip: string;
  /** In-app page where you can play it along. */
  practice?: { href: string; label: string };
}

const K = (name: string): Key => parseKey(name)!;
const BY_EAR = { href: "/learn/by-ear", label: "Play it on the fretboard" };

export const SONGBOOK: SongbookEntry[] = [
  { id: "twinkle", title: "Twinkle, Twinkle, Little Star", aliases: ["twinkle twinkle", "abc song", "baa baa black sheep"], credit: "Traditional", key: K("C"), meter: "4/4", bpm: 100,
    sections: [{ name: "Verse", bars: ["I", "IV I", "IV I", "V I"] }, { name: "Middle", bars: ["I IV", "I V", "I IV", "I V"] }, { name: "Verse again", bars: ["I", "IV I", "IV I", "V I"] }],
    tip: "Three chords, all in first position. The chord changes every two beats.", practice: BY_EAR },
  { id: "ode", title: "Ode to Joy", aliases: ["beethoven 9", "ninth symphony", "joyful joyful"], credit: "Beethoven, 1824", key: K("C"), meter: "4/4", bpm: 100,
    sections: [{ name: "Line 1", bars: ["I", "V", "I", "I V"] }, { name: "Line 2", bars: ["I", "V", "I", "V I"] }],
    tip: "Just C and G. Great first song for changing chords in time.", practice: BY_EAR },
  { id: "amazing-grace", title: "Amazing Grace", aliases: ["how sweet the sound"], credit: "Traditional (words John Newton, 1779)", key: K("G"), meter: "3/4", bpm: 84,
    sections: [{ name: "Verse", bars: ["I", "I", "IV", "I", "I", "I", "V", "V", "I", "I", "IV", "I", "I", "V", "I", "I"] }],
    tip: "Waltz time: bass note on ONE, strum on two and three.", practice: BY_EAR },
  { id: "saints", title: "When the Saints Go Marching In", aliases: ["the saints", "oh when the saints"], credit: "Traditional", key: K("G"), meter: "4/4", bpm: 120,
    sections: [{ name: "Verse", bars: ["I", "I", "I", "I", "I", "I", "V", "V", "I", "I7", "IV", "iv", "I", "V", "I", "I"] }],
    tip: "The C minor (iv) chord in bar 12 is the bluesy twist. Try it with plain C first." },
  { id: "rising-sun", title: "The House of the Rising Sun", aliases: ["house of the rising sun", "rising sun"], credit: "Traditional folk song", key: K("Am"), meter: "6/8", bpm: 72,
    sections: [{ name: "Verse", bars: ["i ♭III", "IV ♭VI", "i ♭III", "V V", "i ♭III", "IV ♭VI", "i V", "i V"] }],
    tip: "Pick the chords as arpeggios in 6/8. D major (IV) in a minor key gives it its dark, Dorian sound." },
  { id: "susanna", title: "Oh! Susanna", aliases: ["oh susanna", "banjo on my knee"], credit: "Stephen Foster, 1848", key: K("C"), meter: "4/4", bpm: 110,
    sections: [{ name: "Verse", bars: ["I", "I", "V", "V", "I", "I", "V", "I"] }, { name: "Chorus", bars: ["IV", "IV", "I", "V", "I", "I", "V", "I"] }],
    tip: "A bouncy country strum: bass note, then strum, alternating." },
  { id: "jingle-bells", title: "Jingle Bells", aliases: ["jingle all the way"], credit: "James Lord Pierpont, 1857", key: K("G"), meter: "4/4", bpm: 120,
    sections: [{ name: "Chorus", bars: ["I", "I", "I", "I", "IV", "I", "II7", "V", "I", "I", "I", "I", "IV", "I", "V", "I"] }],
    tip: "The A7 (II7) is a 'secondary dominant': it pushes into D, which pushes home to G." },
  { id: "silent-night", title: "Silent Night", aliases: ["stille nacht"], credit: "Franz Gruber, 1818", key: K("C"), meter: "3/4", bpm: 72,
    sections: [{ name: "Verse", bars: ["I", "I", "I", "I", "V7", "V7", "I", "I", "IV", "IV", "I", "I", "IV", "IV", "I", "I", "V7", "V7", "I", "vi", "I", "V7", "I", "I"] }],
    tip: "Slow waltz. Let each chord ring for the whole bar." },
  { id: "happy-birthday", title: "Happy Birthday to You", aliases: ["happy birthday"], credit: "Mildred & Patty Hill, 1893", key: K("G"), meter: "3/4", bpm: 100,
    sections: [{ name: "Song", bars: ["I", "V", "V", "I", "I7", "IV", "I V", "I"] }],
    tip: "Starts on a pickup: the first chord comes on 'you'. G7 before C makes the last line lift." },
  { id: "canon", title: "Canon in D", aliases: ["pachelbel canon", "pachelbel's canon", "canon"], credit: "Johann Pachelbel, c. 1700", key: K("D"), meter: "4/4", bpm: 72,
    sections: [{ name: "Loop", bars: ["I V", "vi iii", "IV I", "IV V"] }],
    tip: "The famous eight-chord loop. Many pop songs borrow parts of it." },
  { id: "fur-elise", title: "Für Elise", aliases: ["fur elise", "fuer elise", "bagatelle"], credit: "Beethoven, 1810", key: K("Am"), meter: "3/4", bpm: 72,
    sections: [{ name: "Theme", bars: ["i", "V", "i", "i", "V", "i"] }],
    tip: "Just Am and E. The melody does the work; the chords hold it up." },
  { id: "mary-lamb", title: "Mary Had a Little Lamb", aliases: ["mary had a little lamb"], credit: "Traditional (words Sarah Josepha Hale, 1830)", key: K("C"), meter: "4/4", bpm: 104,
    sections: [{ name: "Song", bars: ["I", "V", "I", "I", "I", "I", "V", "I"] }],
    tip: "Two chords. A good song to practise switching C to G." },
  { id: "row-boat", title: "Row, Row, Row Your Boat", aliases: ["row row row your boat", "merrily merrily"], credit: "Traditional", key: K("C"), meter: "6/8", bpm: 80,
    sections: [{ name: "Song", bars: ["I", "I", "I", "I", "I", "I", "V", "I"] }],
    tip: "One chord almost all the way: perfect for practising a steady strum." },
];

/** Chord names for each bar of a section. */
export function sectionChords(song: SongbookEntry, section: SongSection): Chord[][] {
  return section.bars.map((bar) => bar.split(/\s+/).filter(Boolean).map((n) => numeralChord(song.key, n)));
}

/** Every distinct chord in the song, in order of first use. */
export function songChords(song: SongbookEntry): Chord[] {
  const seen = new Map<string, Chord>();
  for (const s of song.sections) for (const bar of sectionChords(song, s)) for (const c of bar) if (!seen.has(c.symbol)) seen.set(c.symbol, c);
  return [...seen.values()];
}

/* ------------------------------------------------------------- search */

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/^(the|a) /, "").trim();
const grams = (s: string) => { const t = ` ${s} `; const out = new Set<string>(); for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3)); return out; };
function dice(a: string, b: string): number {
  const A = grams(a), B = grams(b);
  let n = 0;
  for (const g of A) if (B.has(g)) n++;
  return (2 * n) / (A.size + B.size || 1);
}

/** Edit distance where swapping two neighbouring letters counts as one typo. */
export function typoDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}
const wordMatch = (w: string, x: string, last: boolean) =>
  x === w || (last && w.length >= 2 && x.startsWith(w)) || (w.length >= 4 && typoDistance(w, x) <= (w.length >= 7 ? 2 : 1));

/** 0–100: how well a title (or alias) matches what was typed. Typos are forgiven. */
export function matchScore(query: string, text: string): number {
  const q = norm(query), t = norm(text);
  if (!q || !t) return 0;
  if (q === t) return 100;
  if (t.startsWith(q)) return 92;
  if (t.includes(q)) return 85;
  const qt = q.split(" "), tt = t.split(" ");
  const hit = qt.filter((w, i) => tt.some((x) => wordMatch(w, x, i === qt.length - 1))).length / qt.length;
  // Every typed word found (allowing typos) is a strong match even when the words are misspelled.
  return Math.round(Math.max(hit === 1 ? 82 : hit * 75, dice(q, t) * 80));
}

export function searchSongbook(query: string, limit = 6): { song: SongbookEntry; score: number }[] {
  if (norm(query).length < 2) return [];
  return SONGBOOK.map((song) => ({ song, score: Math.max(...[song.title, ...song.aliases].map((t) => matchScore(query, t))) }))
    .filter((r) => r.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/* ------------------------------------------------------------- online */

/** A result from the backend's online key lookup. */
export interface OnlineSong {
  id: string;
  title: string;
  artist: string;
  key: string | null;
  tempo: number | null;
  time_sig: string | null;
  uri: string | null;
}
export interface OnlineSearch {
  configured: boolean;
  source: string;
  results: OnlineSong[];
  /** True when Hooktheory username/password are set on the backend. */
  hooktheory?: boolean;
}

export interface HooktheorySong {
  song: string;
  artist: string;
  section: string | null;
  url: string | null;
}
export interface HooktheoryExamples {
  configured: boolean;
  source?: string;
  progressions: { cp: string; label: string; songs: HooktheorySong[] }[];
}

/* -------------------------------------------------------------- sound */

const shapeMidis = (s: ChordShape) => s.frets.flatMap((f, i) => (f == null ? [] : [STANDARD_TUNING[6 - i]! + f]));
const BEATS: Record<Meter, number> = { "4/4": 4, "3/4": 3, "6/8": 2 };

/**
 * Strum a progression: one list of chords per bar. Lights `pb-<i>` for the i-th chord overall.
 * 4/4 strums each half bar, 3/4 is a waltz (bass, strum, strum), 6/8 rolls on each dotted beat.
 */
export function progressionSound(bars: Chord[][], meter: Meter, bpm: number): Sound {
  const events: TheoryEvent[] = [];
  const per = BEATS[meter];
  let t = 0, i = 0;
  for (const bar of bars) {
    const len = per / bar.length;
    for (const c of bar) {
      const ns = shapeMidis(chordShape(c));
      const strum = (at: number, d: number, v: number, top = false) =>
        (top ? ns.slice(-3) : ns).forEach((m, k) => events.push({ kind: "pluck", midi: m, beat: at + k * 0.03, beats: Math.max(d - k * 0.03, 0.3), velocity: v * 0.45 }));
      events.push({ kind: "bass", midi: 36 + c.rootPc, beat: t, beats: len * 0.95, velocity: 0.75 });
      if (meter === "3/4") { for (let x = 1; x < len - 0.01; x++) strum(t + x, 1, 0.6, true); if (len < 3) strum(t, Math.min(1, len), 0.75); }
      else for (let x = 0; x < len - 0.01; x += meter === "6/8" ? 1 : 2) strum(t + x, Math.min(2, len - x) + 0.2, x === 0 ? 0.85 : 0.65);
      events.push({ kind: "highlight", beat: t, beats: len, velocity: 0, highlight: `pb-${i}` });
      t += len; i++;
    }
  }
  return { bpm, lengthBeats: t + 0.5, events };
}
