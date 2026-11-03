/**
 * Diagonal licks: long (about 20 seconds), melodic licks that travel across the neck
 * instead of running up and down one box.
 *
 * Every lick has the shape of a short solo: a theme (the melody), the theme moved up a
 * position (a sequence), a speed phrase built from repeating cells that climb the neck,
 * and a peak that comes home to a chord tone. Notes marked as melody form the tune you can
 * hum; the rest decorate it.
 *
 * All licks are ORIGINAL, written for this app.
 *
 * Licks are written in a small notation (see `compileLine`) of scale degrees, rhythms and
 * hand positions; the compiler picks strings and frets inside the hand position, so every
 * phrase stays playable and the route across the neck is explicit. The result uses the solo
 * workshop's Lick / PlayableNote format, so the same player, neck and TAB components work.
 *
 * Location: frontend/src/lib/music/diagonalLicks.ts
 */
import { MAX_FRET, STANDARD_TUNING } from "@/lib/music/guitar";
import { rootPc, scaleKindById, type ScaleMode, type ScaleRoot } from "@/lib/music/scaleFretmap";
import {
  backingBar,
  buildLick,
  chordTonesOf,
  type BackingStyle,
  type Lick,
} from "@/lib/music/soloGuide";
import type { LeadSound } from "@/lib/theory/player";
import type { TheoryEvent } from "@/lib/theory/content";
import type { PlayableNote } from "@/lib/types";

/* ------------------------------------------------------------------ types */

export interface DiagonalPhrase {
  /** First bar (0-based) and number of bars. */
  bars: [start: number, count: number];
  label: string;
  /** What to listen for and how to play it. */
  text: string;
}

export interface DiagonalLick {
  lick: Lick;
  genre: string;
  level: "Medium" | "Harder";
  /** Fastest rhythm in the lick, in words. */
  speedFeel: string;
  summary: string;
  phrases: DiagonalPhrase[];
  /** Indices of the theme (melody) notes. */
  melody: number[];
  /** 1 = the first six licks, 2 = the next ten, 3 = the ten after that. */
  set: 1 | 2 | 3;
}

/* --------------------------------------------------------------- notation */

type Spec = Parameters<typeof buildLick>[1][number];
const TICKS = 12; // per beat: lets eighths, triplets, sixteenths and sextuplets add up exactly

export interface CompiledLine {
  specs: Spec[];
  melody: number[];
  /** Finger for each note (0 = open), from the hand position it is played in. */
  fingers: number[];
  /** Length in beats. */
  beats: number;
}

/** Scale-degree → MIDI: degree 0 is `rootMidi`, negatives go below it. */
export function degreeMidi(deg: number, mode: ScaleMode, rootMidi: number): number {
  const steps = scaleKindById(mode).steps;
  const n = steps.length;
  const oct = Math.floor(deg / n);
  return rootMidi + (steps as readonly number[])[((deg % n) + n) % n]! + 12 * oct;
}

function parseDur(s: string): number {
  const [a, b] = s.split("/");
  const v = b != null ? Number(a) / Number(b) : Number(s);
  const t = v * TICKS;
  if (!Number.isFinite(v) || v <= 0 || Math.abs(t - Math.round(t)) > 1e-6) throw new Error(`Bad duration "${s}"`);
  return Math.round(t);
}

const TOKEN = /^(\*)?(-?\d+)([\^_])?(?:s([1-6]))?(h|p|\/|b1|b|r1|r)?(~)?(?::([\d./]+))?$/;

/**
 * Compiles one lick line.
 *
 * Tokens (space separated):
 * - `@7`         hand position: index finger at fret 7 (frets 7–10, one finger per fret)
 * - `|`          bar line (checked: must fall on a multiple of 4 beats)
 * - `-:1`        rest for 1 beat
 * - `*3h~:1/3`   a note: `*` = melody note, `3` = scale degree (`3^` / `3_` = a semitone sharp / flat,\n *                for chromatic notes outside the scale), optional `s2` = force string 2,
 *                technique `h` hammer-on, `p` pull-off, `/` slide (same string as the previous note),
 *                `b`/`b1` full/half bend, `r`/`r1` bend and release, `~` vibrato, `:1/3` duration
 *                in beats (omitted = same as the previous token).
 *
 * Strings and frets are chosen inside the hand position, nearest the previous note.
 * Hammer-ons, pull-offs and slides stay on the previous note's string; a slide moves the hand.
 */
export function compileLine(
  id: string,
  text: string,
  scale: { mode: ScaleMode; rootMidi: number },
  startPos = 5,
): CompiledLine {
  const specs: Spec[] = [];
  const melody: number[] = [];
  const fingers: number[] = [];
  let lo = startPos;
  let tick = 0;
  let dur = TICKS;
  let prev: { s: number; f: number } | null = null;

  for (const tok of text.trim().split(/\s+/)) {
    if (tok === "|") {
      if (tick % (4 * TICKS) !== 0) throw new Error(`${id}: bar line at beat ${tick / TICKS}`);
      continue;
    }
    if (tok.startsWith("@")) {
      lo = Number(tok.slice(1));
      if (!Number.isInteger(lo) || lo < 0 || lo > MAX_FRET) throw new Error(`${id}: bad position ${tok}`);
      continue;
    }
    if (tok.startsWith("-:")) {
      dur = parseDur(tok.slice(2));
      tick += dur;
      continue;
    }
    const m = TOKEN.exec(tok);
    if (!m) throw new Error(`${id}: bad token "${tok}"`);
    const [, star, degS, acc, strS, tech, vib, durS] = m;
    if (durS) dur = parseDur(durS);
    const midi = degreeMidi(Number(degS), scale.mode, scale.rootMidi) + (acc === "^" ? 1 : acc === "_" ? -1 : 0);
    const where = `${id} note ${specs.length} ("${tok}")`;

    let s: number;
    let f: number;
    const legato = tech === "h" || tech === "p" || tech === "/";
    if (legato || strS) {
      if (legato && !prev) throw new Error(`${where}: needs a previous note`);
      s = legato ? prev!.s : Number(strS);
      f = midi - STANDARD_TUNING[s]!;
      if (f < 0 || f > MAX_FRET) throw new Error(`${where}: not on string ${s}`);
      if (tech === "h" && !(f > prev!.f)) throw new Error(`${where}: a hammer-on must go up`);
      if (tech === "p" && !(f < prev!.f)) throw new Error(`${where}: a pull-off must go down`);
      if (tech === "/") {
        lo = Math.max(0, lo + f - prev!.f);
        if (f > lo + 3) lo = f - 3;
      } else if (f > 0 && f > lo + 3) lo = f - 3;
      else if (f > 0 && f < lo) lo = f;
    } else {
      const all = [1, 2, 3, 4, 5, 6]
        .map((st) => ({ s: st, f: midi - STANDARD_TUNING[st]! }))
        .filter((c) => c.f >= 0 && c.f <= MAX_FRET);
      let cands = all.filter((c) => c.f >= lo && c.f <= lo + 3);
      if (!cands.length) cands = all.filter((c) => c.f >= lo - 1 && c.f <= lo + 4);
      if (!cands.length) throw new Error(`${where}: not reachable at position ${lo}`);
      const cost = (c: { s: number; f: number }) => (prev ? Math.abs(c.s - prev.s) + 0.5 * Math.abs(c.f - prev.f) : 0);
      cands.sort((a, b) => cost(a) - cost(b) || b.s - a.s);
      ({ s, f } = cands[0]!);
    }

    const t: Spec["t"] =
      tech === "h" ? "h" : tech === "p" ? "p" : tech === "/" ? "slide"
        : tech?.startsWith("b") ? "bend" : tech?.startsWith("r") ? "br" : "";
    const bend = tech === "b1" || tech === "r1" ? 1 : 2;
    specs.push({ s, f, b: tick / TICKS, d: dur / TICKS, t, ...(t === "bend" || t === "br" ? { bend } : {}), vib: !!vib });
    fingers.push(f === 0 ? 0 : Math.min(4, Math.max(1, f - lo + 1)));
    if (star) melody.push(specs.length - 1);
    prev = { s, f };
    tick += dur;
  }
  return { specs, melody, fingers, beats: tick / TICKS };
}

/* ----------------------------------------------------------------- licks */

interface LickDef {
  id: string;
  title: string;
  sub: string;
  tags: string[];
  genre: string;
  level: DiagonalLick["level"];
  speedFeel: string;
  summary: string;
  root: ScaleRoot;
  mode: ScaleMode;
  rootMidi: number;
  bpm: number;
  style: BackingStyle;
  /** One chord per 4-beat bar. */
  chords: string[];
  start: number;
  /** One line per phrase, in the notation above. */
  lines: string[];
  phrases: { label: string; text: string; bars: number }[];
  set?: 1 | 2 | 3;
}

function defineLick(d: LickDef): DiagonalLick {
  const c = compileLine(d.id, d.lines.join(" | "), { mode: d.mode, rootMidi: d.rootMidi }, d.start);
  const notes = buildLick(d.id, c.specs).map((n, i) => ({ ...n, finger: c.fingers[i]! }));
  let bar = 0;
  const phrases = d.phrases.map((p) => {
    const out: DiagonalPhrase = { bars: [bar, p.bars], label: p.label, text: p.text };
    bar += p.bars;
    return out;
  });
  if (bar !== d.chords.length) throw new Error(`${d.id}: phrases cover ${bar} bars, chords ${d.chords.length}`);
  return {
    lick: {
      id: d.id, title: d.title, sub: d.sub, tags: d.tags, root: d.root, mode: d.mode, box: 0,
      bpm: d.bpm, notes, backing: d.chords.map((ch) => [ch, 4] as [string, number]), style: d.style, compact: true,
    },
    genre: d.genre, level: d.level, speedFeel: d.speedFeel, summary: d.summary, phrases, melody: c.melody,
    set: d.set ?? 1,
  };
}

