import { expect, test } from "@playwright/test";

test.describe("Play by ear", () => {
  test("loads, strip scrolls, examples and drills work", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/learn/by-ear");
    await expect(page.getByTestId("ear-page")).toBeVisible();
    expect(errors).toEqual([]);

    await page.getByTestId("ear-strip-home").click();
    await expect(page.locator("#step-home")).toBeInViewport();

    const thenG = page.getByTestId("ear-step-home").getByTestId("theory-example-btn").filter({ hasText: "…then G" });
    await thenG.click();
    await expect(thenG).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".is-on").first()).toBeVisible({ timeout: 4000 });

    const pad = page.getByTestId("ear-tap-pad");
    await pad.scrollIntoViewIfNeeded();
    for (let i = 0; i < 6; i++) {
      await pad.click();
      await page.waitForTimeout(120);
    }
    const bpm = page.getByTestId("ear-tap-bpm");
    await expect(bpm).not.toHaveText("…");
    await expect(bpm).toHaveText(/\d+/);

    const drill = page.getByTestId("ear-drill-home");
    await drill.scrollIntoViewIfNeeded();
    await expect(page.getByTestId("ear-drill-score-home")).toHaveText("0 of 0");
    await page.getByTestId("ear-drill-option-home-0").click();
    await expect(page.getByTestId("ear-drill-feedback-home")).not.toBeEmpty();
    await expect(page.getByTestId("ear-drill-score-home")).toHaveText(/of 1/);
  });

  test("no horizontal page scroll at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/learn/by-ear");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
