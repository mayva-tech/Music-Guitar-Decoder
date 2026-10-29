/**
 * Guitar greats: how eight influential players sound, shown as signature chord shapes and
 * short licks you can hear with a band and pick note by note.
 *
 * Every lick here is ORIGINAL, written to demonstrate a player's techniques and vocabulary.
 * None is a transcription of a recording (see the README's note on copyrighted riffs).
 *
 * Licks use the solo workshop's format (PlayableNote via buildLick), so the same player,
 * TAB and neck components play and draw them.
 */
import type { ChordShape } from "@/lib/music/chordShapes";
import { STANDARD_TUNING } from "@/lib/music/guitar";
import type { ScaleMode, ScaleRoot } from "@/lib/music/scaleFretmap";
import { buildLick, type BackingStyle, type Lick } from "@/lib/music/soloGuide";
import type { PlayableNote } from "@/lib/types";

/* --------------------------------------------------------------- types */

export interface SignatureChord {
  name: string;
  shape: ChordShape;
  /** Why this chord is part of the sound. */
  text: string;
}

export interface GreatLick {
  lick: Lick;
  /** What the lick teaches about the player. */
  why: string;
  /** Extra instruction for particular notes (index → text), shown while picking. */
  hints?: Record<number, string>;
  /** Notes played by tapping with the picking hand. */
  taps?: number[];
  /** Notes fretted with the thumb wrapped over the neck. */
  thumbs?: number[];
}

export interface Great {
  id: string;
  name: string;
  years: string;
  genre: string;
  /** Pick, fingers, thumb… */
  hands: string;
  colour: string;
  /** The sound in one line. */
  sound: string;
  traits: { title: string; text: string }[];
  chords: SignatureChord[];
  licks: GreatLick[];
  listen: string[];
  practice: string[];
}

/* ----------------------------------------------------------- lick builder */

type Tech = "" | "slide" | "h" | "p" | "bend" | "br" | "vib";
interface Spec { s: number; f: number; b: number; d: number; t: Tech; bend?: 1 | 2; vib?: boolean }
const N = (s: number, f: number, b: number, d: number, t: Tech = "", o: { bend?: 1 | 2; vib?: boolean } = {}): Spec => ({ s, f, b, d, t, ...o });

/** Swing straight eighths: an off-beat "and" moves to the last third of the beat. */
const swingPos = (x: number) => {
  const k = Math.floor(x + 1e-9);
  const fr = x - k;
  return Math.abs(fr - 0.5) < 1e-6 ? k + 2 / 3 : x;
};
const swing = (specs: Spec[]): Spec[] =>
  specs.map((sp) => { const b = swingPos(sp.b); return { ...sp, b, d: swingPos(sp.b + sp.d) - b }; });

interface LickDef {
  id: string;
  title: string;
  sub: string;
  tags: string[];
  root: ScaleRoot;
  mode: ScaleMode;
  bpm: number;
  style: BackingStyle;
  backing: [string, number][];
  specs: Spec[];
  /** Fret under the index finger (one finger per fret from here). */
  position: number;
  swing?: boolean;
  /** Fingering where one-finger-per-fret is wrong (chord stabs, octaves, shifts). */
  fingers?: (n: PlayableNote, i: number) => number | undefined;
}
function mk(d: LickDef): Lick {
  const specs = d.swing ? swing(d.specs) : d.specs;
  const notes = buildLick(d.id, specs, Math.max(0, d.position - 1)).map((n, i) => {
    // Bends use the ring finger (with the others behind it), not the pinky.
    let finger = (n.technique === "bend" || n.technique === "bend_release") && n.finger === 4 ? 3 : n.finger;
    const own = d.fingers?.(n, i);
    if (own != null && n.fret > 0) finger = own;
    return { ...n, finger };
  });
  return {
    id: d.id, title: d.title, sub: d.sub, tags: d.tags, root: d.root, mode: d.mode, box: 0, bpm: d.bpm,
    style: d.style, backing: d.backing, notes,
  };
}

/** Chord shape, strings 6→1. Finger 5 means the thumb (wrapped over the neck). */
const shape = (frets: (number | null)[], fingers: (number | null)[]): ChordShape => ({ frets, fingers });

/* ---------------------------------------------------------------- players */

/** Knopfler-style thirds on the G and B strings: [string, fret, beat, beats, technique]. */
const MK_THIRDS: [number, number, number, number, Tech][] = [
  [3, 4, 0, 0.5, ""], [2, 3, 0, 0.5, ""], [3, 6, 0.5, 0.5, "slide"], [2, 5, 0.5, 0.5, "slide"], [3, 7, 1, 1, ""], [2, 7, 1, 1, ""],
  [3, 9, 2, 0.5, ""], [2, 8, 2, 0.5, ""], [3, 7, 2.5, 0.5, ""], [2, 7, 2.5, 0.5, ""], [3, 6, 3, 0.5, ""], [2, 5, 3, 0.5, ""], [3, 7, 4, 4, ""], [2, 7, 4, 4, "vib"],
];