const SET_1: DiagonalLick[] = [
  defineLick({
    id: "dg-staircase", title: "Staircase", sub: "A minor pentatonic, frets 5 → 17, low strings to high.",
    tags: ["Rock", "Triplets"], genre: "Rock", level: "Medium", speedFeel: "eighth-note triplets",
    summary: "A four-note theme climbs the neck in steps: once at fret 5, once a position higher, then as triplet cells that walk up to fret 17 for a bend and a long A.",
    root: "A", mode: "minor-pentatonic", rootMidi: 57, bpm: 96, style: "rock",
    chords: ["Am", "G", "F", "G", "Am", "F", "G", "Am"], start: 5,
    lines: [
      "@5 *0:1 1:.5 2h:.5 *3~:1.5 1:.5 | *2h:1 1:.5 0:.5 *-1~:1.5 0:.5",
      "*1/:1 3:.5 2p:.5 *4~:1.5 5:.5 | *7~:1 6p:.5 5:.5 *4~:1.5 2s4:.5",
      "@10 *1:1/3 2h 3h 2p 3h 4 3 4 5h 4p 5h 6 | @13 *5:1/3 6 7h 6p 7h 8h *10~:1.5 9:.5",
      "*10r:2 9p:.5 7:.5 8h:.5 7p:.5 | @12 *5~:4",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "Box 1 at fret 5. Sing it: A, C-D, a long E; then D, C, A and a long G. This is the melody the rest of the lick grows from." },
      { label: "Theme, one position up", bars: 2, text: "Slide your ring finger from fret 7 to 10 and the hand moves with it. Same rhythm, new notes, higher on the neck: that's a sequence." },
      { label: "Speed cells", bars: 2, text: "Groups of three: C-D-E, D-E-G, E-G-A… each group starts one note higher, so the line climbs without ever running straight up the scale. The hand walks from fret 10 to 17." },
      { label: "Peak and home", bars: 2, text: "Bend A up to B and back over G, pull off, then drop to A at fret 14 with wide vibrato." },
    ],
  }),
  defineLick({
    id: "dg-blues-ladder", title: "Blues ladder", sub: "A blues, shuffle, frets 5 → 17 and back down.",
    tags: ["Blues", "Shuffle"], genre: "Blues", level: "Medium", speedFeel: "swung triplets",
    summary: "A blue curl (C bent toward C#) is the hook. It comes back an octave higher, then triplet cells climb through the ♭5 to a held A and a turnaround that walks down to E.",
    root: "A", mode: "blues", rootMidi: 57, bpm: 96, style: "shuffle",
    chords: ["A7", "D7", "A7", "A7", "D7", "D7", "A7", "E7"], start: 5,
    lines: [
      "@5 *1b1:1 0:2/3 1:1/3 3:2/3 2p:1/3 *4:1 | *2~:2 -:2/3 0:1/3 1:2/3 2h:1/3",
      "*4/:1 6:2/3 5p:1/3 7:2/3 8h:1/3 *10/~:1 | *7s2b1:2 6:2/3 5:1/3 4:2/3 5:1/3",
      "@12 *2:1/3 3h 4h 3p 4h 5 4 5 6h 5p 6h 7 | @13 *6:1/3 7 8h 7p 8h 9h *10h~:2",
      "*11b:5/3 10:1/3 8:2/3 9h:1/3 8p:2/3 6:1/3 | @12 *4:1 2:2/3 0:1/3 *-2~:2",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "Half-bend C toward C# (the A7's 3rd), touch the blue note E♭ with the pinky and pull off to D, then E. Swing it: long-short, long-short." },
      { label: "Theme, an octave up", bars: 2, text: "Slide D to E to move to fret 7, climb, slide again to fret 12, and play the same half bend on the B string, 13th fret." },
      { label: "Speed cells", bars: 2, text: "Groups of three through the blues scale: D-E♭-E, E♭-E-G, E-G-A… each one note higher, frets 12 → 16. Hammer up to E and let it ring." },
      { label: "Peak and turnaround", bars: 2, text: "Bend G up to A, flutter around D-E♭, then walk down across the strings to a low E for the E7: it pulls you back to the top." },
    ],
  }),
  defineLick({
    id: "dg-downhill", title: "Downhill", sub: "G major pentatonic, frets 15 → open, high to low.",
    tags: ["Country", "Pop"], genre: "Country / pop", level: "Medium", speedFeel: "eighth-note triplets at 120 BPM",
    summary: "A downward diagonal: the theme starts at fret 15, steps down a position, runs down the neck in triplet cells and comes home to open G.",
    root: "G", mode: "major-pentatonic", rootMidi: 55, bpm: 120, style: "pop",
    chords: ["G", "D", "Em", "C", "G", "D", "C", "D", "C", "G"], start: 14,
    lines: [
      "@14 *10~:1 8:.5 9h:.5 *11:1.5 10p:.5 | *9b:1.5 8:.5 *6~:1.5 7:.5",
      "@12 *9~:1 7:.5 8h:.5 *10:1.5 9p:.5 | *8b:1.5 7:.5 *5~:1.5 6:.5",
      "*7:1/3 6 5p 4 5 6h 4s4:1/3 @9 3 2p 1 2 3h | *1s5:1/3 @7 0p -1p -2 -1 0 *1~:2",
      "@5 *5~:1 3:.5 4h:.5 *6:1.5 5:.5 | *4b:1.5 3:.5 *1~:1.5 2:.5",
      "@0 *-1/:1 0:.5 1h:.5 *2:1.5 1:.5 | -2:.5 -1h:.5 *0:3",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "Up high at fret 15: G, D-E, a long A, then E bent to F# over D. Bright and singable." },
      { label: "Theme, one position down", bars: 2, text: "The same shape two frets lower. Over C the bend now lands on E, a note of the chord." },
      { label: "Speed cells, downhill", bars: 2, text: "Three 6-note cells going down the neck: frets 12, 9, then 7. Each cell falls four notes and turns back up; pull off on the way down." },
      { label: "Theme, an octave lower", bars: 2, text: "The theme again, one octave lower, at frets 7–10. Hearing the tune come back is what makes a long solo hang together." },
      { label: "Home to open G", bars: 2, text: "Slide down to fret 2 into open position, hammer from the open G string, touch open B and finish on open G." },
    ],
  }),
  defineLick({
    id: "dg-night-drive", title: "Night drive", sub: "E minor pentatonic, frets 7 → 17, then down to open E.",
    tags: ["Rock", "Sixteenths"], genre: "Hard rock", level: "Harder", speedFeel: "sixteenth notes at 120 BPM",
    summary: "A rock hook moves up a position, then breaks into descending fours (four notes down, start one higher) at frets 12–15, peaks with a bend at fret 15 and walks all the way down to low E.",
    root: "E", mode: "minor-pentatonic", rootMidi: 52, bpm: 120, style: "rock",
    chords: ["Em", "C", "D", "Em", "Em", "C", "D", "Em", "D", "Em"], start: 7,
    lines: [
      "@7 *5:1 6:.5 7h:.5 *8~:1.5 -:.5 | *6~:1.5 5:.5 4p:.5 5h:.5 *6:.5 -:.5",
      "@10 *7:1 8:.5 9h:.5 *10~:1.5 -:.5 | *8~:1.5 7:.5 6p:.5 7h:.5 *8:.5 -:.5",
      "@12 *6:1/4 5 4p 3 7 6p 5 4p 8 7 6p 5 9 8p 7 6p | *10:1/4 9 8p 7 11 10p 9 8p *11~:2",
      "*11b:1.5 10:.5 9:.5 10h:.5 8:.5 7p:.5 | *5~:2 3:.5 4s4:.5 2:.5 1s5:.5",
      "@5 *2:1 1:.5 0:.5 -1:.5 0h:.5 -2:.5 -3:.5 | @0 *-5:4",
    ],
    phrases: [
      { label: "Hook", bars: 2, text: "Box 2 at fret 7: E, G-A, a long B, a breath; then G, E, D-E, G. Leave the rests in." },
      { label: "Hook, one position up", bars: 2, text: "Hammer from B to D on the B string (frets 12 → 15) and the hand is suddenly at fret 12. Same rhythm, higher." },
      { label: "Descending fours", bars: 2, text: "Groups of four going down, each group starting one note higher: G-E-D-B, A-G-E-D… Pull off inside each group, pick only the first note on a string." },
      { label: "Peak", bars: 2, text: "Bend G up to A over D, a quick E-D-E, then step down the neck to E at fret 14." },
      { label: "Walk home", bars: 2, text: "Down through box 1 to the open low E. Let it ring." },
    ],
  }),
  defineLick({
    id: "dg-slow-burn", title: "Slow burn", sub: "D minor pentatonic ballad, frets 10 → 22.",
    tags: ["Ballad", "Bends"], genre: "Rock ballad", level: "Harder", speedFeel: "sextuplets at 72 BPM",
    summary: "Long, vocal notes and bends, then one fast flurry that shoots to the top of the neck and lands on a bend, like the burst near the end of a big ballad solo.",
    root: "D", mode: "minor-pentatonic", rootMidi: 62, bpm: 72, style: "pop",
    chords: ["Dm", "F", "C", "Am", "C", "Dm"], start: 10,
    lines: [
      "@10 *2b:1.5 1:.5 0:1 -1:.5 0h:.5 | *3~:2 -:1 1:.5 2h:.5",
      "@12 *5b:1.5 4:.5 3:1 2:.5 3h:.5 | *4~:2 -:1 5:.5 6:.5",
      "@15 *7:1/6 6 5p 6h 7 6 @17 9 8p 7 8 9h 8p *9b~:2",
      "*8p:1 @15 7:.5 6:.5 4:.5 6:.5 *5p~:1",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "Bend G up to A, fall to D and C, hammer back to D, then hold A over F. Play it slowly, like singing." },
      { label: "Theme, a position up", bars: 2, text: "The same curve at fret 12: bend D up to E over C, then hold C over Am." },
      { label: "The burst", bars: 1, text: "Twelve fast notes in two beats, climbing from fret 15 to 20, then bend C up to D right at the top of the neck." },
      { label: "Home", bars: 1, text: "Pull off from the bend, step down G, F, C, F and settle on D with vibrato." },
    ],
  }),
  defineLick({
    id: "dg-pop-glide", title: "Pop glide", sub: "C major pentatonic, frets 5 → 17 with slides.",
    tags: ["Pop", "Slides"], genre: "Pop", level: "Medium", speedFeel: "eighth-note triplets at 100 BPM",
    summary: "A pop hook that glides up the neck: each slide moves the hand to the next position, the triplet cells keep climbing, and a bend at the top resolves to C.",
    root: "C", mode: "major-pentatonic", rootMidi: 60, bpm: 100, style: "pop",
    chords: ["C", "G", "Am", "F", "C", "G", "F", "C"], start: 5,
    lines: [
      "@5 *2:1.5 1:.5 *0:1 1h:.5 2:.5 | *3/:1.5 2:.5 *1~:2",
      "*4:1.5 3:.5 *2:1 3h:.5 4:.5 | *5/:1.5 4:.5 *3~:2",
      "@12 *2:1/3 3 4h 3p 4h 5 4 5 6h 5p 6h 7h | @14 *6:1/3 7h 8 7 8 9h *8p~:1.5 9:.5",
      "*8b:1.5 7:.5 6:.5 7h:.5 5:.5 4:.5 | @12 *5~:4",
    ],
    phrases: [
      { label: "Hook", bars: 2, text: "E, D, C, D-E, then slide E up to G on the B string (fret 5 → 8). The slide is the position shift." },
      { label: "Hook, one position up", bars: 2, text: "The same hook two notes higher; this time slide A up to C (fret 10 → 13)." },
      { label: "Speed cells", bars: 2, text: "Groups of three (E-G-A, G-A-C, A-C-D…), each starting one note higher, from fret 12 up to 17. Hammer on and pull off; pick only where the string changes." },
      { label: "Peak and home", bars: 2, text: "Bend G up to A over F, a quick E-D-E, then land on C at fret 13 and hold it." },
    ],
  }),
];

