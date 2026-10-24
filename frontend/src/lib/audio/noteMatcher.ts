// Turn noisy frame-by-frame pitch estimates into stable, judged notes.
// Pitch tells us WHICH note sounded — never which string or finger produced it.

export interface Frame {
  midi: number | null; // fractional MIDI, null = no pitch
  clarity: number;
}

export interface StableNote {
  midi: number; // median fractional MIDI over the stable window
}

export class StablePitchTracker {
  private window: number[] = [];
  constructor(private stableFrames = 4, private spreadCents = 45, private clarityMin = 0.8) {}

  reset() {
    this.window = [];
  }

  /** Returns a stable note once `stableFrames` consecutive clear frames agree, else null. */
  push(f: Frame): StableNote | null {
    if (f.midi == null || f.clarity < this.clarityMin) {
      this.window = [];
      return null;
    }
    this.window.push(f.midi);
    if (this.window.length > this.stableFrames) this.window.shift();
    if (this.window.length < this.stableFrames) return null;
    const sorted = [...this.window].sort((a, b) => a - b);
    if ((sorted[sorted.length - 1] - sorted[0]) * 100 > this.spreadCents * 2) return null;
    return { midi: sorted[Math.floor(sorted.length / 2)] };
  }
}

export type Verdict = "correct" | "octave" | "wrong";

export function judge(playedMidi: number, target: number, toleranceCents = 40): { verdict: Verdict; cents: number } {
  const cents = (playedMidi - target) * 100;
  if (Math.abs(cents) <= toleranceCents) return { verdict: "correct", cents };
  const rounded = Math.round(playedMidi);
  const offTarget = Math.abs(playedMidi - rounded) * 100;
  if (rounded !== target && (rounded - target) % 12 === 0 && offTarget <= toleranceCents) return { verdict: "octave", cents };
  return { verdict: "wrong", cents };
}

export interface BandTarget {
  id: string;
  midi: number;
  start: number; // seconds
  end: number;
  string?: number;
  fret?: number;
}

export interface BandNoteResult {
  id: string;
  midi: number;
  correct: boolean;
  detectedMidi: number | null;
  timingOffsetMs: number | null;
  string?: number;
  fret?: number;
}

/** Scores a "play with the band" run: a target counts as hit when a clear, correct pitch is
 *  heard inside its window (a little early is allowed). */
export class BandScorer {
  private hits = new Map<string, { offset: number; midi: number }>();
  private lastHeard = new Map<string, number>();
  private streak = new Map<string, number>();

  constructor(private targets: BandTarget[], private toleranceCents = 40, private earlySec = 0.15, private framesNeeded = 2) {}

  push(time: number, f: Frame) {
    for (const t of this.targets) {
      if (this.hits.has(t.id)) continue;
      const end = Math.max(t.end, t.start + 0.3);
      if (time < t.start - this.earlySec || time > end) continue;
      if (f.midi == null) {
        this.streak.set(t.id, 0);
        continue;
      }
      this.lastHeard.set(t.id, f.midi);
      if (judge(f.midi, t.midi, this.toleranceCents).verdict === "correct") {
        const s = (this.streak.get(t.id) ?? 0) + 1;
        this.streak.set(t.id, s);
        if (s >= this.framesNeeded) this.hits.set(t.id, { offset: (time - t.start) * 1000, midi: f.midi });
      } else {
        this.streak.set(t.id, 0);
      }
    }
  }

  status(id: string): "hit" | "pending" {
    return this.hits.has(id) ? "hit" : "pending";
  }

  results(): BandNoteResult[] {
    return this.targets.map((t) => {
      const h = this.hits.get(t.id);
      return {
        id: t.id, midi: t.midi, correct: !!h, detectedMidi: h ? h.midi : this.lastHeard.get(t.id) ?? null,
        timingOffsetMs: h ? Math.round(h.offset) : null, string: t.string, fret: t.fret,
      };
    });
  }
}
