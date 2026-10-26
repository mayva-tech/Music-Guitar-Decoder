/**
 * "Play any song by ear" content for Music Decoder.
 *
 * Pure data + small builders. No DOM, no audio, no React.
 * Location: frontend/src/lib/theory/ear.ts (next to content.ts from the Theory map).
 * Reuses the Theory map's event model, visuals and player, so the same components render it.
 *
 * Time is in BEATS. MIDI 60 = C4. Standard tuning, string 1 = high E (TAB order).
 */
import {
  BASS_ROOT, CHORD_VOICINGS, OPEN_STRING_MIDI, fretExample, gridExample, noteName,
  type BlockItem, type BlockRow, type DotRole, type FretDot, type GridRowSpec, type Lane, type StringNo,
  type TheoryEvent, type TheoryExample,
} from "./content";

/* ------------------------------------------------------------------ types */

/** Sound without a visual. The player only needs these three fields. */
export type Sound = Pick<TheoryExample, "bpm" | "lengthBeats" | "events">;

export interface EarStep {
  id: string;
  lane: Lane;
  title: string;
  why: string;
  how: string[];
  /** Extra block rendered under the "how" list. */
  extra?: "keyChart" | "tapTempo";
  examples: TheoryExample[];
}
export interface WorkedStage { title: string; text: string; examples: TheoryExample[] }
export interface WorkedSong { id: string; title: string; meta: string; stages: WorkedStage[] }

export interface DrillQuestion {
  /** Audition buttons. The user can play these as often as they like. */
  listen: { label: string; sub: string; sound: Sound }[];
  /** Exactly one option is correct. */
  options: { label: string; correct: boolean }[];
  /** Shown after answering, after "Correct." or "Not this time." */
  explanation: string;
}
export type Rng = () => number; // returns [0, 1), like Math.random
export interface Drill {
  id: string;
  lane: Lane;
  title: string;
  prompt: string;
  generate(rng?: Rng): DrillQuestion;
}

/* ----------------------------------------------------- chords and helpers */

/** Theory map voicings plus the extra chords this guide needs. */
export const EAR_VOICINGS: Record<string, number[]> = {
  ...CHORD_VOICINGS,
  D: [50, 57, 62, 66], // xx0232
  A: [45, 52, 57, 61, 64], // x02220
  Bm: [47, 54, 59, 62, 66], // x24432
  E: [40, 47, 52, 56, 59, 64], // 022100
};
export const EAR_ROOTS: Record<string, number> = { ...BASS_ROOT, Cm: 36, D: 38, A: 45, Bm: 47, E: 40 };

const dot = (string: StringNo, fret: number, role: DotRole = "", label?: string): FretDot => {
  const midi = OPEN_STRING_MIDI[string] + fret;
  return { string, fret, midi, name: noteName(midi), role, label };
};
const human = (k: number) => 0.85 + 0.15 * (((k * 37) % 10) / 10);
function strum(ev: TheoryEvent[], notes: number[], beat: number, beats: number, velocity: number, down = true) {
  const ns = down ? notes : notes.slice(-4).reverse();
  ns.forEach((midi, k) => ev.push({ kind: "pluck", midi, beat: beat + k * 0.03, beats: Math.max(beats - k * 0.03, 0.25), velocity: velocity * 0.45 * human(k) }));
}

type ProgItem = [chord: string, numeral: string, beats: number];
/** Strummed chords shown as blocks. Lights `b_<i>`. Same as the Theory map's, with EAR_VOICINGS. */
export function chordsExample(label: string, sub: string, items: ProgItem[], bpm = 92, o: { every?: number; topNote?: number } = {}): TheoryExample {
  const events: TheoryEvent[] = [];
  const blocks: BlockItem[] = [];
  const every = o.every ?? 2;
  let t = 0;
  items.forEach(([c, num, beats], i) => {
    const highlight = `b_${i}`;
    for (let s = 0; s < beats - 0.01; s += every) {
      const last = s + every >= beats - 0.01;
      strum(events, EAR_VOICINGS[c], t + s, Math.min(every, beats - s) + (last ? 0.6 : 0), s === 0 ? 1 : 0.75);
    }
    events.push({ kind: "highlight", beat: t, beats, velocity: 0, highlight });
    if (o.topNote) events.push({ kind: "pluck", midi: o.topNote, beat: t + 0.02, beats, velocity: 1, timbre: "bright" });
    blocks.push({ beat: t, beats, label: c, sub: num, highlight });
    t += beats;
  });
  const rows: BlockRow[] = [{ name: "Chords", items: blocks }];
  if (o.topNote) rows.unshift({ name: "Melody", items: blocks.map((b) => ({ beat: b.beat, beats: b.beats, label: noteName(o.topNote!), highlight: b.highlight })) });
  return { label, sub, bpm, lengthBeats: t, events, visual: { type: "blocks", lengthBeats: t, rows } };
}