/* ------------------------------------------------- set 2: the next ten */

const SET_2: DiagonalLick[] = [
  defineLick({
    id: "dg-pocket-climb", title: "Pocket climb", sub: "E Dorian funk, frets 7 → 19 and back.", set: 2,
    tags: ["Funk", "Sixteenths"], genre: "Funk", level: "Harder", speedFeel: "sixteenth notes at 100 BPM",
    summary: "A syncopated funk hook with rests in it, moved up a position, then 1-3-2-4 cells that climb in sixteenths to fret 19 and a bend at fret 15.",
    root: "E", mode: "dorian", rootMidi: 52, bpm: 100, style: "pop",
    chords: ["Em", "A", "Em", "A", "G", "A", "D", "Em"], start: 7,
    lines: [
      "@7 *7:.5 -:.25 7:.25 *9:.5 10h:.25 9p:.25 *11~:1 -:.5 9:.25 7:.25 | *12~:1 11:.5 9:.25 10h:.25 *8:1 -:.5 6:.25 7:.25",
      "*9/:.5 -:.25 9:.25 *11:.5 12h:.25 11p:.25 *13~:1 -:.5 11:.25 9:.25 | *14~:1 13:.5 11:.25 12h:.25 *10:1 -:.5 8:.25 9:.25",
      "@12 *11:1/4 13 12 14 *13:1/4 15 14 16 @15 *15:1/4 17 16 18 *17:.5 16:.5 | *16b:1.5 @12 14:.5 15:.25 14:.25 12:.5 *14~:1",
      "@10 *13:1 11:.5 10:.5 *8~:1.5 6:.5 | @7 *7:1 6:.5 4:.5 *0s5~:2",
    ],
    phrases: [
      { label: "Hook", bars: 2, text: "E, a sixteenth rest, then G-A hammered and a B. Leave the rests empty: in funk the gaps are part of the groove. Over A, C# (its 3rd) answers." },
      { label: "Hook, one position up", bars: 2, text: "Slide E to G on the G string and the hand moves up three frets. Same rhythm, two notes higher." },
      { label: "Sixteenth cells", bars: 2, text: "Four-note cells that go up, down, up (B-D-C#-E…), each starting two notes higher, up to B at fret 19. Pick every note, loose wrist, accent the first of each four." },
      { label: "Home", bars: 2, text: "Step down through D, B, A and F# over the D chord, then back to the root E on the A string." },
    ],
  }),
  defineLick({
    id: "dg-highway", title: "Highway", sub: "A Mixolydian southern rock, frets 2 → 15.", set: 2,
    tags: ["Southern rock", "Slides"], genre: "Southern rock", level: "Medium", speedFeel: "eighth-note triplets at 112 BPM",
    summary: "An open, major-sounding hook near the nut, the same hook three notes higher after a slide, triplet groups up to fret 15, and a bend that rides the D chord home.",
    root: "A", mode: "mixolydian", rootMidi: 57, bpm: 112, style: "rock",
    chords: ["A", "G", "D", "A", "A", "G", "D", "G", "A"], start: 2,
    lines: [
      "@2 *0:1 1:.5 2h:.5 *4~:1.5 2:.5 | *3:1 2:.5 1:.5 *-1~:1.5 0:.5",
      "*3/:1 4:.5 5h:.5 *7~:1.5 5:.5 | *7:1 5:.5 4:.5 *2~:1.5 5:.5",
      "@9 *4:1/3 5 6 5 6 7 6 7 8 *7 8 9 | *8:1/3 9 10 9 10 11 @12 10 11 12 *11 12 13 | *13b:1.5 12:.5 11:.5 12:.5 *10~:1",
      "@10 *8:1 7:.5 6:.5 *5:1.5 3:.5 | @7 *4:1 2:.5 3h:.5 *0~:2",
    ],
    phrases: [
      { label: "Hook", bars: 2, text: "A, B, hammer to C# (the major 3rd) and a long E. The G note over the G chord is what makes it Mixolydian, not plain major." },
      { label: "Hook, three notes higher", bars: 2, text: "Slide from fret 7 to 12 on the D string: the hand jumps up the neck and the hook starts on D over the D chord." },
      { label: "Triplet climb", bars: 3, text: "Groups of three that each start one note higher: E-F#-G, F#-G-A… two bars of them take you from fret 9 to 15. Then bend G up to A over D." },
      { label: "Home", bars: 2, text: "Walk down B, A, G, F# over G, then E, C#, D and a long A at fret 7 on the D string." },
    ],
  }),
  defineLick({
    id: "dg-iron-gate", title: "Iron gate", sub: "E harmonic minor metal, open E → fret 17.", set: 2,
    tags: ["Metal", "Sixteenths"], genre: "Metal", level: "Harder", speedFeel: "sixteenth notes at 132 BPM",
    summary: "A galloping riff on the open low E, a dark melody in the middle of the neck, descending fours that climb to fret 17, then a bend and the D#–E pull home.",
    root: "E", mode: "harmonic-minor", rootMidi: 52, bpm: 132, style: "rock",
    chords: ["Em", "Em", "C", "B7", "Em", "C", "Am", "B7", "Em", "B7", "Em"], start: 0,
    lines: [
      "@0 *-7:.5 -7:1/4 -7 *-5:.5 -7:1/4 -7 *-4:.5 -7:1/4 -7 *-3~:1 | -7:.5 -7:1/4 -7 *-2:.5 -3:.25 -4:.25 *-1:1 *0~:1",
      "@7 *5:.5 4:.25 5:.25 *7:.5 5:.25 7:.25 *9~:1.5 8:.5 | *8:.5 6:.5 *4:1 6:.5 7:.5 *8~:1",
      "@9 *11:1/4 10 9 8 *12:1/4 11 10 9 *13:1/4 12 11 10 *14:1/4 13 12 11 | @12 *14:1/4 13 12 11 *15:1/4 14 13 12 *16:1/4 15 14 13s2 @13 *17:1/4 16 15 14 | *16b:1.5 15:.25 14:.25 *13:.5 14:.5 *12~:1 | *11:1 13:.5 12:.5 *11:.5 10:.5 *8~:1",
      "@7 *7:1 6:.5 7:.5 *4:1.5 5:.5 | *6:.5 4:.5 *3:1 1:.5 -1:.5 *-3~:1 | @0 *-7:4",
    ],
    phrases: [
      { label: "Gallop riff", bars: 2, text: "Open low E as a pedal: E-E-E, then G on the low E string, A and B on the A string. Palm-mute the open E, let the other notes ring." },
      { label: "Melody", bars: 2, text: "C-B-C-E, C-E-G over C, then F#, D#, B over B7. The D# is the harmonic-minor note: it pulls hard back to E." },
      { label: "Descending fours", bars: 4, text: "Four notes down, start one higher: B-A-G-F#, C-B-A-G… two bars climb from fret 9 to 17, then a bend to A over Am and a B–D#–C–B figure over B7." },
      { label: "Home", bars: 3, text: "E, D#, E over Em, step down over B7, and finish on the open low E." },
    ],
  }),
  defineLick({
    id: "dg-latin-sunset", title: "Latin sunset", sub: "D Dorian, singing bends, frets 5 → 20.", set: 2,
    tags: ["Latin rock", "Bends"], genre: "Latin rock", level: "Medium", speedFeel: "eighth-note triplets at 84 BPM",
    summary: "A long, singing melody with bends over a minor vamp, the same curve a position higher, a triplet run across three strings, and a burst to fret 20.",
    root: "D", mode: "dorian", rootMidi: 62, bpm: 84, style: "pop",
    chords: ["Dm", "G", "Dm", "G", "Dm", "G", "Dm"], start: 5,
    lines: [
      "@5 *4~:1.5 3:.5 *2:1 0:.5 1:.5 | *4b:2 3:.5 2:.5 *3~:1",
      "@10 *7~:1.5 6:.5 *5:1 3:.5 4:.5 | *6b:2 5:.5 3:.5 *5~:1",
      "@12 *4:1/3 5 6 5 6 7 6 7 8 *7 8 9 | @13 *9b:1 10:1/3 11 @16 12 *13~:1 12:.5 11:.5",
      "@14 *11:.5 9s1:.5 @10 7:.5 8:.5 *7~:2",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "A long A, then G, F, D, E. Over G, bend A up to B, G's 3rd. Play it like a singer: slow vibrato, no hurry." },
      { label: "Theme, a position up", bars: 2, text: "The same curve at frets 10–13: D, C, B, G, A, then bend C up to D. The B over Dm is the Dorian colour." },
      { label: "Triplet run", bars: 1, text: "Groups of three across the G, B and e strings: A-B-C, B-C-D… up to F at fret 13." },
      { label: "The burst", bars: 1, text: "Bend F up to G, then G-A-B in one beat, up to C at fret 20. Hold it." },
      { label: "Home", bars: 1, text: "A, F, D, E and a long D at fret 10 with wide vibrato." },
    ],
  }),
  defineLick({
    id: "dg-reel-ridge", title: "Reel ridge", sub: "G major Celtic reel, frets 3 → 19.", set: 2,
    tags: ["Celtic", "Triplets"], genre: "Celtic folk", level: "Medium", speedFeel: "jig-feel triplets at 116 BPM",
    summary: "A fiddle-style tune in jig rhythm (long-short), repeated a position up, then three-note cells (up a third, down a step) that run to the top of the neck.",
    root: "G", mode: "major", rootMidi: 55, bpm: 116, style: "pop",
    chords: ["G", "C", "D", "G", "Em", "C", "D", "G", "D", "G"], start: 2,
    lines: [
      "@2 *0:1/3 2 4 *7:2/3 4:1/3 *2:2/3 4:1/3 *3:2/3 2:1/3 | *3:2/3 5:1/3 *7:2/3 5:1/3 *4:2/3 3:1/3 *2:1",
      "@7 *4:1/3 6 8 *11:2/3 8:1/3 *6:2/3 8:1/3 *7:2/3 6:1/3 | *9:2/3 8:1/3 *9:2/3 11:1/3 *10:2/3 9:1/3 *7:1",
      "@9 *9:1/3 7 8 *10:1/3 8 9 *11:1/3 9 10 *12:1/3 10 11 | @12 *12:1/3 10 11 *13:1/3 11 12 *14:1/3 12 13 @14 *15:1/3 13 14 | @15 *15~:1 16:1/3 15 13 *14:1 13:1/3 12 11",
      "@12 *14:2/3 12:1/3 *11:2/3 12:1/3 *9:2/3 11:1/3 *14~:1 | @9 *11:2/3 10:1/3 *8:2/3 10:1/3 *11:2/3 8:1/3 *6:1 | @7 *7:2/3 4:1/3 *2:2/3 4:1/3 *7~:2",
    ],
    phrases: [
      { label: "Tune", bars: 2, text: "G-B-D up the arpeggio, then a long-short jig rhythm: G, D, B, D, C, B. Lean on the long notes." },
      { label: "Tune, a position up", bars: 2, text: "The same rhythm at fret 7, starting on D over the D chord. Fiddle tunes repeat their phrases, so should you." },
      { label: "The reel", bars: 3, text: "Three-note cells: up a third, down a step (B-G-A, C-A-B…), each one note higher. Two bars climb from fret 10 to 17, then a turn around A and B up at fret 19." },
      { label: "Ridge and home", bars: 3, text: "Dance around G at fret 15, step back down to fret 10 over D, and end on G at fret 8." },
    ],
  }),
  defineLick({
    id: "dg-velvet", title: "Velvet two-five", sub: "C major neo-soul, ii – V – I, frets 7 → 17.", set: 2,
    tags: ["Neo-soul", "Legato"], genre: "Neo-soul", level: "Harder", speedFeel: "sextuplets at 70 BPM",
    summary: "A smooth line over Dm7 – G7 – Cmaj7 that hits each chord's 3rd or 7th, the same line slid up a position, a sextuplet flurry, and a soft landing on G.",
    root: "C", mode: "major", rootMidi: 60, bpm: 70, style: "pop",
    chords: ["Dm7", "G7", "Cmaj7", "Am", "G7", "Cmaj7"], start: 8,
    lines: [
      "@8 *5~:1.5 7:.5 8h:.5 7p:.5 *3:1 | *6:1 4:.5 3:.5 *1~:1.5 2:.5",
      "*4/:1 6:.5 7h:.5 *9~:1.5 7:.5 | *8b:1.5 7:.5 *5:1 4:.5 2:.5",
      "@12 *6:1/6 7 8 7 8 9 @13 8 9 10 9 10 11 *12b:1.5 11:.5",
      "*11:.5 9:.5 10:.5 9:.5 *7~:2",
    ],
    phrases: [
      { label: "Line over ii – V", bars: 2, text: "A over Dm7, C-D-C, then F (its 3rd). Over G7, B (its 3rd) falls through G and F to D and E. Slow and behind the beat." },
      { label: "Slide up", bars: 2, text: "Slide E to G on the G string and the line moves up a position: G, B, C, a long E over Cmaj7, then bend D up to E over Am." },
      { label: "Flurry", bars: 1, text: "Twelve notes in two beats, groups of three from B up to G, then bend A up to B over G7." },
      { label: "Landing", bars: 1, text: "G, E, F, E and a long C. On Cmaj7 every one of those is a chord tone or right next to one." },
    ],
  }),
  defineLick({
    id: "dg-rockabilly", title: "Rockabilly ramble", sub: "E major pentatonic, 12-bar shuffle, open → fret 16.", set: 2,
    tags: ["Rockabilly", "Shuffle"], genre: "Rockabilly", level: "Harder", speedFeel: "swung triplets at 144 BPM",
    summary: "A full 12-bar blues in 20 seconds: open-position licks, the same idea up the neck over A, a triplet run to fret 16, and a turnaround on B.",
    root: "E", mode: "major-pentatonic", rootMidi: 52, bpm: 144, style: "shuffle",
    chords: ["E", "E", "E", "E", "A", "A", "E", "E", "B7", "A", "E", "B7"], start: 0,
    lines: [
      "@0 *0:2/3 2:1/3 *3:2/3 2:1/3 *0:1 -:1 | *-2:2/3 -1h:1/3 *0:2/3 -1:1/3 *-2:1 -3~:1 | *5:2/3 4:1/3 *5:2/3 3:1/3 *2:2/3 0:1/3 *-2:1 | *-3:1 -2:2/3 0:1/3 *2:1 *4:1",
      "@5 *4:2/3 5:1/3 *6:2/3 5:1/3 *4:1 -:1 | *5:2/3 6:1/3 *8:2/3 6:1/3 *9:1 -:1 | @9 *8:2/3 9:1/3 *10:2/3 9:1/3 *8:1 7:1 | *10:2/3 8:1/3 *7:2/3 8:1/3 *5~:2",
      "@11 *8:1/3 9 10 9 10 11 @12 10 11 12 *11 12 10 | @12 *12b1:1.5 11:.5 10:.5 9:.5 *10~:1",
      "@9 *8:2/3 7:1/3 *5:2/3 7:1/3 *8:1 *5~:1 | @7 *3:2/3 4:1/3 *3:2/3 1:1/3 *3~:2",
    ],
    phrases: [
      { label: "Open position", bars: 4, text: "Bars 1–4 over E: E-G#-B, then B-C# hammered, then E down to B. Swing every pair: long-short." },
      { label: "Up the neck", bars: 4, text: "Over A the same rhythm moves to fret 5 (C#, E, F#), then to fret 9–12 back over E." },
      { label: "Triplet run", bars: 2, text: "Groups of three over B7: B-C#-E, C#-E-F#… climbing to G# at fret 16, then a half bend from G# to A over the A chord." },
      { label: "Turnaround", bars: 2, text: "B, G#, E over E, then end on B over B7 so the 12 bars can start again." },
    ],
  }),
  defineLick({
    id: "dg-glass-river", title: "Glass river", sub: "B minor fusion, arpeggio cells, frets 2 → 19.", set: 2,
    tags: ["Fusion", "Arpeggios"], genre: "Fusion", level: "Harder", speedFeel: "sixteenth notes at 96 BPM",
    summary: "A low theme near the nut, the same theme an octave up, then flowing triad arpeggio cells (no scale runs) that climb to fret 19 and fall home.",
    root: "B", mode: "minor", rootMidi: 59, bpm: 96, style: "pop",
    chords: ["Bm", "G", "D", "A", "Bm", "G", "A", "Bm"], start: 2,
    lines: [
      "@2 *-3~:1.5 -5:.5 -4:.5 -3:.5 *-1:1 | *0~:1 -1:.5 -3:.5 *-2:1.5 -3:.5",
      "*-1/:.5 @7 *4:1 2:.5 3:.5 4:.5 *6:1 | *6:.5 7:.5 *9b:1.5 8:.5 6:1",
      "@10 *4:1/4 6 8 6 *5:1/4 7 9 7 *6:1/4 8 10 8 *7:1/4 9 11 9 | *9s1:1/4 @14 11 13 11 @15 *10:1/4 12 14 12 *14~:1 13:.5 12:.5",
      "@12 *12b:1.5 11:.5 9:.5 10:.5 *8:1 | @7 *7:1 4:.5 6:.5 *7~:2",
    ],
    phrases: [
      { label: "Low theme", bars: 2, text: "F#, D, E, F#, A at frets 2–5, then B, A, F#, G. Clean and even." },
      { label: "Theme, an octave up", bars: 2, text: "Slide F# to A on the D string, then the same theme an octave higher at fret 7. Bend D up to E over A." },
      { label: "Arpeggio cells", bars: 2, text: "Each beat is a triad: F#-A-C#-A, G-B-D-B, A-C#-E-C#… every cell one note higher. Legato feel, fingers rolling across the strings. Peaks on B at fret 19." },
      { label: "Fall home", bars: 2, text: "Bend G up to A over A, then F#, D, E, C#; finish B, F#, A and a long B over Bm at fret 7." },
    ],
  }),
  defineLick({
    id: "dg-skyline", title: "Skyline", sub: "F major pentatonic pop-punk, frets 5 → 20.", set: 2,
    tags: ["Pop-punk", "Hooks"], genre: "Pop-punk", level: "Harder", speedFeel: "triplets at 150 BPM",
    summary: "A shout-along hook in eighth notes, the same hook a position up for the second time round, a triplet run to fret 20, and a big landing on F.",
    root: "F", mode: "major-pentatonic", rootMidi: 65, bpm: 150, style: "rock",
    chords: ["F", "C", "Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C", "Bb", "F"], start: 5,
    lines: [
      "@5 *2:.5 2:.5 *3:1 2:.5 1:.5 *0:1 | *-2:.5 -2:.5 *0:1 -2:.5 -3:.5 *-4~:1 | *-1:.5 -1:.5 *0:1 2:.5 1:.5 *-1:1 | *0:1.5 -1:.5 *-2:1 -1:1",
      "@12 *5:.5 5:.5 *6:1 5:.5 4:.5 *3:1 | *1:.5 1:.5 *3:1 1:.5 0:.5 *-1~:1 | *2:.5 2:.5 *3:1 5:.5 4:.5 *2:1 | *4:1.5 3:.5 *2:1 3:1",
      "@13 *2:1/3 3 4 3 4 5 4 5 6 *5 6 7 | @13 *5b:1.5 6:.5 7:.5 @17 8:.5 *7~:1",
      "@10 *4:.5 3:.5 2:.5 0:.5 *-1:1 0:.5 2:.5 | *3:1 2:.5 *0~:2.5",
    ],
    phrases: [
      { label: "Hook", bars: 4, text: "A-A-C, A, G, F: the kind of line a crowd sings. Then C over C, D over Dm, F over B♭. Down-picks only, it's punk." },
      { label: "Hook, second time", bars: 4, text: "The same hook three notes higher at frets 12–15. Repeating a hook higher is how pop songs lift the second chorus." },
      { label: "Triplet run", bars: 2, text: "Groups of three: A-C-D, C-D-F… up to A at fret 17, then bend F up to G over C and climb to C at fret 20." },
      { label: "Landing", bars: 2, text: "D, C, A, F, D over B♭, then C, A and a long F to finish." },
    ],
  }),
  defineLick({
    id: "dg-midnight", title: "Midnight blues", sub: "C blues, slow 12/8 feel, frets 8 → 20.", set: 2,
    tags: ["Slow blues", "Bends"], genre: "Slow blues", level: "Medium", speedFeel: "sextuplets at 60 BPM",
    summary: "One bar at a time over a slow blues: a cry with two bends, an answer up the neck, a sextuplet run through the blue note to fret 20, a peak, and home.",
    root: "C", mode: "blues", rootMidi: 60, bpm: 60, style: "shuffle",
    chords: ["C7", "F7", "C7", "G7", "C7"], start: 8,
    lines: [
      "@8 *5b:1.5 4:.5 *1b1:1 *0~:1",
      "@11 *6:1 5:.5 6:.5 *7b:1.5 6:.5",
      "@11 *6:1/6 7 8 7 8 9 8 9 10 9 10 12/ *11b~:2",
      "@15 *10:1 11:.5 10:.5 *11b1:1.5 10:.5",
      "@11 *6:1 4:.5 1b1:.5 *0~:2",
    ],
    phrases: [
      { label: "The cry", bars: 1, text: "Bend B♭ up to C, fall to G, then the blue curl: E♭ half-bent towards E, C7's 3rd. Each note is a full second; let it hang." },
      { label: "The answer", bars: 1, text: "Up at fret 11–13 over F7: C, B♭, C, then bend E♭ up to F, the chord's root." },
      { label: "The run", bars: 1, text: "A sextuplet run in groups of three through F, F# (the blue note) and G, sliding up to C at fret 20, then a bend from B♭ to C." },
      { label: "Peak", bars: 1, text: "G and B♭ at the top of the neck over G7; half-bend B♭ to B, the chord's 3rd." },
      { label: "Home", bars: 1, text: "C, G, a half bend on E♭ and a long C with vibrato." },
    ],
  }),
];

