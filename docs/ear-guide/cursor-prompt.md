# Cursor prompt: add "Play any song by ear" to Music Decoder

**Prerequisite:** the Theory map feature is already built (`frontend/src/lib/theory/content.ts`, the shared theory player, and the fretboard, grid and block visuals). This page reuses all of it. If the Theory map isn't merged yet, do that prompt first.

Copy everything below the line into Cursor (Agent mode). Before you start, put these files in the repo at `docs/ear-guide/` and attach the PDF and the prototype to the chat:

- `ear-guide-visual-spec.pdf`: 12 pages of annotated screenshots. Sections are numbered §1–§11 in each page header.
- `reference-prototype.html`: working prototype. Open it in a browser to see and hear the behaviour.
- `ear.ts`: all content (7 steps, 31 examples, 2 worked songs, 4 drills, tables, tap-tempo helpers), typed
- `ear.test.ts`: 10 tests for that file (all passing against the Theory map's `content.ts`)

---

## Goal

Add a **Play any song by ear** page to the Music Decoder frontend. It teaches a seven-step method for working out a song from listening, with these sections, top to bottom:

1. **Hero**: title, lead, and a strip of the 7 numbered steps (links)
2. **The method**: one row per step. Left side: why, how (3 bullets) and an optional extra (key chart or tap tempo). Right side: example buttons and a visual that lights up in sync.
3. **Worked examples**: Twinkle, Twinkle (C, 4/4) and Amazing Grace (G, 3/4), stage by stage, with one shared visual per song
4. **Ear drills**: 4 random drills with scoring (find home, major or minor, which chord comes next, up or down / step or leap)
5. **Cheat sheet**: common progressions and troubleshooting

`docs/ear-guide/ear-guide-visual-spec.pdf` is the visual source of truth and `docs/ear-guide/reference-prototype.html` is the behaviour reference. Match both. Use the app's components, fonts and tokens.

## Step 0: read before writing

Find what the Theory map actually created. Names may differ from the suggestions in its prompt.

- The content module (`lib/theory/content.ts`) and its exports: `fretExample`, `gridExample`, `noteName`, `CHORD_VOICINGS`, `BASS_ROOT`, `OPEN_STRING_MIDI` and the types
- The shared player (`getTheoryPlayer()`, or whatever it is called) and how it handles highlights and one-at-a-time playback
- The visual components (fretboard, grid and blocks), the example button, the two-column row layout, and the lane tokens
- The Learn page, the menu (`AppShell`), the store and settings (left-handed, reduced motion), and the test setup

List what you will reuse before writing code. Don't duplicate any of it.

## Step 1: content (no edits to the data)

- Copy `docs/ear-guide/ear.ts` to `frontend/src/lib/theory/ear.ts` and `ear.test.ts` to `frontend/src/lib/theory/ear.test.ts`. They import from `./content`, so they must sit next to the Theory map's `content.ts`. If that file has a different name or path, fix only the import lines.
- Run the test: 10 must pass. If one fails because the Theory map changed `content.ts`, tell me what changed. Don't edit the content data to make it pass.
- Components get every string, example and table from `ear.ts`.

Key exports:
- `EAR_STEPS`: 7 steps with `id`, `lane`, `title`, `why`, `how[]`, optional `extra: "keyChart" | "tapTempo"`, and `examples: TheoryExample[]`
- `WORKED_SONGS`: each song has `title`, `meta`, and `stages[]` (`title`, `text`, `examples`)
- `DRILLS`: each drill has `id`, `lane`, `title`, `prompt` and `generate(rng?)`. `generate` returns `{ listen: {label, sub, sound}[], options: {label, correct}[], explanation }` with exactly one correct option.
- `KEY_CHART`, `COMMON_PROGRESSIONS`, `TROUBLESHOOTING`
- `tempoFromTaps(times)` and `tempoLabel(bpm)`
- The type `Sound = Pick<TheoryExample, "bpm" | "lengthBeats" | "events">`, used by the drills, which have no visual

Examples use the Theory map's event kinds only (`pluck`, `bass`, `organ`, `click`, `highlight`, …). There are no new sounds. The "drone" examples use `organ`, a held pure tone.

## Step 2: one small player change

Widen the shared player's `play()` parameter from `TheoryExample` to `Sound`, so drills can play without a visual. It only ever needs `bpm`, `lengthBeats` and `events`. Highlights are optional: pass a no-op `onHighlight` for drills. Change nothing else in the player. Keep the one-sound-at-a-time rule app-wide.

## Step 3: page and components

Route: `frontend/src/app/learn/by-ear/page.tsx`. Add it to the menu, add a card on the Learn page, and add a link from the Theory map ("Next: play by ear").

Suggested components in `frontend/src/components/ear/` (reuse the Theory map's components inside them):

| Component | Spec | Notes |
|---|---|---|
| `StepStrip.tsx` | §2 | Numbered cards (Step n in mono + title), lane-coloured, min 130px, wrapping. Each links to `#step-<id>` |
| `MethodStep.tsx` | §3–§5 | Theory map row layout. Left: number (2 digits, mono, lane colour) + title, why (larger), how list, extra. Right: example buttons + the visual for the last pressed example (the first example's visual at rest) |
| `KeyChart.tsx` | §4 | Table from `KEY_CHART`. Try-first cells tinted with the chords-lane tint. Minor rows below a thicker rule with their own numeral header. Scrolls inside its well on phones (min width 520px) |
| `TapTempo.tsx` | §5 | Round tap pad in the time colour (Space/Enter work), BPM readout (… after one tap) and `tempoLabel`. Reset after 2 s idle, using `tempoFromTaps` |
| `WorkedSong.tsx` | §6 | Meta line (mono), title, numbered stages each with example buttons. One shared visual + caption ("label. sub") in a column that is sticky on desktop (`top: safe-area inset + 12px`) and static when stacked |
| `Drill.tsx` | §7 | Title + score ("right of total"), prompt, listen buttons (ExampleButton style), answer buttons, feedback (`aria-live="polite"`), New question. After answering, lock all options, colour the correct one with the chords tint and a wrong pick with the time tint, and show "Correct." or "Not this time." in bold plus the explanation. New question stops sound |
| `CheatSheet.tsx` | §8 | Two cards: the progressions table (numbers and keys in mono, scrolls on phones) and the fixes list (problem in bold, fix below) |

Two columns above 820px; stacked below. No horizontal page scroll at 390px.

## Step 4: tests

- Vitest: `ear.test.ts` (copied). Add `Drill.test.tsx`, a component test with a seeded `rng` and a mocked player:
  - Answering locks the options and shows the explanation.
  - The score goes up only on a correct answer.
  - New question generates a fresh question and calls `player.stop()`.
- Playwright `ear.spec.ts` (desktop and Pixel 7):
  1. The page loads with no console errors.
  2. Clicking strip card 2 scrolls to `#step-home`.
  3. Pressing "…then G" sets `aria-pressed="true"` and a lit element appears within 4 s.
  4. Six taps on the tap pad show a number.
  5. Answering a drill shows feedback and the score changes from "0 of 0" to "… of 1".
  6. At 390px, `scrollWidth <= innerWidth`.
- Run all suites, the type-check and the build. Everything must pass. Add a short "Play by ear" section to the README.

## Acceptance checklist (also spec §11)

- [ ] Route renders without errors; no horizontal page scroll at 390px
- [ ] All 31 examples play through the app's audio engine, light their visual in sync, and stop when pressed again or when anything else starts
- [ ] The step strip jumps to each step; the 70% example is audibly slower at the same pitch
- [ ] Key chart highlights the try-first columns; tap tempo shows BPM after two taps and resets after 2 s idle
- [ ] Worked songs: every stage button updates the shared visual and caption; the visual stays in view on desktop
- [ ] Drills: listen, answer, lock, colour, explain, score and new question all work; New question stops sound
- [ ] Keyboard access with visible focus everywhere; the tap pad works with Space/Enter
- [ ] Reduced motion removes scaling; leaving the page stops audio
- [ ] All tests, the type-check and the build pass

## Don't

- Don't edit `ear.ts` or `content.ts` data to fit a component. If you find a real content bug, tell me first.
- Don't add npm dependencies or touch the backend.
- Don't copy the prototype's synth or CSS wholesale. It is a reference for layout and behaviour only.
- Don't use `Math.random` inside components for drills. Call `drill.generate()`, and pass a seeded rng in tests.
