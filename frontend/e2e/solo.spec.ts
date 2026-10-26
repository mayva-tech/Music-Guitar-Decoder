import { expect, test } from "@playwright/test";

test.describe("Lead solo workshop", () => {
  test("loads, opens the map from the Bend card, plays, switches boxes, closes with Escape", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto("/learn/solo");
    await expect(page.getByTestId("solo-page")).toBeVisible();
    await expect(page.getByTestId("solo-techniques")).toBeVisible();

    // Bend card -> popup with the lick bar.
    const card = page.getByTestId("technique-card-bend");
    await card.scrollIntoViewIfNeeded();
    await page.getByTestId("technique-show-bend").click();
    const popup = page.getByTestId("scale-fretmap-float");
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId("lick-bar")).toBeVisible();

    // Play lights a marker within 3 s.
    await popup.getByTestId("lick-play").click();
    await expect(popup.locator(".solo-hl.is-on").first()).toBeAttached({ timeout: 3000 });
    await popup.getByTestId("lick-play").click(); // stop

    // Box row changes the legend.
    await popup.getByTestId("scale-box-2").click();
    await expect(popup.getByTestId("scale-fretmap-legend")).toContainText("Box 2, frets 7–10");
    // Clearing the lick keeps the popup (and the box) open.
    await popup.getByTestId("lick-clear").click();
    await expect(popup.getByTestId("lick-bar")).toBeHidden();
    await expect(popup.getByTestId("scale-fretmap-legend")).toContainText("Box 2, frets 7–10");

    // Escape closes the popup.
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
  });

  test("jam starts, the chord changes within 4 bars, and it stops", async ({ page }) => {
    await page.goto("/learn/solo");
    await page.getByTestId("jam-toggle").scrollIntoViewIfNeeded();
    // Fast tempo so four bars is a few seconds.
    await page.getByTestId("jam-bpm").fill("140");
    const chord = page.getByTestId("jam-chord");
    await expect(chord).toHaveText("Am");
    await page.getByTestId("jam-toggle").click();
    await expect(page.getByTestId("jam-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(chord).not.toHaveText("Am", { timeout: 4 * 4 * (60 / 140) * 1000 + 3000 });
    await page.getByTestId("jam-toggle").click();
    await expect(page.getByTestId("jam-toggle")).toHaveAttribute("aria-pressed", "false");
  });

  test("no horizontal page scroll at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/learn/solo");
    await expect(page.getByTestId("solo-page")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
