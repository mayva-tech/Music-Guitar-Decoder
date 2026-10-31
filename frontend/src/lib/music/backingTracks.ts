/**
 * Backing tracks: drum + bass loops in ten genres, twenty per genre, each at its own tempo.
 *
 * Everything here is data plus pure helpers. A track is a chord progression (one entry per bar; two chords
 * in one bar are written "Dm7 G7"), a drum pattern and a bass pattern. `barSound()` turns one bar into
 * Theory-player events, so the page can loop bar by bar (tempo and mute changes apply from the next bar).
 *
 * Grids: straight patterns use 16 sixteenth steps per 4/4 bar (12 per 3/4 bar); shuffle, swing and 12/8
 * patterns use 12 triplet steps per 4/4 bar (9 per 3/4 bar). Drum rows are strings, one char per step:
 * "X" accent, "x" normal, "o" ghost, "." rest. Bass notes are "<degree>@<step>:<length>" with an optional
 * "!" (accent) or "?" (ghost); degrees are relative to the chord sounding at that step (see `Degree`).
 *
 * Highlight ids (silent `highlight` events): `b_<i>` progression bar i, `beat_<n>` beat n of the bar,
 * `st_<k>` drum-grid column k.
 */
import type { TheoryEvent } from "@/lib/theory/content";
import type { Sound } from "@/lib/theory/ear";
import { parseChord, type ParsedChord } from "./chordSymbol";
import { SCALE_KINDS, type ScaleMode, type ScaleRoot } from "./scaleFretmap";

/* ------------------------------------------------------------------ types */

export type DrumVoice = "kick" | "snare" | "rim" | "hat" | "ohat" | "ride" | "crash";
export const DRUM_VOICES: DrumVoice[] = ["crash", "ride", "ohat", "hat", "rim", "snare", "kick"];
export const DRUM_LABEL: Record<DrumVoice, string> = {
  kick: "Kick", snare: "Snare", rim: "Rim", hat: "Hi-hat", ohat: "Open hat", ride: "Ride", crash: "Crash",
};

export type Feel = "straight" | "sixteenths" | "half-time" | "shuffle" | "swing" | "twelve-eight";
export const FEEL_LABEL: Record<Feel, string> = {
  straight: "Straight 8ths",
  sixteenths: "16th groove",
  "half-time": "Half-time",
  shuffle: "Shuffle",
  swing: "Swing",
  "twelve-eight": "12/8",
};

export interface DrumPattern {
  id: string;
  name: string;
  /** Beats per bar (4 = 4/4, 3 = 3/4). */
  beats: 3 | 4;
  /** Steps per bar: 16 or 12 (straight 4/4, 3/4) / 12 or 9 (triplet 4/4, 3/4). */
  steps: number;
  triplet: boolean;
  feel: Feel;
  /** Straight grids only: delay of every odd 16th, as a fraction of a step (0 = straight, 0.33 ≈ triplet swing). */
  swing: number;
  rows: Partial<Record<DrumVoice, string>>;
}

/**
 * Bass degrees, relative to the chord at that step:
 * R root · 8 octave · 3 chord third (major third on power chords) · b3 minor third · 5 chord fifth · -5 fifth below ·
 * 6 major sixth · b7 minor seventh · 7 chord seventh (♭7 if the chord has none) · 2 ninth · 4 fourth ·
 * A half step below the next chord's root · Ab half step above it.
 */
export type Degree = "R" | "8" | "3" | "b3" | "5" | "-5" | "6" | "b7" | "7" | "2" | "4" | "A" | "Ab";
const DEGREES: Degree[] = ["R", "8", "3", "b3", "5", "-5", "6", "b7", "7", "2", "4", "A", "Ab"];

export interface BassNote { degree: Degree; step: number; len: number; vel: number }
export interface BassPattern {
  id: string;
  name: string;
  steps: number;
  /** One or more bars; bar k is used on the k-th bar the same chord has lasted (so walks restart on a chord change). */
  bars: BassNote[][];
}

export type GenreId = "rock" | "pop" | "blues" | "funk" | "metal" | "punk" | "country" | "reggae" | "jazz" | "soul";
export type FillStyle = "rock" | "pickup" | "triplet" | "none";

export interface Genre {
  id: GenreId;
  name: string;
  colour: string;
  blurb: string;
  /** What to try on guitar over this genre's loops. */
  play: string[];
  fill: FillStyle;
  /** Crash on the first bar of every repeat. */
  crash: boolean;
  lessons: LessonId[];
}

export interface BackingTrack {
  id: string;
  genre: GenreId;
  /** 1–20 inside its genre. */
  n: number;
  name: string;
  bpm: number;
  root: ScaleRoot;
  mode: ScaleMode;
  /** One entry per bar; two chords in a bar are separated by a space. */
  bars: string[];
  drums: DrumPattern;
  bass: BassPattern;
}

/* ---------------------------------------------------------- lesson links */

export interface LessonLink { label: string; href: string; kind: "Guide" | "Lesson" | "Theory" | "Riffs" | "Ear" | "Greats" }

export const LESSON_LINKS = {
  "solo-jam": { label: "Jam with a loop", href: "/learn/solo#jam", kind: "Guide" },
  "solo-techniques": { label: "Eight lead techniques", href: "/learn/solo#techniques", kind: "Guide" },
  "solo-licks": { label: "Lick library", href: "/learn/solo#licks", kind: "Guide" },
  "solo-target": { label: "Land on chord tones", href: "/learn/solo#target", kind: "Guide" },
  "solo-scale": { label: "Choose the scale", href: "/learn/solo#scale", kind: "Guide" },
  "pentatonic-box": { label: "The pentatonic box", href: "/progress/pentatonic-box", kind: "Guide" },
  caged: { label: "CAGED & pentatonic map", href: "/learn/caged", kind: "Guide" },
  "building-chords": { label: "From tune to chords", href: "/progress/building-chords", kind: "Guide" },
  "lesson-twelve-bar": { label: "The 12-bar blues", href: "/progress?lesson=twelve-bar", kind: "Lesson" },
  "lesson-blues-scale": { label: "The blues scale", href: "/progress?lesson=blues-scale", kind: "Lesson" },
  "lesson-swing": { label: "Straight eighths and shuffle", href: "/progress?lesson=swing", kind: "Lesson" },
  "lesson-four-chords": { label: "The four-chord pop song", href: "/progress?lesson=four-chords", kind: "Lesson" },
  "lesson-power-chords": { label: "Power chords", href: "/progress?lesson=power-chords", kind: "Lesson" },
  "lesson-bends": { label: "Bends and vibrato", href: "/progress?lesson=bends", kind: "Lesson" },
  "lesson-legato": { label: "Slides, hammer-ons, pull-offs", href: "/progress?lesson=legato", kind: "Lesson" },
  "lesson-progression": { label: "What is a chord progression?", href: "/progress?lesson=chord-progression", kind: "Lesson" },
  "lesson-improvisation": { label: "What is improvisation?", href: "/progress?lesson=improvisation", kind: "Lesson" },
  "theory-groove": { label: "Groove", href: "/learn/theory?term=groove", kind: "Theory" },
  "theory-tempo": { label: "Tempo", href: "/learn/theory?term=tempo", kind: "Theory" },
  "theory-rhythm": { label: "Rhythm", href: "/learn/theory?term=rhythm", kind: "Theory" },
  "theory-meter": { label: "Meter (3/4 vs 4/4)", href: "/learn/theory?term=meter", kind: "Theory" },
  "theory-harmony": { label: "Harmony", href: "/learn/theory?term=harmony", kind: "Theory" },
  "theory-cadence": { label: "Cadence", href: "/learn/theory?term=cadence", kind: "Theory" },
  "theory-space": { label: "Space and timing", href: "/learn/theory?term=space", kind: "Theory" },
  "theory-dynamics": { label: "Dynamics", href: "/learn/theory?term=dynamics", kind: "Theory" },
  "ear-bass": { label: "Follow the bass to the chords", href: "/learn/by-ear#step-bass", kind: "Ear" },
  "ear-rhythm": { label: "Lock the rhythm", href: "/learn/by-ear#step-rhythm", kind: "Ear" },
  "riffs-rock": { label: "Rock riffs", href: "/riffs?genre=rock", kind: "Riffs" },
  "riffs-pop": { label: "Pop riffs", href: "/riffs?genre=pop", kind: "Riffs" },
  "riffs-blues": { label: "Blues riffs", href: "/riffs?genre=blues", kind: "Riffs" },
  "riffs-modern": { label: "Modern-style riffs", href: "/riffs?source=modern", kind: "Riffs" },
  "greats-bb-king": { label: "B.B. King", href: "/learn/greats#bb-king", kind: "Greats" },
  "greats-srv": { label: "Stevie Ray Vaughan", href: "/learn/greats#srv", kind: "Greats" },
  "greats-hendrix": { label: "Jimi Hendrix", href: "/learn/greats#hendrix", kind: "Greats" },
  "greats-page": { label: "Jimmy Page", href: "/learn/greats#page", kind: "Greats" },
  "greats-gilmour": { label: "David Gilmour", href: "/learn/greats#gilmour", kind: "Greats" },
  "greats-knopfler": { label: "Mark Knopfler", href: "/learn/greats#knopfler", kind: "Greats" },
  "greats-evh": { label: "Eddie Van Halen", href: "/learn/greats#evh", kind: "Greats" },
  "greats-wes": { label: "Wes Montgomery", href: "/learn/greats#wes", kind: "Greats" },
} satisfies Record<string, LessonLink>;
export type LessonId = keyof typeof LESSON_LINKS;

