import { expect, test } from "@playwright/test";

// Skip onboarding: the home page only renders for onboarded users.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("music-decoder", JSON.stringify({ state: { onboarded: true }, version: 1 }));
  });
});

test("home: beginner corner teaches strumming, picking and fingerstyle", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");

  const corner = page.getByTestId("beginner-corner");
  await expect(corner).toBeVisible();
  await expect(corner.getByRole("heading", { name: "Strum chords" })).toBeVisible();
  await expect(corner.getByRole("img", { name: /Strumming/ })).toBeVisible();

  // Wide screens: the corner sits in the right-hand column, beside the hero.
  const vw = page.viewportSize()!.width;
  if (vw >= 1024) {
    const hero = await page.getByRole("heading", { level: 1 }).boundingBox();
    const box = await corner.boundingBox();
    expect(box!.x).toBeGreaterThan(hero!.x + 300);
    expect(box!.y).toBeLessThan(hero!.y + 120);
  }

  // Hear it: one pattern slot lights at a time, and Stop clears it.
  await page.getByTestId("beginner-play").click();
  await expect(corner.locator(".bc-slot.is-on")).toHaveCount(1, { timeout: 6000 });
  await expect.poll(() => corner.locator(".bc-str.is-on").count(), { timeout: 3000 }).toBeGreaterThan(0); // lit strings (lines have no height, so check the count)
  await page.getByTestId("beginner-play").click();
  await expect(corner.locator(".is-on")).toHaveCount(0);

  await page.getByTestId("beginner-tab-pick").click();
  await expect(page.getByTestId("beginner-tab-pick")).toHaveAttribute("aria-selected", "true");
  await expect(corner.getByRole("heading", { name: "Pick single notes" })).toBeVisible();
  await expect(corner.getByText("One finger per fret")).toBeVisible();

  await page.getByTestId("beginner-tab-fingers").click();
  await expect(corner.getByRole("heading", { name: "Pluck with your fingers" })).toBeVisible();
  await expect(corner.getByText("p i m a m i m i")).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
