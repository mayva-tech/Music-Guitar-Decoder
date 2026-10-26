import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScaleFretmapNeck } from "@/components/ScaleFretmapNeck";
import { buildFretmap } from "@/lib/music/scaleFretmap";
import { LICKS_BY_ID, lickOverlay } from "@/lib/music/soloGuide";

const cells = buildFretmap("A", "minor-pentatonic");
const neck = (props: Record<string, unknown> = {}) =>
  renderToString(createElement(ScaleFretmapNeck, { cells, ...props } as never));

const attrAll = (html: string, attr: string) =>
  [...html.matchAll(new RegExp(`${attr}="([^"]+)"`, "g"))].map((m) => m[1]!);
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("ScaleFretmapNeck solo layers", () => {
  it("renders exactly as before when no solo props are given", () => {
    const html = neck();
    expect(html).not.toContain("data-in-box");
    expect(html).not.toContain("lick-layer");
    expect(html).not.toContain("chord-tone-layer");
    expect(html).toContain('data-testid="scale-note-layer"');
  });

  it("box=1 keeps 12 full-opacity markers in frets 5-8 for A minor pentatonic", () => {
    const html = neck({ root: "A", mode: "minor-pentatonic", box: 1 });
    const inside = attrAll(html, "data-pos");
    // Every scale marker carries data-pos in box mode; those at full opacity are "data-in-box=true".
    const full = [...html.matchAll(/data-in-box="true" data-pos="(\d):(\d+)"[^>]*>/g)].map((m) => ({ s: Number(m[1]), f: Number(m[2]) }));
    expect(inside.length).toBeGreaterThan(12);
    expect(full).toHaveLength(12);
    expect(full.every((c) => c.f >= 5 && c.f <= 8)).toBe(true);
    // The rest are faded to 0.16.
    expect(count(html, 'opacity="0.16"')).toBe(inside.length - 12);
  });

  it("works when root and mode are inferred from the cells", () => {
    const html = neck({ box: 1 });
    expect(count(html, 'data-in-box="true"')).toBe(12);
  });

  it("chordTones=F rings in-scale tones and dashes the ones outside the scale (2:6 and 5:8)", () => {
    const html = neck({ root: "A", mode: "minor-pentatonic", box: 1, chordTones: "F" });
    expect(attrAll(html, "data-chord-outside").sort()).toEqual(["2:6", "5:8"]);
    // A and C of F are in the A minor pentatonic box, so they get rings.
    expect(attrAll(html, "data-chord-ring").length).toBeGreaterThan(0);
  });

  it("a lick renders one marker per position with order badges; compact renders no badges or glyphs", () => {
    const lick = LICKS_BY_ID["t-bend"]!;
    const { markers } = lickOverlay(lick.notes);
    const full = neck({ root: "A", mode: "minor-pentatonic", box: 1, lick: { notes: lick.notes } });
    expect(count(full, "data-lick-marker=")).toBe(markers.length);
    expect(count(full, "data-order-badge=")).toBe(markers.length);
    expect(full).toContain('data-glyph="bend"');
    expect(full).toContain('data-lick="true"');

    const compact = neck({ root: "A", mode: "minor-pentatonic", lick: { notes: lick.notes, compact: true } });
    expect(count(compact, "data-lick-marker=")).toBe(markers.length);
    expect(count(compact, "data-order-badge=")).toBe(0);
    expect(count(compact, "data-glyph=")).toBe(0);
  });

  it("lights notes from litNotes and gives every lick note an id to light", () => {
    const lick = LICKS_BY_ID["t-hammer"]!;
    const html = neck({ lick: { notes: lick.notes }, litNotes: new Set([1]) });
    for (let i = 0; i < lick.notes.length; i++) expect(html).toContain(`data-hl="n${i}"`);
    expect(count(html, "solo-hl is-on")).toBe(1);
  });

  it("fretWindow crops the viewBox and moves string letters to a gutter", () => {
    const full = neck();
    const win = neck({ fretWindow: { from: 3, to: 9 } });
    expect(win).not.toBe(full);
    expect(win).toContain("data-string-letter");
    expect(win.match(/<svg[^>]*>/)![0]).not.toMatch(/\swidth=/);
    expect(win).toMatch(/viewBox="\d+ 0 \d+ \d+"/);
  });
});
