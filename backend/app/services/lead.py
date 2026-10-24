"""Genre lead solo: a real guitar solo built from the hummed tune, with techniques.

Deterministic and explainable:

1. Scale & position — the genre's solo scale (rock: minor pentatonic, pop: major
   pentatonic, blues: blues scale) played in ONE hand position, the pentatonic
   "box", so the learner never has to stretch or jump.
2. Call and answer — odd bars follow the contour of the hummed melody ("call"),
   even bars answer by echoing its opening and landing on a long note.
3. Harmony — strong beats land on chord tones. If a chord tone is not in the box
   (e.g. the major 3rd over a pentatonic), it is reached with a bend.
4. Techniques — slides between notes on the same string, hammer-ons/pull-offs on
   quick pairs, bends to chord tones, vibrato on held notes. The set depends on the
   skill level (or the learner's override).
5. Ending — a genre lick that walks into the home note and holds it.

The sounding pitch of every note equals string + fret (+ bend), which the schema
validates, and the TAB is rendered from the same events.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..music.genres import GenreDef, degree_name, genre_of, solo_scale
from ..music.guitar import STANDARD_TUNING
from ..music.tab import render_tab
from ..music.theory import Chord, Key, midi_to_name
from ..schemas import GeneratedSolo, Harmonization, NoteEvent, ScalePosition

ALL_TECH = {"slide", "hammer_on", "pull_off", "half_bend", "bend", "bend_release", "vibrato"}
AUTO_TECH = {
    "zero": {"slide", "vibrato"},
    "few_notes": {"slide", "hammer_on", "vibrato"},
    "basic_chords": {"slide", "hammer_on", "pull_off", "half_bend", "vibrato"},
    "intermediate": {"slide", "hammer_on", "pull_off", "half_bend", "bend", "vibrato"},
    "advanced": ALL_TECH,
}
MODE_TECH = {"none": set(), "slides": {"slide", "hammer_on", "pull_off", "vibrato"}, "all": ALL_TECH}
LEVEL_STRINGS = {"zero": (1, 2, 3), "few_notes": (1, 2, 3, 4), "basic_chords": (1, 2, 3, 4, 5),
                 "intermediate": (1, 2, 3, 4, 5, 6), "advanced": (1, 2, 3, 4, 5, 6)}
LEVEL_TIER = {"zero": 0, "few_notes": 1, "basic_chords": 2, "intermediate": 3, "advanced": 3}
BENDABLE = (1, 2, 3)

Slot = tuple[float, float]  # (beat offset in bar, duration)
# genre -> tier -> (call template, answer template)
TEMPLATES: dict[str, dict[int, tuple[list[Slot], list[Slot]]]] = {
    "rock": {
        0: ([(0, 1), (1, 1), (2, 1), (3, 1)], [(0, 1), (1, 1), (2, 2)]),
        2: ([(0, 1), (1, .5), (1.5, .5), (2, 1), (3, 1)], [(0, .5), (.5, .5), (1, 1), (2, 2)]),
        3: ([(0, .5), (.5, .5), (1, .5), (1.5, .5), (2, 1), (3, .5), (3.5, .5)], [(0, .5), (.5, .5), (1, 1), (2, 2)]),
    },
    "blues": {
        0: ([(0, 1), (1, 1), (2, 2)], [(0, 2), (2, 2)]),
        2: ([(0, 1), (1, .5), (1.5, .5), (2, 2)], [(0, .5), (.5, .5), (1, 1), (2, 2)]),
        3: ([(0, .5), (.5, .5), (1, 1), (2, 1), (3, 1)], [(0, 1.5), (1.5, .5), (2, 2)]),
    },
    "pop": {
        0: ([(0, 1), (1, 1), (2, 1), (3, 1)], [(0, 1), (1, 1), (2, 2)]),
        2: ([(0, 1), (1, .5), (1.5, 1), (2.5, .5), (3, 1)], [(0, 1), (1, 1), (2, 2)]),
        3: ([(0, .5), (.5, 1), (1.5, .5), (2, 1), (3, .5), (3.5, .5)], [(0, 1), (1, .5), (1.5, .5), (2, 2)]),
    },
}
ENDING: list[Slot] = [(0, 1), (1, 1), (2, 2)]


def techniques_for(level: str, mode: str, genre: str = "rock") -> set[str]:
    if mode != "auto":
        return set(MODE_TECH[mode])
    t = set(AUTO_TECH[level])
    if genre == "pop" and level != "advanced":
        t -= {"bend", "half_bend"}   # pop leads lean on slides; bends come with "all"
        t |= {"slide", "hammer_on"}
    return t


def _template(genre: str, tier: int) -> tuple[list[Slot], list[Slot]]:
    table = TEMPLATES[genre]
    return table[max(t for t in table if t <= tier)]


@dataclass
class LeadNote:
    start: float
    dur: float
    midi: int          # sounding pitch
    role: str
    bend: int = 0      # semitones (0 = no bend)
    release: bool = False
    vibrato: bool = False
    string: int = 0
    fret: int = 0
    technique: str | None = None
    slide_from: int | None = None
    finger: int = 0

    @property
    def fret_midi(self) -> int:
        """Pitch of the fretted string (a bend raises it; a bend-and-release ends where it started)."""
        return self.midi if self.release else self.midi - self.bend


def _chord_at(h: Harmonization, beat: float) -> Chord:
    for c in h.chords:
        if c.start_beat - 1e-6 <= beat < c.start_beat + c.duration_beats - 1e-6:
            return Chord(c.root_pc, "min" if c.roman.lstrip("b")[:1].islower() else "maj")
    last = h.chords[-1]
    return Chord(last.root_pc, "min" if last.roman.lstrip("b")[:1].islower() else "maj")


def _melody_at(notes: list[NoteEvent], beat: float) -> int | None:
    cur = None
    for n in notes:
        if n.start_beat <= beat + 1e-6:
            cur = n.midi
        else:
            break
    return cur if cur is not None else (notes[0].midi if notes else None)


def box_fret(scale_box_pc: int) -> int:
    """Low-E fret where the pentatonic box starts (0–11)."""
    return (scale_box_pc - STANDARD_TUNING[6]) % 12


def scale_positions(key: Key, genre: GenreDef, strings: tuple[int, ...], lo: int, hi: int) -> list[ScalePosition]:
    sc = solo_scale(genre, key)
    out = []
    for s in strings:
        for f in range(max(0, lo), hi + 1):
            m = STANDARD_TUNING[s] + f
            iv = (m - key.tonic) % 12
            if iv in sc.intervals:
                out.append(ScalePosition(string=s, fret=f, midi=m, degree=degree_name(iv), is_root=iv == 0,
                                         is_blue=iv in sc.blue_notes))
    return out


def generate_lead(melody_notes: list[NoteEvent], h: Harmonization, key: Key, level: str, style: str,
                  techniques: str = "auto", beats_per_bar: int = 4, total_bars: int | None = None) -> GeneratedSolo:
    notes = sorted(melody_notes, key=lambda n: n.start_beat)
    if not notes:
        raise ValueError("The melody has no notes")
    genre = genre_of(style)
    sc = solo_scale(genre, key)
    tech = techniques_for(level, techniques, genre.key)
    strings = LEVEL_STRINGS[level]
    bpb = beats_per_bar
    end = max(n.start_beat + n.duration_beats for n in notes)
    bars = total_bars or max(1, int(-(-end // bpb)))

    r = box_fret(sc.box_root_pc)
    lo, hi = r, r + 3
    box = scale_positions(key, genre, strings, lo, hi)
    if len({p.midi for p in box}) < 6:
        lo, hi = max(0, r - 1), r + 4
        box = scale_positions(key, genre, strings, lo, hi)
    pool = sorted({p.midi for p in box})
    bend_src = {p.midi for p in box if p.string in BENDABLE and p.fret > 0}

    # Centre the melody's register on the box.
    mids = sorted(n.midi for n in notes)
    median = mids[len(mids) // 2]
    centre = (pool[0] + pool[-1]) / 2
    shift = int(round((centre - median) / 12)) * 12

    def nearest(target: float, cands: list[int], prev: int | None) -> int:
        return min(cands, key=lambda p: (abs(p - target) + (0.35 * abs(p - prev) if prev is not None else 0), p))

    def chord_tone_choice(target: float, chord: Chord, prev: int | None) -> tuple[int, int]:
        """(sounding pitch, bend semitones) for a strong-beat chord tone."""
        options: list[tuple[int, int]] = [(p, 0) for p in pool if p % 12 in chord.pcs]
        lo_m, hi_m = pool[0] - 2, pool[-1] + 2
        for t in range(lo_m, hi_m + 1):
            if t % 12 not in chord.pcs or t in pool:
                continue
            if "bend" in tech and (t - 2) in bend_src:
                options.append((t, 2))
            elif ("half_bend" in tech or "bend" in tech) and (t - 1) in bend_src:
                options.append((t, 1))
        if not options:
            return nearest(target, pool, prev), 0
        best = min(options, key=lambda o: (abs(o[0] - target) + (0.35 * abs(o[0] - prev) if prev is not None else 0)
                                           - (0.6 if o[1] else 0), o[0]))
        return best

    tier = LEVEL_TIER[level]
    call_t, answer_t = _template(genre.key, tier)
    out: list[LeadNote] = []
    prev: int | None = None
    call_opening: list[int] = []
    tonic_pool = [p for p in pool if p % 12 == key.tonic]
    for b in range(bars):
        bar_start = b * bpb
        bar_notes = [n for n in notes if bar_start - 1e-6 <= n.start_beat < bar_start + bpb - 1e-6]
        final = b == bars - 1
        if not bar_notes and not final:
            continue  # the hummed tune rests here, so does the solo
        answer = b % 2 == 1
        template = ENDING if final else (answer_t if answer else call_t)
        opening: list[int] = []
        for k, (off, dur) in enumerate(template):
            beat = bar_start + off
            chord = _chord_at(h, beat)
            ref = _melody_at(notes, beat)
            target = (ref + shift) if ref is not None else (prev or pool[len(pool) // 2])
            strong = abs(off) < 1e-6 or abs(off - bpb / 2) < 1e-6
            bend = 0
            role = "answer" if answer else "call"
            if answer and k < 2 and len(call_opening) > k and (not strong or call_opening[k] % 12 in chord.pcs):
                pitch = call_opening[k]  # echo the call
                role = "echo"
            elif strong:
                pitch, bend = chord_tone_choice(target, chord, prev)
            else:
                pitch = nearest(target, pool, prev)
            if prev is not None and abs(pitch - prev) > 7 and not bend:
                pitch = nearest(prev + (4 if pitch > prev else -4), pool, prev)
            # avoid droning the same pitch three times in a row
            if len(out) >= 2 and out[-1].midi == out[-2].midi == pitch and role != "echo":
                if strong:
                    alts = [p for p in pool if p % 12 in chord.pcs and p != pitch]
                    if alts:
                        pitch, bend = nearest(target, alts, prev), 0
                else:
                    step = [p for p in pool if p != pitch]
                    pitch = nearest(pitch + (2 if pitch < centre else -2), step, prev)
            out.append(LeadNote(beat, dur, pitch, role, bend=bend))
            opening.append(pitch)
            prev = pitch
        if not answer:
            call_opening = opening

    # Ending lick: (bend to) home, step, land on home and hold.
    if tonic_pool:
        last_bar = [n for n in out if n.start >= (bars - 1) * bpb - 1e-6]
        prev_m = out[-len(last_bar) - 1].midi if len(out) > len(last_bar) else last_bar[0].midi
        home = min(tonic_pool, key=lambda p: abs(p - prev_m))
        upper = [p for p in tonic_pool if p >= home]
        if len(last_bar) == 3:
            first, second, land = last_bar
            for x in last_bar:
                x.bend, x.release = 0, False
            if ("bend" in tech) and (home - 2) in bend_src:
                first.midi, first.bend = home, 2           # ♭7 bent up to the root
                first.release = "bend_release" in tech
                if first.release:
                    first.midi = home - 2                     # bend up and back down
            elif ("bend" in tech) and (upper[-1] - 2) in bend_src:
                first.midi, first.bend = upper[-1], 2
            else:
                first.midi = min((p for p in pool if p % 12 in _chord_at(h, first.start).pcs),
                                 key=lambda p: abs(p - home - 4))
            five = [p for p in pool if (p - key.tonic) % 12 == 7]
            blue3 = [p for p in pool if (p - key.tonic) % 12 == 3]
            if genre.key == "blues" and blue3 and ("half_bend" in tech or "bend" in tech) and (min(blue3, key=lambda p: abs(p - home)) in bend_src):
                second.midi, second.bend = min(blue3, key=lambda p: abs(p - home)) + 1, 1  # the blue curl
            elif five:
                second.midi = min(five, key=lambda p: abs(p - home))
            land.midi, land.role = home, "home"
        else:
            last_bar[-1].midi, last_bar[-1].role = home, "home"
            last_bar[-1].bend, last_bar[-1].release = 0, False
        out[-1].dur = bars * bpb - out[-1].start
        out[-1].vibrato = "vibrato" in tech
        for n in last_bar:
            if n.role != "home":
                n.role = "ending"

    _place(out, box, strings, r, tech, bpb, lo, hi)
    _finger_and_check(out, r)

    events: list[NoteEvent] = []
    used: list[str] = []
    for n in out:
        technique = n.technique
        if n.bend:
            technique = "bend_release" if n.release else "bend"
        chord = _chord_at(h, n.start)
        ev = NoteEvent(
            midi=n.midi, name=midi_to_name(n.midi, key.prefer_flats), start_beat=n.start, duration_beats=n.dur,
            string=n.string, fret=n.fret, finger=n.finger, source="generated", role=n.role, technique=technique,
            bend_semitones=n.bend or None, slide_from_fret=n.slide_from, vibrato=n.vibrato,
            chord_degree=degree_name(n.midi - chord.root), in_level_range=n.string in strings)
        events.append(ev)
        for t in ([technique] if technique else []) + (["vibrato"] if n.vibrato else []):
            if t not in used:
                used.append(t)

    bar_chords = []
    for b in range(bars):
        sym = next((c.symbol for c in h.chords if c.start_beat - 1e-6 <= b * bpb < c.start_beat + c.duration_beats - 1e-6), "")
        bar_chords.append(sym)
    tab = render_tab(events, bpb, bars, bar_chords)

    changes = [f"Built on the {sc.name}, played in one hand position around frets {lo}–{hi}."]
    changes.append("Odd bars follow the shape of your tune; even bars answer it — the call-and-answer of a real solo.")
    if techniques != "auto":
        changes.append({"none": "Techniques are switched off for this solo.",
                        "slides": "Slides, hammer-ons and pull-offs are on; bends are off.",
                        "all": "Every technique is switched on, whatever your level."}[techniques])
    explain = {
        "slide_up": "Slides (/): keep pressing and glide your finger up the string to the new fret.",
        "slide_down": "Slides (\\\\): keep pressing and glide your finger down the string.",
        "hammer_on": "Hammer-ons (h): pick once, then tap the next fret down hard so it sounds without picking.",
        "pull_off": "Pull-offs (p): with both fingers down, pick, then flick the higher finger off the string.",
        "bend": "Bends (b): push the string towards the ceiling until it sounds like the note shown — use two or three fingers together.",
        "bend_release": "Bend and release (b…r): bend up, then let the string come back down while it rings.",
        "vibrato": "Vibrato (~): rock the bend a tiny bit up and down to make a held note sing.",
    }
    for t in used:
        changes.append(explain[t])
    if lo > 3:
        changes.append(f"This part sits higher up the neck than the easy solo, but your hand stays put around fret {lo}.")

    return GeneratedSolo(
        kind="lead", level=level, style=style, notes=events, changes=changes, tab_ascii=tab, scale_name=sc.name,
        position_fret=lo, scale_positions=scale_positions(key, genre, (1, 2, 3, 4, 5, 6), lo, hi),
        techniques_used=used,
    )


def _place(out: list[LeadNote], box, strings, r: int, tech: set[str], bpb: int, lo: int, hi: int) -> None:
    by_midi: dict[int, list[tuple[int, int]]] = {}
    for p in box:
        by_midi.setdefault(p.midi, []).append((p.string, p.fret))

    def candidates(fm: int, bend: int) -> list[tuple[int, int]]:
        allowed = BENDABLE if bend else strings
        c = [(s, f) for s, f in by_midi.get(fm, []) if s in allowed]
        if not c:
            c = [(s, fm - STANDARD_TUNING[s]) for s in allowed if lo - 2 <= fm - STANDARD_TUNING[s] <= hi + 2]
        if not c:
            c = [(s, fm - STANDARD_TUNING[s]) for s in (1, 2, 3, 4, 5, 6) if 0 <= fm - STANDARD_TUNING[s] <= 22]
        return c

    prev: LeadNote | None = None
    slides_in_bar: dict[int, int] = {}
    for n in out:
        cands = candidates(n.fret_midi, n.bend)
        if prev is None:
            n.string, n.fret = min(cands, key=lambda sf: (abs(sf[1] - (lo + 1)), sf[0]))
        else:
            quick = n.start - prev.start <= 0.5 + 1e-6
            def cost(sf):
                s, f = sf
                c = abs(s - prev.string) + 0.5 * abs(f - prev.fret)
                if quick and s == prev.string and 1 <= abs(f - prev.fret) <= 3:
                    c -= 1.5  # keep quick pairs on one string (hammer-on / pull-off)
                return c
            n.string, n.fret = min(cands, key=lambda sf: (cost(sf), sf[0]))

        bar = int(n.start // bpb)
        if prev is not None and "slide" in tech and not n.bend and not prev.bend and slides_in_bar.get(bar, 0) == 0:
            diff = n.midi - prev.midi
            strong_or_long = abs(n.start % bpb) < 1e-6 or abs(n.start % bpb - bpb / 2) < 1e-6 or n.dur >= 1.5
            target_fret = prev.fret + diff
            if strong_or_long and 2 <= abs(diff) <= 4 and lo - 1 <= target_fret <= hi + 2 and prev.fret > 0 and target_fret > 0:
                n.string, n.fret = prev.string, target_fret
                n.technique = "slide_up" if diff > 0 else "slide_down"
                n.slide_from = prev.fret
                slides_in_bar[bar] = 1
        quick_pair = (prev is not None and n.technique is None and not n.bend and not prev.bend
                      and n.string == prev.string and prev.fret > 0
                      and n.start - prev.start <= 0.5 + 1e-6 and abs(n.start % bpb) > 1e-6)
        if quick_pair:
            d = n.fret - prev.fret
            if 1 <= d <= 3 and "hammer_on" in tech:
                n.technique = "hammer_on"
            elif -3 <= d <= -1 and "pull_off" in tech and n.fret > 0:
                n.technique = "pull_off"
        prev = n


def _finger_and_check(out: list[LeadNote], r: int) -> None:
    prev: LeadNote | None = None
    for n in out:
        if n.fret == 0:
            n.finger = 0
        elif n.technique in ("slide_up", "slide_down") and prev is not None and prev.finger:
            n.finger = prev.finger  # the same finger slides
        elif r == 0:
            n.finger = min(4, n.fret)
        else:
            n.finger = max(1, min(4, n.fret - r + 1))
        if STANDARD_TUNING[n.string] + n.fret != n.fret_midi:
            raise ValueError("lead solo: position does not match pitch")
        prev = n
