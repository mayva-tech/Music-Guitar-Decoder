# Cursor prompt: add the Theory map to Music Decoder

Copy everything below the line into Cursor (Agent mode). Before you start, put these four files in the repo at `docs/theory-map/` and attach the PDF and the prototype to the chat:

- `theory-map-visual-spec.pdf`: what each screen must look like, with numbered callouts. Sections are numbered §1–§13 in each page header.
- `reference-prototype.html`: working prototype. Open it in a browser to see and hear the behaviour.
- `theory-content.ts`: all content, typed (19 terms, 5 principles, about 60 examples, map layout, 26 tour steps)
- `content.test.ts`: integrity tests for that file (10 tests, all passing)

---

## Goal

Add a **Theory map** page to the Music Decoder frontend (Next.js + TypeScript + Tone.js). It explains every music term, shows how the terms connect, and plays an example of each one with a visual that lights up in sync. It has five sections, top to bottom:

1. **Guided tour**: a narrated player with 26 steps (about 8 minutes) that works like a video
2. **Map + detail panel**: an SVG concept map. Selecting a node opens a panel with an explanation and playable examples.
3. **What makes it good**: 5 principles, each with an A/B comparison
4. **Six steps + mini song**: a songwriting recipe and a 9-bar demo
5. **Glossary**: a table of all 19 terms

`docs/theory-map/theory-map-visual-spec.pdf` is the visual source of truth. `docs/theory-map/reference-prototype.html` is the behaviour reference. Match both. Use the app's own components, buttons, fonts and tokens wherever they already exist.

## Step 0: read before writing

Inspect these and reuse what is there. Don't duplicate anything:

- `frontend/src/lib/music/lessons.ts` and the Learn page (where lessons and the theory guide live)
- The audio engine: `engine.ts` and `guitarTone.ts` (the plucked-string voice, body and cabinet filtering, reverb), plus any drum or bass voices used for band backing
- The Fretboard component (it supports the hand overlay, dot labels for finger, interval and note name, and left-handed mode)
- `AppShell` (navigation, `PageTitle`, `Notice`), the app store and settings (left-handed, reduced motion, voice instructions, volume)
- The existing speech helper used for voice instructions
- Playwright config (desktop and Pixel 7 projects) and the vitest setup

Briefly tell me which existing pieces you will reuse before you write code.

## Step 1: content (no edits to the data)

- Copy `docs/theory-map/theory-content.ts` to `frontend/src/lib/theory/content.ts`. Don't rewrite or reformat it. It is the single source for every string, example, map position and tour step.
- Copy `docs/theory-map/content.test.ts` to `frontend/src/lib/theory/content.test.ts` and change only its import path to `./content`.
- Components must not contain theory text. Everything comes from `content.ts`.

Key exports: `TERMS`, `PRINCIPLES`, `ALL_TERMS`, `LANE_LABEL`, `MAP_NODES`, `MAP_EDGES`, `MAP_LANES`, `MAP_VIEWBOX`, `nodeBox()`, `edgePath()`, `connections()`, `TOUR`, `MINI_SONG`, `RECIPE`, and the types `TheoryExample`, `TheoryEvent`, `TheoryVisual`, `TheoryTerm`, `TourStep`.

The event model: each example has `bpm`, `lengthBeats` and `events[]`. Each event has `{ kind, beat, beats, velocity, midi?, timbre?, highlight? }` with time in beats. Event kinds are `pluck | bass | organ | kick | snare | hat | click | highlight`. A `highlight` event is silent. It only lights its visual element.

## Step 2: player, `frontend/src/lib/theory/player.ts`

```ts
export interface TheoryPlayer {
  /** Stops anything playing, then plays `ex`. Resolves when it ends or is stopped. */
  play(ex: TheoryExample, onHighlight: (id: string, on: boolean) => void): Promise<void>;
  stop(): void;
  readonly playing: boolean;
}
export function getTheoryPlayer(): TheoryPlayer; // one shared instance
```