/** gridExample plus rows that strum a chord on each hit (`chord` set). */
export function strumGridExample(label: string, sub: string, bpm: number, stepsPerBeat: number, rows: (GridRowSpec & { chord?: string })[], o: { stepsPerBar?: number; loops?: number } = {}): TheoryExample {
  const base = gridExample(label, sub, bpm, stepsPerBeat, rows.map((r) => (r.chord ? { ...r, kind: "highlight" as const } : r)), o);
  const events: TheoryEvent[] = [];
  for (const e of base.events) {
    const row = Number(/^g(\d+)_/.exec(e.highlight ?? "")?.[1] ?? -1);
    const chord = rows[row]?.chord;
    if (chord && e.kind === "highlight") {
      strum(events, EAR_VOICINGS[chord], e.beat, Math.max(e.beats, 0.75), Math.max(e.velocity, 0.3) * 1.1);
      events.push({ ...e, velocity: 0 }); // keep the silent highlight
    } else events.push(e);
  }
  return { ...base, events };
}

/* ---- songs whose bars can be any length and change chord inside a bar ---- */
export interface EarBar {
  /** Beats in this bar; defaults to the song's beats per bar. Use 1 for a pickup. */
  length?: number;
  chords?: ProgItem[];
  melody?: [midi: number, beats: number][];
}
interface Seg { beat: number; beats: number; label: string; sub?: string; chord?: string }
interface EarLayer {
  name: string;
  segments: (bar: EarBar, barBeats: number) => Seg[];
  sound: (seg: Seg, at: number, bar: EarBar, barBeats: number) => TheoryEvent[];
}
const chordSegs = (b: EarBar): Seg[] => {
  let t = 0;
  return (b.chords ?? []).map(([chord, num, d]) => { const s = { beat: t, beats: d, label: chord, sub: num, chord }; t += d; return s; });
};
export const melodyLayer = (): EarLayer => ({
  name: "Melody",
  segments: (b, bl) => (b.melody?.some((n) => n[0] > 0) ? [{ beat: 0, beats: bl, label: b.melody.filter((n) => n[0] > 0).map((n) => noteName(n[0])).join(" ") }] : []),
  sound: (_s, at, b) => { const ev: TheoryEvent[] = []; let x = 0; for (const [midi, d] of b.melody ?? []) { if (midi > 0) ev.push({ kind: "pluck", midi, beat: at + x, beats: d, velocity: 1, timbre: "bright" }); x += d; } return ev; },
});
export const bassLayer = (): EarLayer => ({
  name: "Bass",
  segments: (b) => chordSegs(b).map((s) => ({ ...s, label: noteName(EAR_ROOTS[s.chord!]), sub: undefined })),
  sound: (s, at) => [{ kind: "bass", midi: EAR_ROOTS[s.chord!], beat: at, beats: s.beats, velocity: 0.9 }],
});
export const chordLayer = (style: "block" | "beats" | "waltz" = "block"): EarLayer => ({
  name: "Chords",
  segments: (b) => chordSegs(b),
  sound: (s, at) => {
    const ev: TheoryEvent[] = [];
    const ns = EAR_VOICINGS[s.chord!];
    if (style === "waltz") { strum(ev, ns, at, 1, 0.8); for (let x = 1; x < s.beats; x++) strum(ev, ns.slice(-3), at + x, 1, 0.5); }
    else if (style === "beats") { for (let x = 0; x < s.beats; x++) strum(ev, ns, at + x, 1.05, x === 0 ? 0.8 : 0.6); }
    else strum(ev, ns, at, s.beats + 0.3, 0.8);
    return ev;
  },
});
/** Held pure tone under everything (an "organ" drone) to test a home note. */
export const droneLayer = (midi: number): EarLayer => ({
  name: "Drone",
  segments: (_b, bl) => [{ beat: 0, beats: bl, label: noteName(midi) }],
  sound: (s, at) => [{ kind: "organ", midi, beat: at, beats: s.beats, velocity: 0.85 }],
});
/** Metronome; beat 1 of a 3- or 4-beat bar is accented. */
export const countLayer = (): EarLayer => ({
  name: "Count",
  segments: (_b, bl) => [{ beat: 0, beats: bl, label: "" }],
  sound: (_s, at, _b, bl) => Array.from({ length: bl }, (_, x) => ({ kind: "click" as const, beat: at + x, beats: 0.2, velocity: (bl === 3 || bl === 4) && x === 0 ? 1 : 0.6 })),
});
/** Layered example shown as rows of blocks. Lights `L<layer>_<bar>_<segment>`. */
export function barsExample(label: string, sub: string, bpm: number, bars: EarBar[], layers: EarLayer[], o: { beatsPerBar?: number } = {}): TheoryExample {
  const bpb = o.beatsPerBar ?? 4;
  const events: TheoryEvent[] = [];
  const rows: BlockRow[] = [];
  let t = 0;
  const starts = bars.map((b) => { const s = t; t += b.length ?? bpb; return s; });
  const lengthBeats = t;
  layers.forEach((L, li) => {
    const items: BlockItem[] = [];
    bars.forEach((b, bi) => {
      const bl = b.length ?? bpb;
      L.segments(b, bl).forEach((sg, si) => {
        const at = starts[bi] + sg.beat;
        const highlight = `L${li}_${bi}_${si}`;
        events.push(...L.sound(sg, at, b, bl), { kind: "highlight", beat: at, beats: sg.beats, velocity: 0, highlight });
        items.push({ beat: at, beats: sg.beats, label: sg.label, sub: sg.sub, highlight });
      });
    });
    rows.push({ name: L.name, items });
  });
  return { label, sub, bpm, lengthBeats, events, visual: { type: "blocks", lengthBeats, rows } };
}