/* ----------------------------------------------------------- pattern parsing */

const DRUM_VEL: Record<string, number> = { X: 1, x: 0.75, o: 0.4 };
const BASS_VEL = { "!": 0.95, "": 0.8, "?": 0.45 } as const;

function drum(
  id: string, name: string, feel: Feel, rows: Partial<Record<DrumVoice, string>>,
  opts: { beats?: 3 | 4; triplet?: boolean; swing?: number } = {},
): DrumPattern {
  const triplet = opts.triplet ?? (feel === "shuffle" || feel === "swing" || feel === "twelve-eight");
  const beats = opts.beats ?? 4;
  const steps = beats * (triplet ? 3 : 4);
  return { id, name, beats, steps, triplet, feel, swing: opts.swing ?? 0, rows };
}

function bass(id: string, name: string, steps: number, ...bars: string[]): BassPattern {
  return {
    id, name, steps,
    bars: bars.map((bar) => bar.trim().split(/\s+/).map((tok) => {
      const m = /^([^@]+)@(\d+):(\d+)([!?]?)$/.exec(tok);
      if (!m || !DEGREES.includes(m[1] as Degree)) throw new Error(`bad bass token "${tok}" in ${id}`);
      return { degree: m[1] as Degree, step: Number(m[2]), len: Number(m[3]), vel: BASS_VEL[m[4] as keyof typeof BASS_VEL] };
    })),
  };
}

/** Steps of a hit row, with velocity. */
export function rowHits(row: string | undefined): { step: number; vel: number }[] {
  if (!row) return [];
  const out: { step: number; vel: number }[] = [];
  [...row].forEach((c, step) => { if (DRUM_VEL[c] != null) out.push({ step, vel: DRUM_VEL[c]! }); });
  return out;
}

/* ------------------------------------------------------------- drum patterns */

const H8 = "x.x.x.x.x.x.x.x.";
const H8A = "X.x.X.x.X.x.X.x.";
const H16 = "xoxoxoxoxoxoxoxo";
const SHUF = "X.xX.xX.xX.x";
const RIDE_SWING = "X..X.xX..X.x";
const T68 = "xooxooxooxoo";

export const DRUMS = {
  // rock
  rock8: drum("rock8", "Straight eight", "straight", { kick: "X.......X.......", snare: "....X.......X...", hat: H8A }),
  rockDrive: drum("rockDrive", "Driving eight", "straight", { kick: "X.....X.X.....x.", snare: "....X.......X...", hat: H8A }),
  rockHalf: drum("rockHalf", "Half-time", "half-time", { kick: "X.....x...X.....", snare: "........X.......", hat: H8A }),
  rockFloor: drum("rockFloor", "Four on the floor", "straight", { kick: "X...X...X...X...", snare: "....X.......X...", hat: "x...x...x...x...", ohat: "..x...x...x...x." }),
  rock16: drum("rock16", "Sixteenth hats", "sixteenths", { kick: "X.......X.x.....", snare: "....X.......X...", hat: H16 }),
  rockRide: drum("rockRide", "Ride groove", "straight", { kick: "X.....X...X.....", snare: "....X.......X...", ride: H8A }),
  rockShuffle: drum("rockShuffle", "Rock shuffle", "shuffle", { kick: "X.....X.....", snare: "...X.....X..", hat: SHUF }),
  rock68: drum("rock68", "Six-eight", "twelve-eight", { kick: "X.....X.....", snare: "...X.....X..", hat: T68 }),
  // pop
  popBasic: drum("popBasic", "Pop backbeat", "straight", { kick: "X......xX.......", snare: "....X.......X...", hat: H8 }),
  popFloor: drum("popFloor", "Dance floor", "straight", { kick: "X...X...X...X...", snare: "....X.......X...", hat: "x...x...x...x...", ohat: "..x...x...x...x." }),
  popBallad: drum("popBallad", "Rim-click ballad", "straight", { kick: "X.......x.x.....", rim: "....X.......X...", hat: "x.o.x.o.x.o.x.o." }),
  popSync: drum("popSync", "Syncopated pop", "sixteenths", { kick: "X..X..X...X.....", snare: "....X.......X...", hat: H16 }),
  popHalf: drum("popHalf", "Half-time pop", "half-time", { kick: "X.....X...X.....", snare: "........X.......", hat: H8, ohat: "..............x." }),
  popTresillo: drum("popTresillo", "Tresillo", "straight", { kick: "X...X...X...X...", snare: "...X..X....X..X.", hat: H8 }),
  pop68: drum("pop68", "Six-eight ballad", "twelve-eight", { kick: "X.....X.....", rim: "...X.....X..", hat: T68 }),
  popWaltz: drum("popWaltz", "Waltz", "straight", { kick: "X...........", rim: "....x...x...", hat: "x.x.x.x.x.x." }, { beats: 3 }),
  // blues
  bluesShuffle: drum("bluesShuffle", "Shuffle", "shuffle", { kick: "X.....X.....", snare: "...X.....X..", hat: SHUF }),
  texasShuffle: drum("texasShuffle", "Texas shuffle", "shuffle", { kick: "X..x..X..x..", snare: "...X.....X..", ride: SHUF }),
  slow128: drum("slow128", "Slow 12/8", "twelve-eight", { kick: "X.....x..x..", snare: "...X.....X..", hat: T68 }),
  trainBlues: drum("trainBlues", "Train beat", "shuffle", { kick: "X.....X.....", snare: "o.oX.oo.oX.o", hat: "...x.....x.." }),
  jumpBlues: drum("jumpBlues", "Jump swing", "swing", { kick: "o..o..o..o..", snare: "...x.....x..", ride: RIDE_SWING, hat: "...x.....x.." }),
  bluesStraight: drum("bluesStraight", "Straight-eight blues", "straight", { kick: "X.....X.X.......", snare: "....X.......X...", hat: H8A }),
  // funk
  funkOne: drum("funkOne", "On the one", "sixteenths", { kick: "X.....x...X..x..", snare: "....X..o.o..X..o", hat: H16 }),
  funkTight: drum("funkTight", "Tight sixteenths", "sixteenths", { kick: "X..x....x.x.....", snare: "....X.o.o..oX...", hat: H16 }),
  funkDisco: drum("funkDisco", "Disco", "straight", { kick: "X...X...X...X...", snare: "....X.......X...", hat: "xo..xo..xo..xo..", ohat: "..x...x...x...x." }),
  funkBreak: drum("funkBreak", "Breakbeat", "sixteenths", { kick: "X.X.......X.....", snare: "....X..o.o.oX..o", hat: H8 }, { swing: 0.15 }),
  funkSwing: drum("funkSwing", "Swung pocket", "sixteenths", { kick: "X......x..X.....", snare: "....X..o....X...", hat: H16 }, { swing: 0.3 }),
  funkSlow: drum("funkSlow", "Half-time funk", "half-time", { kick: "X..x......X..x..", snare: "........X......o", hat: H16 }, { swing: 0.1 }),
  // metal
  gallop: drum("gallop", "Gallop", "sixteenths", { kick: "X.XXX.XXX.XXX.XX", snare: "....X.......X...", ride: "X...X...X...X..." }),
  doubleKick: drum("doubleKick", "Double kick", "sixteenths", { kick: "xxxxxxxxxxxxxxxx", snare: "....X.......X...", ride: H8A }),
  metalHalf: drum("metalHalf", "Half-time heavy", "half-time", { kick: "X..X......X..X..", snare: "........X.......", ride: H8A }),
  thrash: drum("thrash", "Thrash skank", "straight", { kick: "X...X...X...X...", snare: "..X...X...X...X.", hat: "X.X.X.X.X.X.X.X." }),
  doom: drum("doom", "Doom crawl", "half-time", { kick: "X.........X.....", snare: "........X.......", ride: "X...X...X...X..." }),
  chug: drum("chug", "Chug", "sixteenths", { kick: "X.X.X..XX.X.X..X", snare: "....X.......X...", hat: H8A }),
  metal8: drum("metal8", "Heavy eight", "straight", { kick: "X.X...X.X.X...X.", snare: "....X.......X...", ride: H8A }),
  // punk
  punk8: drum("punk8", "Punk eight", "straight", { kick: "X.....X.X.......", snare: "....X.......X...", hat: "X.X.X.X.X.X.X.X." }),
  skate: drum("skate", "Skate beat", "straight", { kick: "X...X...X...X...", snare: "..X...X...X...X.", hat: "X.X.X.X.X.X.X.X." }),
  punkFloor: drum("punkFloor", "Floor stomp", "straight", { kick: "X...X...X...X...", snare: "....X.......X...", ride: "X.X.X.X.X.X.X.X." }),
  punkHalf: drum("punkHalf", "Breakdown", "half-time", { kick: "X.....X.X.......", snare: "........X.......", hat: H8A }),
  dancePunk: drum("dancePunk", "Dance-punk", "sixteenths", { kick: "X...X...X...X...", snare: "....X.......X...", hat: H16, ohat: "..............x." }),
  // country
  twoStep: drum("twoStep", "Two-step", "straight", { kick: "X.......X.......", snare: "....X.......X...", hat: H8 }),
  trainCountry: drum("trainCountry", "Train beat", "sixteenths", { kick: "X.......X.......", snare: "ooxoXoxoooxoXoxo" }),
  countryShuffle: drum("countryShuffle", "Country shuffle", "shuffle", { kick: "X.....X.....", rim: "...X.....X..", hat: SHUF }),
  countryWaltz: drum("countryWaltz", "Country waltz", "straight", { kick: "X...........", rim: "....X...X...", hat: "x.x.x.x.x.x." }, { beats: 3 }),
  countryRock: drum("countryRock", "Country rock", "straight", { kick: "X.....X.X.......", snare: "....X.......X...", hat: H8A }),
  countryBallad: drum("countryBallad", "Country ballad", "straight", { kick: "X.......X.x.....", rim: "....X.......X...", hat: H8 }),
  // reggae
  oneDrop: drum("oneDrop", "One drop", "straight", { kick: "........X.......", rim: "........X.......", hat: H8 }, { swing: 0.12 }),
  rockers: drum("rockers", "Rockers", "straight", { kick: "X...X...X...X...", rim: "....X.......X...", hat: H8 }, { swing: 0.12 }),
  steppers: drum("steppers", "Steppers", "straight", { kick: "X...X...X...X...", rim: "........X.......", ohat: "..x...x...x...x." }),
  ska: drum("ska", "Ska", "straight", { kick: "X.......X.......", snare: "....X.......X...", hat: "..x...x...x...x." }),
  dub: drum("dub", "Dub", "half-time", { kick: "........X.......", rim: "....x...X.......", hat: "x...x...x...x...", ohat: "......x.......x." }),
  lovers: drum("lovers", "Lovers rock", "sixteenths", { kick: "........X.......", rim: "........X.......", hat: H16 }, { swing: 0.25 }),
  // jazz
  swingRide: drum("swingRide", "Swing ride", "swing", { ride: RIDE_SWING, hat: "...X.....X..", kick: "o..o..o..o..", snare: "........o..." }),
  fastSwing: drum("fastSwing", "Fast swing", "swing", { ride: RIDE_SWING, hat: "...X.....X..", snare: "..o.....o..." }),
  brushBallad: drum("brushBallad", "Ballad", "swing", { ride: "x..x.ox..x.o", hat: "...x.....x..", kick: "o.....o....." }),
  twoFeel: drum("twoFeel", "Two-feel", "swing", { ride: RIDE_SWING, hat: "...X.....X..", kick: "o.....o....." }),
  jazzWaltz: drum("jazzWaltz", "Jazz waltz", "swing", { ride: "X..X.xX..", hat: "...x..x..", kick: "o........" }, { beats: 3 }),
  bossa: drum("bossa", "Bossa nova", "straight", { rim: "X..X..X...X..X..", kick: "X..xX..xX..xX..x", hat: H8 }),
  // soul / R&B
  motown: drum("motown", "Motown", "straight", { kick: "X.....X.X.....x.", snare: "x...X...x...X...", hat: H8 }),
  soul68: drum("soul68", "Soul 12/8", "twelve-eight", { kick: "X.....X..x..", snare: "...X.....X..", hat: T68 }),
  rnbHalf: drum("rnbHalf", "R&B half-time", "half-time", { kick: "X......x..X.....", snare: "........X.......", hat: H16 }, { swing: 0.25 }),
  neoSoul: drum("neoSoul", "Neo-soul", "sixteenths", { kick: "X.....x...X..x..", snare: "....X.......X..o", hat: H16 }, { swing: 0.33 }),
  gospel: drum("gospel", "Gospel shuffle", "shuffle", { kick: "X..x..X..x..", snare: "...X.....X..", hat: SHUF }),
  discoSoul: drum("discoSoul", "Disco soul", "straight", { kick: "X...X...X...X...", snare: "....X.......X...", hat: "xo..xo..xo..xo..", ohat: "..x...x...x...x." }),
} satisfies Record<string, DrumPattern>;

