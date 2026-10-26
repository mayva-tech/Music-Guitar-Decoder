# Cursor prompt: add the Lead Solo Workshop to Music Decoder

Written against `mayva-tech/Music-Guitar-Decoder` at commit `802a301` ("Add Theory map with EN TTS and smooth lesson audio").

Copy everything below the line into Cursor (Agent mode). Before you start, put these files in the repo at `docs/solo-guide/` and attach the PDF and the prototype to the chat:

- `solo-guide-visual-spec.pdf`: 12 pages of annotated screenshots. Sections are numbered §1–§11 in each page header.
- `reference-prototype.html`: working prototype. Open it in a browser to see and hear the behaviour.
- `soloGuide.ts`: all content and helpers. It goes to `frontend/src/lib/music/soloGuide.ts`.
- `soloGuide.test.ts`: 14 tests. It goes to `frontend/tests/soloGuide.test.ts`.

Both files were checked against this commit: `npm run typecheck` is clean and `npm test` passes all 139 tests (125 existing + 14 new).

---

## Goal

Add a **Lead Solo Workshop** page at `/learn/solo`. It is an improvisation guide for adding lead solos to a song, with these sections, top to bottom:

1. **Hero**: title, "Open fretboard map" button, and a Lead tone switch (Clean / Crunch)
2. **Plan**: 6 numbered steps with actions
3. **Techniques**: 8 cards (slide, hammer-on, pull-off, bend, bend and release, vibrato, double stops, space)
4. **Choose the scale**: a 6-row table that opens the map
5. **Land on chord tones**: chord pills plus a Wandering vs Targeting comparison
6. **Lick library**: 8 cards
7. **Full solo**: 9 bars over Am – G – F – G
8. **Jam**: 4 looping backing tracks

Every lick opens on the existing **fretboard map popup**, extended with pentatonic boxes, chord-tone rings and a **lick layer** that draws the lick on the neck.

`docs/solo-guide/solo-guide-visual-spec.pdf` is the visual source of truth and `docs/solo-guide/reference-prototype.html` is the behaviour reference.

## Step 0: read before writing

- `src/components/ScaleFretmapFloat.tsx` and `src/components/ScaleFretmapNeck.tsx` (you will extend both)
- `src/lib/music/scaleFretmap.ts`, `src/lib/music/fretboardLayout.ts` (`computeLayout`, `lay.note()`, `lay.openMarker()`), `src/lib/music/guitar.ts`
- `src/lib/audio/timeline.ts` (`Articulation`, `articulation()`), `src/lib/audio/engine.ts` (`playLead()`, the lead `MonoSynth` and `TONES.lead`), `src/lib/audio/guitarTone.ts`
- `src/lib/theory/player.ts` (`getTheoryPlayer()`, highlight scheduling with `Tone.getDraw()`), `src/lib/theory/content.ts` (`TheoryExample`, `TheoryEvent`), `src/components/theory/highlight.ts`
- `src/lib/music/tab.ts` (`noteToken`, `layoutTab`), `src/components/AppShell.tsx` (nav), `src/app/learn/theory/page.tsx` (page pattern)

Before writing code, list the changes you plan to each existing file.

## Step 1: content

Copy `soloGuide.ts` and `soloGuide.test.ts` into place unchanged, run `npm test`, and confirm 139 pass. Don't edit the content data to fit a component. If something is genuinely wrong, tell me first.

What it gives you:
- **Licks are `PlayableNote[]`** with `technique`, `bend_semitones`, `slide_from_fret`, `vibrato` and `finger`. They follow the backend's `schemas.py` rules (a bend's `midi` is the bent-to pitch), so `articulation()`, `playLead()`, `noteToken()` and `layoutTab()` work on them as they are.
- `TECHNIQUES`, `LICKS`, `BOX_RUN`, `TARGETING`, `WANDERING`, `SOLO` (+ `SOLO_SECTIONS`, `SOLO_NOTES`), `PLAN`, `SCALE_CHOICES`, `JAM_TRACKS`, `JAM_IDEAS`, `TARGET_*`, and `LICKS_BY_ID`
- Neck helpers:
  - `pentatonicBox(root, mode, n, nearFret?)` and `fretRange()`
  - `chordToneCells(chord, root, mode, box, maxFret, nearFret?)`, which returns cells with `inScale`
  - `lickOverlay(notes)`, which returns markers (position, pitch-class name, note indices, order) and glyphs (slide, hammer_on, pull_off, bend, bend_release, vibrato, double_stop)
  - `lickWindow(notes)`, the fret range for small card diagrams
