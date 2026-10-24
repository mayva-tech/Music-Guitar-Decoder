"""ASCII guitar TAB rendered strictly from structured note events.

Standard TAB convention: thin e string (string 1) on TOP, thick E (string 6) at the bottom.

Technique notation (written on the note it applies to):
    /7  slide up into fret 7        \\5  slide down into fret 5
    h7  hammer-on to fret 7          p5  pull-off to fret 5
    7b9 bend fret 7 up to the pitch of fret 9 (whole step); 7b8 = half step
    7b9r7 bend up and release        7~  vibrato
"""
from __future__ import annotations

import math
import re
from typing import Any, Iterable, Protocol

TAB_STRING_ORDER = (1, 2, 3, 4, 5, 6)
TAB_LABELS = {1: "e", 2: "B", 3: "G", 4: "D", 5: "A", 6: "E"}


class TabNote(Protocol):
    start_beat: float
    string: int | None
    fret: int | None


_PREFIX = {"slide_up": "/", "slide_down": "\\", "hammer_on": "h", "pull_off": "p"}
TOKEN_RE = re.compile(r"^([/\\hp]?)(\d+)(?:b(\d+)(?:r(\d+))?)?(~?)$")
_TOKEN_CHARS = set("0123456789/\\hpbr~")


def note_token(n: Any) -> str:
    """The TAB text for one note, derived only from its data."""
    tech = getattr(n, "technique", None)
    bend = getattr(n, "bend_semitones", None) or 0
    tok = _PREFIX.get(tech, "") + str(n.fret)
    if tech == "bend":
        tok += f"b{n.fret + bend}"
    elif tech == "bend_release":
        tok += f"b{n.fret + bend}r{n.fret}"
    if getattr(n, "vibrato", False):
        tok += "~"
    return tok


def token_to_technique(tok: str) -> dict:
    m = TOKEN_RE.match(tok)
    if not m:
        raise ValueError(f"Bad TAB token {tok!r}")
    prefix, fret, bend_to, release, vib = m.groups()
    fret_i = int(fret)
    tech = {"/": "slide_up", "\\": "slide_down", "h": "hammer_on", "p": "pull_off"}.get(prefix)
    bend = None
    if bend_to:
        bend = int(bend_to) - fret_i
        tech = "bend_release" if release else "bend"
    return {"fret": fret_i, "technique": tech, "bend_semitones": bend, "vibrato": bool(vib)}


def grid_resolution(notes: Iterable[TabNote]) -> int:
    """Smallest subdivisions-per-beat (1, 2, 4) on which every note starts."""
    starts = [n.start_beat for n in notes]
    for r in (1, 2, 4):
        if all(abs(s * r - round(s * r)) < 1e-6 for s in starts):
            return r
    return 4


def render_tab(notes: list[TabNote], beats_per_bar: int = 4, total_bars: int | None = None,
               chords: list[str] | None = None) -> str:
    """Render notes to ASCII TAB. Every note must have a string and fret."""
    for n in notes:
        if n.string is None or n.fret is None:
            raise ValueError("Every TAB note needs a string and fret")
    res = grid_resolution(notes)
    if total_bars is None:
        last = max((n.start_beat for n in notes), default=0)
        total_bars = max(1, math.floor(last / beats_per_bar) + 1)
    cells_per_bar = beats_per_bar * res
    n_cells = total_bars * cells_per_bar

    grid: dict[int, list[str | None]] = {s: [None] * n_cells for s in TAB_STRING_ORDER}
    for n in notes:
        cell = round(n.start_beat * res)
        if cell >= n_cells:
            raise ValueError(f"Note at beat {n.start_beat} is outside {total_bars} bars")
        if grid[n.string][cell] is not None:
            raise ValueError(f"Two notes on string {n.string} at beat {n.start_beat}")
        grid[n.string][cell] = note_token(n)

    widths = [max((len(grid[s][c] or "-") for s in TAB_STRING_ORDER)) for c in range(n_cells)]
    lines = []
    for s in TAB_STRING_ORDER:
        parts = [TAB_LABELS[s], "|"]
        for b in range(total_bars):
            for k in range(cells_per_bar):
                c = b * cells_per_bar + k
                txt = grid[s][c] or ""
                parts.append("--" + txt.ljust(widths[c], "-"))
            parts.append("--|")
        lines.append("".join(parts))

    if chords:
        header = [" "] * len(lines[0])
        col = 2
        for b in range(total_bars):
            label = chords[b] if b < len(chords) else ""
            pos = col + 2
            for i, ch in enumerate(label):
                if pos + i < len(header):
                    header[pos + i] = ch
            bar_w = sum(2 + widths[b * cells_per_bar + k] for k in range(cells_per_bar)) + 3
            col += bar_w
        lines.insert(0, "".join(header).rstrip())
    return "\n".join(lines)


def parse_tab_tokens(tab: str, beats_per_bar: int = 4, resolution: int = 1) -> list[tuple[float, int, str]]:
    """Parse TAB produced by render_tab into sorted (start_beat, string, token) tuples.

    All six rows share one column layout, so cells are walked column-wise.
    """
    label_to_string = {v: k for k, v in TAB_LABELS.items()}
    rows = {label_to_string[ln[0]]: ln for ln in tab.splitlines() if len(ln) > 1 and ln[1] == "|"}
    if sorted(rows) != [1, 2, 3, 4, 5, 6]:
        raise ValueError("TAB must contain six string rows")
    ref = rows[1]
    out: list[tuple[float, int, str]] = []
    pos = 2
    cell_index = 0
    cells_per_bar = beats_per_bar * resolution
    while pos < len(ref):
        for _ in range(cells_per_bar):
            pos += 2
            width = 1
            for s, row in rows.items():
                j = pos
                while j < len(row) and row[j] in _TOKEN_CHARS:
                    j += 1
                if j > pos:
                    out.append((cell_index / resolution, s, row[pos:j]))
                    width = max(width, j - pos)
            pos += width
            cell_index += 1
        if ref[pos:pos + 3] != "--|":
            raise ValueError(f"Malformed TAB near column {pos}")
        pos += 3
    return sorted(out)


def parse_tab(tab: str, beats_per_bar: int = 4, resolution: int = 1) -> list[tuple[float, int, int]]:
    """Parse TAB back into sorted (start_beat, string, fret) tuples."""
    return sorted((b, s, token_to_technique(t)["fret"]) for b, s, t in parse_tab_tokens(tab, beats_per_bar, resolution))