/* ------------------------------------------------------------- bass patterns */

const allSixteenths = Array.from({ length: 16 }, (_, k) => `R@${k}:1${k % 4 ? "?" : ""}`).join(" ");

export const BASS = {
  // straight 16-step
  root8: bass("root8", "Root eighths", 16, "R@0:2! R@2:2 R@4:2 R@6:2 R@8:2! R@10:2 R@12:2 R@14:2"),
  drive8: bass("drive8", "Eighths with a lead-in", 16, "R@0:2! R@2:2 R@4:2 R@6:2 R@8:2! R@10:2 R@12:2 A@14:2"),
  octave8: bass("octave8", "Octave eighths", 16, "R@0:2! 8@2:2 R@4:2 8@6:2 R@8:2! 8@10:2 R@12:2 8@14:2"),
  halfRoot: bass("halfRoot", "Long roots", 16, "R@0:6! R@6:2 5@8:6 A@14:2"),
  rootFive: bass("rootFive", "Root and fifth", 16, "R@0:4! R@4:2 5@6:2 R@8:4 5@12:2 8@14:2"),
  popSync: bass("popSync", "Pop syncopation", 16, "R@0:3! R@3:3 R@6:2 R@8:3 5@11:3 8@14:2"),
  tresillo: bass("tresillo", "Tresillo", 16, "R@0:3! R@3:3 5@6:2 R@8:3 R@11:3 5@14:2"),
  ballad: bass("ballad", "Ballad", 16, "R@0:8! 5@8:4 3@12:4"),
  balladWalk: bass("balladWalk", "Ballad walk", 16, "R@0:6! R@6:2 5@8:4 A@12:4"),
  bluesStraight8: bass("bluesStraight8", "Straight boogie", 16,
    "R@0:2! R@2:2 3@4:2 3@6:2 5@8:2 5@10:2 6@12:2 6@14:2",
    "b7@0:2! b7@2:2 6@4:2 6@6:2 5@8:2 5@10:2 3@12:2 3@14:2"),
  funkRoot: bass("funkRoot", "Funk root", 16, "R@0:2! 8@3:1 R@4:1? R@6:1 b7@7:1 8@8:2 R@10:1? R@11:1 5@12:1 b7@14:1 8@15:1"),
  funkOct: bass("funkOct", "Octave pops", 16, "R@0:1! 8@2:1 R@3:1? R@6:1 8@7:1 R@8:2 8@10:1 R@12:1 5@13:1 b7@14:1 8@15:1"),
  funkSparse: bass("funkSparse", "Sparse funk", 16, "R@0:3! R@6:1? R@7:1 b7@10:2 8@12:1 5@14:2"),
  funkSyncop: bass("funkSyncop", "Syncopated funk", 16, "R@0:2! R@3:1 R@5:1? 5@6:2 R@8:1 R@10:2 b7@12:1 8@13:1 5@14:2"),
  gallopBass: bass("gallopBass", "Gallop", 16, "R@0:2! R@2:1 R@3:1 R@4:2 R@6:1 R@7:1 R@8:2! R@10:1 R@11:1 R@12:2 R@14:1 R@15:1"),
  sixteenR: bass("sixteenR", "Sixteenth roots", 16, allSixteenths),
  halfMetal: bass("halfMetal", "Heavy half-time", 16, "R@0:3! R@3:3 R@6:4 R@10:3 R@13:3"),
  doomBass: bass("doomBass", "Doom", 16, "R@0:8! R@8:6 A@14:2"),
  chugBass: bass("chugBass", "Chug", 16, "R@0:2! R@2:2 R@4:2 R@7:1 R@8:2! R@10:2 R@12:2 R@15:1"),
  punkWalk: bass("punkWalk", "Punk walk", 16, "R@0:2! R@2:2 R@4:2 R@6:2 R@8:2 R@10:2 5@12:2 A@14:2"),
  altRoot5: bass("altRoot5", "Root–fifth (two-step)", 16, "R@0:4! 5@8:4", "R@0:4! -5@8:4"),
  walkUp: bass("walkUp", "Walk-up", 16, "R@0:4! 3@4:4 5@8:4 A@12:4"),
  dropBass: bass("dropBass", "One-drop bass", 16, "R@2:2 R@4:2 5@6:2 8@8:3! 5@12:2 3@14:2"),
  rockersBass: bass("rockersBass", "Rockers bass", 16, "R@0:3! R@3:1? R@4:2 5@6:2 8@8:2 5@10:2 3@12:2 R@14:2"),
  steppersBass: bass("steppersBass", "Steppers bass", 16, "R@0:3! R@4:3 5@8:3 R@12:3"),
  skaWalk: bass("skaWalk", "Ska walk", 16, "R@0:4! 3@4:4 5@8:4 A@12:4"),
  dubBass: bass("dubBass", "Dub", 16, "R@0:6! R@8:2 5@10:2 R@12:4"),
  bossaBass: bass("bossaBass", "Bossa", 16, "R@0:6! 5@6:2 5@8:6 R@14:2"),
  motownBass: bass("motownBass", "Motown", 16, "R@0:3! 5@3:1 8@4:2 5@6:2 R@8:2 3@10:2 5@12:2 A@14:2"),
  rnbBass: bass("rnbBass", "R&B", 16, "R@0:6! R@7:2 5@10:2 8@12:2 5@14:2"),
  neoBass: bass("neoBass", "Neo-soul", 16, "R@0:5! 5@6:2 R@8:4 3@12:2 5@14:2"),
  // 3/4, 12 sixteenth steps
  waltz3: bass("waltz3", "Waltz", 12, "R@0:4!", "-5@0:4!"),
  // triplet 12-step
  shuffleRoot: bass("shuffleRoot", "Shuffle roots", 12, "R@0:2! R@2:1 R@3:2 R@5:1 R@6:2 R@8:1 R@9:2 R@11:1"),
  boogie: bass("boogie", "Boogie", 12,
    "R@0:2! R@2:1 3@3:2 3@5:1 5@6:2 5@8:1 6@9:2 6@11:1",
    "b7@0:2! b7@2:1 6@3:2 6@5:1 5@6:2 5@8:1 3@9:2 3@11:1"),
  walkQuarter: bass("walkQuarter", "Walking boogie", 12, "R@0:3! 3@3:3 5@6:3 6@9:3", "b7@0:3! 6@3:3 5@6:3 3@9:3"),
  slowBass: bass("slowBass", "Slow 12/8", 12, "R@0:3! 3@3:3 5@6:3 6@9:2 5@11:1"),
  sixEight: bass("sixEight", "Six-eight", 12, "R@0:3! R@3:2 5@5:1 8@6:3 5@9:3"),
  countryShuffleBass: bass("countryShuffleBass", "Country shuffle", 12, "R@0:3! 5@6:3", "R@0:3! -5@6:3"),
  walk1: bass("walk1", "Walking", 12, "R@0:3! 3@3:3 5@6:3 A@9:3", "R@0:3! 2@3:3 3@6:3 A@9:3"),
  walkTwo: bass("walkTwo", "Walking (two chords a bar)", 12, "R@0:3! A@3:3 R@6:3 A@9:3"),
  twoFeelBass: bass("twoFeelBass", "Two-feel", 12, "R@0:6! 5@6:6"),
  // 3/4 triplet, 9 steps
  jazzWaltzBass: bass("jazzWaltzBass", "Jazz waltz", 9, "R@0:3! 5@3:3 3@6:3", "R@0:3! 3@3:3 A@6:3"),
} satisfies Record<string, BassPattern>;