/* ------------------------------------------------------------- material */

const TW_DOTS = [dot(2, 1, "root"), dot(2, 3), dot(1, 0, "third"), dot(1, 1), dot(1, 3), dot(1, 5)]; // C D E F G A
const TW_MINOR = [dot(2, 1, "root"), dot(2, 3), dot(2, 4, "third", "E♭"), dot(1, 1), dot(1, 3), dot(1, 4, "", "A♭")];
type FretStep = [number | number[], number, number?];
const TWINKLE: FretStep[] = [[0, 1], [0, 1], [4, 1], [4, 1], [5, 1], [5, 1], [4, 2], [3, 1], [3, 1], [2, 1], [2, 1], [1, 1], [1, 1], [0, 2]];
export const TWINKLE_BARS: EarBar[] = [
  { chords: [["C", "I", 4]], melody: [[60, 1], [60, 1], [67, 1], [67, 1]] },
  { chords: [["F", "IV", 2], ["C", "I", 2]], melody: [[69, 1], [69, 1], [67, 2]] },
  { chords: [["F", "IV", 2], ["C", "I", 2]], melody: [[65, 1], [65, 1], [64, 1], [64, 1]] },
  { chords: [["G", "V", 2], ["C", "I", 2]], melody: [[62, 1], [62, 1], [60, 2]] },
];
export const AMAZING_GRACE_BARS: EarBar[] = [
  { length: 1, melody: [[62, 1]] }, // pickup
  { chords: [["G", "I", 3]], melody: [[67, 2], [71, 0.5], [67, 0.5]] },
  { chords: [["G", "I", 3]], melody: [[71, 2], [69, 1]] },
  { chords: [["C", "IV", 3]], melody: [[67, 2], [64, 1]] },
  { chords: [["G", "I", 3]], melody: [[62, 2], [62, 1]] },
  { chords: [["G", "I", 3]], melody: [[67, 2], [71, 0.5], [67, 0.5]] },
  { chords: [["G", "I", 3]], melody: [[71, 2], [69, 1]] },
  { chords: [["D", "V", 3]], melody: [[74, 3]] },
];
const AG_RESOLVED: EarBar[] = [...AMAZING_GRACE_BARS, { chords: [["G", "I", 3]], melody: [[67, 3]] }];
const HOME_DOTS = [dot(3, 0, "root"), dot(3, 2), dot(2, 0), dot(2, 1), dot(2, 3)]; // G A B C D
const HOME_PHRASE: FretStep[] = [[0, 1], [1, 0.5], [2, 0.5], [4, 1], [3, 0.5], [2, 0.5], [1, 1], [4, 2]];
const G_MAJOR = [dot(6, 3, "root", "G"), dot(5, 2, "third", "B"), dot(4, 0, "", "D")];
const G_MINOR = [dot(6, 3, "root", "G"), dot(5, 1, "third", "B♭"), dot(4, 0, "", "D")];
const ARPEGGIO: FretStep[] = [[0, 1], [1, 1], [2, 1], [1, 1], [0, 1], [[0, 1, 2], 3]];

