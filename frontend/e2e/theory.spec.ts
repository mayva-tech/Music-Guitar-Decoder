import { expect, test } from "@playwright/test";

test.describe("Theory map", () => {
  test("loads, selects Chord, plays an example, and advances the tour", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/learn/theory");
    await expect(page.getByTestId("theory-page")).toBeVisible();
    expect(errors).toEqual([]);

    await page.getByTestId("theory-node-chord").click();
    await expect(page.getByTestId("theory-term-panel")).toContainText("Chord");
    await expect(page.getByTestId("theory-term-panel")).toContainText("Interval");

    const example = page.getByTestId("theory-example-btn").first();
    await example.click();
    await expect(example).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".is-on").first()).toBeVisible({ timeout: 2000 });
    await example.click();
    await expect(example).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("theory-tour-start").click();
    await expect(page.getByTestId("theory-tour-step")).toContainText("Step 1 of");
    await page.getByTestId("theory-tour-next").click();
    await expect(page.getByTestId("theory-tour-step")).toContainText("Step 2 of");
    await page.getByTestId("theory-tour-pause").click();
  });

  test("no horizontal page scroll at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/learn/theory");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