/* ------------------------------------------------------------------ genres */

export const GENRES: Genre[] = [
  {
    id: "rock", name: "Rock", colour: "#e07a5f", fill: "rock", crash: true,
    blurb: "Kick on 1 and 3, snare on 2 and 4, eighth notes driving underneath. Power chords and the minor pentatonic live here.",
    play: ["Minor pentatonic over minor and power-chord loops", "Major pentatonic over the bright major ones", "Chug muted eighths with the bass, then break into a lick"],
    lessons: ["lesson-power-chords", "pentatonic-box", "solo-jam", "solo-techniques", "riffs-rock", "greats-page"],
  },
  {
    id: "pop", name: "Pop", colour: "#e48aa8", fill: "pickup", crash: true,
    blurb: "Clean backbeats, dance-floor kicks and ballads. Most loops use the four chords every pop song seems to share.",
    play: ["Major pentatonic, aiming for the chord's root on beat 1", "Strum down on the beat, up on the 'and'", "Short melodic hooks, repeated with a small change"],
    lessons: ["lesson-four-chords", "building-chords", "solo-target", "theory-groove", "riffs-pop", "pentatonic-box"],
  },
  {
    id: "blues", name: "Blues", colour: "#e4a853", fill: "triplet", crash: false,
    blurb: "Shuffles, slow 12/8 grooves and walking boogie bass over the 12-bar form, plus minor blues and eight-bar variations.",
    play: ["Blues scale, with the ♭5 as a passing note", "Bend the ♭3 slightly sharp over the I chord", "Leave space: call for two bars, answer for two"],
    lessons: ["lesson-twelve-bar", "lesson-blues-scale", "lesson-swing", "lesson-bends", "riffs-blues", "greats-bb-king", "greats-srv"],
  },
  {
    id: "funk", name: "Funk", colour: "#81b29a", fill: "pickup", crash: false,
    blurb: "Sixteenth-note hats, ghost notes on the snare and a bass that hits hard on the one. Usually one or two chords for a long time.",
    play: ["Muted sixteenth-note scratching, accenting a few hits", "Dorian over minor 7 vamps, Mixolydian over 9th chords", "Small 9th-chord shapes high on the neck"],
    lessons: ["theory-rhythm", "theory-groove", "ear-rhythm", "solo-scale", "lesson-legato", "riffs-modern", "greats-hendrix"],
  },
  {
    id: "metal", name: "Metal", colour: "#8a8f98", fill: "rock", crash: true,
    blurb: "Gallops, double kick, thrash skank beats and slow doom. The bass locks to the kick drum on the root.",
    play: ["Palm-muted power chords on the low E and A strings", "Natural minor, Phrygian (♭2) and harmonic minor for dark leads", "Alternate picking: down-up on every sixteenth"],
    lessons: ["lesson-power-chords", "solo-techniques", "lesson-legato", "theory-tempo", "riffs-modern", "greats-evh"],
  },
  {
    id: "punk", name: "Punk", colour: "#ef6f6c", fill: "rock", crash: true,
    blurb: "Fast, loud and simple: eighth-note roots, skate beats and big singalong choruses on three or four chords.",
    play: ["Down-strokes only on power chords", "Change chords on time, even if a note buzzes", "One-string melodies along the B or G string"],
    lessons: ["lesson-power-chords", "lesson-progression", "theory-tempo", "theory-dynamics", "riffs-rock", "building-chords"],
  },
  {
    id: "country", name: "Country", colour: "#c9a66b", fill: "pickup", crash: false,
    blurb: "Boom-chick two-steps, train beats, shuffles and waltzes. The bass alternates root and fifth and walks into the next chord.",
    play: ["Major pentatonic with the major 3rd, hammered from the ♭3", "Alternate the bass note and a strum: root, strum, fifth, strum", "Double stops on the G and B strings"],
    lessons: ["lesson-legato", "pentatonic-box", "caged", "theory-meter", "riffs-modern", "greats-knopfler"],
  },
  {
    id: "reggae", name: "Reggae", colour: "#5fae7a", fill: "none", crash: false,
    blurb: "One drop, rockers, steppers, ska and dub. The drums leave beat 1 empty and the bass carries the melody.",
    play: ["Short muted chord stabs on the off-beats (the 'and')", "Low melodic riffs doubling the bass", "Minor pentatonic, with lots of space between phrases"],
    lessons: ["theory-rhythm", "theory-space", "ear-bass", "solo-scale", "riffs-modern", "pentatonic-box"],
  },
  {
    id: "jazz", name: "Jazz", colour: "#a68bd8", fill: "triplet", crash: false,
    blurb: "Swing ride, walking bass, bossa nova and jazz waltz over ii–V–I changes and jazz blues.",
    play: ["Target the 3rd and 7th of each chord on beat 1", "Swing your eighth notes: long-short", "Arpeggiate each 7th chord before you add scale notes"],
    lessons: ["solo-target", "lesson-swing", "theory-harmony", "theory-cadence", "building-chords", "greats-wes"],
  },
  {
    id: "soul", name: "Soul & R&B", colour: "#d98a4f", fill: "pickup", crash: false,
    blurb: "Motown stomps, gospel shuffles, 12/8 soul ballads, laid-back R&B and swung neo-soul.",
    play: ["Small chord shapes with hammer-on embellishments", "Slides into chord tones, vocal-style phrasing", "Play behind the beat on the swung grooves"],
    lessons: ["solo-target", "theory-groove", "theory-dynamics", "lesson-legato", "lesson-bends", "riffs-modern", "greats-hendrix"],
  },
];
export const GENRES_BY_ID = Object.fromEntries(GENRES.map((g) => [g.id, g])) as Record<GenreId, Genre>;

/* ------------------------------------------------------------------ tracks */

type Row = [name: string, bpm: number, root: ScaleRoot, mode: ScaleMode, bars: string, drums: keyof typeof DRUMS, bass: keyof typeof BASS];

const TWELVE = (i: string, iv: string, v: string) => [i, i, i, i, iv, iv, i, i, v, iv, i, v].join(" | ");
const QUICK = (i: string, iv: string, v: string) => [i, iv, i, i, iv, iv, i, i, v, iv, i, v].join(" | ");