/* ------------------------------------------------------------- the method */

export const EAR_STEPS: EarStep[] = [
  {
    id: "listen", lane: "song", title: "Listen, loop and sing it first",
    why: "If you can sing it, you can find it. Your voice tells you where the notes go before your fingers do.",
    how: ["Loop one short section, a line or two, not the whole song.", "If it's fast, slow it to 70–75%. Most players can change speed without changing pitch.", "Hum the melody, then the bass line. If you can't hum it yet, listen again before you pick up the guitar."],
    examples: [
      fretExample("Full speed", "Twinkle, Twinkle at 100 BPM.", TW_DOTS, TWINKLE, 100),
      fretExample("Slowed to 70%", "Same pitch, more time to hear each note.", TW_DOTS, TWINKLE, 70),
    ],
  },
  {
    id: "home", lane: "pitch", title: "Find the home note",
    why: "Every song has one note where it feels at rest. That note names the key, and you measure everything else from it.",
    how: ["Listen to where the chorus, or the whole song, ends. The last bass note is usually home.", "Play single notes on the low E or A string along with the song. Home is the note that never sounds wrong and feels finished.", "Phrases often stop on other notes. Those endings sound like they're waiting for something."],
    examples: [
      fretExample("The phrase", "It stops on D and feels like it's waiting.", HOME_DOTS, HOME_PHRASE, 104),
      fretExample("…then G", "Settled. G is home.", HOME_DOTS, [...HOME_PHRASE, [0, 3]], 104),
      fretExample("…then C", "Not finished. It wants to keep going.", HOME_DOTS, [...HOME_PHRASE, [3, 3]], 104),
      fretExample("…then A", "Hanging in the air. Not home.", HOME_DOTS, [...HOME_PHRASE, [1, 3]], 104),
    ],
  },
  {
    id: "mode", lane: "pitch", title: "Decide major or minor",
    why: "The 3rd above home sets the mood, and it tells you which family of chords to expect.",
    how: ["Play home, then the note 4 frets up (major 3rd), then 3 frets up (minor 3rd), along with the song.", "The one that blends is right. Bright songs are usually major; dark or serious songs are minor.", "Major key: expect I, IV, V and vi. Minor key: expect i, iv, ♭VI and ♭VII, and sometimes V."],
    examples: [
      fretExample("G major: the 3rd is 4 frets up", "Bright. B is the major 3rd.", G_MAJOR, ARPEGGIO, 92, { muted: [3, 2, 1], legend: "chord" }),
      fretExample("G minor: the 3rd is 3 frets up", "Darker. B♭ is the minor 3rd.", G_MINOR, ARPEGGIO, 92, { muted: [3, 2, 1], legend: "chord" }),
      fretExample("A tune in major", "Twinkle, Twinkle as written. E is the major 3rd of C.", TW_DOTS, TWINKLE, 100),
      fretExample("The same tune in minor", "E and A each drop one fret. The mood flips.", TW_MINOR, TWINKLE, 100),
    ],
  },
  {
    id: "bass", lane: "chords", title: "Follow the bass to find the chord roots",
    why: "The bass usually plays the root of each chord. Find the bass note and you have the chord's letter name.",
    how: ["Listen for the lowest note at each change, usually on beat 1.", "Match it on the low E or A string. Write down only the letter for now.", "Count how long each chord lasts: a whole bar, two bars, or half a bar."],
    examples: [
      barsExample("Bass line alone", "Twinkle, Twinkle: C | F C | F C | G C", 100, TWINKLE_BARS, [bassLayer()]),
      barsExample("Bass under the melody", "Hum along with the low notes.", 100, TWINKLE_BARS, [melodyLayer(), bassLayer()]),
    ],
  },
  {
    id: "chords", lane: "chords", title: "Fill in the chords from the key's family",
    why: "Songs mostly use the chords that belong to their key. Once you know the key, there are only about six chords to try.",
    how: ["Find the key's row in the chart below. Try I, IV, V and vi first (highlighted).", "If the bass plays A in C major, try Am (vi) before A major.", "Check against the melody: the note on beat 1 is usually one of the chord's notes."],
    extra: "keyChart",
    examples: [
      chordsExample("One melody note, three chords", "F sits inside F and Dm. Over C it rubs against the chord's E.", [["C", "I", 4], ["F", "IV", 4], ["Dm", "ii", 4]], 84, { topNote: 65, every: 4 }),
      chordsExample("The G family: I – IV – V – vi", "G, C, D and Em are the first four chords to try in G.", [["G", "I", 4], ["C", "IV", 4], ["D", "V", 4], ["Em", "vi", 4]], 96),
    ],
  },
  {
    id: "melody", lane: "pitch", title: "Find the melody by steps and leaps",
    why: "Melodies mostly move to the next note in the scale. If you know the direction and size of each move, you're counting instead of guessing.",
    how: ["Find the first note relative to home. It's often home itself, the 3rd or the 5th.", "For each next note, ask: up or down? A step (1–2 frets) or a leap (3 or more)?", "Stay inside one scale shape (the major scale or the pentatonic box) so every guess is in key."],
    examples: [
      fretExample("Leap, then steps", "C up to G is a leap of 7 frets. Everything after is steps.", TW_DOTS, TWINKLE.slice(0, 7), 100),
      fretExample("Step up, then leap up", "C to D is a step (2 frets). C to G is a leap.", [dot(2, 1, "root"), dot(2, 3), dot(1, 3)], [[0, 1], [1, 2], [0, 1], [2, 2]], 90),
    ],
  },
  {
    id: "rhythm", lane: "time", title: "Lock the rhythm, then map the form",
    why: "The right chords in the wrong rhythm still sound wrong. And once one section works, most of the song repeats it.",
    how: ["Tap along to find the tempo. Count 1 2 3 4 or 1 2 3 to find the meter.", "Copy the strum from the drums. Accents usually fall with the snare.", "Write the form: Intro, Verse, Chorus. Learn each section once, then follow the map."],
    extra: "tapTempo",
    examples: [
      strumGridExample("4/4: one strum per beat", "Count 1 2 3 4 and strum down on every number.", 96, 2, [{ name: "Count", kind: "click", pattern: "X.x.x.x.X.x.x.x." }, { name: "Strum", kind: "pluck", chord: "G", pattern: "x.x.x.x.x.x.x.x." }]),
      strumGridExample("4/4: down-up eighths", "Down on the numbers, up on the ands. Softer on the ups.", 96, 2, [{ name: "Count", kind: "click", pattern: "X.x.x.x.X.x.x.x." }, { name: "Strum", kind: "pluck", chord: "G", pattern: "xoxoxoxoxoxoxoxo" }]),
      strumGridExample("3/4 waltz: bass, strum, strum", "ONE two three. Bass note on ONE, chord on two and three.", 108, 1, [{ name: "Count", kind: "click", pattern: "944 944 944 944" }, { name: "Bass", kind: "bass", midi: 43, pattern: "x.. x.. x.. x.." }, { name: "Strum", kind: "pluck", chord: "G", pattern: ".xx .xx .xx .xx" }], { stepsPerBar: 3 }),
    ],
  },
];

