/** Imperative highlight toggles — tour/example tempos fire many updates per second. */
export function setHighlight(root: HTMLElement | null, id: string, on: boolean) {
  if (!root) return;
  const safe = id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  root.querySelectorAll(`[data-hl="${safe}"]`).forEach((el) => {
    el.classList.toggle("is-on", on);
  });
}

export function clearHighlights(root: HTMLElement | null) {
  if (!root) return;
  root.querySelectorAll(".is-on[data-hl]").forEach((el) => el.classList.remove("is-on"));
}