const ROWS: Record<GenreId, Row[]> = {
  rock: [
    ["Garage Eighths", 116, "A", "minor-pentatonic", "Am | G | F | G", "rock8", "root8"],
    ["Open Road", 132, "D", "mixolydian", "D | C | G | D", "rockDrive", "drive8"],
    ["Power Chord Stomp", 100, "E", "minor-pentatonic", "E5 | E5 | G5 | A5", "rockFloor", "root8"],
    ["Slow Burn", 66, "E", "minor-pentatonic", "Em | C | D | Em", "rock68", "sixEight"],
    ["Arena Anthem", 126, "G", "major-pentatonic", "G | D | Em | C", "rockDrive", "octave8"],
    ["Half-Time Heavy", 80, "A", "minor-pentatonic", "Am | Am | F | G", "rockHalf", "halfRoot"],
    ["Highway Dust", 96, "E", "minor-pentatonic", "Em | G | A | Em", "rock8", "drive8"],
    ["Shuffle Rocker", 120, "A", "blues", "A5 | A5 | D5 | D5 | A5 | A5 | E5 | D5", "rockShuffle", "boogie"],
    ["Three-Chord Classic", 108, "E", "minor-pentatonic", "E | G | A | A", "rock8", "rootFive"],
    ["Sixteenth Drive", 138, "D", "minor-pentatonic", "Dm | Bb | C | Dm", "rock16", "root8"],
    ["Stadium Stomp", 88, "A", "dorian", "Am | D | Am | D", "rockFloor", "octave8"],
    ["Midnight Ballad", 64, "C", "major-pentatonic", "C | Am | F | G", "rock68", "sixEight"],
    ["Southern Groove", 98, "G", "major-pentatonic", "G | C | G | D", "rockRide", "rootFive"],
    ["Grunge Haze", 90, "E", "minor", "E5 | G5 | C5 | B5", "rockHalf", "halfRoot"],
    ["Fast Lane", 156, "A", "major-pentatonic", "A | D | E | D", "rockDrive", "drive8"],
    ["Riff Machine", 110, "D", "minor-pentatonic", "D5 | F5 | G5 | D5", "rock16", "drive8"],
    ["Ride Out", 124, "B", "minor-pentatonic", "Bm | A | G | A", "rockRide", "octave8"],
    ["Heavy Six-Eight", 76, "A", "harmonic-minor", "Am | Dm | Am | E", "rock68", "sixEight"],
    ["Big Chorus", 118, "C", "major-pentatonic", "C | G | Am | F", "rockFloor", "octave8"],
    ["Last Call", 72, "A", "minor", "Am | F | C | G", "rockHalf", "halfRoot"],
  ],
  pop: [
    ["Four-Chord Sunshine", 112, "C", "major-pentatonic", "C | G | Am | F", "popBasic", "root8"],
    ["Dancefloor Lights", 124, "A", "minor-pentatonic", "Am | F | C | G", "popFloor", "octave8"],
    ["Quiet Hours", 68, "G", "major-pentatonic", "G | D | Em | C", "popBallad", "ballad"],
    ["Offbeat Summer", 104, "D", "major-pentatonic", "D | A | Bm | G", "popSync", "popSync"],
    ["Heartbeat Half-Time", 76, "E", "minor-pentatonic", "Em | C | G | D", "popHalf", "balladWalk"],
    ["Island Pop", 96, "A", "minor-pentatonic", "F | G | Em | Am", "popTresillo", "tresillo"],
    ["Sing-Along Waltz", 132, "D", "major-pentatonic", "D | G | A | D", "popWaltz", "waltz3"],
    ["Slow Dance", 60, "C", "major-pentatonic", "C | Am | F | G", "pop68", "sixEight"],
    ["Bright Morning", 116, "G", "major-pentatonic", "G | C | Em | D", "popBasic", "popSync"],
    ["Night Drive", 100, "D", "minor-pentatonic", "Dm | Bb | F | C", "popFloor", "octave8"],
    ["Radio Chorus", 120, "E", "major-pentatonic", "E | B | C#m | A", "popBasic", "root8"],
    ["Rainy Window", 72, "F", "major-pentatonic", "F | C | Dm | Bb", "popBallad", "balladWalk"],
    ["Roller Skate", 128, "C", "major", "C | Em | F | G", "popFloor", "octave8"],
    ["Feel-Good Pocket", 92, "A", "major-pentatonic", "A | F#m | D | E", "popSync", "popSync"],
    ["Sunset Tresillo", 108, "E", "minor-pentatonic", "Em | D | C | D", "popTresillo", "tresillo"],
    ["Lighthouse", 84, "G", "major-pentatonic", "G | Em | C | D", "popHalf", "ballad"],
    ["Confetti", 140, "F", "major-pentatonic", "F | C | Gm | Bb", "popFloor", "root8"],
    ["First Dance", 70, "D", "major-pentatonic", "D | Bm | G | A", "pop68", "sixEight"],
    ["Easy Sunday", 88, "C", "major-pentatonic", "F | G | C | Am", "popBasic", "rootFive"],
    ["Small Town Waltz", 102, "G", "major-pentatonic", "G | C | D | G", "popWaltz", "waltz3"],
  ],
  blues: [
    ["12-Bar Shuffle in A", 92, "A", "blues", TWELVE("A7", "D7", "E7"), "bluesShuffle", "boogie"],
    ["Slow 12/8 in G", 58, "G", "blues", TWELVE("G7", "C7", "D7"), "slow128", "slowBass"],
    ["Texas Shuffle in E", 120, "E", "blues", TWELVE("E7", "A7", "B7"), "texasShuffle", "shuffleRoot"],
    ["Quick Change in C", 100, "C", "blues", QUICK("C7", "F7", "G7"), "bluesShuffle", "walkQuarter"],
    ["Minor Blues in A", 76, "A", "minor-pentatonic", "Am | Am | Am | Am | Dm | Dm | Am | Am | F7 | E7 | Am | E7", "slow128", "slowBass"],
    ["Chicago Straight Eight", 112, "E", "blues", TWELVE("E7", "A7", "B7"), "bluesStraight", "bluesStraight8"],
    ["Train Beat in D", 132, "D", "blues", TWELVE("D7", "G7", "A7"), "trainBlues", "shuffleRoot"],
    ["Jump Blues in F", 150, "F", "blues", TWELVE("F7", "Bb7", "C7"), "jumpBlues", "walkQuarter"],
    ["Low-Down in E", 64, "E", "minor-pentatonic", TWELVE("E7", "A7", "B7"), "slow128", "slowBass"],
    ["Boogie in G", 128, "G", "blues", TWELVE("G7", "C7", "D7"), "texasShuffle", "boogie"],
    ["Eight-Bar in A", 84, "A", "blues", "A7 | E7 | D7 | D7 | A7 | E7 | A7 | E7", "bluesShuffle", "shuffleRoot"],
    ["Minor Shuffle in D", 96, "D", "minor-pentatonic", "Dm | Dm | Dm | Dm | Gm | Gm | Dm | Dm | Bb7 | A7 | Dm | A7", "bluesShuffle", "shuffleRoot"],
    ["Midnight Slow Blues", 52, "C", "blues", TWELVE("C7", "F7", "G7"), "slow128", "slowBass"],
    ["Two-Chord Stomp", 104, "E", "blues", "E7 | E7 | A7 | E7", "bluesStraight", "bluesStraight8"],
    ["Quick Change in E", 116, "E", "blues", QUICK("E7", "A7", "B7"), "texasShuffle", "walkQuarter"],
    ["Swinging in C", 140, "C", "blues", TWELVE("C7", "F7", "G7"), "jumpBlues", "walkQuarter"],
    ["One-Chord Stomp", 88, "A", "minor-pentatonic", "A7 | A7 | A7 | A7", "trainBlues", "shuffleRoot"],
    ["Minor 12/8 in E", 60, "E", "minor-pentatonic", "Em | Em | Em | Em | Am | Am | Em | Em | C7 | B7 | Em | B7", "slow128", "slowBass"],
    ["Shuffle in D", 108, "D", "blues", TWELVE("D7", "G7", "A7"), "bluesShuffle", "boogie"],
    ["Rocking Blues in A", 138, "A", "blues", TWELVE("A7", "D7", "E7"), "bluesStraight", "bluesStraight8"],
  ],
  funk: [
    ["One-Chord Vamp in E", 100, "E", "dorian", "Em7 | Em7", "funkOne", "funkRoot"],
    ["Ninth Chord Strut", 108, "A", "mixolydian", "A9 | A9 | D9 | A9", "funkTight", "funkOct"],
    ["Disco Pocket", 118, "A", "dorian", "Am7 | D9 | Am7 | D9", "funkDisco", "octave8"],
    ["Sixteenth Bounce", 96, "D", "dorian", "Dm7 | Dm7 | G7 | G7", "funkOne", "funkSyncop"],
    ["Slow Pocket", 78, "E", "dorian", "Em7 | A7 | Em7 | A7", "funkSwing", "funkSparse"],
    ["Breakbeat Groove", 92, "G", "mixolydian", "G7 | G7 | C7 | G7", "funkBreak", "funkRoot"],
    ["Half-Time Strut", 84, "C", "dorian", "Cm7 | Cm7 | F7 | F7", "funkSlow", "funkSparse"],
    ["Mirrorball", 122, "D", "minor", "Dm7 | C | Bb | C", "funkDisco", "octave8"],
    ["Clavinet Chase", 104, "E", "dorian", "Em7 | Em7 | Em7 | A9", "funkTight", "funkOct"],
    ["Tight Pocket", 112, "A", "dorian", "Am7 | D7 | Am7 | D7", "funkOne", "funkSyncop"],
    ["Lazy Sunday Funk", 88, "G", "dorian", "Gm7 | C9", "funkSwing", "funkSparse"],
    ["Two-Chord Chop", 98, "B", "dorian", "Bm7 | E9", "funkOne", "funkRoot"],
    ["Disco Strings", 126, "C", "major", "Cmaj7 | Am7 | Dm7 | G7", "funkDisco", "octave8"],
    ["Swing Sixteenths", 94, "F", "mixolydian", "F9 | Bb9", "funkSwing", "funkOct"],
    ["Breakdown", 86, "E", "mixolydian", "E7 | E7 | A7 | E7", "funkBreak", "funkRoot"],
    ["Uptown Strut", 114, "D", "mixolydian", "D9 | G9 | D9 | A9", "funkTight", "funkSyncop"],
    ["Basement Jam", 102, "A", "dorian", "Am7 | Am7", "funkBreak", "funkSparse"],
    ["Groove Machine", 106, "E", "dorian", "Em7 | Em7 | G | A", "funkOne", "funkOct"],
    ["Late Night Pocket", 74, "C", "dorian", "Cm7 | F9", "funkSlow", "funkSparse"],
    ["Party Starter", 130, "G", "mixolydian", "G9 | C9 | G9 | D9", "funkDisco", "octave8"],
  ],
  metal: [
    ["Gallop in E", 168, "E", "minor", "E5 | E5 | C5 | D5", "gallop", "gallopBass"],
    ["Double-Kick Run", 176, "E", "minor-pentatonic", "E5 | G5 | A5 | E5", "doubleKick", "sixteenR"],
    ["Doom Crawl", 58, "E", "phrygian", "E5 | F5 | E5 | G5", "doom", "doomBass"],
    ["Thrash Skank", 200, "E", "minor", "E5 | E5 | G5 | F#5", "thrash", "root8"],
    ["Half-Time Breakdown", 90, "A", "minor", "A5 | A5 | F5 | G5", "metalHalf", "halfMetal"],
    ["Chug Machine", 120, "D", "minor", "D5 | D5 | Bb5 | C5", "chug", "chugBass"],
    ["Dark Gallop", 150, "A", "minor", "A5 | F5 | G5 | A5", "gallop", "gallopBass"],
    ["Phrygian Stomp", 112, "E", "phrygian", "E5 | F5 | G5 | F5", "chug", "chugBass"],
    ["Storm Front", 162, "D", "minor-pentatonic", "D5 | C5 | Bb5 | C5", "doubleKick", "sixteenR"],
    ["Slow Grind", 70, "B", "minor", "B5 | G5 | A5 | F#5", "doom", "doomBass"],
    ["Headbanger", 132, "E", "minor-pentatonic", "E5 | G5 | A5 | G5", "metal8", "root8"],
    ["Iron March", 100, "A", "minor", "A5 | C5 | D5 | E5", "metalHalf", "halfMetal"],
    ["Harmonic Minor Run", 144, "E", "harmonic-minor", "E5 | C5 | B5 | E5", "gallop", "gallopBass"],
    ["Thrash Chorus", 190, "A", "minor", "A5 | G5 | F5 | E5", "thrash", "root8"],
    ["Sludge", 64, "D", "minor", "D5 | D5 | F5 | C5", "doom", "doomBass"],
    ["Double-Time Chorus", 172, "G", "minor", "G5 | Eb5 | F5 | G5", "doubleKick", "sixteenR"],
    ["Downtuned Chug", 108, "D", "minor-pentatonic", "D5 | D5 | F5 | G5", "chug", "chugBass"],
    ["Power Gallop", 156, "B", "minor", "B5 | G5 | A5 | B5", "gallop", "gallopBass"],
    ["Heavy Half-Time", 82, "C", "minor", "C5 | Ab5 | Bb5 | C5", "metalHalf", "halfMetal"],
    ["Fist Pumper", 128, "E", "minor-pentatonic", "E5 | D5 | C5 | D5", "metal8", "root8"],
  ],
  punk: [
    ["Three Chords and Go", 180, "A", "major-pentatonic", "A | D | E | D", "punk8", "root8"],
    ["Skate Park", 200, "E", "minor-pentatonic", "E5 | A5 | B5 | A5", "skate", "root8"],
    ["Garage Anthem", 160, "D", "major-pentatonic", "D | G | A | G", "punk8", "drive8"],
    ["Basement Floor", 170, "G", "major-pentatonic", "G | C | D | C", "punkFloor", "root8"],
    ["Half-Time Shout", 86, "E", "minor-pentatonic", "E5 | C5 | G5 | D5", "punkHalf", "halfRoot"],
    ["Dance-Punk Strut", 126, "A", "minor-pentatonic", "Am | Am | F | G", "dancePunk", "octave8"],
    ["Pop-Punk Chorus", 176, "C", "major-pentatonic", "C | G | Am | F", "punk8", "drive8"],
    ["Hardcore Sprint", 212, "E", "minor", "E5 | G5 | A5 | C5", "skate", "root8"],
    ["Mid-Tempo Shout", 140, "A", "minor-pentatonic", "A5 | C5 | D5 | A5", "punkFloor", "punkWalk"],
    ["Surf Punk", 166, "E", "minor-pentatonic", "Em | C | D | Em", "punk8", "drive8"],
    ["Bedroom Riot", 152, "G", "major-pentatonic", "G | D | C | D", "skate", "root8"],
    ["Slow Burn Punk", 120, "D", "minor-pentatonic", "D5 | F5 | G5 | D5", "punkFloor", "root8"],
    ["Gutter Groove", 134, "E", "minor", "E5 | E5 | D5 | C5", "dancePunk", "octave8"],
    ["Anthem Shout", 164, "A", "major-pentatonic", "A | E | F#m | D", "punk8", "root8"],
    ["Crowd Surf", 192, "D", "major-pentatonic", "D | A | G | A", "skate", "root8"],
    ["Chant Breakdown", 92, "A", "minor-pentatonic", "A5 | A5 | G5 | F5", "punkHalf", "halfRoot"],
    ["Bus Ride Home", 148, "C", "major-pentatonic", "C | F | G | F", "punkFloor", "punkWalk"],
    ["Neon Night", 130, "B", "minor-pentatonic", "Bm | G | D | A", "dancePunk", "octave8"],
    ["Last Encore", 184, "E", "major-pentatonic", "E | B | C#m | A", "punk8", "drive8"],
    ["Two-Minute Song", 172, "G", "minor-pentatonic", "G5 | Bb5 | C5 | G5", "skate", "root8"],
  ],
  country: [
    ["Boom-Chick in G", 112, "G", "major-pentatonic", "G | G | C | D", "twoStep", "altRoot5"],
    ["Freight Train in E", 150, "E", "major-pentatonic", "E | E | A | B", "trainCountry", "altRoot5"],
    ["Honky-Tonk Shuffle", 124, "A", "major-pentatonic", "A | D | A | E", "countryShuffle", "countryShuffleBass"],
    ["Back Porch Waltz", 96, "D", "major-pentatonic", "D | G | A | D", "countryWaltz", "waltz3"],
    ["Highway Two-Step", 132, "C", "major-pentatonic", "C | F | G | C", "twoStep", "walkUp"],
    ["Sunset Ballad", 70, "G", "major-pentatonic", "G | Em | C | D", "countryBallad", "ballad"],
    ["Country Rocker", 140, "A", "major-pentatonic", "A | D | E | A", "countryRock", "root8"],
    ["Dusty Road", 104, "E", "major-pentatonic", "E | A | E | B", "twoStep", "altRoot5"],
    ["Kitchen Waltz", 120, "C", "major", "C | F | G | C", "countryWaltz", "waltz3"],
    ["Chicken Pickin' Shuffle", 116, "G", "mixolydian", "G7 | C7 | G7 | D7", "countryShuffle", "countryShuffleBass"],
    ["Gravel Train", 160, "D", "major-pentatonic", "D | G | A | D", "trainCountry", "altRoot5"],
    ["Steel Guitar Night", 64, "F", "major-pentatonic", "F | C | Bb | C", "countryBallad", "ballad"],
    ["Bluegrass Breakdown", 176, "G", "major-pentatonic", "G | C | G | D", "twoStep", "altRoot5"],
    ["Outlaw Groove", 92, "E", "minor-pentatonic", "Em | D | C | D", "countryRock", "root8"],
    ["Barn Dance", 128, "A", "major-pentatonic", "A | A | E | A", "twoStep", "walkUp"],
    ["Lonesome Waltz", 84, "G", "major-pentatonic", "G | C | G | D", "countryWaltz", "waltz3"],
    ["Truck Stop Shuffle", 108, "E", "mixolydian", "E7 | A7 | E7 | B7", "countryShuffle", "countryShuffleBass"],
    ["Wide Open Sky", 100, "D", "major-pentatonic", "D | A | Bm | G", "countryRock", "octave8"],
    ["Telecaster Twang", 136, "B", "major-pentatonic", "B | E | B | F#", "twoStep", "altRoot5"],
    ["Front Porch Train", 144, "C", "major-pentatonic", "C | G | F | C", "trainCountry", "walkUp"],
  ],
  reggae: [
    ["One Drop in A Minor", 72, "A", "minor-pentatonic", "Am | Dm | Am | Em", "oneDrop", "dropBass"],
    ["Rockers in E", 80, "E", "dorian", "Em | A | Em | A", "rockers", "rockersBass"],
    ["Steppers", 84, "D", "minor", "Dm | C | Dm | C", "steppers", "steppersBass"],
    ["Ska Skank", 160, "G", "major-pentatonic", "G | C | D | C", "ska", "skaWalk"],
    ["Dub Space", 66, "A", "minor-pentatonic", "Am | Am | G | G", "dub", "dubBass"],
    ["Lovers Rock", 76, "C", "major-pentatonic", "C | Am | F | G", "lovers", "dropBass"],
    ["Roots Two-Chord", 70, "B", "minor-pentatonic", "Bm | A", "oneDrop", "dropBass"],
    ["Island Morning", 88, "D", "major-pentatonic", "D | G | A | G", "rockers", "rockersBass"],
    ["Offbeat Uptown", 152, "C", "major-pentatonic", "C | Am | F | G", "ska", "skaWalk"],
    ["Minor Riddim", 82, "G", "minor", "Gm | Cm | Gm | Cm", "steppers", "steppersBass"],
    ["Hilltop One Drop", 74, "E", "minor-pentatonic", "Em | C | D | Em", "oneDrop", "dropBass"],
    ["Dub Echo", 62, "D", "minor-pentatonic", "Dm | Dm | Gm | Gm", "dub", "dubBass"],
    ["Rocksteady", 100, "F", "major-pentatonic", "F | Dm | Bb | C", "ska", "skaWalk"],
    ["Sunshine Rockers", 86, "G", "major-pentatonic", "G | Em | C | D", "rockers", "rockersBass"],
    ["Night Steppers", 90, "A", "minor", "Am | F | G | Am", "steppers", "steppersBass"],
    ["Easy Skank", 140, "E", "minor-pentatonic", "Em | Am | Em | B7", "ska", "skaWalk"],
    ["Heavy One Drop", 68, "C", "minor", "Cm | Fm | Cm | G", "oneDrop", "dropBass"],
    ["Seaside Lovers", 78, "A", "major-pentatonic", "A | F#m | D | E", "lovers", "dropBass"],
    ["Yard Rockers", 92, "D", "dorian", "Dm7 | G", "rockers", "rockersBass"],
    ["Echo Chamber", 64, "E", "minor-pentatonic", "Em | Em | D | D", "dub", "dubBass"],
  ],
  jazz: [
    ["ii–V–I in C", 120, "C", "major", "Dm7 | G7 | Cmaj7 | Cmaj7", "swingRide", "walk1"],
    ["Medium Swing in F", 140, "F", "major", "Fmaj7 | Dm7 | Gm7 | C7", "swingRide", "walk1"],
    ["Jazz Blues in F", 132, "F", "blues", "F7 | Bb7 | F7 | F7 | Bb7 | Bb7 | F7 | D7 | Gm7 | C7 | F7 | C7", "swingRide", "walk1"],
    ["Ballad in G", 60, "G", "major", "Gmaj7 | Em7 | Am7 | D7", "brushBallad", "twoFeelBass"],
    ["Bossa in A Minor", 130, "A", "harmonic-minor", "Am7 | Dm7 | E7 | Am7", "bossa", "bossaBass"],
    ["Waltz in D", 150, "D", "major", "Dmaj7 | Bm7 | Em7 | A7", "jazzWaltz", "jazzWaltzBass"],
    ["Two-Feel in G", 110, "G", "major", "Gmaj7 | Am7 | D7 | Gmaj7", "twoFeel", "twoFeelBass"],
    ["Fast Bop ii–V", 208, "C", "major", "Dm7 | G7 | Cmaj7 | A7", "fastSwing", "walk1"],
    ["Quick Turnaround in C", 160, "C", "major", "Cmaj7 A7 | Dm7 G7", "swingRide", "walkTwo"],
    ["Minor ii–V–i", 112, "A", "harmonic-minor", "Bm7b5 | E7 | Am7 | Am7", "swingRide", "walk1"],
    ["Bossa in C", 124, "C", "major", "Cmaj7 | Dm7 | G7 | Cmaj7", "bossa", "bossaBass"],
    ["Slow Swing Blues in C", 96, "C", "blues", "C7 | F7 | C7 | C7 | F7 | F7 | C7 | A7 | Dm7 | G7 | C7 | G7", "swingRide", "walk1"],
    ["Modal Vamp in D Dorian", 144, "D", "dorian", "Dm7 | Dm7 | Em7 | Dm7", "swingRide", "walk1"],
    ["Waltz Ballad in F", 116, "F", "major", "Fmaj7 | Dm7 | Gm7 | C7", "jazzWaltz", "jazzWaltzBass"],
    ["Cycle of Dominants", 168, "F", "major", "D7 | G7 | C7 | F7", "swingRide", "walk1"],
    ["Bossa Ballad in D Minor", 100, "D", "harmonic-minor", "Dm7 | Gm7 | A7 | Dm7", "bossa", "bossaBass"],
    ["After Hours", 72, "D", "major", "Em7 | A7 | Dmaj7 | Dmaj7", "brushBallad", "twoFeelBass"],
    ["Up-Tempo Blues in G", 184, "G", "blues", "G7 | C7 | G7 | G7 | C7 | C7 | G7 | E7 | Am7 | D7 | G7 | D7", "fastSwing", "walk1"],
    ["Waltz in A Minor", 138, "A", "harmonic-minor", "Am7 | Dm7 | E7 | Am7", "jazzWaltz", "jazzWaltzBass"],
    ["Turnaround in G", 154, "G", "major", "Gmaj7 Em7 | Am7 D7", "swingRide", "walkTwo"],
  ],
  soul: [
    ["Motown Bounce", 120, "C", "major-pentatonic", "C | Am | F | G", "motown", "motownBass"],
    ["Six-Eight Soul", 62, "G", "major-pentatonic", "G | Em | C | D", "soul68", "sixEight"],
    ["Neo-Soul Haze", 76, "E", "dorian", "Em9 | A9", "neoSoul", "neoBass"],
    ["Slow Jam", 68, "A", "minor", "Am7 | Dm7 | Fmaj7 | E7", "rnbHalf", "rnbBass"],
    ["Gospel Shuffle", 108, "F", "major-pentatonic", "F | Bb | F | C7", "gospel", "walkQuarter"],
    ["Northern Soul Stomp", 136, "D", "major-pentatonic", "D | Bm | G | A", "motown", "motownBass"],
    ["Velvet Groove", 82, "D", "dorian", "Dm7 | G7", "neoSoul", "neoBass"],
    ["Late-Night R&B", 72, "C", "minor", "Cm7 | Fm7 | Cm7 | G7", "rnbHalf", "rnbBass"],
    ["Soul Ballad", 58, "C", "major", "C | Em | F | G", "soul68", "sixEight"],
    ["Sunday Choir", 96, "G", "major-pentatonic", "G | C | G | D", "gospel", "walkQuarter"],
    ["Disco Soul", 118, "A", "dorian", "Am7 | D7 | Am7 | D7", "discoSoul", "octave8"],
    ["Midnight Drive", 88, "E", "minor", "Em7 | Cmaj7 | Am7 | B7", "rnbHalf", "rnbBass"],
    ["Neo-Soul Pocket", 90, "B", "dorian", "Bm7 | E9", "neoSoul", "neoBass"],
    ["Uptown Motown", 128, "G", "major-pentatonic", "G | Em | Am | D", "motown", "motownBass"],
    ["Candlelight", 66, "F", "major-pentatonic", "F | Dm | Bb | C", "soul68", "sixEight"],
    ["Church Clap", 116, "C", "major-pentatonic", "C | F | C | G7", "gospel", "walkQuarter"],
    ["Silk", 74, "A", "dorian", "Am9 | D9", "neoSoul", "neoBass"],
    ["Dancefloor Soul", 124, "D", "dorian", "Dm7 | Em7 | Fmaj7 | Em7", "discoSoul", "octave8"],
    ["Quiet Storm", 64, "E", "major", "Emaj7 | C#m7 | F#m7 | B7", "rnbHalf", "rnbBass"],
    ["Golden Hour", 100, "C", "major", "Cmaj7 | Am7 | Dm7 | G7", "motown", "motownBass"],
  ],
};

