import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("music-decoder", JSON.stringify({ state: { onboarded: true }, version: 1 }));
  });
});

test("CAGED map: shapes, boxes, playback, roots view and root hunt", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/learn/caged");

  const neck = page.getByTestId("caged-neck");
  await expect(page.getByRole("heading", { level: 1, name: "CAGED & pentatonic map" })).toBeVisible();
  await expect(page.getByTestId("caged-key-line")).toContainText("C major pentatonic");
  await expect(page.getByTestId("caged-key-line")).toContainText("A minor");

  // All five: C A G E D bands from the nut, then C again at 12.
  const bands = await neck.locator("[data-band]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-band")}${e.getAttribute("data-lo")}`));
  expect(bands.slice(0, 6)).toEqual(["C0", "A2", "G5", "E7", "D9", "C12"]);
  await expect(page.getByTestId("caged-chain").locator("li")).toHaveCount(5);

  // Focus the E shape: the 8th-fret barre chord, inside box 2.
  await page.getByTestId("caged-shape-E").click();
  await expect(neck).toHaveAttribute("data-selected", "E");
  await expect(page.getByTestId("caged-focus")).toContainText("E shape · box 2");
  await expect(neck.locator('[data-chord="E"]')).toHaveCount(6);
  await expect(neck.locator('[data-chord="E"][data-string="6"]')).toHaveAttribute("data-fret", "8");

  // Hear it: chord then box, a note lights up, Stop clears it.
  await page.getByTestId("caged-play-shape").click();
  await expect.poll(() => page.locator(".cg-note.is-on").count(), { timeout: 6000 }).toBeGreaterThan(0);
  await page.getByTestId("caged-play-shape").click();
  await expect(page.locator(".cg-note.is-on")).toHaveCount(0);

  await page.getByTestId("caged-next").click();
  await expect(neck).toHaveAttribute("data-selected", "D");

  // Switch key to G minor: chord shapes are B♭ major, roots are G.
  await page.getByTestId("caged-key").selectOption("7");
  await page.getByTestId("caged-mode-minor").click();
  await expect(page.getByTestId("caged-key-line")).toContainText("G minor pentatonic");
  await page.getByTestId("caged-show-roots").click();
  await expect(neck).toHaveAttribute("data-view", "roots");
  const roots = neck.locator("[data-root]");
  expect(await roots.count()).toBeGreaterThan(6);
  for (const r of await roots.all()) {
    const s = Number(await r.getAttribute("data-string")), f = Number(await r.getAttribute("data-fret"));
    expect(({ 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 }[s]! + f) % 12).toBe(7);
  }
  expect(await neck.getByTestId("octave-link").count()).toBeGreaterThan(3);

  // Root hunt: answer two rounds correctly.
  await page.getByTestId("hunt-start").click();
  for (let round = 0; round < 2; round++) {
    const prompt = page.getByTestId("hunt-prompt");
    await expect(prompt).toContainText(`Round ${round + 1}/10`);
    const s = Number(await prompt.getAttribute("data-string")), pc = Number(await prompt.getAttribute("data-pc"));
    const f = (pc - ({ 6: 40, 5: 45, 4: 50 } as Record<number, number>)[s]! % 12 + 12) % 12;
    await page.getByTestId(`hunt-cell-${s}-${f}`).click();
    await expect(page.getByTestId("hunt-ok")).toHaveCount(1);
  }
  await expect(page.getByTestId("hunt-prompt")).toContainText("Round 3/10");
  await expect(page.getByTestId("hunt-score")).toHaveText("Score 2/10");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("learn page links to the CAGED map", async ({ page }) => {
  await page.goto("/learn");
  await page.getByRole("link", { name: /CAGED/ }).first().click();
  await expect(page).toHaveURL(/\/learn\/caged$/);
});