/* ------------------------------------------------- set 3: ten more */

const SET_3: DiagonalLick[] = [
  defineLick({
    id: "dg-swing-street", title: "Swing street", sub: "C major jazz over ii – V – I – VI, frets 7 → 19.", set: 3,
    tags: ["Jazz", "Swing"], genre: "Jazz swing", level: "Harder", speedFeel: "swung triplets at 96 BPM",
    summary: "A bebop-style line that walks through the chord tones of Dm7 – G7 – Cmaj7 – A7, uses chromatic passing notes to land on the next chord, then climbs in triplets to fret 19 and lands softly.",
    root: "C", mode: "major", rootMidi: 60, bpm: 96, style: "shuffle",
    chords: ["Dm7", "G7", "Cmaj7", "A7", "Dm7", "G7", "Cmaj7", "Cmaj7"], start: 7,
    lines: [
      "@7 *5:2/3 7:1/3 *8:2/3 7:1/3 *5:2/3 4:1/3 *3:1 | *6:2/3 4:1/3 *3:2/3 1:1/3 *4:2/3 6:1/3 8:2/3 8^:1/3",
      "@9 *9~:1.5 7:.5 *6:2/3 4:1/3 *2:1 | *4:2/3 4^:1/3 *5:2/3 7^:1/3 *9:2/3 8:1/3 *7^:2/3 5s3:1/3",
      "@12 *8:1/3 10 9 *9:1/3 11 10 @14 *10:1/3 12 11 @15 *11:1/3 13 12 | *13~:1 12:2/3 10:1/3 *11:2/3 10:1/3 *8:2/3 8^:1/3",
      "@8 *9~:1.5 6:.5 *7:1 4:1 | *6:1 4:2/3 2:1/3 *0~:2",
    ],
    phrases: [
      { label: "Bebop line", bars: 2, text: "Over Dm7: A, C, D, C, A, G, F. Over G7: B (its 3rd) down to D, back up to D, then D# as a chromatic step into E. Swing every pair of eighths." },
      { label: "Answer, a position up", bars: 2, text: "A long E over Cmaj7, then the A7 bar: G, G#, A, C#, E: the G# and C# are the notes that tell you the chord changed." },
      { label: "Triplet climb", bars: 2, text: "Three-note cells (up a third, down a step) from D at fret 15 to B at fret 19, then down through G7 with the same D# step into E." },
      { label: "Landing", bars: 2, text: "E, B, C, G over Cmaj7, then B, G, E and a long C." },
    ],
  }),
  defineLick({
    id: "dg-flamenco", title: "Flamenco fire", sub: "E Phrygian over the Andalusian cadence, open → fret 19.", set: 3,
    tags: ["Flamenco", "Picado"], genre: "Flamenco", level: "Harder", speedFeel: "sixteenth-note picado at 108 BPM",
    summary: "The Am – G – F – E cadence twice: first as a falling line in open position, then an octave up with picado ornaments, then a fast run that climbs to fret 19 and the F–E crush over E.",
    root: "E", mode: "phrygian", rootMidi: 64, bpm: 108, style: "pop",
    chords: ["Am", "G", "F", "E", "Am", "G", "F", "E", "E"], start: 0,
    lines: [
      "@0 *0:1.5 -1:.5 -2:.5 -1:.5 *-2:1 | *-1:1.5 -2:.5 -3:.5 -2:.5 *-3:1 | *-2:1.5 -3:.5 -4:.5 -3:.5 *-4:1 | *-5^:1 -6:1/3 -5^ -6 *-7~:2",
      "@10 *7:.5 8:.25 7:.25 *6:.5 7:.25 6:.25 *5:1 *6:.5 5:.5 | *6:.5 7:.25 6:.25 *5:.5 6:.25 5:.25 *4:1 *5:.5 4:.5",
      "@12 *5:1/4 7 6 8 *6:1/4 8 7 9 @14 *7:1/4 9 8 10 @15 *8:1/4 10 9 11 | *7:1/4 8 7 8 *9^:1/4 8 9^ 8 *7~:2",
      "@7 *4:1 2^:.5 1:.5 *0~:2",
    ],
    phrases: [
      { label: "The cadence", bars: 4, text: "E, D, C over Am, then the same shape a step lower on each chord: the line falls with the bass. Over E, G# (outside the scale) and F trill into E on the D string." },
      { label: "An octave up, picado", bars: 2, text: "The same falling line at frets 10–13, with quick picado turns (E-F-E, D-E-D). Alternate-pick every note, rest stroke if you can." },
      { label: "The run", bars: 2, text: "1-3-2-4 cells from C to B at fret 19, then the flamenco crush over E: E-F-E-F, G#-F-G#-F, a long E." },
      { label: "Final", bars: 1, text: "B, G#, F and a long E at fret 9 on the G string: the F to E half step is the Phrygian sound." },
    ],
  }),
  defineLick({
    id: "dg-lydian-sky", title: "Lydian sky", sub: "F Lydian, film-score style, frets 5 → 19.", set: 3,
    tags: ["Cinematic", "Wide leaps"], genre: "Cinematic", level: "Medium", speedFeel: "sextuplets at 86 BPM",
    summary: "A floating melody with wide leaps that leans on B (the raised 4th that makes Lydian sound dreamy), a sliding answer up the neck, cascading triads and one sextuplet swell.",
    root: "F", mode: "lydian", rootMidi: 65, bpm: 86, style: "pop",
    chords: ["F", "G", "F", "G", "Am", "G", "F"], start: 5,
    lines: [
      "@5 *2:1.5 -3:.5 *1:1 3:1 | *3~:2 2:.5 1:.5 *-2:1",
      "*0/:1 4:1 *6:1 5:.5 4:.5 | @10 *5~:2 3:.5 4:.5 *1:1",
      "@12 *6:1/4 4 2 4 *7:1/4 5 3 5 *8:1/4 6 4 6s2 @14 *9:1/4 7 5 7 | @15 *8:1/6 9 10 9 8 7 *10~:1 8:.5 7:.5 *8:1",
      "@12 *7:1 6:.5 4:.5 *2~:2",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "A, down to C, up to G and B. Over G the long B is a chord tone; over F it's the Lydian #4, the floating note." },
      { label: "Slide and answer", bars: 2, text: "Slide from D to F on the G string, leap to C and E, then a long D over G." },
      { label: "Cascade", bars: 2, text: "Falling triads that climb (E-C-A-C, F-D-B-D…), then a sextuplet swell around B at fret 19." },
      { label: "Landing", bars: 1, text: "F, E, C and a long A over F. Ending on the 3rd keeps it open, like a film cue." },
    ],
  }),
  defineLick({
    id: "dg-surf-wave", title: "Surf wave", sub: "D minor surf with tremolo picking, frets 5 → 18.", set: 3,
    tags: ["Surf", "Tremolo"], genre: "Surf rock", level: "Medium", speedFeel: "tremolo triplets at 140 BPM",
    summary: "Twelve bars of surf: a tremolo-picked melody on the low strings, the same tune higher over B♭ and A (with C# outside the scale), a triplet climb to a bend at fret 18, and tremolo back down.",
    root: "D", mode: "minor", rootMidi: 62, bpm: 140, style: "rock",
    chords: ["Dm", "Dm", "C", "C", "Bb", "Bb", "A", "A", "Dm", "C", "Bb", "A"], start: 5,
    lines: [
      "@5 *-7:1/3 -7 -7 -7 -7 -7 *-5:1/3 -5 -5 *-4:1/3 -4 -4 | *-3:1/3 -3 -3 -3 -3 -3 *-4:1/3 -4 -4 *-5:1/3 -5 -5 | *-8:1/3 -8 -8 -8 -8 -8 *-6:1/3 -6 -6 *-5:1/3 -5 -5 | *-4:1/3 -4 -4 -4 -4 -4 *-5:1/3 -5 -5 *-6:1/3 -6 -6",
      "@10 *5:1/3 5 5 5 5 5 *4:1/3 4 4 *2:1/3 2 2 | *2:1/3 2 2 2 2 2 *0:1/3 0 0 *2:1/3 2 2 | @9 *-1^:1/3 -1^ -1^ -1^ -1^ -1^ *1:1/3 1 1 *4:1/3 4 4 | *4:1/3 4 4 4 4 4 *6^:1/3 6^ 6^ *8:1/3 8 8",
      "@10 *7:1/3 8 9 @12 8 9 10 @14 9 10 11 *10 11 12 | @15 *12b:1.5 11:.5 10:.5 9:.5 *10:1",
      "@10 *9:1/3 9 9 9 9 9 *7:1/3 7 7 *5:1/3 5 5 | *6^:1/3 6^ 6^ 6^ 6^ 6^ *4~:2",
    ],
    phrases: [
      { label: "Low tremolo", bars: 4, text: "Pick each note as fast and even as you can (the tremolo): D, F, G, A on the A and D strings. Keep the wrist loose; the melody is the long notes." },
      { label: "Tremolo up the neck", bars: 4, text: "The tune moves to frets 9–12 over B♭ and A. Over A, play C# (outside D minor, it's A's 3rd) instead of C." },
      { label: "Triplet climb", bars: 2, text: "Groups of three from D at fret 10 up to B♭ at fret 18, then bend B♭ up to C over the C chord." },
      { label: "Tremolo home", bars: 2, text: "F, D, B♭ tremolo over B♭, then C# and a long A over A: it pulls back to Dm for the next round." },
    ],
  }),
  defineLick({
    id: "dg-rooftop", title: "Rooftop skank", sub: "E minor reggae, off-beat phrasing, frets 7 → 17.", set: 3,
    tags: ["Reggae", "Off-beats"], genre: "Reggae", level: "Medium", speedFeel: "sixteenths at 74 BPM",
    summary: "A laid-back reggae melody that leaves space on the beats and answers on the off-beats, moves up to fret 12, drops one quick sixteenth fill, and comes home.",
    root: "E", mode: "minor", rootMidi: 64, bpm: 74, style: "pop",
    chords: ["Em", "D", "C", "D", "Em", "Em"], start: 7,
    lines: [
      "@7 *-3:.5 -:.5 *0:.5 2:.5 -:.5 *4:.5 2:.75 0:.25 | *-1:.5 -:.5 *1:.5 3:.5 -:.5 *6:.5 3:.75 1:.25",
      "*5/:.5 -:.5 *7:.5 9:.5 -:.5 *7:.5 5:.75 4:.25 | @13 *6:.5 -:.5 *8:.5 10:.5 -:.5 *8:.5 6:.75 5:.25",
      "@12 *9:1/4 8 7 5 *8:1/4 7 5 4 *7:1/4 5 4 2 *4~:1",
      "@7 *2:.5 -:.5 *0:.5 -3:.5 -:.5 *0~:1.5",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "B, a rest, E-G, a rest, B, G, E. The rests fall where the rhythm guitar skanks; your notes answer between them. Then the same shape over D." },
      { label: "Theme, a position up", bars: 2, text: "Slide up the B string from F# to C at fret 13, then C-E-G over C and D-F#-A over D up to fret 17." },
      { label: "Quick fill", bars: 1, text: "One beat-by-beat falling fill in sixteenths (G-F#-E-C, F#-E-C-B…) and a held B. One fast moment per solo is plenty in reggae." },
      { label: "Home", bars: 1, text: "G, E, B and a long E. Lay back behind the beat." },
    ],
  }),
  defineLick({
    id: "dg-bluegrass", title: "Bluegrass breakdown", sub: "G major pentatonic with the G run, open → fret 19.", set: 3,
    tags: ["Bluegrass", "Open strings"], genre: "Bluegrass", level: "Medium", speedFeel: "eighth-note triplets at 120 BPM",
    summary: "Flatpicking in G: the classic G run (A# hammered to B), open-string arpeggios, the run again at fret 10, triplet rolls up to fret 19 and the G run to finish.",
    root: "G", mode: "major-pentatonic", rootMidi: 55, bpm: 120, style: "pop",
    chords: ["G", "G", "C", "G", "D", "G", "C", "G", "D", "G"], start: 0,
    lines: [
      "@0 *2:.5 1:.5 *0:.5 1:.5 1^:.5 2h:.5 *3:1 | *5:.5 3:.5 *2:.5 0:.5 *-2:.5 -1:.5 *0:1 | @0 *4:.5 3:.5 *4:.5 5:.5 *4:.5 3:.5 *2:1 | *0:.5 2:.5 *3:.5 5:.5 *3:.5 2:.5 *0:1",
      "@7 *3:.5 5:.5 *6:.5 6^:.5 7h:.5 8:.5 *6:1 | *7:.5 8:.5 *9:.5 8:.5 *7:.5 5:.5 *7:1",
      "@10 *5:1/3 7 6 *6:1/3 8 7 *7:1/3 9 8s2 @12 *8:1/3 10 9 | @15 *10:1/3 12 11 *12~:1 10:1/3 8 7 *10:1",
      "@7 *8:.5 6:.5 *5:.5 3:.5 *4:.5 3:.5 *1:1 | @0 *-2:.5 -1:.5 *0:.5 1:.5 1^:.5 2h:.5 *0s3~:1",
    ],
    phrases: [
      { label: "G run and open strings", bars: 4, text: "B, A, G, A, A#, hammer to B, D: the G run every flatpicker knows. Then arpeggios that ring on open strings, alternate picking down-up." },
      { label: "The run at fret 10", bars: 2, text: "The same move an octave up: A, A#, hammer to B on the B string (frets 10–12), then B, D, E, D, B, G over G." },
      { label: "Triplet rolls", bars: 2, text: "Three-note rolls (G-B-A, A-D-B…) that climb to B at fret 19, like a banjo roll on guitar." },
      { label: "G run home", bars: 2, text: "Down through D, A, G over D, then the G run in open position to end on the open G string." },
    ],
  }),
  defineLick({
    id: "dg-sunday-best", title: "Sunday best", sub: "C gospel / soul, frets 5 → 17.", set: 3,
    tags: ["Gospel", "Soul"], genre: "Gospel soul", level: "Medium", speedFeel: "sextuplets at 72 BPM",
    summary: "Church-style phrasing in C: the E♭ to E hammer (the bluesy 3rd that resolves), a call that answers itself up the neck, one sextuplet shout and a gentle amen.",
    root: "C", mode: "major-pentatonic", rootMidi: 60, bpm: 72, style: "pop",
    chords: ["C", "F", "C", "G", "F", "C"], start: 8,
    lines: [
      "@8 *5:1 4:.5 5:.5 *7_:.5 7h:.5 *5~:1 | *4~:1.5 5:.5 *4:.5 3:.5 *2^:1",
      "@12 *7:1 7_:.5 7:.5 *8:.5 7:.5 *5~:1 | *6:1.5 8:.5 *6:.5 5:.5 *3:1",
      "@12 *4:1/6 5 6 5 6 7 @14 6 7 8 7 8 9 *8b:1.5 7s1:.5",
      "@5 *5:.5 4:.5 *2_:.5 2h:.5 *0~:2",
    ],
    phrases: [
      { label: "Call", bars: 2, text: "C, A, C, then E♭ hammered to E: the sound of a choir bending into the note. Over F: A, C, A, G and F." },
      { label: "Answer, up the neck", bars: 2, text: "At fret 12: E, E♭, E, G, E, C over C, then D, G, D, C, G over G." },
      { label: "Shout", bars: 1, text: "Twelve sextuplets climbing in threes from A to A at fret 17, then bend G up to A over F." },
      { label: "Amen", bars: 1, text: "C, A, E♭ to E, and a long C. Wide, slow vibrato." },
    ],
  }),
  defineLick({
    id: "dg-rain-city", title: "Rain city", sub: "B minor pentatonic grunge, frets 7 → 19.", set: 3,
    tags: ["Grunge", "Bends"], genre: "Grunge", level: "Harder", speedFeel: "sixteenths at 108 BPM",
    summary: "A moody, bend-heavy theme, the theme a position up, then sixteenth pedal cells (a climbing note against a repeated top note) that rise to fret 19, a peak bend and a heavy landing on B.",
    root: "B", mode: "minor-pentatonic", rootMidi: 59, bpm: 108, style: "rock",
    chords: ["Bm", "G", "D", "A", "Bm", "G", "D", "A", "Bm"], start: 7,
    lines: [
      "@7 *2b:1.5 1:.5 *0:1 -1:.5 0:.5 | *1~:2 -1:.5 0:.5 *1:1",
      "@12 *6~:1.5 5:.5 *4:1 3:.5 4:.5 | *7~:1.5 6:.5 *5b:1 4:1",
      "@12 *5:1/4 8 6 8 *6:1/4 8 7 8 @14 *7:1/4 9 8 9 @15 *8s2:1/4 10 9 10 | *10~:1.5 9:.5 *8:.5 9:.5 *6s2:1 | @12 *7b:2 6:.5 5:.5 *4:1",
      "@7 *2:1 1:.5 2:.5 *4~:2 | *0:1 -2:.5 -1:.5 *0~:2",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "Bend E up to F#, fall to D, B, A, B, then a long D over G. Let the bend be slightly lazy; grunge isn't tidy." },
      { label: "Theme, a position up", bars: 2, text: "D, B, A, F#, A at frets 11–15, then E, D and a bend from B toward C# over A." },
      { label: "Pedal cells", bars: 3, text: "A climbing note against a repeated top note (B-F#-D-F#, D-F#-E-F#…) up to B at fret 19, then a peak bend from E to F# over D." },
      { label: "Heavy landing", bars: 2, text: "E, D, E and a long A over A, then B, F#, A and a long B." },
    ],
  }),
  defineLick({
    id: "dg-clockwork", title: "Clockwork", sub: "A harmonic minor neoclassical, frets 4 → 19.", set: 3,
    tags: ["Neoclassical", "Sextuplets"], genre: "Neoclassical shred", level: "Harder", speedFeel: "sextuplets at 96 BPM",
    summary: "A stately theme with the G# leading note, the theme an octave up, then sextuplet arpeggios over Dm and harmonic-minor turns over E, ending on a half bend from G# to A.",
    root: "A", mode: "harmonic-minor", rootMidi: 69, bpm: 96, style: "rock",
    chords: ["Am", "E", "Am", "E", "Dm", "E", "Am", "Am"], start: 5,
    lines: [
      "@5 *0~:1.5 -1:.5 *-3:1 0:1 | *-1:1.5 -2:.5 *-3:1 -6:1",
      "@14 *7~:1.5 6:.5 *4:1 7:1 | *6:1.5 5:.5 *4:1 1:1",
      "@10 *-2:1/6 0 3 5 3 0 @13 *0:1/6 3 5 7 5 3 @15 *5:1/6 7 8 7 5 3 *3~:1 | *6:1/6 7 8 7 6 4 *4:1/6 6 7 6 4 3 *3:1/6 4 6 4 3 1 *4~:1",
      "@13 *6b1:2 4:.5 2:.5 *3:.5 1:.5 | *0:1.5 -1:.5 *0~:2",
    ],
    phrases: [
      { label: "Theme", bars: 2, text: "A, G#, E, A, then G#, F, E, B over E. The G# (a major 7th above A) is the harmonic-minor note that sounds classical." },
      { label: "Theme, an octave up", bars: 2, text: "The same tune at frets 13–17. Play it slowly and sing it before you speed anything up." },
      { label: "Sextuplet arpeggios", bars: 2, text: "Over Dm, arpeggios climb from fret 10 (F-A-D-F-D-A, A-D-F-A-F-D…); over E, turns through G#-A-B and back. Six notes per beat: practise at 60% first." },
      { label: "Final bend", bars: 2, text: "Half-bend G# up to A, fall through E, C, D, B, and hold A." },
    ],
  }),
  defineLick({
    id: "dg-bike-lights", title: "Bike lights", sub: "D major indie, open → fret 19.", set: 3,
    tags: ["Indie", "Arpeggios"], genre: "Indie rock", level: "Medium", speedFeel: "sixteenths at 112 BPM",
    summary: "A chiming arpeggio hook, the same hook a position up over Bm and G, rippling sixteenth cells that climb to fret 19 and a bend at fret 17, and the hook again in open position.",
    root: "D", mode: "major", rootMidi: 62, bpm: 112, style: "pop",
    chords: ["D", "A", "Bm", "G", "D", "A", "Bm", "G", "D"], start: 7,
    lines: [
      "@7 *2:.5 0:.5 *4:.5 2:.5 *7~:1.5 4:.5 | *1:.5 -1:.5 *4:.5 1:.5 *6~:1.5 4:.5",
      "@12 *5:.5 3:.5 *7:.5 5:.5 *10~:1.5 7:.5 | *3:.5 2:.5 *5:.5 3:.5 *7~:1.5 5:.5",
      "@10 *4:1/4 5 7 5 *5:1/4 6s2 8 6s2 @12 *6:1/4 7 9 7 *7:1/4 8 10 8 | @13 *8:1/4 9 11 9 @15 *9:1/4 10 12 10 *11~:1 9:.5 8:.5 | *11b:1.5 9:.5 *10:.5 9:.5 *7:1",
      "@0 *-2:.5 -4:.5 *0:.5 -2:.5 *-4~:1.5 -5:.5 | *-7:.5 -5:.5 *-3:.5 -5:.5 *-7~:2",
    ],
    phrases: [
      { label: "Hook", bars: 2, text: "F#, D, A, F#, a long D at fret 10: a chiming arpeggio. Over A: E, C#, A, E, a long C#." },
      { label: "Hook, a position up", bars: 2, text: "B, G, D, B, G over Bm at frets 12–15, then G, F#, B, G, D over G." },
      { label: "Ripples", bars: 3, text: "Four-note cells (A-B-D-B, B-C#-E-C#…) that each start one note higher, up to B at fret 19; then bend A up to B over Bm." },
      { label: "Hook in open position", bars: 2, text: "B, G, D on open strings over G, then D, F#, A and the open D string to finish." },
    ],
  }),
];

