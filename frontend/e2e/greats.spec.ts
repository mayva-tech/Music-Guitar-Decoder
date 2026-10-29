import { expect, test, type Page } from "@playwright/test";

async function targets(page: Page) {
  const picker = page.getByTestId("greats-picker");
  const t = await picker.getByTestId("ef-neck").getAttribute("data-target");
  return t!.split("-").map(Number) as [number, number];
}

test.describe("Guitar greats", () => {
  test("pick a player, see chord shapes, hear and pick a lick", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/learn/greats");

    await expect(page.getByTestId("greats-roster").getByRole("tab")).toHaveCount(8);
    await expect(page.getByTestId("greats-panel")).toHaveAttribute("data-player", "bb-king");

    // Hendrix: E7#9 on the neck with fingers 2 1 3 4, then the thumb-over G.
    await page.getByTestId("greats-tab-hendrix").click();
    const panel = page.getByTestId("greats-panel");
    await expect(panel).toHaveAttribute("data-player", "hendrix");
    await expect(page).toHaveURL(/#hendrix$/);
    await expect(page.getByTestId("greats-chord-name")).toHaveText("E7♯9");
    const shape = page.getByTestId("greats-chords").getByTestId("ef-shape");
    await expect(shape.locator("[data-shape-string]")).toHaveCount(4);
    await expect(shape.locator('[data-shape-string="5"]')).toHaveAttribute("data-shape-fret", "7");
    await page.getByTestId("greats-chord-1").click();
    await expect(page.getByTestId("greats-chord-steps")).toContainText("Thumb over the neck (T): low E string fret 3");
    await page.getByTestId("greats-strum").click();

    // Play a lick with the band: TAB and neck light up, then stop.
    await page.getByTestId("greats-play-hx-7s9").click();
    await expect.poll(() => page.getByTestId("greats-lick-hx-7s9").locator(".is-on").count(), { timeout: 8000 }).toBeGreaterThan(0);
    await page.getByTestId("greats-play-hx-7s9").click();
    await expect(page.getByTestId("greats-play-hx-7s9")).toContainText("Play with band");

    // Pick it: step 1 is a 4-note chord (one target + three extra), tap all four to move on.
    await page.getByTestId("greats-pick-hx-7s9").click();
    const picker = page.getByTestId("greats-picker");
    await expect(picker).toBeVisible();
    await expect(picker.getByTestId("greats-picker-how")).toContainText("Pick these 4 notes together");
    await expect(picker.getByTestId("ef-target-extra")).toHaveCount(3);
    for (const [s, f] of [[5, 7], [4, 6], [3, 7], [2, 8]]) await picker.getByTestId(`ef-cell-${s}-${f}`).click();
    await expect(picker).toHaveAttribute("data-step", "1");
    // A wrong fret is named, and doesn't advance.
    await picker.getByTestId("ef-cell-1-1").click();
    await expect(picker.getByTestId("greats-picker-feedback")).toContainText("That's F");
    await expect(picker).toHaveAttribute("data-step", "1");
    // Walk the rest of the lick by tapping the glowing note(s).
    for (let k = 0; k < 40; k++) {
      if (await picker.getAttribute("data-done")) break;
      const extra = await picker.getByTestId("ef-target-extra").count();
      const [s, f] = await targets(page);
      await picker.getByTestId(`ef-cell-${s}-${f}`).click();
      if (extra) {
        // Double stops: tap whatever still glows.
        for (let j = 0; j < extra; j++) {
          const [s2, f2] = await targets(page);
          await picker.getByTestId(`ef-cell-${s2}-${f2}`).click();
        }
      }
    }
    await expect(picker.getByTestId("greats-picker-done")).toBeVisible();

    // The bend step said how to bend.
    await page.getByTestId("greats-step-2").click();
    await expect(picker.getByTestId("greats-picker-how")).toContainText("Bend A up to B");

    // Next player and the fretboard map popup.
    await page.getByTestId("greats-next").click();
    await expect(panel).toHaveAttribute("data-player", "srv");
    await page.getByTestId("greats-map-srv-open").click();
    await expect(page.getByTestId("scale-fretmap-board").first()).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("deep link opens a player, and the EVH tap lick marks tapped notes", async ({ page }) => {
    await page.goto("/learn/greats#evh");
    await expect(page.getByTestId("greats-panel")).toHaveAttribute("data-player", "evh");
    await page.getByTestId("greats-pick-evh-tap").click();
    const picker = page.getByTestId("greats-picker");
    await expect(picker.getByTestId("greats-picker-how")).toContainText("Tap fret 13 with your picking hand");
    await expect(picker.getByTestId("ef-target")).toContainText("tap");
    expect(await page.locator('a[href="/learn/greats"][aria-current="page"]').count()).toBeGreaterThan(0);
    expect(await page.locator('a[href="/learn"][aria-current="page"]').count()).toBe(0);
  });
});