/* ------------------------------------------------------- worked examples */

export const WORKED_SONGS: WorkedSong[] = [
  {
    id: "twinkle", title: "Twinkle, Twinkle, Little Star", meta: "Traditional · C major · 4/4 · about 100 BPM",
    stages: [
      { title: "Listen and hum", text: "Loop the first two lines. Hum them until you can sing them without the recording.",
        examples: [barsExample("Melody", "The first two lines.", 100, TWINKLE_BARS, [melodyLayer()])] },
      { title: "Find home", text: "The second line ends on C and sounds finished. Hold a low C under the tune and nothing clashes. Try D instead: the first and last notes rub against it, and the ending never settles.",
        examples: [
          barsExample("Melody over a C drone", "Fits all the way through. C is home.", 100, TWINKLE_BARS, [melodyLayer(), droneLayer(48)]),
          barsExample("Melody over a D drone", "The C notes rub and the end doesn't settle.", 100, TWINKLE_BARS, [melodyLayer(), droneLayer(50)]),
        ] },
      { title: "Major or minor", text: "The tune uses E, 4 frets above C. That's a major 3rd, so the key is C major. Its family is C, Dm, Em, F, G and Am.",
        examples: [chordsExample("C major, then C minor", "The tune's E belongs to C major. C minor has E♭ instead.", [["C", "I", 4], ["Cm", "i", 4]], 90, { every: 4 })] },
      { title: "Follow the bass", text: "Hum the lowest note that fits each half bar: C, then F C, F C, G C. Those are the chord letters.",
        examples: [barsExample("Bass roots", "C | F C | F C | G C", 100, TWINKLE_BARS, [bassLayer()])] },
      { title: "Check the chords against the melody", text: "A sits inside F. G and E sit inside C. D sits inside G. Every chord holds the melody note on its strong beat, so the chords are I, IV and V.",
        examples: [barsExample("All together", "Melody, chords and bass.", 100, TWINKLE_BARS, [melodyLayer(), chordLayer("beats"), bassLayer()])] },
    ],
  },
  {
    id: "amazing-grace", title: "Amazing Grace", meta: "Traditional · G major · 3/4 · about 84 BPM",
    stages: [
      { title: "Listen and count", text: "Tap along and the strong beat comes every three: ONE two three. The tune starts on a pickup note just before the first ONE.",
        examples: [barsExample("Melody with a 3/4 count", "ONE two three in every bar.", 84, AMAZING_GRACE_BARS, [melodyLayer(), countLayer()], { beatsPerBar: 3 })] },
      { title: "Find home", text: "This line ends on D, and it doesn't feel finished. D is the 5th of G, so it's waiting. Add a G after it and the line comes to rest. G is home.",
        examples: [
          barsExample("The line as sung", "Ends on D. It sounds like a question.", 84, AMAZING_GRACE_BARS, [melodyLayer()], { beatsPerBar: 3 }),
          barsExample("Add a G at the end", "Now it's finished.", 84, AG_RESOLVED, [melodyLayer()], { beatsPerBar: 3 }),
        ] },
      { title: "Major or minor", text: "The tune leans on B, 4 frets above G. That's a major 3rd, so the key is G major. Its family is G, Am, Bm, C, D and Em.",
        examples: [fretExample("G, then B", "Home and its major 3rd.", [dot(6, 3, "root", "G"), dot(5, 2, "third", "B")], [[0, 1], [1, 1], [[0, 1], 2]], 84, { legend: "chord" })] },
      { title: "Bass and chords", text: "The bass moves G, G, C, G, G, G, D. In the G family that's I, I, IV, I, I, I, V. The line ends on V, which is why it sounds like a question.",
        examples: [
          barsExample("Bass roots", "G G C G G G D", 84, AMAZING_GRACE_BARS, [bassLayer()], { beatsPerBar: 3 }),
          barsExample("All together", "Waltz strum: bass on ONE, chord on two and three.", 84, AG_RESOLVED, [melodyLayer(), chordLayer("waltz"), bassLayer()], { beatsPerBar: 3 }),
        ] },
    ],
  },
];

