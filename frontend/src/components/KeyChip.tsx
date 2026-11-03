import { keyOfLabel, type ScaleMode, type ScaleRoot } from "@/lib/music/scaleFretmap";

/** Compact chip showing the musical key for a lick, track, or scale map. */
export function KeyChip({
  root,
  mode,
  className = "chip text-xs",
}: {
  root: ScaleRoot;
  mode: ScaleMode;
  className?: string;
}) {
  return (
    <span className={className} title="Musical key" data-testid="key-chip">
      {keyOfLabel(root, mode)}
    </span>
  );
}