export const DIAGONAL_LICKS: DiagonalLick[] = [...SET_1, ...SET_2, ...SET_3];

export const DIAGONAL_BY_ID: Record<string, DiagonalLick> = Object.fromEntries(DIAGONAL_LICKS.map((d) => [d.lick.id, d]));

/* --------------------------------------------------------------- helpers */

export const BEATS_PER_BAR = 4;

/** One chord per bar. */
export function barChords(dl: DiagonalLick): string[] {
  return dl.lick.backing.map(([c]) => c);
}
export function lickBeats(dl: DiagonalLick): number {
  return dl.lick.backing.reduce((a, [, b]) => a + b, 0);
}
export function lickSeconds(dl: DiagonalLick, pct = 100): number {
  return (lickBeats(dl) * 60) / tempoAt(dl, pct);
}
/** BPM at a percentage of the lick's tempo (whole numbers). */
export function tempoAt(dl: DiagonalLick, pct: number): number {
  return Math.max(30, Math.round((dl.lick.bpm * pct) / 100));
}
/** Beat range of a phrase (or the whole lick). */
export function partRange(dl: DiagonalLick, part: number | null): { from: number; to: number } {
  if (part == null) return { from: 0, to: lickBeats(dl) };
  const [start, count] = dl.phrases[part]!.bars;
  return { from: start * BEATS_PER_BAR, to: (start + count) * BEATS_PER_BAR };
}
/** Indices of the notes that start inside a phrase. */
export function phraseNotes(dl: DiagonalLick, part: number | null): number[] {
  const { from, to } = partRange(dl, part);
  return dl.lick.notes.flatMap((n, i) => (n.start_beat >= from - 1e-9 && n.start_beat < to - 1e-9 ? [i] : []));
}
/** Lowest and highest fret of a set of notes (open strings count as 0). */
export function fretSpan(notes: PlayableNote[]): { lo: number; hi: number } {
  const fs = notes.map((n) => n.fret);
  return { lo: Math.min(...fs), hi: Math.max(...fs) };
}
/** Fastest notes in the lick, per second, at a tempo percentage. */
export function notesPerSecond(dl: DiagonalLick, pct = 100): number {
  const shortest = Math.min(...dl.lick.notes.map((n) => n.duration_beats));
  return Math.round(((tempoAt(dl, pct) / 60) / shortest) * 10) / 10;
}

