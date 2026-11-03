import { expect, test } from "@playwright/test";

test.describe("Diagonal licks", () => {
  test("loads with a route on the neck, plays the lick and lights notes and TAB", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon/.test(m.text()) && !/404/.test(m.text())) errors.push(m.text());
    });

    await page.goto("/learn/diagonal");
    await expect(page.getByTestId("diagonal-page")).toBeVisible();
    const practice = page.getByTestId("dg-practice");
    await expect(practice).toHaveAttribute("data-lick", "dg-staircase");
    await expect(practice.getByTestId("lick-route")).toBeAttached();
    await expect(practice.locator('[data-melody="true"]').first()).toBeAttached();

    await practice.getByTestId("dg-play").scrollIntoViewIfNeeded();
    await practice.getByTestId("dg-play").click();
    await expect(practice.getByTestId("dg-play")).toHaveAttribute("aria-pressed", "true");
    await expect(practice.locator(".solo-hl.is-on").first()).toBeAttached({ timeout: 4000 });
    await expect(practice.locator(".tab-tok.is-on").first()).toBeAttached({ timeout: 4000 });
    await expect(practice.getByTestId("dg-status")).toContainText("Loop 1");
    await practice.getByTestId("dg-play").click();
    await expect(practice.getByTestId("dg-play")).toHaveAttribute("aria-pressed", "false");
    expect(errors).toEqual([]);
  });

  test("switches lick, loops a phrase and speeds up each loop", async ({ page }) => {
    await page.goto("/learn/diagonal");
    await page.getByTestId("dg-pick-dg-night-drive").click();
    const practice = page.getByTestId("dg-practice");
    await expect(practice).toHaveAttribute("data-lick", "dg-night-drive");
    await expect(page).toHaveURL(/#dg-night-drive$/);

    // Phrase 3 (descending fours, 2 bars = 4 s at 120 BPM) from 100%, speeding up each loop.
    await practice.getByTestId("dg-part-2").click();
    await expect(practice.getByTestId("dg-play")).toContainText("Play phrase 3");
    await practice.getByTestId("dg-preset-100").click();
    await practice.getByTestId("dg-ramp").check();
    await expect(practice.getByTestId("dg-loop")).toBeChecked();
    await practice.getByTestId("dg-play").click();
    await expect(practice.getByTestId("dg-status")).toContainText("Loop 1 · 100%");
    await expect(practice.getByTestId("dg-status")).toContainText("Loop 2 · 105%", { timeout: 8000 });
    await practice.getByTestId("dg-play").click();
    await expect(practice.getByTestId("dg-status")).not.toContainText("Loop");
  });

  test("melody only, note-by-note picker and the fretboard map", async ({ page }) => {
    await page.goto("/learn/diagonal#dg-blues-ladder");
    const practice = page.getByTestId("dg-practice");
    await expect(practice).toHaveAttribute("data-lick", "dg-blues-ladder");

    await practice.getByTestId("dg-melody").click();
    await expect(practice.getByTestId("dg-melody")).toHaveAttribute("aria-pressed", "true");
    await expect(practice.locator(".solo-hl.is-on").first()).toBeAttached({ timeout: 4000 });
    await practice.getByTestId("dg-melody").click();

    await practice.getByTestId("dg-pick-notes").click();
    await expect(page.getByTestId("greats-picker")).toBeVisible();
    await page.getByTestId("greats-picker-skip").click();
    await expect(page.getByTestId("greats-picker")).toHaveAttribute("data-step", "1");
    await page.getByTestId("greats-picker-close").click();

    await practice.getByTestId("dg-show-map").click();
    const popup = page.getByTestId("scale-fretmap-float");
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId("lick-bar")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
  });

  test("is linked from Lead solos and has no horizontal page scroll at 390px", async ({ page }) => {
    await page.goto("/learn/solo");
    await page.getByTestId("solo-diagonal-link").click();
    await expect(page.getByTestId("diagonal-page")).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId("diagonal-page")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
