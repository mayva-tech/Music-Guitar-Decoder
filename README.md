# Music Decoder

**Hum It. Rock It. Play It.**

Hum, whistle or sing a short tune. Music Decoder detects the notes, proposes three chord progressions, writes a
beginner-friendly classic-rock solo, plays it with a synthesized backing band, and teaches it on an interactive
guitar fretboard with TAB, finger-by-finger instructions and live microphone feedback.

```
music-decoder/
├── backend/            FastAPI + librosa: transcription, harmony, solo, storage
│   ├── app/music/      theory, guitar positions & fingering, chord shapes, TAB, demo fixture
│   ├── app/services/   audio decoding, transcription, rhythm, harmonizer, solo, arrangement, progress, SQLite
│   └── tests/          pytest (unit + API integration with synthesized hums)
├── frontend/           Next.js 16 + TypeScript + Tailwind 4 + Tone.js + Zustand
│   ├── src/app/        pages: home, onboarding, record, decoder, learn (+ theory map, play by ear), library, progress, settings
│   ├── src/components/ Fretboard (SVG), TabView, FingerGPS, ChordDiagram, PianoRoll, theory map, ear guide …
│   ├── src/lib/        music model, fretboard geometry, TAB layout, YIN pitch detection, playback, theory + ear content
│   ├── tests/          vitest unit tests
│   └── e2e/            Playwright browser tests (desktop + mobile)
└── scripts/            dev.sh (run both servers), test-all.sh
```

## Song search

**Song search** (`/songs`, plus a search box in the sidebar and a search icon on phones) takes a song title and
returns its key, scale and chords:

