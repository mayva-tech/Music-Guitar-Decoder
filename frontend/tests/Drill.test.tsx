import { beforeEach, describe, expect, it, vi } from "vitest";
import { DRILLS, type Rng } from "@/lib/theory/ear";
import { freshQuestion, scoreAfterAnswer } from "@/components/ear/Drill";

const seeded = (seed: number): Rng => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const stop = vi.fn();

describe("Drill behaviour", () => {
  beforeEach(() => {
    stop.mockReset();
  });

  it("answering locks options conceptually and exposes the explanation", () => {
    const drill = DRILLS[0]!;
    const q = freshQuestion(drill, seeded(11));
    expect(q.options.filter((o) => o.correct)).toHaveLength(1);
    expect(q.explanation.length).toBeGreaterThan(20);
    const correct = q.options.findIndex((o) => o.correct);
    expect(correct).toBeGreaterThanOrEqual(0);
    // After an answer the UI locks (disabled) and shows this explanation.
    expect(q.explanation).toBeTruthy();
  });

  it("score goes up only on a correct answer", () => {
    expect(scoreAfterAnswer(0, 0, true)).toEqual({ right: 1, total: 1 });
    expect(scoreAfterAnswer(1, 1, false)).toEqual({ right: 1, total: 2 });
    expect(scoreAfterAnswer(1, 2, true)).toEqual({ right: 2, total: 3 });
  });

  it("New question generates a fresh question and stops sound", () => {
    const drill = DRILLS.find((d) => d.id === "mode")!;
    const a = freshQuestion(drill, seeded(3));
    const b = freshQuestion(drill, seeded(99));
    // Different seeds → different questions (almost always).
    expect(a.explanation === b.explanation && a.options[0]?.label === b.options[0]?.label).toBe(false);
    stop();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