export const TRACKS: BackingTrack[] = GENRES.flatMap((g) =>
  ROWS[g.id].map(([name, bpm, root, mode, bars, d, b], i) => ({
    id: `${g.id}-${String(i + 1).padStart(2, "0")}`,
    genre: g.id,
    n: i + 1,
    name,
    bpm,
    root,
    mode,
    bars: bars.split("|").map((s) => s.trim()),
    drums: DRUMS[d],
    bass: BASS[b],
  })),
);
export const TRACKS_BY_ID: Record<string, BackingTrack> = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
export const tracksFor = (genre: GenreId) => TRACKS.filter((t) => t.genre === genre);

/* ---------------------------------------------------------- descriptions */

const MAJORISH: ScaleMode[] = ["major", "major-pentatonic", "lydian", "mixolydian"];
export function scaleLabel(mode: ScaleMode): string {
  return {
    major: "major scale", minor: "natural minor", "major-pentatonic": "major pentatonic", "minor-pentatonic": "minor pentatonic",
    blues: "blues scale", "harmonic-minor": "harmonic minor", "melodic-minor": "melodic minor", dorian: "Dorian",
    mixolydian: "Mixolydian", phrygian: "Phrygian", lydian: "Lydian", locrian: "Locrian",
  }[mode];
}
/** "A minor", "D major", "E blues", "D Dorian"… */
export function keyName(t: Pick<BackingTrack, "root" | "mode">): string {
  if (t.mode === "blues") return `${t.root} blues`;
  if (t.mode === "dorian" || t.mode === "mixolydian" || t.mode === "phrygian") return `${t.root} ${scaleLabel(t.mode)}`;
  return `${t.root} ${MAJORISH.includes(t.mode) ? "major" : "minor"}`;
}
export function meterOf(t: BackingTrack): "4/4" | "3/4" | "12/8" {
  if (t.drums.beats === 3) return "3/4";
  return t.drums.feel === "twelve-eight" ? "12/8" : "4/4";
}
export type TempoBand = "slow" | "medium" | "fast";
export function tempoBand(bpm: number): TempoBand {
  return bpm < 85 ? "slow" : bpm <= 130 ? "medium" : "fast";
}
/** Chord names in the progression, in order of first appearance. */
export function chordsOf(t: BackingTrack): string[] {
  return [...new Set(t.bars.flatMap((b) => b.split(/\s+/)))];
}
/** "Am – G – F – G" (two-chord bars in brackets). */
export function progressionText(t: BackingTrack): string {
  return t.bars.map((b) => (b.includes(" ") ? `(${b.split(/\s+/).join(" ")})` : b)).join(" – ");
}
export function scaleModeLabel(mode: ScaleMode): string {
  return SCALE_KINDS.find((k) => k.id === mode)?.label ?? mode;
}

