import { expect, test } from "@playwright/test";

test.describe("Solo in any key", () => {
  test("loads, walks the frame and lights its notes", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon/.test(m.text()) && !/404/.test(m.text())) errors.push(m.text());
    });

    await page.goto("/learn/any-key");
    await expect(page.getByTestId("any-key-page")).toBeVisible();
    const frame = page.getByTestId("mv-frame");
    await expect(frame.getByTestId("mv-frame-summary")).toContainText("A minor pentatonic");
    await expect(frame.getByTestId("mv-frame-summary")).toContainText("fret 5");
    await expect(frame.locator('[data-tone="root"]')).toHaveCount(3);

    await frame.getByTestId("mv-walk").click();
    await expect(frame.getByTestId("mv-walk")).toHaveAttribute("aria-pressed", "true");
    await expect(frame.locator(".solo-hl.is-on").first()).toBeAttached({ timeout: 4000 });
    await frame.getByTestId("mv-walk").click();
    await expect(frame.getByTestId("mv-walk")).toHaveAttribute("aria-pressed", "false");
    expect(errors).toEqual([]);
  });

  test("moving the frame changes the key; variations add notes", async ({ page }) => {
    await page.goto("/learn/any-key");
    const frame = page.getByTestId("mv-frame");
    await frame.getByTestId("mv-move-up").click();
    await expect(frame.getByTestId("mv-frame-summary")).toContainText("B♭ minor pentatonic");
    await expect(frame.getByTestId("mv-frame-summary")).toContainText("fret 6");

    await frame.getByTestId("mv-anchor-5").click();
    await expect(frame.getByTestId("mv-frame-summary")).toContainText("5th string, fret 1");

    await frame.getByTestId("mv-var-dorian").click();
    await expect(frame.locator('[data-tone="added"]').first()).toBeAttached();
    await page.getByTestId("mv-chart-7").click();
    await expect(frame.getByTestId("mv-frame-summary")).toContainText("G Dorian");
  });

  test("a variation card plays its phrase", async ({ page }) => {
    await page.goto("/learn/any-key");
    const card = page.getByTestId("mv-card-blues");
    await card.getByTestId("mv-hear-blues").scrollIntoViewIfNeeded();
    await card.getByTestId("mv-hear-blues").click();
    await expect(card.getByTestId("mv-hear-blues")).toHaveAttribute("aria-pressed", "true");
    await expect(card.locator(".solo-hl.is-on").first()).toBeAttached({ timeout: 4000 });
    await card.getByTestId("mv-hear-blues").click();
  });

  test("any chord: picks the frame, plays a melodic arpeggio and the straight one", async ({ page }) => {
    await page.goto("/learn/any-key");
    const chord = page.getByTestId("mv-chord");
    await chord.getByTestId("mv-chord-root-0").click();
    await chord.getByTestId("mv-quality-7").click();
    await expect(chord.getByTestId("mv-chord-name")).toHaveText("C7");
    await expect(chord.getByTestId("mv-chord-card")).toContainText("Major frame");

    const arp = page.getByTestId("mv-arpeggios");
    await arp.getByTestId("mv-play-enclose").scrollIntoViewIfNeeded();
    await arp.getByTestId("mv-play-enclose").click();
    await expect(arp.getByTestId("mv-play-enclose")).toHaveAttribute("aria-pressed", "true");
    await expect(arp.getByTestId("mv-arp-viewer")).toContainText("Enclosure");
    await expect(arp.locator(".solo-hl.is-on").first()).toBeAttached({ timeout: 4000 });
    await expect(arp.locator(".tab-tok.is-on").first()).toBeAttached({ timeout: 4000 });

    await arp.getByTestId("mv-ab-robot").click();
    await expect(arp.getByTestId("mv-ab-robot")).toHaveAttribute("aria-pressed", "true");
    await expect(arp.getByTestId("mv-play-enclose")).toHaveAttribute("aria-pressed", "false");
    await arp.getByTestId("mv-ab-robot").click();
  });

  test("progression: plays over the band, bars light, follow mode moves the frame", async ({ page }) => {
    await page.goto("/learn/any-key");
    const prog = page.getByTestId("mv-progression");
    await prog.getByTestId("mv-prog-jazz").click();
    await expect(prog.getByTestId("mv-prog-bars")).toContainText("Bm7");
    await prog.getByTestId("mv-prog-play").scrollIntoViewIfNeeded();
    await prog.getByTestId("mv-prog-play").click();
    await expect(prog.locator('[data-hl="b_0"].is-on')).toBeAttached({ timeout: 4000 });
    await expect(prog.locator(".solo-hl.is-on").first()).toBeAttached({ timeout: 4000 });
    await prog.getByTestId("mv-prog-play").click();
    await expect(prog.getByTestId("mv-prog-play")).toHaveAttribute("aria-pressed", "false");

    await prog.getByTestId("mv-mode-follow").click();
    await expect(prog.getByTestId("mv-prog-bars")).toContainText("fret");
  });

  test("no horizontal page scroll at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/learn/any-key");
    await expect(page.getByTestId("any-key-page")).toBeVisible();
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(sw).toBeLessThanOrEqual(iw);
  });
});