/* ------------------------------------------------------------------ drills */

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const pickFrom = <T,>(rng: Rng, a: T[]): T => a[Math.floor(rng() * a.length)];
const shuffled = <T,>(rng: Rng, a: T[]): T[] => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
/** Plays notes in sequence; an array of MIDI numbers is a chord (lightly strummed). */
export function noteSequence(notes: [number | number[], number, "bright"?][], bpm: number): Sound {
  const events: TheoryEvent[] = [];
  let t = 0;
  for (const [m, d, timbre] of notes) {
    if (Array.isArray(m)) m.forEach((x, k) => events.push({ kind: "pluck", midi: x, beat: t + k * 0.05, beats: d, velocity: 0.75, timbre }));
    else events.push({ kind: "pluck", midi: m, beat: t, beats: d, velocity: 0.9, timbre });
    t += d;
  }
  return { bpm, lengthBeats: t, events };
}
const CHORD_HINT: Record<string, string> = {
  IV: "IV sounds open and lifted, like stepping outside.",
  V: "V sounds tense and leans back towards home.",
  vi: "vi sounds like the sad twin of I.",
};

export const DRILLS: Drill[] = [
  {
    id: "home", lane: "pitch", title: "Find home", prompt: "Play each ending. Which one sounds like home?",
    generate(rng = Math.random) {
      const tonic = pickFrom(rng, [60, 62, 53, 55, 57]); // C D F G A (clean spellings)
      const sc = (d: number) => tonic + MAJOR_STEPS[d % 7] + 12 * Math.floor(d / 7);
      const phrase: [number, number][] = [[sc(0), 1], [sc(1), 0.5], [sc(2), 0.5], [sc(4), 1], [sc(3), 0.5], [sc(2), 0.5], [sc(1), 1], [sc(4), 2]];
      const endings = shuffled(rng, [{ deg: 0, correct: true }, { deg: 3, correct: false }, { deg: 5, correct: false }]);
      return {
        listen: endings.map((e, i) => ({ label: `Ending ${"ABC"[i]}`, sub: "Phrase, then one held note", sound: noteSequence([...phrase, [sc(e.deg), 3, "bright"]], 104) })),
        options: endings.map((e, i) => ({ label: "ABC"[i], correct: e.correct })),
        explanation: `Home was ${noteName(tonic)}. The phrase stops on ${noteName(sc(4))}, the 5th, which pulls back to ${noteName(tonic)}. The other endings were ${endings.filter((e) => !e.correct).map((e) => noteName(sc(e.deg))).join(" and ")}.`,
      };
    },
  },
  {
    id: "mode", lane: "pitch", title: "Major or minor", prompt: "Listen to the notes and the chord. Is it major or minor?",
    generate(rng = Math.random) {
      const root = pickFrom(rng, [48, 50, 53, 55, 57]); // C D F G A
      const major = rng() < 0.5;
      const third = root + (major ? 4 : 3);
      return {
        listen: [{ label: "Play", sub: "Root, 3rd, 5th, then all together", sound: noteSequence([[root, 0.75], [third, 0.75], [root + 7, 0.75], [root + 12, 0.75], [[root, third, root + 7, root + 12], 3]], 96) }],
        options: [{ label: "Major", correct: major }, { label: "Minor", correct: !major }],
        explanation: `It was ${noteName(root)} ${major ? "major" : "minor"}. The 3rd (${noteName(third)}) was ${major ? 4 : 3} frets above the root, so it sounds ${major ? "bright" : "darker"}.`,
      };
    },
  },
  {
    id: "next-chord", lane: "chords", title: "Which chord comes next?", prompt: "You hear the home chord (I), then a mystery chord. Is it IV, V or vi?",
    generate(rng = Math.random) {
      const key = pickFrom(rng, [
        { name: "C", I: "C", IV: "F", V: "G", vi: "Am" },
        { name: "G", I: "G", IV: "C", V: "D", vi: "Em" },
        { name: "D", I: "D", IV: "G", V: "A", vi: "Bm" },
      ]);
      const answer = pickFrom(rng, ["IV", "V", "vi"] as const);
      const events: TheoryEvent[] = [];
      ([[key.I, 0], [key[answer], 4]] as [string, number][]).forEach(([c, t]) => {
        strum(events, EAR_VOICINGS[c], t, 2, 0.9);
        strum(events, EAR_VOICINGS[c], t + 2, 2.4, 0.7);
        events.push({ kind: "bass", midi: EAR_ROOTS[c], beat: t, beats: 4, velocity: 0.85 });
      });
      return {
        listen: [{ label: "Play", sub: "Home chord, then the mystery chord", sound: { bpm: 92, lengthBeats: 8.4, events } }],
        options: (["IV", "V", "vi"] as const).map((x) => ({ label: x, correct: x === answer })),
        explanation: `It was ${answer}: ${key[answer]} in the key of ${key.name}. ${CHORD_HINT[answer]}`,
      };
    },
  },
  {
    id: "move", lane: "pitch", title: "Up or down, step or leap", prompt: "Two notes. Which way did the melody move, and how far?",
    generate(rng = Math.random) {
      const start = 55 + Math.floor(rng() * 13);
      const size = pickFrom(rng, [1, 2, 2, 3, 4, 5, 7]);
      const dir = rng() < 0.5 ? 1 : -1;
      const end = start + dir * size;
      const answer = `${dir > 0 ? "Up" : "Down"}, ${size <= 2 ? "step" : "leap"}`;
      return {
        listen: [{ label: "Play", sub: "First note, then second note", sound: noteSequence([[start, 1, "bright"], [end, 2, "bright"]], 90) }],
        options: ["Up, step", "Up, leap", "Down, step", "Down, leap"].map((x) => ({ label: x, correct: x === answer })),
        explanation: `${noteName(start)} to ${noteName(end)}: ${dir > 0 ? "up" : "down"} ${size} fret${size > 1 ? "s" : ""}, a ${size <= 2 ? "step" : "leap"}.`,
      };
    },
  },
];