const PENTA: ScaleMode[] = ["minor-pentatonic", "major-pentatonic", "blues"];
/** Lessons for this particular loop (on top of its genre's), chosen from what's in it. */
export function trackLessons(t: BackingTrack): LessonId[] {
  const out: LessonId[] = [];
  const chords = chordsOf(t).map((c) => parseChord(c)!);
  if (t.mode === "blues") out.push("lesson-blues-scale");
  if (PENTA.includes(t.mode)) out.push("pentatonic-box");
  else out.push("solo-scale");
  if (t.bars.length === 12 && chords.some((c) => c.quality === "7")) out.push("lesson-twelve-bar");
  if (t.drums.triplet) out.push("lesson-swing");
  if (chords.some((c) => c.quality === "5")) out.push("lesson-power-chords");
  if (isFourChordPop(t)) out.push("lesson-four-chords");
  if (chords.some((c) => c.seventh != null) && (t.genre === "jazz" || t.genre === "soul" || t.genre === "funk")) out.push("solo-target");
  if (t.drums.beats === 3) out.push("theory-meter");
  if (t.drums.feel === "half-time") out.push("theory-groove");
  return [...new Set(out)];
}

/** Is the loop a rotation of I–V–vi–IV (e.g. C–G–Am–F, Am–F–C–G)? */
export function isFourChordPop(t: BackingTrack): boolean {
  if (t.bars.length !== 4 || t.bars.some((b) => b.includes(" "))) return false;
  const cs = t.bars.map((b) => parseChord(b)!);
  for (let r = 0; r < 4; r++) {
    const rot = [...cs.slice(r), ...cs.slice(0, r)];
    const I = rot[0]!.root;
    const ok = [[0, false], [7, false], [9, true], [5, false]].every(([iv, minor], k) =>
      (rot[k]!.root - I + 12) % 12 === iv && rot[k]!.minor === minor && rot[k]!.quality !== "5");
    if (ok) return true;
  }
  return false;
}

