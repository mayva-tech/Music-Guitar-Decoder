import { expect, test } from "@playwright/test";

test.describe("Backing tracks", () => {
  test("loads with ten genres of twenty loops and lesson links", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // The app has no favicon yet; its 404 is not this page's error.
      if (m.type() === "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text());
    });

    await page.goto("/learn/backing");
    await expect(page.getByTestId("backing-page")).toBeVisible();
    await expect(page.getByTestId("backing-genres").getByRole("tab")).toHaveCount(10);
    await expect(page.getByTestId("backing-tracks").locator("li")).toHaveCount(20);
    await expect(page.getByTestId("backing-genre-lessons").locator("a").first()).toBeVisible();

    await page.getByTestId("backing-genre-blues").click();
    await expect(page.getByTestId("backing-genre-intro")).toContainText("Blues");
    await expect(page.getByTestId("backing-player-title")).toHaveText("12-Bar Shuffle in A");
    await expect(page.getByTestId("backing-track-lessons")).toContainText("The 12-bar blues");
    expect(page.url()).toContain("#blues");

    // Tempo filter narrows the list.
    await page.getByTestId("backing-band-slow").click();
    const slow = await page.getByTestId("backing-tracks").locator("li").count();
    expect(slow).toBeGreaterThan(0);
    expect(slow).toBeLessThan(20);
    expect(errors).toEqual([]);
  });

  test("plays a loop: count-in, chords advance, grid lights, tempo and stop", async ({ page }) => {
    await page.goto("/learn/backing#pop-02");
    await expect(page.getByTestId("backing-player-title")).toHaveText("Dancefloor Lights");
    await page.getByTestId("backing-bpm").fill("180");
    await expect(page.getByTestId("backing-bpm-value")).toHaveText("180 BPM");
    await expect(page.getByTestId("backing-chord")).toHaveText("Am");

    await page.getByTestId("backing-toggle").click();
    await expect(page.getByTestId("backing-toggle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("backing-grid").locator(".bk-step.is-on").first()).toBeAttached({ timeout: 4000 });
    // Count-in bar + one bar at 180 BPM ≈ 2.7 s.
    await expect(page.getByTestId("backing-chord")).toHaveText("F", { timeout: 8000 });
    await expect(page.getByTestId("backing-progression").locator(".is-on")).toHaveCount(1);

    await page.getByTestId("backing-part-drums").click();
    await expect(page.getByTestId("backing-part-drums")).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("backing-toggle").click();
    await expect(page.getByTestId("backing-toggle")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("backing-grid").locator(".is-on")).toHaveCount(0);
  });

  test("row play buttons switch loops, the map opens, and lesson links land on the lesson", async ({ page }) => {
    await page.goto("/learn/backing#jazz");
    await page.getByTestId("backing-play-jazz-03").click();
    await expect(page.getByTestId("backing-play-jazz-03")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("backing-player-title")).toHaveText("Jazz Blues in F");
    await page.getByTestId("backing-play-jazz-01").click();
    await expect(page.getByTestId("backing-play-jazz-03")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("backing-play-jazz-01")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("backing-play-jazz-01").click();

    await page.getByTestId("backing-show-map").click();
    const popup = page.getByTestId("scale-fretmap-float");
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId("chord-pill-Dm7")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByTestId("backing-track-lessons").getByTestId("lesson-link-solo-target").click();
    await expect(page).toHaveURL(/\/learn\/solo#target/);
  });

  test("no horizontal page scroll at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/learn/backing#metal-02");
    await expect(page.getByTestId("backing-player")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