/* ------------------------------------------------------ reference tables */

export const KEY_CHART = {
  majorHeader: ["I", "ii", "iii", "IV", "V", "vi"],
  major: [
    ["G", ["G", "Am", "Bm", "C", "D", "Em"]],
    ["C", ["C", "Dm", "Em", "F", "G", "Am"]],
    ["D", ["D", "Em", "F♯m", "G", "A", "Bm"]],
    ["A", ["A", "Bm", "C♯m", "D", "E", "F♯m"]],
    ["E", ["E", "F♯m", "G♯m", "A", "B", "C♯m"]],
  ] as [string, string[]][],
  minorHeader: ["i", "III", "iv", "v", "♭VI", "♭VII"],
  minor: [
    ["Am", ["Am", "C", "Dm", "Em", "F", "G"]],
    ["Em", ["Em", "G", "Am", "Bm", "C", "D"]],
  ] as [string, string[]][],
  /** Column indices to highlight as "try these first". */
  tryFirstMajor: [0, 3, 4, 5],
  tryFirstMinor: [0, 2, 4, 5],
  note: "Highlighted chords are the ones to try first. Each minor key shares its chords with a major key: Am with C, Em with G.",
};

export const COMMON_PROGRESSIONS: { name: string; numbers: string; inG: string; inC: string; heard: string }[] = [
  { name: "Three-chord", numbers: "I – IV – V", inG: "G C D", inC: "C F G", heard: "Folk, country, blues, early rock" },
  { name: "Pop loop", numbers: "I – V – vi – IV", inG: "G D Em C", inC: "C G Am F", heard: "Pop, ballads, singalongs" },
  { name: "Pop loop, sad start", numbers: "vi – IV – I – V", inG: "Em C G D", inC: "Am F C G", heard: "Emotional pop and rock" },
  { name: "Fifties", numbers: "I – vi – IV – V", inG: "G Em C D", inC: "C Am F G", heard: "Doo-wop and oldies" },
  { name: "12-bar blues", numbers: "I I I I · IV IV I I · V IV I V", inG: "G7 C7 D7", inC: "C7 F7 G7", heard: "Blues, rock'n'roll" },
  { name: "Minor rock", numbers: "i – ♭VII – ♭VI – ♭VII", inG: "Em D C D", inC: "Am G F G", heard: "Rock and metal" },
  { name: "Descending minor", numbers: "i – ♭VII – ♭VI – V", inG: "Em D C B", inC: "Am G F E", heard: "Flamenco, surf, dramatic rock" },
];