export const GREATS: Great[] = [
  {
    id: "bb-king", name: "B.B. King", years: "1925–2015", genre: "Blues", hands: "Pick, few notes", colour: "#e4a853",
    sound: "One perfectly bent note can say more than a fast run.",
    traits: [
      { title: "Sing, then answer", text: "He rarely played while singing. The guitar answers the voice with short phrases, like a conversation." },
      { title: "Butterfly vibrato", text: "A fast, wide shake from the wrist with the thumb off the neck. The note sounds like a singer holding it." },
      { title: "The B.B. box", text: "A small spot around frets 10–13 in A, with the root on the B string. It mixes the major 3rd, the 6th and the 9th (B) with blues notes." },
      { title: "Bends that land exactly", text: "Bends go right to a chord note, like the major 3rd, and stop there. In tune every time." },
    ],
    chords: [
      { name: "D9", shape: shape([null, 5, 4, 5, 5, 5], [null, 2, 1, 3, 3, 3]), text: "Blues bands play 9th chords instead of plain 7ths. This is the IV chord in A, with a ring-finger barre on top." },
    ],
    licks: [
      {
        lick: mk({ id: "bb-answer", title: "Sing it, answer it", sub: "Bend to the major 3rd, then rest on the root with wide vibrato.", tags: ["Blues", "Bends", "Vibrato"],
          root: "A", mode: "blues", bpm: 72, style: "shuffle", backing: [["A7", 4], ["D7", 4]], position: 10, swing: true,
          specs: [N(2, 10, 0, 0.5), N(2, 12, 0.5, 1, "bend", { bend: 2 }), N(2, 10, 1.5, 0.5), N(3, 11, 2, 0.5), N(2, 10, 2.5, 1.5, "vib"),
            N(1, 10, 4, 1, "vib"), N(2, 13, 5, 0.5), N(2, 12, 5.5, 0.5), N(2, 10, 6, 2, "vib")] }),
        why: "Each phrase is short and ends on a long note with vibrato. The bend goes from B to C♯, the major 3rd of A7.",
        hints: { 1: "Bend with your ring finger, with your middle and index behind it pushing too. Stop when it sounds like C♯.", 4: "Butterfly vibrato: thumb off the neck, shake from the wrist." },
      },
      {
        lick: mk({ id: "bb-curl", title: "Half-step curl", sub: "Nudge the 9th up a half step and let it fall back.", tags: ["Blues", "Bend and release"],
          root: "A", mode: "blues", bpm: 72, style: "shuffle", backing: [["A7", 4], ["A7", 4]], position: 10, swing: true,
          specs: [N(1, 12, 0, 0.5), N(1, 10, 0.5, 0.5), N(2, 12, 1, 1, "br", { bend: 1 }), N(2, 10, 2, 2, "vib"),
            N(3, 9, 4, 0.5), N(3, 11, 4.5, 0.5), N(2, 10, 5, 3, "vib")] }),
        why: "A small bend that goes up and back down. A quick note, then space: the band keeps going while you wait.",
        hints: { 2: "Push the B string up just a half step (one fret's worth), then let it back down while it rings." },
      },
    ],
    listen: ["The Thrill Is Gone", "Every Day I Have the Blues", "Live at the Regal (album)"],
    practice: ["Play only five notes for a whole chorus, and make each one count.", "Hold every last note with vibrato for two full beats.", "Sing a phrase, then answer it on the guitar."],
  },
  {
    id: "hendrix", name: "Jimi Hendrix", years: "1942–1970", genre: "Rock · Blues · R&B", hands: "Pick, thumb over the neck", colour: "#b48ead",
    sound: "Rhythm and lead in one: chords that sing, with little melodies woven inside them.",
    traits: [
      { title: "Thumb over the neck", text: "He fretted bass notes on the low E string with his thumb. That left four fingers free to decorate the chord." },
      { title: "Chord embellishments", text: "Hammer-ons and slides inside a chord shape, picked up from R&B and soul guitar. The chord becomes a tune." },
      { title: "The 7♯9 chord", text: "A dominant 7th with both the major and the minor 3rd in it. Bluesy and tense, so it's often called the Hendrix chord." },
      { title: "Sound as an instrument", text: "Fuzz, wah, feedback and the whammy bar were part of the music, not just effects." },
    ],
    chords: [
      { name: "E7♯9", shape: shape([null, 7, 6, 7, 8, null], [null, 2, 1, 3, 4, null]), text: "Root on the A string. The top note, G, is the ♯9 (the minor 3rd) sitting over the G♯ major 3rd." },
      { name: "G, thumb over", shape: shape([3, 2, 0, 0, 0, 3], [5, 1, 0, 0, 0, 3]), text: "The thumb wraps over the neck to fret the low G, so your index and pinky are free for hammer-ons." },
    ],
    licks: [
      {
        lick: mk({ id: "hx-embellish", title: "Melody inside the chord", sub: "Double stops and hammer-ons inside C and G shapes.", tags: ["R&B", "Rhythm", "Hammer-ons"],
          root: "C", mode: "major", bpm: 68, style: "pop", backing: [["C", 4], ["G", 4]], position: 1,
          specs: [N(5, 3, 0, 1), N(2, 1, 1, 0.5), N(1, 0, 1, 0.5), N(2, 3, 1.5, 0.5, "h"), N(2, 1, 2, 0.5, "p"), N(3, 0, 2.5, 0.5), N(3, 2, 3, 1, "h"),
            N(6, 3, 4, 1), N(2, 0, 5, 0.5), N(1, 3, 5, 0.5), N(2, 1, 5.5, 0.5, "h"), N(2, 0, 6, 0.5, "p"), N(3, 0, 6.5, 1.5)] }),
        why: "Bass note, then a little melody on the top strings while the chord keeps ringing. Rhythm and lead at the same time.",
        hints: { 3: "Hammer your ring finger onto fret 3. Don't pick it.", 7: "Wrap your thumb over the neck for this low G.", 10: "Hammer your index onto fret 1: the G chord becomes Gsus4 for a moment." },
        thumbs: [7],
      },
      {
        lick: mk({ id: "hx-7s9", title: "7♯9 stabs, then a bend", sub: "Two short hits of E7♯9, then E minor pentatonic with a wide bend.", tags: ["Rock", "Chords", "Bends"],
          root: "E", mode: "minor-pentatonic", bpm: 96, style: "rock", backing: [["E7", 4], ["E7", 4]], position: 7,
          fingers: (_n, i) => (i < 8 ? [2, 1, 3, 4][i % 4] : undefined),
          specs: [N(5, 7, 0, 1), N(4, 6, 0, 1), N(3, 7, 0, 1), N(2, 8, 0, 1), N(5, 7, 1.5, 0.5), N(4, 6, 1.5, 0.5), N(3, 7, 1.5, 0.5), N(2, 8, 1.5, 0.5),
            N(2, 10, 2.5, 1, "bend", { bend: 2 }), N(1, 7, 3.5, 0.5), N(2, 10, 4, 0.5), N(2, 8, 4.5, 0.5), N(3, 9, 5, 0.5), N(3, 7, 5.5, 0.5), N(4, 9, 6, 0.5), N(4, 7, 6.5, 0.5), N(5, 7, 7, 1, "vib")] }),
        why: "The chord and the solo come from the same spot on the neck, so you can move between them without changing position.",
        hints: { 0: "Strum only the middle four strings: A, D, G and B.", 8: "Bend A up to B with your ring finger. Push hard: it's a whole step." },
      },
    ],
    listen: ["Little Wing", "The Wind Cries Mary", "Voodoo Child (Slight Return)", "Purple Haze"],
    practice: ["Hold a G chord and see how many hammer-ons you can add without letting go of it.", "Try fretting the low E string with your thumb. Go slowly: it takes a while.", "Switch between E7♯9 stabs and a lick in the same position."],
  },
  {
    id: "srv", name: "Stevie Ray Vaughan", years: "1954–1990", genre: "Texas blues", hands: "Heavy pick attack", colour: "#e07a5f",
    sound: "Blues played hard: heavy strings, big bends and a driving shuffle.",
    traits: [
      { title: "Dig in", text: "Very heavy strings and a hard pick attack. Even quiet notes have bite." },
      { title: "Open-string licks", text: "In E he mixes open strings with fretted notes, so licks ring and snap at the same time." },
      { title: "Big bends", text: "Bends inspired by Albert King: strong, repeated, and often a whole step or more." },
      { title: "Shuffle engine", text: "Rhythm parts that swing hard: a boogie on the bass strings with chord stabs on top." },
    ],
    chords: [
      { name: "E9", shape: shape([null, 7, 6, 7, 7, 7], [null, 2, 1, 3, 3, 3]), text: "A funky 9th chord for stabs on the off-beat. The ring finger barres the top three strings." },
      { name: "E7, open", shape: shape([0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]), text: "The home chord of a Texas shuffle in E. Low E rings while you boogie on the bass strings." },
    ],
    licks: [
      {
        lick: mk({ id: "srv-open", title: "Open-E shuffle lick", sub: "A curl on G, a run down the open strings, then a low-string boogie.", tags: ["Texas blues", "Open strings", "Shuffle"],
          root: "E", mode: "blues", bpm: 108, style: "shuffle", backing: [["E7", 4], ["E7", 4]], position: 1, swing: true,
          specs: [N(1, 3, 0, 0.5, "bend", { bend: 1, vib: false }), N(1, 0, 0.5, 0.5), N(2, 3, 1, 0.5), N(2, 0, 1.5, 0.5), N(3, 2, 2, 0.5), N(3, 0, 2.5, 0.5), N(4, 2, 3, 1, "vib"),
            N(6, 0, 4, 0.5), N(6, 3, 4.5, 0.5), N(6, 4, 5, 0.5, "h"), N(5, 2, 5.5, 0.5), N(4, 2, 6, 2, "vib")] }),
        why: "Open strings let you play fast without moving your hand. The hammer from G to G♯ is the minor-to-major blues move.",
        hints: { 0: "Push G up a half step to G♯, the major 3rd of E.", 9: "Hammer from G to G♯: ring finger on fret 3, then the pinky hammers fret 4." },
      },
      {
        lick: mk({ id: "srv-bends", title: "Repeated whole-step bends", sub: "Hit the same bend twice, then come down the box to E.", tags: ["Bends", "Aggressive"],
          root: "E", mode: "minor-pentatonic", bpm: 92, style: "rock", backing: [["E7", 4], ["E7", 4]], position: 12,
          specs: [N(2, 15, 0, 1, "bend", { bend: 2, vib: false }), N(2, 15, 1, 1, "bend", { bend: 2 }), N(1, 12, 2, 0.5), N(2, 15, 2.5, 0.5), N(2, 12, 3, 0.5), N(3, 14, 3.5, 0.5), N(4, 14, 4, 2, "vib")] }),
        why: "Repeating a bend builds tension. Release it by walking down to the root.",
        hints: { 0: "Use three fingers on the B string to push D up to E. Pick hard.", 1: "Same bend again, this time with vibrato at the top." },
      },
    ],
    listen: ["Pride and Joy", "Texas Flood", "Lenny"],
    practice: ["Play a shuffle on the low E and A strings for five minutes, keeping it swinging.", "Bend the B string up a whole step ten times. Check each one against the fretted note two frets higher.", "Mix open strings into a lick in E."],
  },
  {
    id: "page", name: "Jimmy Page", years: "b. 1944", genre: "Hard rock", hands: "Pick, riff first", colour: "#d9c26a",
    sound: "Songs built on riffs, solos with fast repeating patterns and a loose, swaggering feel.",
    traits: [
      { title: "Riff first", text: "Many songs start from one guitar riff on the low strings. The whole band locks to it." },
      { title: "Repeating pull-off triplets", text: "A short pull-off figure repeated faster and faster in the pentatonic box. It sounds wild but it's one shape." },
      { title: "Light and shade", text: "Heavy electric riffs next to acoustic parts, sometimes in open tunings." },
      { title: "Layers", text: "Several guitar parts stacked in the studio, like an orchestra of guitars." },
    ],
    chords: [
      { name: "A5", shape: shape([5, 7, 7, null, null, null], [1, 3, 4, null, null, null]), text: "Root, 5th and octave. No 3rd, so it's neither major nor minor, and it stays clear with distortion." },
      { name: "Dsus4", shape: shape([null, null, 0, 2, 3, 3], [null, null, 0, 1, 3, 4]), text: "A suspended chord that wants to move back to D. Good for ringing acoustic parts." },
    ],
    licks: [
      {
        lick: mk({ id: "page-triplets", title: "Pull-off triplet loop", sub: "One three-note shape, repeated in triplets, then a bend home.", tags: ["Rock", "Pull-offs", "Speed"],
          root: "A", mode: "minor-pentatonic", bpm: 92, style: "rock", backing: [["Am", 4], ["Am", 4]], position: 5,
          specs: [0, 1, 2, 3].flatMap((k) => [N(1, 8, k, 1 / 3), N(1, 5, k + 1 / 3, 1 / 3, "p"), N(2, 8, k + 2 / 3, 1 / 3)])
            .concat([N(2, 5, 4, 0.5), N(3, 7, 4.5, 1, "bend", { bend: 2 }), N(3, 5, 5.5, 0.5), N(4, 7, 6, 2, "vib")]) }),
        why: "Fast runs are often one small shape repeated. Get the shape even, then speed it up.",
        hints: { 1: "Pull off: flick the string with your pinky as you lift it, so fret 5 sounds without picking." },
      },
      {
        lick: mk({ id: "page-riff", title: "Riff on the low strings", sub: "Single notes, a hammer-on, then power-chord stabs.", tags: ["Riff", "Power chords"],
          root: "A", mode: "minor-pentatonic", bpm: 100, style: "rock", backing: [["Am", 4], ["Am", 4]], position: 5,
          fingers: (n, i) => ([4, 6, 8, 14].includes(i) ? 1 : [5, 7, 9, 15].includes(i) ? 3 : n.fret === 3 ? 1 : undefined),
          specs: [N(6, 5, 0, 0.5), N(6, 8, 0.5, 0.5), N(5, 5, 1, 0.5), N(5, 7, 1.5, 0.5, "h"), N(6, 5, 2, 1), N(5, 7, 2, 1), N(6, 3, 3, 0.5), N(5, 5, 3, 0.5), N(6, 3, 3.5, 0.5), N(5, 5, 3.5, 0.5),
            N(6, 5, 4, 0.5), N(6, 8, 4.5, 0.5), N(5, 5, 5, 0.5), N(5, 7, 5.5, 0.5, "h"), N(6, 5, 6, 2), N(5, 7, 6, 2)] }),
        why: "A riff is short and repeats, so the band can lock to it. Single notes answered by power chords give it punch.",
        hints: { 4: "A5 power chord: index on fret 5, ring finger on fret 7 of the A string.", 6: "Slide the same shape down two frets for G5." },
      },
    ],
    listen: ["Whole Lotta Love", "Heartbreaker", "Since I've Been Loving You", "Stairway to Heaven"],
    practice: ["Write a one-bar riff on the low E and A strings and loop it for a minute.", "Play the triplet loop with a metronome at 60, then 80, then 100.", "Play the same lick heavy, then soft and clean."],
  },
  {
    id: "gilmour", name: "David Gilmour", years: "b. 1946", genre: "Progressive rock", hands: "Pick, slow and singing", colour: "#6fa8dc",
    sound: "Slow, singing bends and lots of space. Every note feels chosen.",
    traits: [
      { title: "Bends in perfect tune", text: "Slow bends that arrive exactly on pitch, sometimes bent before picking and then released." },
      { title: "Space", text: "Long notes, rests and echo. The silence is part of the melody." },
      { title: "Melody first", text: "Solos you could sing back, built from the minor pentatonic with a few extra notes." },
      { title: "Echo and sustain", text: "Delay and smooth sustain make a few notes fill a big room." },
    ],
    chords: [
      { name: "Em7", shape: shape([0, 2, 2, 0, 3, 3], [0, 1, 2, 0, 3, 4]), text: "Open, ringing E minor with D and G on top. Ring and pinky stay put on the B and e strings." },
      { name: "Cadd9", shape: shape([null, 3, 2, 0, 3, 3], [null, 2, 1, 0, 3, 4]), text: "Keep ring and pinky where they were and move the other two fingers. The top notes ring through the change." },
    ],
    licks: [
      {
        lick: mk({ id: "dg-slow", title: "Slow bend, let it sing", sub: "A long bend to E, then a bend to B over C. Lots of space.", tags: ["Melodic", "Bends", "Space"],
          root: "E", mode: "minor-pentatonic", bpm: 64, style: "rock", backing: [["Em", 4], ["C", 4]], position: 12,
          specs: [N(2, 15, 0, 2, "bend", { bend: 2 }), N(1, 12, 2, 0.5), N(2, 15, 2.5, 0.5), N(2, 12, 3, 1, "vib"),
            N(3, 14, 4, 1.5, "bend", { bend: 2 }), N(3, 12, 5.5, 0.5), N(4, 14, 6, 2, "vib")] }),
        why: "Only seven notes in two bars. Each bend takes its time and lands right on pitch.",
        hints: { 0: "Bend slowly over a whole beat. Listen for E, then add a gentle vibrato.", 4: "Over C, the bend to B is the major 7th. It sounds dreamy." },
      },
      {
        lick: mk({ id: "dg-release", title: "Bend, release, wait", sub: "Bend and release, a rest, then one high note.", tags: ["Bend and release", "Space"],
          root: "E", mode: "minor-pentatonic", bpm: 64, style: "rock", backing: [["G", 4], ["D", 4]], position: 12,
          specs: [N(2, 15, 0, 1, "br", { bend: 2 }), N(2, 12, 1, 1), N(1, 15, 3, 1, "vib"), N(1, 12, 4, 0.5), N(2, 15, 4.5, 3.5, "vib")] }),
        why: "The rest on beat 3 matters as much as the notes. Let the echo fill it.",
        hints: { 0: "Bend up a whole step, then slowly let it back down to D." },
      },
    ],
    listen: ["Comfortably Numb", "Shine On You Crazy Diamond", "Time"],
    practice: ["Play a solo with no more than one note per beat.", "Bend, then check the pitch against the fretted note. Fix it if it's off.", "Play a phrase, then rest for as long as it lasted."],
  },
  {
    id: "knopfler", name: "Mark Knopfler", years: "b. 1949", genre: "Rock · Roots", hands: "Fingers, no pick", colour: "#81b29a",
    sound: "Clean, snappy notes plucked with the fingers, with country rolls and double stops.",
    traits: [
      { title: "No pick", text: "Thumb, index and middle finger. Pulling and snapping the strings gives a bright, percussive attack." },
      { title: "Triads on top", text: "Small three-note chord shapes on the top strings, broken into rolling patterns." },
      { title: "Double stops", text: "Pairs of notes that slide into place, borrowed from country and rockabilly." },
      { title: "Lyrical lines", text: "Major-key melodies with hammer-ons and pull-offs, played clean." },
    ],
    chords: [
      { name: "D triad (7th fret)", shape: shape([null, null, null, 7, 7, 5], [null, null, null, 2, 3, 1]), text: "D, F♯ and A on the top three strings. Pluck them with thumb, index and middle." },
      { name: "G triad (7th fret)", shape: shape([null, null, null, 7, 8, 7], [null, null, null, 1, 2, 1]), text: "Move one note and the D triad becomes G. These two shapes go together a lot." },
    ],
    licks: [
      {
        lick: mk({ id: "mk-roll", title: "Thumb-and-fingers roll", sub: "Rolling triads over D and G, with a hammer-on flick.", tags: ["Fingerstyle", "Triads"],
          root: "D", mode: "major-pentatonic", bpm: 96, style: "pop", backing: [["D", 4], ["G", 4]], position: 5,
          specs: [N(3, 7, 0, 0.5), N(2, 7, 0.5, 0.5), N(1, 5, 1, 0.5), N(2, 7, 1.5, 0.5), N(3, 7, 2, 0.5), N(1, 5, 2.5, 0.5), N(1, 7, 3, 0.5, "h"), N(1, 5, 3.5, 0.5, "p"),
            N(3, 7, 4, 0.5), N(2, 8, 4.5, 0.5), N(1, 7, 5, 0.5), N(2, 8, 5.5, 0.5), N(3, 7, 6, 2, "vib")] }),
        why: "Thumb on the G string, index on B, middle on e. The pattern rolls so the triad rings like a harp.",
        hints: { 0: "Thumb plays the G string.", 1: "Index finger plays the B string.", 2: "Middle finger plays the high e string.", 6: "Hammer onto fret 7: a quick flick up to B." },
      },
      {
        lick: mk({ id: "mk-thirds", title: "Sliding double stops", sub: "Pairs of notes on the G and B strings slide up to D.", tags: ["Double stops", "Country"],
          root: "D", mode: "major", bpm: 96, style: "pop", backing: [["D", 4], ["D", 4]], position: 4,
          fingers: (n, i) => {
            const pair = i % 2 === 0 ? i + 1 : i - 1;
            const g = n.string === 3 ? n.fret : MK_THIRDS[pair]![1];
            const b = n.string === 2 ? n.fret : MK_THIRDS[pair]![1];
            if (g === b) return n.string === 3 ? 2 : 3;
            return n.string === 2 ? 1 : 2;
          },
          specs: MK_THIRDS.map(([s, f, b, d, t]) => N(s, f, b, d, t)) }),
        why: "Two notes moving together sound fuller than one. Sliding into them gives the country twang.",
        hints: { 2: "Slide both fingers up two frets together. Keep the pressure on.", 4: "D and F♯: the root and 3rd of D." },
      },
    ],
    listen: ["Sultans of Swing", "Brothers in Arms", "Money for Nothing"],
    practice: ["Put the pick down for a week. Thumb on the low strings, index and middle on top.", "Roll a D triad, then a G triad, in a steady loop.", "Slide pairs of notes on the G and B strings up and down the D major scale."],
  },
  {
    id: "evh", name: "Eddie Van Halen", years: "1955–2020", genre: "Hard rock", hands: "Pick plus tapping", colour: "#e48aa8",
    sound: "Playful, explosive rock: two-hand tapping, legato speed and a huge, warm tone.",
    traits: [
      { title: "Two-hand tapping", text: "A picking-hand finger hammers notes onto the fretboard, so huge stretches become easy and fast." },
      { title: "Legato", text: "Lots of hammer-ons and pull-offs: notes flow smoothly without picking each one." },
      { title: "Harmonics and the whammy bar", text: "Chiming harmonics and dive bombs as part of the phrasing." },
      { title: "Rhythm with attitude", text: "Power chords mixed with open strings and little fills between them." },
    ],
    chords: [
      { name: "E5", shape: shape([0, 2, 2, null, null, null], [0, 1, 2, null, null, null]), text: "Open-string power chord. Palm-mute it and add quick fills in the gaps." },
      { name: "A5 (with octave)", shape: shape([5, 7, 7, null, null, null], [1, 3, 4, null, null, null]), text: "The movable power chord: root on the low E string, 5th and octave above it." },
    ],
    licks: [
      {
        lick: mk({ id: "evh-tap", title: "Tapped arpeggios", sub: "Tap, pull off, hammer on, all on the B string, through Am, F and G.", tags: ["Tapping", "Arpeggios", "Legato"],
          root: "A", mode: "minor", bpm: 84, style: "rock", backing: [["Am", 2], ["F", 2], ["G", 4]], position: 5,
          fingers: (n) => (n.technique === "pull_off" ? 1 : n.fret === 10 || n.fret === 12 ? 4 : undefined),
          specs: [
            ...[0, 1].flatMap((k) => [N(2, 13, k, 1 / 3, k ? "h" : ""), N(2, 5, k + 1 / 3, 1 / 3, "p"), N(2, 10, k + 2 / 3, 1 / 3, "h")]),
            ...[2, 3].flatMap((k) => [N(2, 13, k, 1 / 3, "h"), N(2, 6, k + 1 / 3, 1 / 3, "p"), N(2, 10, k + 2 / 3, 1 / 3, "h")]),
            ...[4, 5, 6].flatMap((k) => [N(2, 15, k, 1 / 3, "h"), N(2, 8, k + 1 / 3, 1 / 3, "p"), N(2, 12, k + 2 / 3, 1 / 3, "h")]),
            N(2, 15, 7, 1, "vib"),
          ] }),
        why: "Each group of three notes is a chord: E A C is A minor, F A C is F, G B D is G. Tapping makes the big jumps easy.",
        taps: [0, 3, 6, 9, 12, 15, 18, 21],
        hints: { 0: "Tap fret 13 with your picking hand's middle finger. Hold the pick against your palm.", 1: "Pull the tapping finger off sideways so fret 5 sounds. Your index is already on fret 5.", 2: "Hammer your fretting hand's pinky onto fret 10.", 7: "F: index moves to fret 6. Same tap and hammer.", 13: "G: move your fretting hand up so your index is on fret 8, pinky on fret 12." },
      },
      {
        lick: mk({ id: "evh-legato", title: "Legato cascade", sub: "Sixteenth notes down the box with pull-offs, then a bend.", tags: ["Legato", "Speed"],
          root: "A", mode: "minor-pentatonic", bpm: 88, style: "rock", backing: [["Am", 4], ["Am", 4]], position: 5,
          specs: [0, 1].flatMap((k) => [N(1, 8, k, 0.25), N(1, 5, k + 0.25, 0.25, "p"), N(2, 8, k + 0.5, 0.25), N(2, 5, k + 0.75, 0.25, "p")])
            .concat([N(3, 7, 2, 0.25), N(3, 5, 2.25, 0.25, "p"), N(4, 7, 2.5, 0.25), N(4, 5, 2.75, 0.25, "p"), N(3, 7, 3, 1, "bend", { bend: 2 }), N(2, 5, 4, 0.5), N(1, 5, 4.5, 3.5, "vib")]) }),
        why: "Only every other note is picked. The pull-offs let the run flow faster than picking every note.",
        hints: { 1: "Pull off from your pinky to your index finger. Don't pick." },
      },
    ],
    listen: ["Eruption", "Ain't Talkin' 'bout Love", "Panama"],
    practice: ["Tap on one string first: tap, pull off, hammer on, slowly and evenly.", "Rest your picking hand's palm on the strings you aren't playing, so they stay quiet.", "Play the legato run with pull-offs only, then with every note picked. Compare."],
  },
  {
    id: "wes", name: "Wes Montgomery", years: "1923–1968", genre: "Jazz", hands: "Thumb only", colour: "#a68bd8",
    sound: "Warm, round jazz lines played with the thumb, melodies in octaves, and chord-tone phrasing.",
    traits: [
      { title: "Thumb, no pick", text: "Every note is played with the side of the thumb, which gives a soft, round tone." },
      { title: "Octaves", text: "The melody is doubled an octave higher, on two strings with one string between them that you mute." },
      { title: "Solos in three stages", text: "Single notes first, then octaves, then block chords. Each stage makes the solo bigger." },
      { title: "Chord tones", text: "Lines that outline each chord of a ii–V–I, with chromatic approach notes into the target." },
    ],
    chords: [
      { name: "Dm7", shape: shape([null, 5, 7, 5, 6, 5], [null, 1, 3, 1, 2, 1]), text: "The ii chord of C: D, A, C, F and A. Index finger barre at fret 5." },
      { name: "G7 (shell)", shape: shape([3, null, 3, 4, null, null], [2, null, 3, 4, null, null]), text: "Just the root, 7th and 3rd. Jazz players often leave the rest out." },
      { name: "Cmaj7", shape: shape([null, 3, 5, 4, 5, null], [null, 1, 3, 2, 4, null]), text: "The I chord, with B (the major 7th) on the G string. Soft and settled." },
    ],
    licks: [
      {
        lick: mk({ id: "wes-octaves", title: "Melody in octaves", sub: "Each note doubled on the D and B strings, over ii–V–I in C.", tags: ["Jazz", "Octaves", "Thumb"],
          root: "C", mode: "major", bpm: 120, style: "shuffle", backing: [["Dm7", 2], ["G7", 2], ["Cmaj7", 4]], position: 3, swing: true,
          fingers: (n) => (n.string === 4 ? 1 : 3),
          specs: [
            N(4, 7, 0, 1), N(2, 10, 0, 1), N(4, 5, 1, 0.5), N(2, 8, 1, 0.5), N(4, 3, 1.5, 0.5), N(2, 6, 1.5, 0.5),
            N(4, 9, 2, 1), N(2, 12, 2, 1), N(4, 7, 3, 0.5), N(2, 10, 3, 0.5), N(4, 5, 3.5, 0.5), N(2, 8, 3.5, 0.5),
            N(4, 2, 4, 4), N(2, 5, 4, 4, "vib"),
          ] }),
        why: "Two notes an octave apart sound like one big note. Mute the G string between them with the underside of your index finger.",
        hints: { 0: "Index finger on the D string, ring finger three frets higher on the B string. Strum all three strings with your thumb: the G string is muted." },
      },
      {
        lick: mk({ id: "wes-line", title: "Chord-tone line into the 3rd", sub: "Arpeggiate Dm7, then G7, and slide chromatically onto E.", tags: ["Jazz", "Arpeggios", "Chromatic"],
          root: "C", mode: "major", bpm: 120, style: "shuffle", backing: [["Dm7", 2], ["G7", 2], ["Cmaj7", 4]], position: 3, swing: true,
          specs: [N(5, 5, 0, 0.5), N(4, 3, 0.5, 0.5), N(4, 7, 1, 0.5), N(3, 5, 1.5, 0.5), N(3, 4, 2, 0.5), N(2, 3, 2.5, 0.5), N(2, 6, 3, 0.5), N(2, 4, 3.5, 0.5), N(2, 5, 4, 4, "vib")] }),
        why: "D F A C is Dm7, then B D F is G7. D♯ is a chromatic step into E, the 3rd of Cmaj7, right where the chord changes.",
        hints: { 7: "D♯ isn't in the key. It's a passing note that leans into E.", 8: "Land on E right on beat 1 of Cmaj7." },
      },
    ],
    listen: ["Four on Six", "West Coast Blues", "The Incredible Jazz Guitar of Wes Montgomery (album)"],
    practice: ["Play a melody you know in octaves on the D and B strings.", "Play only chord tones over Dm7–G7–Cmaj7 for a few minutes.", "Use your thumb, no pick, for a whole practice session."],
  },
];