/**
 * The melody on its own: theme notes held until the next theme note (at most a bar), with
 * bends and vibrato kept and legato marks removed. `index` is the note's index in the lick.
 */
export function melodyLine(dl: DiagonalLick): { note: PlayableNote; index: number }[] {
  const ns = dl.lick.notes;
  const end = lickBeats(dl);
  return dl.melody.map((idx, k) => {
    const n = ns[idx]!;
    const nextStart = k + 1 < dl.melody.length ? ns[dl.melody[k + 1]!]!.start_beat : end;
    const keepBend = n.technique === "bend" || n.technique === "bend_release";
    const dur = Math.min(nextStart - n.start_beat, BEATS_PER_BAR);
    return {
      index: idx,
      note: {
        ...n,
        id: `${n.id}-m`,
        duration_beats: Math.max(n.duration_beats, dur),
        technique: keepBend ? n.technique : null,
        bend_semitones: keepBend ? n.bend_semitones : null,
        slide_from_fret: null,
      },
    };
  });
}

/** Pitch a note reaches (a bend-and-release peaks above its fretted pitch). */
export function peakMidi(n: PlayableNote): number {
  return n.technique === "bend_release" ? n.midi + (n.bend_semitones ?? 2) : n.midi;
}

/** Does every bar start on (or bend into) a note of its chord? Returns the bars that don't. */
export function barsMissingChordTone(dl: DiagonalLick): number[] {
  const bad: number[] = [];
  barChords(dl).forEach((chord, b) => {
    const tones = chordTonesOf(chord) ?? [];
    const at = dl.lick.notes.filter((n) => Math.abs(n.start_beat - b * BEATS_PER_BAR) < 1e-6);
    if (!at.some((n) => tones.includes(peakMidi(n) % 12))) bad.push(b);
  });
  return bad;
}