- Use the **app's existing voices**. Don't port the prototype's Karplus-Strong synth.
  - `pluck` uses the guitar voice from `guitarTone.ts`. Map `timbre` to brightness or pluck position: `bright` = near the bridge, `warm` = near the neck, `normal` = default.
  - `bass` uses the existing bass voice, or the guitar voice an octave down with a warm timbre.
  - `organ` must be a plain sine tone with a short attack and no pluck. It is the "pure tone" timbre demo, so it should sound organ-like on purpose.
  - `kick`, `snare`, `hat` and `click` use the existing band kit if there is one. Otherwise add small voices in the player: MembraneSynth for the kick, NoiseSynth for snare and hat, and a short sine blip for the click. A click with `velocity >= 0.95` is the accent and plays a higher pitch.
- Time: `seconds = beat * 60 / bpm`, starting about 0.1 s after `Tone.now()`. Call `Tone.start()` from the user's click.
- Highlights: schedule `onHighlight(id, true)` at the event start and `onHighlight(id, false)` at `max(duration - 30 ms, 110 ms)`, using `Tone.getDraw().schedule` so they stay in sync with the audio.
- `play()` resolves at `lengthBeats * 60 / bpm + 0.35 s`. `stop()` releases voices, cancels pending draw callbacks, turns every highlight off, and resolves the pending promise. Only one thing plays at a time across the whole app, so stop band or practice playback too.
- If the app drives other playback with `Tone.Transport`, schedule these examples so they don't disturb it (absolute times are fine). Respect the master volume setting.

## Step 3: page and components

Route: `frontend/src/app/learn/theory/page.tsx`. Add "Theory map" to the main menu and a link card on the Learn page.

Suggested components in `frontend/src/components/theory/`:

| Component | Spec section | Notes |
|---|---|---|
| `TourPlayer.tsx` | 2–3 | Start overlay, lane chip, title, definition, narration/subtitles, visual stage, "Listen:" line, 26-segment progress (clickable), prev / play-pause / next, voice toggle |
| `TheoryMap.tsx` | 4 | SVG from `MAP_*`, `nodeBox`, `edgePath`. States: selected (filled), related (thick outline), dimmed (about 40%), hot edges drawn last with an ink arrowhead. Nodes are focusable buttons (Enter/Space). Min width 880px, scrolls inside its card. |
| `TermPanel.tsx` | 5, 7 | Eyebrow, name, definition, body, "On guitar" tip, optional `figure`, "Connected to" chips (from `connections(id)`), example buttons, visual |
| `ExampleButton.tsx` | 5 | Play icon turns into a stop square while playing (`aria-pressed`); a second press stops |
| `FretVisual.tsx` | 5 | Prefer an adapter onto the existing Fretboard. High E on top (TAB order), nut at fret 0, fret numbers, inlays 3/5/7/9/12, × for `muted` strings, dot roles (root filled, third orange, seventh/blue purple, others outlined), `label` overrides the note name, legend below. **Respect left-handed mode.** |
| `GridVisual.tsx` | 6 | Rows × cells. Hit colour = lane colour mixed by velocity (25% + 75% × v). Ties are thin bars. Bar line every `stepsPerBar`. Alternate beats shaded. Count row (1 + 2 +) |
| `BlocksVisual.tsx` | 6, 7, 9 | Rows of absolutely positioned blocks (left/width as % of `lengthBeats`), label in bold and sub in mono. `variant: "sect"` = dashed; `s-intro`, `s-verse`, `s-chorus`, `s-bridge` = form colours. `lengthBeats > 24` gets a min width of 600px with horizontal scroll |
| `Principles.tsx` | 8 | Vertical list, "Principle n of 5", compare buttons, "Uses" chips that select the term and scroll to the map |
| `Recipe.tsx` | 9 | Six numbered steps with chips, plus a mini song player (`MINI_SONG`) |
| `Glossary.tsx` | 10 | Table from `TERMS`: term (lane dot), short definition, `glossaryExample` in mono, connections |

