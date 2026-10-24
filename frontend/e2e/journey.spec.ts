import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page, hand: "Right-handed guitar" | "Left-handed guitar" = "Right-handed guitar") {
  await page.goto("/");
  await page.waitForURL("**/onboarding");
  await page.getByRole("textbox").fill("My favourite riff");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Never touched a guitar").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText(hand).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Rock", { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Open the recorder" }).click();
  await page.waitForURL("**/record");
}

async function demoToLearn(page: Page) {
  await page.getByRole("button", { name: "Use the demo tune instead" }).click();
  await page.waitForURL("**/decoder");
  await expect(page.getByTestId("piano-roll")).toBeVisible();
  await page.getByRole("button", { name: "Find chords" }).click();
  for (const k of ["simple", "genre", "alternative"]) await expect(page.getByTestId(`harmony-${k}`)).toBeVisible();
  const simple = page.getByTestId("harmony-simple");
  for (const chord of ["C", "F", "G"]) await expect(simple.getByText(chord, { exact: true }).first()).toBeVisible();
  await page.getByTestId("generate-solo").click();
  await page.waitForURL("**/learn");
  await expect(page.getByTestId("fretboard")).toBeVisible();
}

test("beginner journey: demo tune → chords → solo → fretboard, TAB and finger GPS", async ({ page }) => {
  await onboard(page);
  await demoToLearn(page);

  // Nut on the LEFT, frets increasing left to right, thin e on top (standard TAB order).
  const board = page.getByTestId("fretboard");
  await expect(board).toHaveAttribute("data-nut-side", "left");
  const xs = await page.locator("[data-fret-number]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("x"))));
  const nums = await page.locator("[data-fret-number]").evaluateAll((els) => els.map((e) => Number(e.textContent)));
  expect(nums.slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
  for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  const nutX = Number(await page.getByTestId("nut").getAttribute("x1"));
  expect(nutX).toBeLessThan(xs[0]);
  const ys = await page.locator("[data-string-label]").evaluateAll((els) => els.map((e) => [Number(e.getAttribute("data-string-label")), Number(e.getAttribute("y"))]));
  expect(ys.map((p) => p[0])).toEqual([1, 2, 3, 4, 5, 6]);
  expect(ys[0][1]).toBeLessThan(ys[5][1]);

  // First note: open thinnest string, marker outside the nut.
  await expect(page.getByTestId("current-note")).toHaveText("E4");
  await expect(page.getByTestId("instructions")).toContainText("No finger needed. Just pluck this string.");
  const marker = page.getByTestId("marker-current");
  await expect(marker).toHaveAttribute("data-fret", "0");
  expect(Number(await marker.getAttribute("data-x"))).toBeLessThan(nutX);

  // Select G4 in the TAB → fretboard + GPS follow.
  await page.getByTestId("tab-note-1").click();
  await expect(page.getByTestId("current-note")).toHaveText("G4");
  await expect(page.getByTestId("instructions")).toContainText("Press the third fret.");
  await expect(page.getByTestId("instructions")).toContainText("Use your ring finger.");
  await expect(marker).toHaveAttribute("data-string", "1");
  await expect(marker).toHaveAttribute("data-fret", "3");
  await expect(page.getByTestId("gps-finger")).toHaveText("3");

  // Select on the fretboard → TAB follows (C4 = string 2 fret 1 is note index 5).
  await page.getByRole("img", { name: /Play/ }).locator('rect[aria-label="the second-thinnest string, fret 1"]').click();
  await expect(page.getByTestId("current-note")).toHaveText("C4");
  await expect(page.locator('[data-testid^="tab-note-"][data-current="true"]')).toHaveAttribute("data-fret", "1");

  // TAB string order: thin e on top.
  const tabLabels = await page.locator("[data-tab-label]").evaluateAll((els) => els.map((e) => e.textContent));
  expect(tabLabels).toEqual(["e", "B", "G", "D", "A", "E"]);

  // Step-by-step practice through the first bar is recorded honestly as "not listening".
  await page.getByTestId("tab-note-0").click();
  await page.getByTestId("mode-manual").click();
  await expect(page.getByTestId("feedback")).toContainText("isn't listening");
  for (let i = 0; i < 4; i++) await page.getByTestId("manual-next").click();
  await expect(page.getByTestId("insight")).toBeVisible();
  await page.getByRole("button", { name: "Why does this work?" }).click();

  // Composition is in the library; practice is in the history.
  await page.goto("/library");
  await expect(page.getByTestId("library-item").first()).toContainText("Demo: First Rock Tune");
  await page.goto("/progress");
  await expect(page.getByTestId("skills")).toBeVisible();
});

test("record a hummed tune through the microphone and decode it on the server", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "uses Chromium's fake audio capture file");
  await onboard(page);
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.waitForTimeout(6800); // the fake microphone hums E4 G4 E4 C4 F4 C4 F4 C4 at 80 BPM
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByTestId("playback")).toBeVisible();
  await page.getByRole("button", { name: "Decode my tune" }).click();
  await expect(page.getByTestId("job-stages")).toBeVisible();
  await page.waitForURL("**/decoder", { timeout: 60_000 });
  await expect(page.getByTestId("piano-roll")).toBeVisible();
  const names = await page.locator('[data-testid^="note-chip-"]').allInnerTexts();
  expect(names.slice(0, 4).map((n) => n.replace("?", ""))).toEqual(["E4", "G4", "E4", "C4"]);
});