/* --------------------------------------------------------------- helpers */

export const GREATS_BY_ID: Record<string, Great> = Object.fromEntries(GREATS.map((g) => [g.id, g]));

/** Notes grouped by start beat: one step per pick (a double stop or chord is one step). */
export function lickSteps(notes: PlayableNote[]): number[][] {
  const steps: number[][] = [];
  notes.forEach((n, i) => {
    const last = steps[steps.length - 1];
    if (last && Math.abs(notes[last[0]!]!.start_beat - n.start_beat) < 1e-6) last.push(i);
    else steps.push([i]);
  });
  return steps;
}

const FINGER = ["", "index", "middle", "ring", "pinky"];
const STRING = ["", "high e", "B", "G", "D", "A", "low E"];

/** Plain-language instruction for one note of a lick. */
export function howToPlay(notes: PlayableNote[], i: number, extra?: GreatLick): string {
  const n = notes[i]!;
  if (extra?.hints?.[i]) return extra.hints[i]!;
  if (extra?.taps?.includes(i)) return `Tap fret ${n.fret} with a picking-hand finger.`;
  if (extra?.thumbs?.includes(i)) return `${STRING[n.string]} string, fret ${n.fret} with your thumb over the neck.`;
  const where = `${STRING[n.string]} string, ${n.fret === 0 ? "open" : `fret ${n.fret}`}`;
  const who = n.fret === 0 ? "" : ` with your ${FINGER[n.finger ?? 1] || "index"} finger`;
  switch (n.technique) {
    case "bend": return `${where}: pick it, then bend up ${n.bend_semitones === 1 ? "a half step" : "a whole step"}${who}.`;
    case "bend_release": return `${where}: bend up ${n.bend_semitones === 1 ? "a half step" : "a whole step"}, then let it back down.`;
    case "hammer_on": return `${where}: hammer on${who}. Don't pick.`;
    case "pull_off": return `${where}: pull off to this note. Flick the string as the finger above lifts.`;
    case "slide_up": case "slide_down": return `${where}: slide ${n.technique === "slide_up" ? "up" : "down"} from fret ${n.slide_from_fret} without lifting.`;
    default: return `${where}${who}${n.vibrato ? ", with vibrato" : ""}.`;
  }
}

/** Sanity data used by tests: fret → pitch. */
export const pitchAt = (string: number, fret: number) => STANDARD_TUNING[string]! + fret;