/**
 * Longest stretch of back-to-back notes that each move one scale step in the same direction:
 * the "up and down the scale" sound these licks avoid. Rests and repeated or out-of-scale
 * notes break a stretch.
 */
export function longestScaleRun(dl: DiagonalLick): number {
  const steps = scaleKindById(dl.lick.mode).steps;
  const tonic = rootPc(dl.lick.root);
  const idx = (midi: number): number | null => {
    const rel = (((midi - tonic) % 12) + 12) % 12;
    const k = (steps as readonly number[]).indexOf(rel);
    return k < 0 ? null : Math.floor((midi - tonic) / 12) * steps.length + k;
  };
  const ns = dl.lick.notes;
  let best = 1;
  let run = 1;
  let dir = 0;
  for (let i = 1; i < ns.length; i++) {
    const a = ns[i - 1]!;
    const b = ns[i]!;
    const touching = Math.abs(a.start_beat + a.duration_beats - b.start_beat) < 1e-6;
    const ia = idx(peakMidi(a));
    const ib = idx(peakMidi(b));
    const d = ia != null && ib != null ? ib - ia : 0;
    if (touching && Math.abs(d) === 1 && (run === 1 || d === dir)) {
      run += 1;
      dir = d;
    } else if (touching && Math.abs(d) === 1) {
      run = 2;
      dir = d;
    } else {
      run = 1;
      dir = 0;
    }
    best = Math.max(best, run);
  }
  return best;
}