Highlighting: every visual renders `data-hl="<id>"` on the element for each highlight id (`d<i>` for fret dots, `g<row>_<col>` for grid cells and their ties, `b_<i>` and `L<layer>_<bar>` for blocks). Toggle an `is-on` class imperatively on the visual's container ref, not through React state, because fast tempos fire about 20 toggles a second. Lit = amber fill, plus a 1.2× scale on dots and 1.08× on cells. No scaling with reduced motion.

Shared state for the page (a small store slice or lifted state): `selectedId`, `tourIndex`, `tourPlaying`. Selecting a node, pressing an example, or using a chip pauses the tour. The tour sets `selectedId` for each step, so the map and panel follow along.

## Step 4: guided tour

- Steps come from `TOUR`. Each step runs: show the step → speak `narration` → wait 300 ms → play each of `examples` in order, showing its visual and "Listen: {label}. {sub}" → wait 700 ms between examples and after the last one → next step. Step 1 shows the five-lane overview visual (spec §2).
- Speech: use the existing speech helper and voice setting. When voice is off or unavailable, advance on a timer of `max(2400 ms, characters × 64 ms)`. Guard against `onend` never firing with a timeout of `estimate × 1.7 + 3 s`.
- Pause cancels speech and audio. Play restarts the current step from its narration. Prev, next and progress segments jump (and keep playing if it was already playing). Use a run token so a cancelled loop never continues.
- Unmounting the page stops audio and speech.

## Step 5: style

- Add lane tokens for both themes (values in spec §1): `--lane-pitch`, `--lane-chords`, `--lane-time`, `--lane-colour`, `--lane-song`, each with a `-bg` tint, plus `--theory-highlight` (amber `#F2B233` light, `#F5BE45` dark, text `#2A1C00`). Scope them to the theory feature if the app has no global token file.
- Layout breakpoints as in the prototype: two columns above 820px, stacked below. No horizontal page scroll at 390px; only the map, wide blocks and the glossary scroll sideways inside their own containers.

## Step 6: tests

- Vitest: `content.test.ts` (copied). Add `player.test.ts` with Tone mocked: `play()` schedules one highlight on/off pair per event that has `highlight`; `stop()` resolves the pending promise and calls `onHighlight(id, false)` for everything that is lit; a second `play()` stops the first.
- Playwright `theory.spec.ts` (desktop and Pixel 7):
  1. The page loads with no console errors.
  2. Clicking the Chord node shows "Chord" in the panel and marks Interval as related.
  3. Pressing an example sets `aria-pressed="true"`, an `.is-on` element appears within 2 s, and pressing again stops it.
  4. Starting the tour shows step 1 of 26; next shows 2 of 26; pause works.
  5. At 390px, `document.documentElement.scrollWidth <= innerWidth`.
- Run the full suites (backend pytest, frontend vitest, Playwright) and the type-check and build. All must pass.

## Acceptance checklist (also spec §13)

- [ ] Route renders without errors; no horizontal page scroll at 390px
- [ ] Selecting any of the 19 map nodes updates the map highlight and the detail panel
- [ ] Every example plays through the app's audio engine, lights its visual in sync, and stops cleanly
- [ ] Only one thing plays at a time across the page and the app
- [ ] Tour: overlay → 26 steps in order; pause, resume, previous, next and progress jumps all work; the tour drives map selection
- [ ] Narration uses the app's speech helper and setting; subtitles advance on a timer when the voice is off
- [ ] Fretboard respects left-handed mode; reduced motion removes scaling
- [ ] Keyboard access with visible focus for nodes, chips, example buttons and tour controls
- [ ] Leaving the page stops audio and speech
- [ ] All tests, the type-check and the build pass; README gets a short "Theory map" section

## Don't

- Don't change `content.ts` data to fit a component. Change the component instead. If you find a real content bug, tell me before you change it.
- Don't add new npm dependencies. Tone.js is already there.
- Don't touch the backend.
- Don't copy the prototype's CSS or its synth wholesale. It is a reference for layout and behaviour only.