| Source | What you get |
|---|---|
| Built-in songbook (13 public-domain and traditional songs, works offline) | The full chord chart by section, playable, with chord shapes, key, scale and a capo tip |
| [GetSongBPM](https://getsongbpm.com/api) title search | Key, tempo and time signature for almost any song, then the scale and key chords to try |
| [Hooktheory Trends](https://www.hooktheory.com/api/trends/docs) | TheoryTab example songs that use common progressions in that key (not title search — Hooktheory has no title API) |

No free service provides the exact chords of copyrighted songs. Online GetSongBPM results show the key's chords as
"chords to try"; Hooktheory links open TheoryTab charts on their site. Typos are forgiven (`twinkel twinkel` finds Twinkle, Twinkle).

Put keys in `backend/.env` (loaded automatically), then restart the backend:

```bash
# backend/.env
GETSONGBPM_API_KEY=your-getsongbpm-key
HOOKTHEORY_USERNAME=your-hooktheory-username
HOOKTHEORY_PASSWORD=your-hooktheory-password
```

Get a free GetSongBPM key at https://getsongbpm.com/api (their terms require a visible backlink — `/songs` already shows one).
Hooktheory uses your hooktheory.com login; the Trends API returns songs by chord path, not by title.
Without keys the songbook still works. Lookups are cached in memory. Code: `songSearch.ts`, `song_lookup.py`, `hooktheory.py`.

## Theory map

**Theory map** (`/learn/theory`) explains 19 music terms on a concept map with a 26-step guided tour,
playable examples (guitar / bass / drums via Tone.js), A/B principles, a six-step songwriting recipe,
and a glossary. Content lives in `frontend/src/lib/theory/content.ts` (do not rewrite the data to fit UI).

## Play by ear

**Play any song by ear** (`/learn/by-ear`) teaches a seven-step method for working out a song from listening:
listen and loop, find home, major or minor, follow the bass, chords (with a key chart), melody, and rhythm
(with tap tempo). It includes two worked songs (Twinkle, Twinkle; Amazing Grace), four scored ear drills,
and a cheat sheet of common progressions. Content is in `frontend/src/lib/theory/ear.ts` and reuses the
Theory map player and visuals.

## Lead solo workshop

**Lead solos** (`/learn/solo`) is an improvisation guide for adding a lead solo to a song: a six-step plan,
eight technique cards (slide, hammer-on, pull-off, bend, bend and release, vibrato, double stops, space),
a scale chooser, chord-tone targeting (wandering vs targeting), a library of eight licks, a nine-bar full
solo, and four looping jam tracks with tempo. Every lick plays through the app's lead voice
(`playLead` + `articulation`) over drums, bass and chords, and lights its neck markers and TAB together.

- Content and neck helpers: `frontend/src/lib/music/soloGuide.ts` (tests in `frontend/tests/soloGuide.test.ts`).
- The fretboard map popup (`ScaleFretmapFloat` / `ScaleFretmapNeck`) gained optional pentatonic **boxes**,
  **chord-tone rings** (dashed where the tone is outside the scale) and a **lick layer** (numbered markers,
  bend / slide / hammer / pull / vibrato glyphs). Without the new props the Progress pages render as before;
  the workshop remembers its own popup position (`md-solo-fretmap-float`).
- Audio: `getTheoryPlayer().play(example, onHighlight, { lead, leadTone, loop })` adds a lead line (a second
  voice handles double stops), an optional mild-drive **Crunch** tone, and looping until `stop()`.
  The **Lead tone** (Clean / Crunch) is saved in preferences as `leadTone`. Only one thing plays at a time,
  and leaving the page stops everything.
- Tests: `tests/soloNeck.test.ts` (neck layers), `tests/soloPlayer.test.ts` (lead line, loop), `e2e/solo.spec.ts`.

## What's new in v4: modern-style riffs and finger animation

**10 original riffs in modern styles.** These are written for this app, not taken from any song. Use the *Modern styles*
filter on Riff practice to find them:

| Riff | Style | Genre | Level | Key & tempo | Practises |
|---|---|---|---|---|---|
| Flannel Crunch | Grunge | Rock | Medium | E minor, 100 BPM | Low-string riffing, pull-offs, the dark ♭5 note |
| Sixteenth Strut | Funk | Pop | Harder | E minor, 96 BPM | Sixteenth-note timing, rests that groove, a hammer-on |
| Basement Show | Pop-punk | Rock | Easy | D major, 160 BPM | Fast down-strokes, root notes, walking into the next chord |
| Gallop Run | Metal | Rock | Harder | E minor, 132 BPM | The gallop rhythm, pull-offs on the A string, picking speed |
| Bedroom Shimmer | Indie | Pop | Medium | D major, 110 BPM | Ringing arpeggios, open strings over chords, I–vi–IV–V |
| Offbeat Sunrise | Reggae | Pop | Medium | A minor, 76 BPM | Starting off the beat, leaving space, low melodic riffing |
| Desert Highway | Desert rock | Rock | Medium | E minor, 88 BPM | Exotic half steps, pull-offs, heavy slow groove |
| Tide Pool Tremolo | Surf | Rock | Harder | A minor, 120 BPM | Tremolo picking, a descending melody, light alternate picking |
| Back Porch Pickin' | Country | Pop | Medium | G major, 110 BPM | Hammer-ons, pull-offs, major pentatonic runs |
| Velvet Slide | Neo-soul | Pop | Harder | E minor, 72 BPM | Slides, pull-offs, smooth vocal phrasing |

Rhythmic feels (gallops, sixteenths, tremolo picking, offbeat stabs) are written out note by note, so the TAB, the
playback and the mic feedback all agree.

**Animated finger changes** (Guitar learning page; turn off under Settings → *Animate finger moves*):

| Feature | What you see |
|---|---|
| Hand moves | The hand overlay glides from one note to the next (eased, ~260 ms): the hand slides along the neck on position shifts, the old finger lifts and the new one presses down. |
| Pressed string | The string being played lights up from the pressed fret to the bridge and vibrates; a ripple marks the exact press point. Open strings light up along their whole length. |
| "Move:" hint | Finger GPS says what changes: "Hand stays put: lift your ring finger, press with your index finger", "Shift your hand up 4 frets (index finger to fret 5)…", "Keep your index finger pressed and slide it up to fret 7". |
| Watch the fingers | Plays the part slowly, note by note, animating every change so you can watch before you try it. |

Animations respect the system *reduce motion* setting (the hand jumps instead of gliding, nothing vibrates).

## Riff practice (v3)

**Riff practice** in the menu holds 11 short riffs (plus the 10 modern-style riffs above), each with TAB, finger positions and techniques, ready to play with the band:

| Riff | Source | Genre | Level | Practises |
|---|---|---|---|---|
| In the Hall of the Mountain King | Grieg, 1875 | Rock | Medium | Even eighths, chromatic notes |
| Toccata and Fugue in D minor (opening) | J. S. Bach (attr.), c. 1704 | Rock | Harder | Pull-offs, hammer-ons, a slide |
| Für Elise (opening) | Beethoven, 1810 | Pop | Medium | Open strings, string crossing |
| Ode to Joy | Beethoven, 1824 | Pop | Easy | First-position notes |
| When the Saints Go Marching In | Traditional, 1896 | Blues | Easy | Rests, held notes, shuffle |
| Engine Room | Original | Rock | Easy | Low-string eighth-note riffing |
| Bend and Hold | Original | Rock | Harder | Hammer/pull, full bend, vibrato |
| Boogie Shuffle | Original (traditional boogie pattern) | Blues | Medium | Shuffle, walking the chord |
| Blue Curl Lick | Original | Blues | Harder | Half-step "blue" bends |
| Four-Chord Arpeggio Hook | Original | Pop | Medium | Arpeggios over I–V–vi–IV |
| Slide Hook | Original | Pop | Medium | Hammer-on into a slide |

Each riff opens in Guitar learning with three parts: **The riff** (exactly as written), an **Easy version** for your
level (same key, simplified), and **Jam over it** (a genre lead over the riff's chords). The band plays the riff's
own chords in its genre's groove. Riffs live in `backend/app/music/riffs.py` — add your own in the same format.

**Why there are no riffs from famous copyrighted songs:** writing out a protected melody note for note reproduces the
work, so only public-domain pieces (published before 1929) and original riffs are included. To practise a riff from a
song you love, hum it on the Record page: Music Decoder writes out what *you* played and builds the band around it.

## What's new in v2

| Area | What it does |
|---|---|
| **Genres** | Rock, Pop and Blues each have their own chord palette, groove and solo vocabulary. Rock: power chords, ♭VII, eighth-note chugs. Pop: I–V–vi–IV leanings, strummed down/down-up/up-down-up, syncopated bass. Blues: 7th chords, 12-bar template, shuffle boogie, walking bass, swung eighths. Switch genre on the Learn page and the band, chords and solos are rebuilt from your original tune. |
| **Lead solo** | A second solo built in one pentatonic/blues "box" from your melody's shape (call and answer), with **slides, hammer-ons, pull-offs, bends, bend-and-release and vibrato**. Techniques follow your level, or choose *Plain notes*, *Slides & legato* or *Everything*. |
| **Hand overlay** | A translucent fretting hand over the fretboard: index on the position fret, one finger per fret, the pressing finger solid, the others hovering, thumb behind the neck. Opacity slider; works in every view and left-handed. |
| **Technique guides** | Bend arrows (½ / full), slide paths, hammer-on/pull-off arcs and vibrato marks on the fretboard; TAB shows `/7`, `h7`, `p5`, `7b9`, `7b9r7`, `7~`. Finger GPS explains each technique; live feedback says "push further" when a bend falls short. |
| **Theory** | Scale shape overlay with intervals (R, ♭3, 5 …); dots can show finger, interval or note name; a "Why it sounds like …" panel with the progression in Roman numerals, the solo scale, each note's role in the key and chord, a technique legend and a genre guide; nine new lessons (intervals, power chords, pentatonic box, blues scale, 12-bar blues, four-chord pop, swing, legato, bends). |
| **Speed** | Transcription 31–42% faster (pYIN runs only over the sound and over the singer's actual range, found by a quick YIN pre-pass). Live pitch detection 4.7× faster for low E and up to 32× for high notes (decimation + early exit, no per-frame allocation). The fretboard and its static neck are memoised, and band-mode scoring only re-renders when a note's result changes. |

## Requirements

| Tool | Version | Why |
|---|---|---|
| Python | 3.10+ (tested on 3.13) | backend |
| Node.js | 20+ (tested on 22) | frontend |
| ffmpeg | any recent | decoding browser recordings (WebM/Opus, MP4/AAC) and MP3/M4A uploads |

No paid AI services or API keys are used. Everything runs locally.

## Installation

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate     # optional but recommended
pip install -r requirements.txt

# frontend
cd ../frontend
npm install
```

Install ffmpeg with your package manager (`brew install ffmpeg`, `sudo apt install ffmpeg`, `winget install ffmpeg`).
Without it, WAV/FLAC/OGG uploads still work but in-browser recordings cannot be decoded.

## Running

Two terminals:

```bash
# 1. backend — http://localhost:8000 (interactive API docs at /docs)
cd backend
uvicorn app.main:app --reload --port 8000

# 2. frontend — http://localhost:3000
cd frontend
npm run dev
```

Or both at once: `./scripts/dev.sh`.

Open **http://localhost:3000**. The frontend proxies `/api/*` to the backend (set `MUSIC_DECODER_API` if the backend
runs elsewhere). Saved songs and practice history go to `backend/data/music_decoder.sqlite3`
(override with `MUSIC_DECODER_DB`).

## Microphone permissions

* Browsers only allow the microphone on **secure pages**: `http://localhost` counts as secure; a phone visiting your
  computer's IP address over plain `http://` does not. For phone testing use HTTPS, e.g.
  `npx next dev --experimental-https` (and open the page via that https URL).
* The browser asks once; if you block it, Music Decoder explains how to re-enable it, offers file upload for
  recording, and offers **Step by step** practice (clearly labelled as not listening).
* Echo cancellation, noise suppression and auto-gain are switched **off** so musical notes aren't distorted.
* Recordings are sent only to your own backend for analysis. Audio is not stored in localStorage.
* Use **headphones** for *Play with the band*, so the microphone hears your guitar rather than the speakers.

## Supported audio formats

WAV, FLAC, OGG/Opus, WebM (Chrome/Firefox recordings), MP4/M4A/AAC (Safari recordings), MP3.
Limits: 0.5–30 s, 15 MB. 5–15 s works best.

## Tests

```bash
cd backend  && python3 -m pytest                 # 250 tests: theory, positions, TAB, harmony, genres, solos & techniques, riffs, API, audio
cd frontend && npm test                          # 75 tests: tuning, fretboard & hand geometry, hand animation, TAB, YIN, swing timing, mic errors, persistence
cd frontend && npm run typecheck && npm run build
cd frontend && npm run test:e2e                  # 20 browser tests (desktop + Pixel 7); needs both servers running
```

`./scripts/test-all.sh` runs everything except the browser tests.

Browser tests use Chromium's fake microphone fed with `e2e/fixtures/demo-hum.wav` (a synthesized hum of the demo's
first two bars), so the record → decode and *Follow me* tests exercise the real microphone, MediaRecorder,
ffmpeg, pitch tracking and live YIN detection. If `npx playwright install chromium` can't download a browser, point
`CHROMIUM_PATH` at any Chromium/Chrome binary.

Backend integration tests synthesize humming (harmonics, vibrato, noise, detuning, glides) instead of shipping
recordings, and check that the exact notes and timing come back.

## How it works

**Single source of truth.** Every note is a structured event (`id, midi, name, start_beat, duration_beats, string,
fret, finger, confidence`). Sound, fretboard, TAB, instructions and scoring all read these events; TAB text is
rendered from them and parsed back in tests to prove they agree. Pydantic rejects any event whose string/fret doesn't
produce its MIDI pitch (`MIDI = open string + fret`; strings 6→1 = 40, 45, 50, 55, 59, 64).

**Transcription** (`services/transcription.py`): decode → mono 22.05 kHz → gentle 50 Hz high-pass → normalise →
probabilistic YIN (`librosa.pyin`) with voicing → global tuning-offset correction → note segmentation on pitch changes
and re-articulation onsets → spurious-blip filtering → tempo candidates from onset-grid fit → eighth-note quantisation
(with manual BPM / beat-shift) → Krumhansl–Kessler key candidates. Every note gets a confidence; uncertain ones are
shown in amber for correction. Nothing is invented to fill gaps. Processing runs as a background job whose real stages
are shown in the UI.

**Harmonizer** (`services/harmonizer.py`): scores every chord in a style palette against each bar's notes (chord tones
on strong beats score highest, out-of-key notes clash), then a Viterbi pass adds home → away → tension → home
grammar, start/end-on-home bonuses and a complexity penalty. Returns **Simple** (I–IV–V), **Rock** (power chords,
♭VII allowed) and **Alternative** (relative minors, half-bar changes, steered away from the Simple choice).

**Solo generator** (`services/solo.py`, rule-based and explainable):
1. range fitting — pick the transposition that puts most notes on the level's strings/frets (zero level: strings 1–3,
   frets 0–3, preferring strings 1–2); octave-move notes only if needed;
2. one note per beat for beginners (held notes stay held, rests stay rests);
3. chord tones on beats 1 and 3, scale tones elsewhere;
4. lead devices: phrase-opening echo, neighbour-note approach for back-and-forth figures, varied repeats, and a cadence
   walking down the home chord;
5. Viterbi string/fret choice minimising hand movement, then 4-fret-window fingering (first position: finger = fret).

Every change (transposition, octave moves, adjusted notes, simplified rhythm) is listed for the learner, and the
original transcription is kept untouched in the arrangement.

**Lead solo** (`services/lead.py`): chooses the genre scale (rock: minor pentatonic, pop: major pentatonic, blues:
blues scale) in one hand position, follows the hummed contour with call-and-answer bars, puts chord tones on strong
beats (reaching a missing chord tone with a bend), adds slides/legato/vibrato from the allowed set, and ends with a genre
lick into the home note. Notes carry `technique`, `bend_semitones`, `slide_from_fret`, `vibrato`; the schema checks that
string + fret (+ bend) equals the sounding pitch, and validation parses the TAB tokens back and compares them with the
data. Shuffle is applied in the shared playback timeline, so sound, highlighting and scoring stay in sync.

**Demo tune** (C major, 80 BPM): run through the real harmonizer and generator, it produces C | F | G | C and exactly
the reference solo and TAB from the spec — which is asserted in tests. It is a fixture, not a canned result: every other
melody is processed dynamically.

**Live feedback** (`lib/audio/pitch.ts`, `noteMatcher.ts`): YIN in the browser ~25×/s, a stability gate (4 steady
frames), cents tolerance and clarity threshold (both adjustable, plus background-noise calibration). The app reports
the note it heard and how to fix it — it never claims to know which string or finger you used.

## Fretboard views

All views are computed from the same string/fret data (no CSS flipping):

| View | Nut | Top / first string | Notes |
|---|---|---|---|
| Beginner (default, right-handed) | left | string 1 (thin e) | same order as TAB; frets increase left → right |
| Chart | left | string 1 (thin e) | matches TAB |
| Facing a teacher | right | string 1 (thin e) | nut mirrored; string order still TAB |
| Vertical | top | string 1 at left | thin e → thick E left to right |

Left-handed mode mirrors the neck horizontally (nut on the right) for every view. All fretboard views use standard
TAB string order: thin e on top (or left when vertical), thick E at the bottom (or right).

## Known limitations

* **One melody line only.** Chords, full songs, or several voices at once won't transcribe. Fast runs, heavy vibrato
  and slides between notes reduce accuracy (shown as amber notes).
* **Tempo** assumes 4/4 and that the first note falls on a beat; use the tempo chips, BPM box or *Shift beat by ½*
  to correct it. Re-timing is disabled after manually inserting notes (they have no recorded timing).
* **Harmony** is diatonic, one chord per bar (half-bar in *Alternative*), with no key changes.
* **Solo generators** are rule-based and deterministic: musical, but not as varied as a human player. The lead stays in
  one box position (it doesn't yet move between positions or use string skipping, double-stops or pre-bends).
* **Bends and slides in live practice** are judged by the pitch you land on; the app can't see *how* you got there.
* **The hand overlay** is a guide to finger placement, not a model of your exact hand shape.
* **Sound** is synthesized with Tone.js — a guide to the music, not a recording of real guitars, bass or drums.
* **Live detection** is monophonic pitch only. It cannot tell which string or finger produced a note; guitar
  harmonics can occasionally cause octave errors (reported as "right note name, different octave"). Without
  headphones, the backing track can leak into the microphone.
* **Voice instructions** depend on the browser's speech synthesis.
* Single user, no accounts. Transcription jobs live in server memory (lost on restart); arrangements and practice
  history persist in SQLite, and preferences/work in progress in the browser's localStorage.
