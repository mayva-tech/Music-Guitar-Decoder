"use client";

export function ExampleButton({
  label,
  sub,
  playing,
  onToggle,
}: {
  label: string;
  sub?: string;
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn btn-sm flex w-full items-start gap-2 text-left ${playing ? "btn-primary" : "btn-quiet"}`}
      aria-pressed={playing}
      onClick={onToggle}
      data-testid="theory-example-btn"
    >
      <span className="mt-0.5 shrink-0 text-sm" aria-hidden>
        {playing ? "■" : "▶"}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {sub ? <span className="block text-xs text-muted">{sub}</span> : null}
      </span>
    </button>
  );
}