test("Follow Me listens through the microphone and gives real feedback", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "uses Chromium's fake audio capture file");
  await onboard(page);
  await demoToLearn(page);
  await page.getByTestId("mode-follow").click();
  // The fake microphone hums E4 then G4 — the first two notes of the demo solo.
  await expect(page.getByTestId("feedback")).toHaveText("Great! That's the right note.", { timeout: 15_000 });
  await expect(page.getByTestId("current-note")).not.toHaveText("E4", { timeout: 10_000 });
  // Later the hum plays a note that doesn't match the solo: the app says what it heard and how to fix it.
  await expect(page.getByTestId("feedback")).toContainText("I heard", { timeout: 20_000 });
  await expect(page.getByTestId("feedback")).toContainText(/Try .*string/);
});

test("microphone permission denied is explained and manual practice is offered", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  await onboard(page);
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText("Microphone access was blocked");
  await demoToLearn(page);
  await page.getByTestId("mode-follow").click();
  await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText("Microphone access was blocked");
  await page.getByRole("button", { name: "Practise step by step without the microphone" }).click();
  await expect(page.getByTestId("feedback")).toContainText("isn't listening");
});

test("uploading an unsupported file is rejected before upload", async ({ page }) => {
  await onboard(page);
  await page.getByTestId("upload-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText("isn't supported");
});

test("left-handed view mirrors the neck without changing the notes", async ({ page }) => {
  await onboard(page, "Left-handed guitar");
  await demoToLearn(page);
  await expect(page.getByTestId("fretboard")).toHaveAttribute("data-nut-side", "right");
  const xs = await page.locator("[data-fret-number]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("x"))));
  for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeLessThan(xs[i - 1]);
  await page.getByTestId("tab-note-1").click();
  await expect(page.getByTestId("marker-current")).toHaveAttribute("data-fret", "3");
});

test("layout fits the screen without sideways scrolling", async ({ page }) => {
  await onboard(page);
  await demoToLearn(page);
  for (const path of ["/", "/record", "/decoder", "/learn", "/riffs", "/library", "/progress", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
    // No card or panel may stick out past the screen edge (even if the page itself doesn't scroll).
    const wide = await page.evaluate(() => [...document.querySelectorAll("main li, main section")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length);
    expect(wide, `elements wider than the screen on ${path}`).toBe(0);
    await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeAttached();
  }
});

test("genre lead solo: techniques in TAB, hand overlay, scale shape and theory", async ({ page }) => {
  await onboard(page);
  await demoToLearn(page);
  await page.getByTestId("part-lead").click();
  await page.getByTestId("techniques-select").selectOption("all");

  // TAB shows bends written from the data, e.g. 8b9 (wait for the rewritten lead to arrive).
  const tabTexts = () => page.locator('[data-testid^="tab-note-"]').evaluateAll((els) => els.map((e) => e.textContent ?? ""));
  await expect.poll(async () => (await tabTexts()).some((t) => /^\d+b\d+/.test(t)), { timeout: 20_000 }).toBe(true);
  const tokens = await tabTexts();

  // Pick the first bend: GPS explains it and the fretboard draws the bend arrow.
  const bendIndex = tokens.findIndex((t) => /^\d+b\d+$/.test(t) || /^\d+b\d+~$/.test(t));
  await page.getByTestId(`tab-note-${bendIndex}`).click();
  await expect(page.getByTestId("current-technique")).toContainText("Bend");
  await expect(page.getByTestId("instructions")).toContainText("push the string towards the ceiling");
  await expect(page.getByTestId("guide-bend")).toBeVisible();

  // Translucent hand: the pressing finger matches the note's finger, one finger per fret.
  const hand = page.getByTestId("hand-overlay");
  await expect(hand).toBeVisible();
  const finger = await page.getByTestId("gps-finger").innerText();
  await expect(page.getByTestId(`hand-finger-${finger}`)).toHaveAttribute("data-pressing", "true");
  expect(await page.locator('[data-pressing="true"]').count()).toBe(1);
  const opacity = await hand.evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBeCloseTo(0.5, 1);
  await page.getByLabel("Hand opacity").first().fill("0.8");
  expect(Number(await hand.evaluate((el) => getComputedStyle(el).opacity))).toBeCloseTo(0.8, 1);
  await page.getByTestId("toggle-hand").click();
  await expect(hand).toHaveCount(0);

  // Scale shape + interval labels.
  await page.getByTestId("toggle-scale").click();
  await expect(page.getByTestId("scale-overlay")).toBeVisible();
  await page.getByTestId("marker-label").selectOption("interval");
  await expect(page.getByTestId("theory-panel")).toContainText("minor pentatonic");

  // Switch genre to blues: chords become 7ths, feel becomes shuffle.
  await page.getByTestId("genre-blues").click();
  await expect(page.getByTestId("genre-blues")).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
  await expect(page.getByTestId("theory-panel")).toContainText("blues scale");
  await expect(page.getByTestId("theory-panel")).toContainText("C7");
  await expect(page.getByText(/^Shuffle feel, /)).toBeVisible();
});

test("riff practice: pick a riff, practise it with TAB, techniques and an easy version", async ({ page }) => {
  await onboard(page);
  await page.goto("/riffs");
  await expect(page.getByTestId("riff-mountain-king")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Genre" }).getByRole("radio", { name: "Blues" }).click();
  await expect(page.getByTestId("riff-mountain-king")).toHaveCount(0);
  await expect(page.getByTestId("riff-blue-curl")).toContainText("Half-step bends");
  await page.getByTestId("practise-blue-curl").click();
  await page.waitForURL("**/learn");

  await expect(page.getByTestId("part-melody")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("part-melody")).toHaveText("The riff");
  await expect(page.getByTestId("riff-tips")).toContainText("blues");
  const texts = await page.locator('[data-testid^="tab-note-"]').evaluateAll((els) => els.map((e) => e.textContent ?? ""));
  expect(texts).toContain("8b9");
  await expect(page.getByTestId("current-note")).toHaveText("A4");

  // The bend: GPS says bend, the hand presses with the fretting finger.
  await page.getByTestId("tab-note-1").click();
  await expect(page.getByTestId("current-note")).toHaveText("C#5");
  await expect(page.getByTestId("current-technique")).toContainText("half step");
  await expect(page.getByTestId("guide-bend")).toBeVisible();

  // Easy version for a first-time player stays on the easy strings.
  await page.getByTestId("part-solo").click();
  await expect(page.getByTestId("part-solo")).toHaveText("Easy version");
  const frets = await page.locator('[data-testid^="tab-note-"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-fret"))));
  expect(Math.max(...frets)).toBeLessThanOrEqual(3);
});

test("modern-style riffs and animated finger changes", async ({ page }) => {
  await onboard(page);
  await page.goto("/riffs");
  await page.getByRole("radiogroup", { name: "Type" }).getByRole("radio", { name: "Modern styles" }).click();
  await expect(page.locator('[data-testid^="vibe-"]')).toHaveCount(10);
  await expect(page.getByTestId("vibe-gallop-run")).toHaveText("Metal");
  await page.getByTestId("practise-velvet-slide").click();
  await page.waitForURL("**/learn");

  // The struck string lights up from the pressed fret.
  const marker = page.getByTestId("marker-current");
  const pressed = page.getByTestId("pressed-string");
  await expect(pressed).toHaveAttribute("data-string", (await marker.getAttribute("data-string"))!);

  // Moving to the slide: the hand animates, then the pressing fingertip lands on the note.
  await page.getByTestId("tab-note-1").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="hand-overlay"]')?.getAttribute("data-animating") === "true",
    undefined, { polling: "raf", timeout: 3000 });
  await expect(page.getByTestId("hand-overlay")).toHaveAttribute("data-animating", "false");
  await expect(page.getByTestId("finger-change")).toContainText("slide it up to fret 7");
  const finger = await page.getByTestId("gps-finger").innerText();
  const tipX = Number(await page.getByTestId(`hand-finger-${finger}`).getAttribute("data-tip-x"));
  expect(Math.abs(tipX - Number(await marker.getAttribute("data-x")))).toBeLessThan(1.5);
  await expect(pressed).toHaveAttribute("data-fret", "7");

  // Watch the fingers steps through the part on its own.
  await page.getByTestId("tab-note-0").click();
  await page.getByTestId("watch-fingers").click();
  await expect(page.getByTestId("current-note")).not.toHaveText("B3", { timeout: 5000 });
  await page.getByTestId("watch-fingers").click();
  await expect(page.getByTestId("watch-fingers")).toHaveText("Watch the fingers");
});
