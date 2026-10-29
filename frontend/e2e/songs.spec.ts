import { expect, test, type Page } from "@playwright/test";

/** The backend's online lookup, mocked (the real one calls GetSongBPM with an API key). */
async function mockOnline(page: Page, body: unknown, status = 200) {
  await page.route("**/api/song-search?**", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }));
}
const OFF = { configured: false, source: "GetSongBPM.com", results: [] };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("music-decoder", JSON.stringify({ state: { onboarded: true }, version: 1 })));
});

test.describe("Song search", () => {
  test("songbook song: key, chord chart that plays, shapes and scale", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await mockOnline(page, OFF);
    await page.goto("/songs");

    const input = page.getByTestId("song-search-input");
    await input.fill("rising sun");
    await expect(page.getByTestId("song-suggestions")).toContainText("The House of the Rising Sun");
    await input.press("Enter");

    const detail = page.getByTestId("song-detail");
    await expect(detail).toHaveAttribute("data-song", "rising-sun");
    await expect(page).toHaveURL(/\/songs\?q=rising\+sun|\/songs\?q=rising%20sun/);
    await expect(page.getByTestId("song-fact-key")).toContainText("A minor");
    await expect(page.getByTestId("song-fact-time")).toContainText("6/8");
    const section = page.getByTestId("song-section-0");
    await expect(section.locator("[data-chord]")).toHaveCount(16);
    expect(await section.locator("[data-chord]").evaluateAll((els) => els.slice(0, 4).map((e) => e.getAttribute("data-chord")))).toEqual(["Am", "C", "D", "F"]);

    // Play the chart: one chord lights at a time; Stop clears it.
    await page.getByTestId("song-play-0").click();
    await expect.poll(() => section.locator(".song-chip.is-on").count(), { timeout: 8000 }).toBe(1);
    await page.getByTestId("song-play-0").click();
    await expect(section.locator(".is-on")).toHaveCount(0);

    // Shapes for every chord in the song, and the scale.
    for (const c of ["Am", "C", "D", "F", "E"]) await expect(page.getByTestId(`song-shape-${c}`)).toBeVisible();
    await expect(page.getByTestId("song-scale-notes")).toHaveText("A · B · C · D · E · F · G");
    await page.getByTestId("song-show-neck").click();
    await expect(page.getByTestId("song-caged-neck")).toBeVisible();

    // The online side says it's off (no API key).
    await expect(page.getByTestId("song-online-off")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("typos still find the song", async ({ page }) => {
    await mockOnline(page, OFF);
    await page.goto("/songs?q=twinkel%20twinkel");
    await expect(page.getByTestId("song-detail")).toHaveAttribute("data-song", "twinkle");
    await expect(page.getByTestId("song-fact-key")).toContainText("C major");
  });

  test("online song: key, capo tip, the key's chords and progressions", async ({ page }) => {
    await mockOnline(page, {
      configured: true, source: "GetSongBPM.com",
      results: [{ id: "x1", title: "Some Pop Song", artist: "A Band", key: "F♯m", tempo: 104, time_sig: "4/4", uri: "https://getsongbpm.com/song/x1" }],
    });
    await page.goto("/songs");
    await page.getByTestId("song-search-input").fill("some pop song");
    await page.getByTestId("song-search-go").click();
    await page.getByTestId("song-online-x1").click();

    const detail = page.getByTestId("song-detail");
    await expect(detail).toHaveAttribute("data-key", "F♯m");
    await expect(page.getByTestId("song-fact-key")).toContainText("F♯ minor");
    await expect(page.getByTestId("song-fact-capo")).toContainText("Fret 2, play Em shapes");
    await expect(page.getByTestId("song-fact-tempo")).toContainText("104 BPM");
    await expect(page.getByTestId("song-online-note")).toContainText("aren't available online");
    await expect(page.getByTestId("song-key-chords").locator("[data-chord]").first()).toHaveAttribute("data-chord", "F♯m");
    await page.getByTestId("song-prog-0").click();
    await expect.poll(() => detail.locator(".song-prog-chord.is-on").count(), { timeout: 8000 }).toBe(1);
    await page.getByTestId("song-prog-0").click();
    await expect(page.getByTestId("song-credit").getByRole("link", { name: "GetSongBPM.com" })).toHaveAttribute("href", "https://getsongbpm.com");
  });

  test("online lookup errors are shown, songbook still works", async ({ page }) => {
    await mockOnline(page, { detail: "Couldn't reach the song key service." }, 502);
    await page.goto("/songs?q=jingle%20bells");
    await expect(page.getByTestId("song-detail")).toHaveAttribute("data-song", "jingle-bells");
    await expect(page.getByTestId("song-results-online")).toContainText("Couldn't reach the song key service.");
  });

  test("search from the sidebar or the phone header", async ({ page, isMobile }) => {
    await mockOnline(page, OFF);
    await page.goto("/");
    if (isMobile) {
      await page.getByTestId("mobile-song-search").click();
      await expect(page).toHaveURL(/\/songs$/);
      await page.getByTestId("song-example-Canon in D").click();
      await expect(page.getByTestId("song-detail")).toHaveAttribute("data-song", "canon");
    } else {
      const box = page.getByTestId("sidebar-song-search").locator("input");
      await box.fill("amazing grace");
      await box.press("Enter");
      await expect(page).toHaveURL(/\/songs\?q=amazing/);
      await expect(page.getByTestId("song-detail")).toHaveAttribute("data-song", "amazing-grace");
      await expect(page.getByTestId("song-fact-key")).toContainText("G major");
    }
  });
});
