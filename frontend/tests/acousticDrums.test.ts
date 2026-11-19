import { describe, expect, it } from "vitest";
import { renderCrash, renderHat, renderKick, renderSnare, windowEnergy } from "@/lib/audio/acousticDrums";

const SR = 44100;

function lowEnergy(data: Float32Array): number {
  let acc = 0;
  let e = 0;
  const n = Math.min(data.length, 6000);
  for (let i = 0; i < n; i++) {
    acc = acc * 0.985 + data[i]!;
    e += acc * acc;
  }
  return e / n;
}

describe("acoustic drum samples", () => {
  it("gives the kick a low body and a decay, unlike a hi-hat tick", () => {
    const kick = renderKick();
    const hat = renderHat();
    const snare = renderSnare();
    expect(lowEnergy(kick)).toBeGreaterThan(lowEnergy(hat) * 8);
    expect(lowEnergy(snare)).toBeGreaterThan(lowEnergy(hat));
    expect(windowEnergy(kick, 0, 800)).toBeGreaterThan(windowEnergy(kick, kick.length - 800, kick.length) * 4);
    expect(renderCrash().length).toBeGreaterThan(hat.length * 8);
    expect(hat.length).toBeLessThan(snare.length);
  });

  it("keeps the closed hat a short hush, not a ringing tin-can ting", () => {
    const hat = renderHat();
    expect(hat.length).toBeLessThan(SR * 0.08);
    expect(windowEnergy(hat, 0, 400)).toBeGreaterThan(windowEnergy(hat, hat.length - 200, hat.length) * 4);
    let crossings = 0;
    for (let i = 1; i < hat.length; i++) {
      if ((hat[i - 1]! >= 0) !== (hat[i]! >= 0)) crossings++;
    }
    expect(crossings / hat.length).toBeGreaterThan(0.15);
  });

  it("makes the snare a noise-led crack, not a sustained sine ting", () => {
    const snare = renderSnare();
    // Early window is loud; late window has decayed.
    expect(windowEnergy(snare, 0, 1200)).toBeGreaterThan(windowEnergy(snare, snare.length - 1200, snare.length) * 3);
    // Zero-crossing density stays high after the body dies → wire noise, not a pure tone.
    let crossings = 0;
    const from = Math.floor(snare.length * 0.12);
    const to = Math.floor(snare.length * 0.45);
    for (let i = from + 1; i < to; i++) {
      if ((snare[i - 1]! >= 0) !== (snare[i]! >= 0)) crossings++;
    }
    expect(crossings / (to - from)).toBeGreaterThan(0.12);
  });
});
