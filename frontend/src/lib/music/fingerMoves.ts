// "What changes next?" — one plain sentence describing how the fretting hand moves
// from the previous note to the current one. Derived only from string/fret/finger data.
import { FINGER_NAMES, fretWords, stringWords } from "./guitar";

export interface MoveNote {
  string: number;
  fret: number;
  finger: number;
  technique?: string | null;
}

const fingerName = (f: number) => FINGER_NAMES[f] ?? "finger";

/** Index-finger fret for a fretted note (one finger per fret). */
export function handBaseOf(n: MoveNote): number | null {
  return n.fret > 0 && n.finger > 0 ? Math.max(1, n.fret - n.finger + 1) : null;
}

export function fingerChange(prev: MoveNote | null, cur: MoveNote, prevBase?: number | null, curBase?: number | null): string {
  const cb = curBase ?? handBaseOf(cur);
  const pb = prevBase ?? (prev ? handBaseOf(prev) : null);
  if (!prev) {
    return cur.fret === 0 ? "Start on the open string — no fingers down." : `Start with your ${fingerName(cur.finger)} on the ${fretWords(cur.fret)} fret.`;
  }
  if (cur.technique === "slide_up" || cur.technique === "slide_down") {
    return `Keep your ${fingerName(cur.finger)} pressed and slide it ${cur.technique === "slide_up" ? "up" : "down"} to fret ${cur.fret}.`;
  }
  if (cur.technique === "hammer_on") return `Hammer your ${fingerName(cur.finger)} onto fret ${cur.fret} — no pick.`;
  if (cur.technique === "pull_off") {
    return cur.fret === 0 ? "Pull your finger off sideways — the open string rings." : `Pull the higher finger off — your ${fingerName(cur.finger)} on fret ${cur.fret} rings.`;
  }
  if (cur.fret === 0) return prev.fret === 0 && prev.string === cur.string ? "Same open string again." : "Lift your fingers — play the open string.";
  if (prev.string === cur.string && prev.fret === cur.fret) return "Same note again — keep your finger down and pick again.";
  if (prev.fret === 0) return `Put your ${fingerName(cur.finger)} on the ${fretWords(cur.fret)} fret of ${stringWords(cur.string)}.`;
  if (pb != null && cb != null && pb !== cb) {
    const d = cb - pb;
    return `Shift your hand ${d > 0 ? "up" : "down"} ${Math.abs(d)} fret${Math.abs(d) > 1 ? "s" : ""} (index finger to fret ${cb}), then press with your ${fingerName(cur.finger)}.`;
  }
  if (prev.finger === cur.finger) {
    const dir = cur.string < prev.string ? "towards the thinner strings" : "towards the thicker strings";
    return `Move your ${fingerName(cur.finger)} ${dir}, to ${stringWords(cur.string)}.`;
  }
  return `Hand stays put: lift your ${fingerName(prev.finger)}, press with your ${fingerName(cur.finger)}.`;
}