export const TROUBLESHOOTING: { problem: string; fix: string }[] = [
  { problem: "The chord is close but not right", fix: "Try its relative: C ↔ Am, G ↔ Em, F ↔ Dm. They share two notes." },
  { problem: "The bass note fits but the chord sounds off", fix: "Switch between major and minor, or add a 7th (G → G7)." },
  { problem: "Nothing fits anywhere", fix: "The recording may be tuned down a half step, which is common in rock. Tune down, or move everything up one fret." },
  { problem: "It worked until the chorus", fix: "Some songs change key for a section. Find the new home note for that part." },
  { problem: "The melody note clashes on beat 1", fix: "The chord is probably different there. Look for a chord that contains that note." },
  { problem: "You're lost", fix: "Go back to the home note, loop four bars at 70%, and rebuild from the bass." },
];

/* --------------------------------------------------------------- tap tempo */

/** BPM from tap timestamps in ms (uses the last 8; null until 2 taps). Reset the list after 2 s without a tap. */
export function tempoFromTaps(times: number[]): number | null {
  const t = times.slice(-8);
  if (t.length < 2) return null;
  return Math.round(60000 / ((t[t.length - 1] - t[0]) / (t.length - 1)));
}
export function tempoLabel(bpm: number): string {
  return bpm < 70 ? "slow ballad" : bpm < 100 ? "relaxed" : bpm < 130 ? "mid-tempo pop and rock" : "fast";
}