- Audio data:
  - `lickExample(lick)`: backing drums, bass and chords as `TheoryEvent`s, plus silent highlights `n<i>` (lick note i) and `b_<i>` (bar i)
  - `jamExample(track, bpm)`: one loop with `b_<i>` and `beat_<0-3>` highlights
  - `backingBar()`, `SOLO_VOICINGS`, `SOLO_BASS`, `CHORD_TONES`

## Step 2: extend `ScaleFretmapNeck` (spec §2, §3, §5)

Add optional props. Existing callers must render exactly as before.

```ts
box?: number;                       // 0 = none; fade scale notes outside pentatonicBox(...) to ~0.16
chordTones?: string | null;         // ring chord tones (maple); dashed marker for tones outside the scale
lick?: { notes: PlayableNote[]; compact?: boolean } | null;
litNotes?: ReadonlySet<number>;     // indices of lick notes sounding now (or use data-hl + highlight.ts, see Step 4)
fretWindow?: { from: number; to: number }; // crop for card diagrams (lickWindow)
```

- The **scale layer** dims to about 0.28 when a lick is shown, the same way it already dims to 0.22 for chord placement.
- **Box placement:** when a lick is shown, draw its box in the lick's octave with `pentatonicBox(root, mode, box, lickWindow(notes).from)`.
- **Lick layer** (from `lickOverlay`):
  - **Markers:** a note circle in `noteMarkerColors(name)` with a dark outline, plus a maple order badge (top-right, the first play order).
  - **Glyphs:**
    - bend: an arrow above the note labelled `full`/`½`
    - bend_release: an up-and-back arrow labelled `full ↺`
    - slide: a straight arrow between frets with `/` or `\`
    - hammer_on / pull_off: an arc above the two notes labelled `h` or `p`
    - vibrato: a small wave to the right of the note
    - double_stop: a dashed link to the string below
  - Add top padding when a lick has bends (~58 units) or arcs (~36).
  - `compact`: markers only, no badges or glyphs (used by the full solo).
- **Lit note:** a maple ring plus scale 1.18 (CSS transform; none with reduced motion).
- **`fretWindow`:** crop with the SVG `viewBox` to the window and draw string letters in a left gutter, so cards show about 6 frets (spec §5, §7).

## Step 3: extend `ScaleFretmapFloat` (spec §2, §3)

Add optional props, keeping today's behaviour when they're absent:

```ts
initialBox?: number;
chordList?: string[];        // header pills become chord-TONE toggles (not shapes) when provided
initialChord?: string | null;
lick?: Lick | null;          // shows the lick bar + lick layer
onPlayLick?: (lick: Lick) => void; playing?: boolean; litNotes?: ReadonlySet<number>;
```

- **Box row** under Scale: All, 1–5. Show it only for `BOX_MODES`.
- **Legend:** add "· Box n, frets a–b" and "· <chord> chord tones ringed: …".
- **Lick bar** (above the neck): Play/Stop, title, description, Clear lick, and the lick's TAB as a small `LickTab` component built on `layoutTab()`. Each token is a span that lights when its note sounds.
- **Key line** under the neck (glyph legend with a lick shown; ring legend without one).
- Escape closes the popup. On phones, open it centred near the top. Hide the "Drag" and "Chord tones" labels under 520px.
- Use a separate sessionStorage key for this page's popup position, for example `md-solo-fretmap-float`.

## Step 4: audio

- **Lead line:** extend the Theory player rather than starting a second transport:

  ```ts
  play(ex, onHighlight, opts?: { lead?: PlayableNote[]; leadTone?: "clean" | "crunch"; loop?: boolean })
  ```

  - `lead` notes play on a lead `MonoSynth` (the engine's `TONES.lead`/`leadLow`/`leadG` voices) through `playLead(synth, midi, t0 + beat * spb, dur, vel, articulation(n, prevOnSameString))`, using the same `t0` as the backing.
  - Start each note at the fretted pitch the way `playLead` already does.
  - Double stops (two notes at the same beat) need a second lead voice.
  - `crunch` = the lead chain with mild drive (a waveshaper at about the prototype's level) before the cab filter. `clean` = the existing clean lead path.
  - `loop` reschedules the example back to back until `stop()`. A tempo change applies from the next loop.
- **Highlights:** use the existing `setHighlight(root, id, on)` / `clearHighlights` pattern with ids `n<i>`, `b_<i>` and `beat_<n>`. Every rendering of the same lick (card neck, card TAB, popup neck, popup TAB) must light together.
- One thing plays at a time across the app. Starting anything stops the jam. Leaving the page stops everything.

## Step 5: page and components

Route `src/app/learn/solo/page.tsx`. Add `{ href: "/learn/solo", label: "Lead solos", short: "Solos", Icon: … }` to `AppShell` and exclude it from the `/learn` active match, the same way `/learn/theory` is. Add a link card on `/learn` and on the Theory map.

Suggested components in `src/components/solo/`:

| Component | Spec | Notes |
|---|---|---|
| `SoloHero.tsx` | §4 | `.display` title, "Open fretboard map" (`btn-primary`), Lead tone segmented control (persist in the app store prefs) |
| `PlanSteps.tsx` | §4 | 3-column grid (2 below 900px, 1 below 760px); mono step number in `--color-next`; `PLAN` actions |
| `TechniqueCard.tsx` | §5 | Name, amber TAB symbol chip, text, how list, cropped neck (`fretWindow`), Hear it, Show on fretboard |
| `ScaleChoices.tsx` | — | Table from `SCALE_CHOICES`; each row opens the map (root, mode, box, `chordList`) |
| `ChordTargeting.tsx` | §6 | Am/G/F pills (`noteMarkerColors`), `TARGET_TEXT`, Wandering/Targeting buttons, 4-bar timeline lit by `b_<i>`, cropped neck frets 3–9 with `box=1` and `chordTones` |
| `LickCard.tsx` | §7 | Tags, cropped neck, `LickTab`, Play, "over <chords>" chip, Show on fretboard |
| `FullSolo.tsx` | §8 | Play (primary), Follow on fretboard (compact popup), section row, 9-bar timeline, `LickTab`, `SOLO_NOTES` |
| `JamPanel.tsx` | §9 | Track list, large current chord + "next", 4 beat dots, Start/Stop, tempo 60–140, `JAM_IDEAS`, "Show scale on fretboard". If a chord pill is on, its rings follow the current bar |

Use the app's tokens and classes (`surface`, `btn`, `chip`, `display`, colours from `@theme`). Don't copy the prototype's CSS.

## Step 6: tests

- `soloGuide.test.ts` (copied).
- A neck render test (vitest, node environment, `react-dom/server` `renderToString`):
  - `box=1` gives 12 full-opacity markers in frets 5–8 for A minor pentatonic.
  - `chordTones="F"` gives dashed markers at 2:6 and 5:8.
  - A lick renders one marker per position with badges, and `compact` renders none.
- Playwright `solo.spec.ts` (desktop + Pixel 7):
  1. The page loads with no console errors.
  2. "Show on fretboard" on the Bend card opens the popup with the lick bar.
  3. Play lights a marker within 3 s.
  4. The Box row switches the legend to "Box 2, frets 7–10".
  5. Escape closes the popup.
  6. The jam starts, the chord changes within 4 bars, and it stops.
  7. At 390px, `scrollWidth <= innerWidth`.
- `npm run typecheck`, `npm test`, `npm run build` and the e2e suite all pass. Add a README section.

## Acceptance checklist (also spec §11)

- [ ] `/learn/solo` renders without errors; no horizontal page scroll at 390px; linked from the menu, `/learn` and the Theory map
- [ ] All 20 licks play through the app's lead voice (`playLead` + `articulation`) with their backing, and light their markers and TAB in sync in the card and the popup
- [ ] Fretboard map: box row, chord-tone pills with rings and dashed outsiders, lick layer with badges and glyphs, Play/Stop and Clear lick; the progress pages' popup is unchanged
- [ ] A lick's box is drawn in the lick's octave
- [ ] Targeting A/B, full solo with sections, jam loop with tempo, current chord and beat dots
- [ ] One sound at a time; leaving the page stops audio
- [ ] Keyboard access with visible focus; Escape closes the popup; reduced motion removes scaling
- [ ] All tests, the type-check and the build pass

## Don't

- Don't change `ScaleFretmapFloat`/`ScaleFretmapNeck` behaviour for existing callers.
- Don't add npm dependencies or touch the backend.
- Don't write a second lead synth. Reuse `playLead` and `articulation`.
- Don't copy the prototype's Karplus-Strong audio or CSS. It is a reference for layout and behaviour only.
