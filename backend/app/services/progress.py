"""Skill tracking and adaptive practice suggestions.

Only microphone-verified practice counts towards skills; manual (no-listening)
practice is recorded as practice time but never as a verified skill.
"""
from __future__ import annotations

from ..schemas import PracticeResult, PracticeSession

SKILLS = [
    ("recognize_strings", "Recognizing guitar strings", "Play correct notes on two different strings."),
    ("open_strings", "Playing open strings", "Play 3 correct open-string notes."),
    ("fretted_notes", "Playing individual fretted notes", "Play 3 correct fretted notes."),
    ("moving_frets", "Moving between frets", "Move between two frets on one string correctly twice."),
    ("switching_strings", "Switching strings", "Switch between strings correctly twice."),
    ("basic_rhythm", "Maintaining basic rhythm", "Play with the band: 60%+ notes, within 180 ms on average."),
    ("phrase_4", "Playing four-note phrases", "Play 4 notes in a row correctly."),
    ("phrase_8", "Playing eight-note phrases", "Play 8 notes in a row correctly."),
    ("full_solo", "Playing a complete generated solo", "Play every note of a solo correctly in one go."),
]


def score_result(r: PracticeResult) -> tuple[float, float | None]:
    if not r.events:
        return 0.0, None
    acc = sum(1 for e in r.events if e.correct) / len(r.events)
    offs = [abs(e.timing_offset_ms) for e in r.events if e.correct and e.timing_offset_ms is not None]
    return round(acc, 4), (round(sum(offs) / len(offs), 1) if offs else None)


def _longest_run(r: PracticeResult) -> int:
    best = cur = 0
    for e in r.events:
        cur = cur + 1 if e.correct else 0
        best = max(best, cur)
    return best


def compute_progress(sessions: list[PracticeSession]) -> dict:
    verified = [s for s in sessions if s.result.used_microphone and s.result.mode != "manual"]
    counts = {k: 0.0 for k, _, _ in SKILLS}
    strings: set[int] = set()
    for s in verified:
        ev = s.result.events
        for e in ev:
            if e.correct and e.string is not None:
                strings.add(e.string)
                if e.fret == 0:
                    counts["open_strings"] += 1
                elif e.fret is not None:
                    counts["fretted_notes"] += 1
        for a, b in zip(ev, ev[1:]):
            if a.correct and b.correct and a.string is not None and b.string is not None:
                if a.string == b.string and a.fret != b.fret and (a.fret or 0) + (b.fret or 0) > 0:
                    counts["moving_frets"] += 1
                elif a.string != b.string:
                    counts["switching_strings"] += 1
        run = _longest_run(s.result)
        counts["phrase_4"] = max(counts["phrase_4"], run)
        counts["phrase_8"] = max(counts["phrase_8"], run)
        if s.result.mode == "play_with_band" and s.accuracy >= 0.6 and (s.mean_abs_timing_ms or 9999) <= 180:
            counts["basic_rhythm"] = 1
        if s.result.completed and s.accuracy == 1.0 and len(ev) >= 8:
            counts["full_solo"] = 1
    counts["recognize_strings"] = len(strings)
    targets = {"recognize_strings": 2, "open_strings": 3, "fretted_notes": 3, "moving_frets": 2,
               "switching_strings": 2, "basic_rhythm": 1, "phrase_4": 4, "phrase_8": 8, "full_solo": 1}
    skills = []
    for key, label, how in SKILLS:
        p = min(1.0, counts[key] / targets[key])
        skills.append({"key": key, "label": label, "how": how, "progress": round(p, 3), "achieved": p >= 1.0})
    total_minutes = round(sum(s.result.duration_sec for s in sessions) / 60, 1)
    return {"skills": skills, "sessions": len(sessions), "verified_sessions": len(verified),
            "practice_minutes": total_minutes,
            "next_skill": next((s["label"] for s in skills if not s["achieved"]), None)}


def recommendations(sessions: list[PracticeSession], arrangement_id: str, note_count: int) -> list[dict]:
    mine = [s for s in sessions if s.result.arrangement_id == arrangement_id and s.result.events]
    if not mine:
        return [{"kind": "start", "message": "Start with Follow Me mode — no timing pressure."}]
    recent = mine[-2:]
    acc = sum(s.accuracy for s in recent) / len(recent)
    tempo = recent[-1].result.tempo_factor
    out: list[dict] = []
    if acc < 0.6:
        out.append({"kind": "slow_down", "tempo_factor": round(max(0.5, tempo - 0.15), 2),
                    "message": "Let's slow down a little — speed comes later."})
        out.append({"kind": "shorter_phrase", "phrase_length": 4 if note_count > 4 else note_count,
                    "message": "Practise just the first four notes until they feel easy."})
        if len(mine) >= 3 and all(s.accuracy < 0.5 for s in mine[-3:]):
            out.append({"kind": "simpler", "message": "Try the Original Melody part — it can be easier than the solo."})
    elif acc >= 0.9:
        if tempo < 1.0:
            out.append({"kind": "speed_up", "tempo_factor": round(min(1.0, tempo + 0.1), 2),
                        "message": "Great accuracy! Let's nudge the tempo up."})
        else:
            out.append({"kind": "longer_phrase", "message": "Excellent! Try the whole solo with the band."})
        out.append({"kind": "new_skill", "message": "Ready for something new — check My Progress for your next skill."})
    else:
        out.append({"kind": "keep_going", "message": "Nice progress. A few more runs at this speed will lock it in."})
    return out
