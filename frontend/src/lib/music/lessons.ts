// Optional, progressive theory topics. Each unlocks after a playing skill, so theory
// always explains something the learner has already done.

export type LessonDiagramId = "chord-recipes" | "power-chord-shape";

export interface Lesson {
  id: string;
  title: string;
  unlockedBy: string | null; // skill key, null = available from the start
  body: string[];
  /** Optional SVG diagrams rendered under the body (Progress + Learn). */
  diagrams?: LessonDiagramId[];
  /** Short principle → rule rows shown as a quick-reference table. */
  quickRef?: { principle: string; rule: string }[];
  /** Full guide page — Progress “Read” opens this in a new tab. */
  detailHref?: string;
}

export const LESSONS: Lesson[] = [
  {
    id: "note", title: "What is a musical note?", unlockedBy: null,
    body: [
      "A note is one steady pitch — like a single hum. Each note has a letter name: A B C D E F G, then it starts again.",
      "Between some letters there are in-between notes called sharps (#) or flats (b). On the guitar, every fret is one of these small steps.",
    ],
  },
  {
    id: "beat", title: "What is a beat?", unlockedBy: null,
    body: [
      "The beat is the steady pulse you tap your foot to. Most rock songs count it in groups of four: 1, 2, 3, 4.",
      "Each group of four is called a bar. The drums in Music Decoder hit the kick on 1 and 3 and the snare on 2 and 4.",
    ],
  },
  {
    id: "fret", title: "What is a fret?", unlockedBy: "recognize_strings",
    body: [
      "Frets are the metal strips across the neck. Pressing a string just behind a fret makes it shorter, so the note gets higher.",
      "Every fret raises the note by one small step. Open string, first fret, second fret… each one a step higher.",
    ],
  },
  {
    id: "chord", title: "What is a chord?", unlockedBy: "open_strings",
    body: [
      "A chord is a few notes played together. A C major chord is C, E and G.",
      "When the band plays C major and you play E, your note is part of their chord — that's why it sounds so good.",
    ],
  },
  {
    id: "building-chords", title: "From tune to chords", unlockedBy: null,
    detailHref: "/progress/building-chords",
    body: [
      "Your tune’s home note names the key. That key has a seven-note scale. Stack notes 1 · 3 · 5 to make a chord — do it on every scale step and you get the whole family.",
      "Open the full guide for clear C major, D major, and G major examples: scale ladders, home-chord build, every derived chord, and the power chords (C5, G5…) you can slide as one shape.",
    ],
    quickRef: [
      { principle: "Home note", rule: "The note the tune ends or rests on" },
      { principle: "Scale", rule: "Seven notes that belong in the key" },
      { principle: "Chord", rule: "Notes 1 · 3 · 5 from any scale step" },
      { principle: "Power chord", rule: "Just root + 5th — one shape to slide" },
    ],
  },
  {
    id: "progression", title: "What makes chords sound good together?", unlockedBy: "fretted_notes",
    body: [
      "Chords take turns being home, away and tension. Home (like C in C major) feels settled. Tension (G in C major) pulls back towards home.",
      "Your Simple harmonization uses exactly these three jobs: C (home), F (away), G (tension).",
    ],
  },
  {
    id: "scale", title: "What is a scale?", unlockedBy: "moving_frets",
    body: [
      "A scale is a ladder of notes that belong together. C major uses C D E F G A B — the white keys of a piano.",
      "Most of the notes in your tune come from one scale. That's why the solo generator keeps the in-between notes inside it.",
    ],
  },
  {
    id: "key", title: "What is a musical key?", unlockedBy: "switching_strings",
    body: [
      "The key tells you the home note and the scale. \"C major\" means home is C and the C major scale is used.",
      "Music Decoder sometimes moves your tune to a different key so it fits the easy strings — the tune sounds the same, just higher or lower.",
    ],
  },
  {
    id: "chord-progression", title: "What is a chord progression?", unlockedBy: "phrase_4",
    body: [
      "A chord progression is the order the chords come in, like C → F → G → C.",
      "Many different progressions can fit one melody. That's why you got three options — each tells a slightly different story.",
    ],
  },
  {
    id: "solo", title: "What is a guitar solo?", unlockedBy: "phrase_8",
    body: [
      "A solo is a lead melody that the guitar plays over the band. Good rock solos borrow from the song's tune, repeat short ideas, and land on chord notes on the strong beats.",
      "Your generated solo does exactly that — it starts from your hum and adds classic rock moves like echoes and a walk down to the home note.",
    ],
  },
  {
    id: "improvisation", title: "What is improvisation?", unlockedBy: "full_solo",
    body: [
      "Improvising means making up a solo as you play. It sounds magical, but it's built from things you now know: stay in the scale, land on chord notes on beats 1 and 3, repeat ideas with small changes.",
      "Try it: play your solo, but swap one note for its neighbour on the same string. You just improvised.",
    ],
  },
  {
    id: "interval", title: "What is an interval?", unlockedBy: "recognize_strings",
    body: [
      "An interval is the distance between two notes. Counting from a chord's root: the 3rd makes it happy (major) or sad (minor, ♭3), the 5th makes it strong, the ♭7 makes it bluesy.",
      "Switch the fretboard dots to “Interval” to see R, 3, 5 and friends instead of finger numbers.",
    ],
  },
  {
    id: "power-chords", title: "Power chords", unlockedBy: null,
    body: [
      "A power chord is just two notes: the root and the 5th (often doubled an octave up). It's written C5, G5 and so on.",
      "With no 3rd it sounds neither happy nor sad — perfect for distorted rock guitar, where full chords get muddy.",
    ],
  },
  {
    id: "legato", title: "Slides, hammer-ons and pull-offs", unlockedBy: "fretted_notes",
    body: [
      "These play a second note without picking again. Slide: glide the pressed finger to a new fret. Hammer-on: tap a higher fret hard. Pull-off: flick a finger off to sound a lower fret.",
      "They make a solo flow like a voice instead of sounding like separate plucks. In TAB: /7 slide, h7 hammer-on, p5 pull-off.",
    ],
  },
  {
    id: "pentatonic", title: "The pentatonic box", unlockedBy: "moving_frets",
    detailHref: "/progress/pentatonic-box",
    body: [
      "The minor pentatonic has five notes: R · ♭3 · 4 · 5 · ♭7. On the guitar they sit in a four-fret “box” — two notes per string, one finger per fret.",
      "Open the full guide for A, E, and D minor examples: how the five notes are carved from the minor scale, the box diagram, and how to slide it to any key.",
    ],
    quickRef: [
      { principle: "Five notes", rule: "R · ♭3 · 4 · 5 · ♭7 from the root" },
      { principle: "How it's made", rule: "Natural minor, drop the 2nd and 6th" },
      { principle: "The box", rule: "Four frets wide, two notes per string" },
      { principle: "Move it", rule: "Slide the same shape to a new root fret" },
    ],
  },
  {
    id: "blues-scale", title: "The blues scale and the blue note", unlockedBy: "switching_strings",
    body: [
      "Add the ♭5 to the minor pentatonic and you get the blues scale. That extra note sounds wonderfully 'wrong' when you pass through it.",
      "Bending the ♭3 halfway up towards the major 3rd is the most famous blues sound — the 'blue curl'.",
    ],
  },
  {
    id: "twelve-bar", title: "The 12-bar blues", unlockedBy: "phrase_4",
    body: [
      "Bars 1–4: I. Bars 5–6: IV. Bars 7–8: I. Bar 9: V, bar 10: IV, bar 11: I, bar 12: V — then round again.",
      "In C that's C7 ×4, F7 ×2, C7 ×2, G7, F7, C7, G7. Thousands of songs, from Chuck Berry to the Beatles, use it.",
    ],
  },
  {
    id: "four-chords", title: "The four-chord pop song", unlockedBy: "phrase_4",
    body: [
      "I – V – vi – IV (C – G – Am – F) is everywhere in pop. Start it on vi (Am – F – C – G) and the same chords sound moodier.",
      "Pick Pop as your genre and the band leans towards this loop when your tune allows it.",
    ],
  },
  {
    id: "swing", title: "Straight eighths and shuffle", unlockedBy: "basic_rhythm",
    body: [
      "Rock and pop play eighth notes evenly: 1-and-2-and. Blues usually shuffles: the 'and' comes late, long-short, long-short.",
      "TAB writes both the same way — the genre tells you how to feel it. Listen to the blues backing and tap along.",
    ],
  },
  {
    id: "bends", title: "Bends and vibrato", unlockedBy: "phrase_8",
    body: [
      "A bend pushes the string sideways so the note rises. 7b9 means: play fret 7 and bend until it sounds like fret 9 (a whole step).",
      "Vibrato is a small, even wobble on a held note. Together they're what makes a guitar sound like it's singing.",
    ],
  },
];

/** Plain English string for TTS (title + body + quick-ref rules). */
export function lessonSpeakText(lesson: Lesson): string {
  const parts = [lesson.title, ...lesson.body];
  for (const row of lesson.quickRef ?? []) {
    parts.push(`${row.principle}. ${row.rule}`);
  }
  return parts.join(" ");
}