/* ------------------------------------------------------------ bass pitches */

const BASS_LOW = 36; // C2; roots sit in C2–B2

function chordsInBar(bar: string): ParsedChord[] {
  return bar.split(/\s+/).map((c) => parseChord(c)!);
}
function chordIndexAt(bar: string, step: number, steps: number): number {
  const n = bar.split(/\s+/).length;
  return Math.min(n - 1, Math.floor((step * n) / steps));
}
/** The chord after chord `ci` of bar `bi` (wraps to the start). */
function nextChord(t: BackingTrack, bi: number, ci: number): ParsedChord {
  const here = chordsInBar(t.bars[bi]!);
  if (ci + 1 < here.length) return here[ci + 1]!;
  return chordsInBar(t.bars[(bi + 1) % t.bars.length]!)[0]!;
}
/** How many bars the chord in bar `bi` has already lasted (0 on a change). */
function barsHeld(t: BackingTrack, bi: number): number {
  let k = 0;
  while (k < bi && t.bars[bi - k - 1] === t.bars[bi]) k++;
  return k;
}

export function degreeMidi(degree: Degree, chord: ParsedChord, next: ParsedChord): number {
  const root = BASS_LOW + chord.root;
  switch (degree) {
    case "R": return root;
    case "8": return root + 12;
    case "3": return root + (chord.third ?? 4);
    case "b3": return root + 3;
    case "5": return root + chord.fifth;
    case "-5": return root + chord.fifth - 12;
    case "6": return root + 9;
    case "b7": return root + 10;
    case "7": return root + (chord.seventh ?? 10);
    case "2": return root + 2;
    case "4": return root + 5;
    case "A": return BASS_LOW + next.root - 1;
    case "Ab": return BASS_LOW + next.root + 1;
  }
}

export interface BassHit { midi: number; step: number; len: number; vel: number; chord: string }
/** The bass notes of progression bar `bi`. */
export function bassBar(t: BackingTrack, bi: number): BassHit[] {
  const bar = t.bars[bi % t.bars.length]!;
  const pattern = t.bass.bars[barsHeld(t, bi % t.bars.length) % t.bass.bars.length]!;
  const names = bar.split(/\s+/);
  return pattern.map((n) => {
    const ci = chordIndexAt(bar, n.step, t.bass.steps);
    const chord = parseChord(names[ci]!)!;
    return { midi: degreeMidi(n.degree, chord, nextChord(t, bi % t.bars.length, ci)), step: n.step, len: n.len, vel: n.vel, chord: names[ci]! };
  });
}

/* ------------------------------------------------------------- drum hits */

export interface DrumHit { voice: DrumVoice; step: number; vel: number }

/** The drum hits of one bar: the groove, or the genre's fill on the last bar of the loop, plus a crash on bar 1 of a repeat. */
export function drumBar(t: BackingTrack, bi: number, cycle = 0): DrumHit[] {
  const d = t.drums;
  const g = GENRES_BY_ID[t.genre];
  const len = t.bars.length;
  const isLast = bi % len === len - 1 && len >= 2;
  const spb = d.steps / d.beats;
  let fillFrom = d.steps;
  let fill: { off: number; vel: number }[] = [];
  if (isLast && g.fill !== "none") {
    // A triplet fill only fits triplet grids; straight grids in those genres (bossa, straight blues) get a pickup.
    const style = g.fill === "triplet" && !d.triplet ? "pickup" : g.fill;
    if (style === "pickup") {
      fillFrom = d.steps - spb;
      fill = spb === 4
        ? [{ off: 0, vel: 0.4 }, { off: 1, vel: 0.55 }, { off: 2, vel: 0.7 }, { off: 3, vel: 0.9 }]
        : [{ off: 0, vel: 0.5 }, { off: 1, vel: 0.7 }, { off: 2, vel: 0.9 }];
    } else if (spb === 4) {
      fillFrom = d.steps - 2 * spb;
      fill = [{ off: 0, vel: 0.7 }, { off: 2, vel: 0.7 }, { off: 4, vel: 1 }, { off: 5, vel: 0.75 }, { off: 6, vel: 1 }, { off: 7, vel: 0.8 }];
    } else {
      fillFrom = d.steps - 2 * spb;
      fill = [{ off: 0, vel: 0.7 }, { off: 2, vel: 0.75 }, { off: 3, vel: 0.95 }, { off: 4, vel: 0.8 }, { off: 5, vel: 1 }];
    }
  }
  const hits: DrumHit[] = [];
  for (const voice of DRUM_VOICES) {
    for (const h of rowHits(d.rows[voice])) {
      if (h.step >= fillFrom && voice !== "kick") continue;
      if (h.step >= fillFrom && voice === "kick" && h.step !== fillFrom) continue;
      hits.push({ voice, step: h.step, vel: h.vel });
    }
  }
  for (const f of fill) hits.push({ voice: "snare", step: fillFrom + f.off, vel: f.vel });
  if (fill.length && !hits.some((h) => h.voice === "kick" && h.step === fillFrom)) hits.push({ voice: "kick", step: fillFrom, vel: 0.8 });
  if (g.crash && cycle > 0 && bi % len === 0) hits.push({ voice: "crash", step: 0, vel: 0.85 });
  return hits.sort((a, b) => a.step - b.step);
}

/* ------------------------------------------------------------ playback data */

export interface BarOptions {
  bpm: number;
  drums?: boolean;
  bass?: boolean;
  /** Which pass through the progression (crash on repeats). */
  cycle?: number;
}

/** Beat position of a step, with 16th swing applied on straight grids. */
export function stepBeat(d: DrumPattern, step: number): number {
  const stepLen = d.beats / d.steps;
  const swing = !d.triplet && step % 2 === 1 ? d.swing * stepLen : 0;
  return step * stepLen + swing;
}

/** One bar of the loop as a Theory-player Sound, with bar/beat/step highlights. */
export function barSound(t: BackingTrack, bi: number, opts: BarOptions): Sound {
  const d = t.drums;
  const bar = bi % t.bars.length;
  const stepLen = d.beats / d.steps;
  const events: TheoryEvent[] = [];
  if (opts.drums !== false) {
    for (const h of drumBar(t, bar, opts.cycle ?? 0)) {
      events.push({ kind: h.voice, beat: stepBeat(d, h.step), beats: stepLen, velocity: h.vel });
    }
  }
  if (opts.bass !== false) {
    const bl = d.beats / t.bass.steps;
    for (const n of bassBar(t, bar)) {
      const start = t.bass.steps === d.steps ? stepBeat(d, n.step) : n.step * bl;
      events.push({ kind: "bass", midi: n.midi, beat: start, beats: Math.max(0.1, n.len * bl * 0.92), velocity: n.vel });
    }
  }
  events.push({ kind: "highlight", beat: 0, beats: d.beats, velocity: 0, highlight: `b_${bar}` });
  for (let b = 0; b < d.beats; b++) events.push({ kind: "highlight", beat: b, beats: 0.9, velocity: 0, highlight: `beat_${b}` });
  for (let k = 0; k < d.steps; k++) events.push({ kind: "highlight", beat: stepBeat(d, k), beats: stepLen, velocity: 0, highlight: `st_${k}` });
  return { bpm: opts.bpm, lengthBeats: d.beats, events };
}

/** One bar of clicks before the loop starts (accent on 1). */
export function countInSound(t: BackingTrack, bpm: number): Sound {
  const events: TheoryEvent[] = [];
  for (let b = 0; b < t.drums.beats; b++) {
    events.push({ kind: "click", beat: b, beats: 0.25, velocity: b === 0 ? 1 : 0.7 });
    events.push({ kind: "highlight", beat: b, beats: 0.9, velocity: 0, highlight: `beat_${b}` });
    events.push({ kind: "highlight", beat: b, beats: 0.9, velocity: 0, highlight: `count_${b}` });
  }
  return { bpm, lengthBeats: t.drums.beats, events };
}

/** The whole progression once, as one Sound (for previews and tests). */
export function loopSound(t: BackingTrack, opts: BarOptions): Sound {
  const events: TheoryEvent[] = [];
  t.bars.forEach((_, i) => {
    const s = barSound(t, i, opts);
    for (const e of s.events) events.push({ ...e, beat: e.beat + i * t.drums.beats });
  });
  return { bpm: opts.bpm, lengthBeats: t.bars.length * t.drums.beats, events };
}

/** Seconds for one pass through the progression at `bpm`. */
export function loopSeconds(t: BackingTrack, bpm = t.bpm): number {
  return (t.bars.length * t.drums.beats * 60) / bpm;
}