/* ------------------------------------------------------------ practice */

export const TEMPO_MIN = 50;
export const TEMPO_MAX = 120;
export const TEMPO_PRESETS = [60, 70, 80, 90, 100, 110];
export const RAMP_STEP = 5;
export const RAMP_MAX = 110;

/** Tempo for the next loop when "speed up each loop" is on. */
export function nextRampPct(pct: number): number {
  if (pct >= RAMP_MAX) return pct;
  return Math.min(RAMP_MAX, Math.round((pct + RAMP_STEP) / RAMP_STEP) * RAMP_STEP);
}

export interface PracticeOptions {
  /** Phrase index, or null for the whole lick. */
  part?: number | null;
  melodyOnly?: boolean;
  /** Percentage of the lick's tempo. */
  pct?: number;
  /** One bar of clicks first. */
  countIn?: boolean;
}

/**
 * One pass of a lick (or one phrase) for the Theory player: drums, bass and chords, the lead line
 * (beats relative to the pass), and silent highlights. Highlight ids match the lick: `n<i>` = note i,
 * `b_<bar>` = bar, `count_<k>` = count-in click.
 */
export function practiceExample(dl: DiagonalLick, opts: PracticeOptions = {}): LeadSound {
  const { from, to } = partRange(dl, opts.part ?? null);
  const off = opts.countIn ? BEATS_PER_BAR : 0;
  const events: TheoryEvent[] = [];
  for (let k = 0; k < off; k++) {
    events.push({ kind: "click", beat: k, beats: 0.2, velocity: k === 0 ? 1 : 0.6 });
    events.push({ kind: "highlight", beat: k, beats: 0.8, velocity: 0, highlight: `count_${k}` });
  }
  barChords(dl).forEach((chord, b) => {
    const at = b * BEATS_PER_BAR;
    if (at < from - 1e-9 || at >= to - 1e-9) return;
    const t = off + at - from;
    events.push(...backingBar(chord, dl.lick.style, t, BEATS_PER_BAR, 0.8));
    events.push({ kind: "highlight", beat: t, beats: BEATS_PER_BAR, velocity: 0, highlight: `b_${b}` });
  });
  const source = opts.melodyOnly
    ? melodyLine(dl)
    : dl.lick.notes.map((note, index) => ({ note, index }));
  const lead: PlayableNote[] = [];
  for (const { note, index } of source) {
    if (note.start_beat < from - 1e-9 || note.start_beat >= to - 1e-9) continue;
    const start = off + note.start_beat - from;
    const dur = Math.min(note.duration_beats, to - note.start_beat);
    lead.push({ ...note, start_beat: start, duration_beats: dur });
    events.push({ kind: "highlight", beat: start, beats: dur, velocity: 0, highlight: `n${index}` });
  }
  return { bpm: tempoAt(dl, opts.pct ?? 100), lengthBeats: off + to - from, events, lead };
}

/* -------------------------------------------------------------- guidance */

export const DIAGONAL_IDEAS: { title: string; text: string }[] = [
  {
    title: "Move the hand, not just the fingers",
    text: "A box keeps you in four frets. A diagonal lick shifts position as it crosses strings, usually with a slide, so one phrase can cover two octaves and the whole neck becomes one map.",
  },
  {
    title: "Write the tune first",
    text: "Every lick here starts from a few melody notes you could sing. The fast notes decorate the tune; turn on Melody only to hear the skeleton the lick is built on.",
  },
  {
    title: "Repeat a shape, a step higher",
    text: "Sequences (the same rhythm or cell, started one or two notes higher) are what make speed sound musical. Your ear follows the pattern instead of hearing a scale exercise.",
  },
  {
    title: "Land on the chord",
    text: "Each bar starts on a note of its chord, often with a bend into it. Fast or slow, that's what makes the lick sound like it belongs to the song.",
  },
];

export const PRACTICE_STEPS: string[] = [
  "Play Melody only and hum along until you could sing the theme.",
  "Pick one phrase, set 60% and loop it. Watch where the hand shifts.",
  "Turn on Speed up each loop: 5% faster every pass, up to 110%.",
  "Clean at 100%? Move to the next phrase, then play the whole lick.",
  "Make it yours: keep the melody notes, change the fast notes around them.",
];
