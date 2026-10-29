import { expect, test, type Page } from "@playwright/test";


/** Target cell "string-fret" from the neck. */
async function target(page: Page) {
  const t = await page.getByTestId("ef-neck").getAttribute("data-target");
  const [s, f] = t!.split("-").map(Number);
  return { s: s!, f: f! };
}

test.describe("Play by ear: fretboard play-along", () => {
  test("follow the notes, strum the chords, find notes by ear", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/learn/by-ear");

    const trainer = page.getByTestId("ef-trainer");
    await expect(trainer).toBeVisible();
    await expect(trainer).toHaveAttribute("data-song", "ode");

    // Follow: Ode to Joy starts on E, the open high e string, over a C chord shape.
    await expect(page.getByTestId("ef-note-name")).toHaveText("E");
    expect(await target(page)).toEqual({ s: 1, f: 0 });
    await expect(page.getByTestId("ef-shape")).toHaveAttribute("data-style", "ghost");
    // The next note is E again, in the same spot, so no separate "next" ring yet.
    await expect(page.getByTestId("ef-next")).toHaveCount(0);

    // A wrong fret says what it was and doesn't move on.
    await page.getByTestId("ef-cell-2-1").click();
    await expect(page.getByTestId("ef-feedback")).toContainText("That's C");
    await expect(trainer).toHaveAttribute("data-index", "0");

    // Tap the glowing note five times: E E F G G.
    for (let i = 0; i < 5; i++) {
      const { s, f } = await target(page);
      await page.getByTestId(`ef-cell-${s}-${f}`).click();
      await expect(trainer).toHaveAttribute("data-index", String(i + 1));
    }
    await expect(page.getByTestId("ef-note-name")).toHaveText("F");
    expect(await target(page)).toEqual({ s: 1, f: 1 });
    await expect(page.getByTestId("ef-next")).toBeVisible(); // G comes next, at fret 3

    // Play along: the count-in shows, then the highlight walks through the notes. Stop halts it.
    await page.getByTestId("ef-restart").click();
    await page.getByTestId("ef-play").click();
    await expect(page.getByTestId("ef-count")).toBeVisible({ timeout: 6000 });
    await expect.poll(async () => Number(await trainer.getAttribute("data-index")), { timeout: 8000 }).toBeGreaterThan(1);
    await page.getByTestId("ef-play").click();
    await expect(page.getByTestId("ef-play")).toContainText("Play along");

    // Chords: full C shape with fingers 3 2 1, low E muted; then G.
    await page.getByTestId("ef-mode-chords").click();
    await expect(page.getByTestId("ef-chord-name")).toHaveText("C");
    const shape = page.getByTestId("ef-shape");
    await expect(shape).toHaveAttribute("data-style", "full");
    await expect(shape.locator("[data-shape-string]")).toHaveCount(5);
    await expect(shape.locator('[data-shape-muted="6"]')).toHaveCount(1);
    await expect(page.getByTestId("ef-chord-steps")).toContainText("Ring finger (3): A string fret 3");
    await page.getByTestId("ef-strum").click();
    await page.getByTestId("ef-next-chord").click();
    await expect(page.getByTestId("ef-chord-name")).toHaveText("G");

    // Find by ear: notes are hidden; a wrong tap says higher/lower; the right one is revealed and scored.
    await page.getByTestId("ef-song").selectOption("twinkle");
    await page.getByTestId("ef-mode-ear").click();
    await expect(page.getByTestId("ef-target")).toHaveCount(0);
    await expect(page.getByTestId("ef-chip-0")).toHaveText("?");
    await page.getByTestId("ef-hear").click();
    await page.getByTestId("ef-cell-2-3").click(); // D, the first note is C
    await expect(page.getByTestId("ef-feedback")).toContainText("go lower");
    await page.getByTestId("ef-cell-3-5").click(); // C on the G string: same pitch, any place counts
    await expect(page.getByTestId("ef-mark-ok")).toHaveCount(1);
    await expect(trainer).toHaveAttribute("data-index", "1", { timeout: 3000 });
    await expect(page.getByTestId("ef-chip-0")).toHaveText("C");
    // Second note: show me.
    await page.getByTestId("ef-show").click();
    await expect(page.getByTestId("ef-feedback")).toContainText("It was C");
    await expect(trainer).toHaveAttribute("data-index", "2", { timeout: 4000 });
    await expect(page.getByTestId("ef-score")).toContainText("0 of 2"); // a miss, then a reveal
    // Third note, G, found on the first try (high e, fret 3).
    await page.getByTestId("ef-cell-1-3").click();
    await expect(page.getByTestId("ef-feedback")).toContainText("Up 7 frets from C: a leap");
    await expect(page.getByTestId("ef-score")).toContainText("1 of 3");

    // Worked example button opens Amazing Grace, up at position VII.
    await page.getByTestId("ear-play-along-amazing-grace").click();
    await expect(trainer).toHaveAttribute("data-song", "amazing-grace");
    await expect(page.getByTestId("ef-hand")).toContainText("frets 7–10");

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("microphone mode listens and shows what it hears", async ({ page }) => {
    await page.goto("/learn/by-ear");
    await page.getByTestId("ef-mic").click();
    await expect(page.getByTestId("ef-mic")).toHaveAttribute("aria-pressed", "true");
    // The fake microphone hums the demo tune, so some note gets heard.
    await expect(page.getByTestId("ef-heard").locator("strong")).not.toHaveText("—", { timeout: 15000 });
    await page.getByTestId("ef-mic").click();
    await expect(page.getByTestId("ef-heard")).toHaveCount(0);
  });
});
