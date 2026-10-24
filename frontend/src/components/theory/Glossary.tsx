"use client";

import { ALL_TERMS, TERMS, connections } from "@/lib/theory/content";

export function Glossary({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <section className="space-y-3" data-testid="theory-glossary">
      <h2 className="display text-xl">Glossary</h2>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-panel text-[0.65rem] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Term</th>
              <th className="px-3 py-2 font-semibold">Meaning</th>
              <th className="px-3 py-2 font-semibold">Example</th>
              <th className="px-3 py-2 font-semibold">Links</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(TERMS).map((t) => (
              <tr key={t.id} className="border-t border-line/60">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 font-bold"
                    onClick={() => onSelect(t.id)}
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: `var(--lane-${t.lane})` }} />
                    {t.name}
                  </button>
                </td>
                <td className="px-3 py-2 text-muted">{t.short}</td>
                <td className="px-3 py-2 font-mono text-xs text-faint">{t.glossaryExample ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted">
                  {connections(t.id)
                    .map((id) => ALL_TERMS[id]?.name ?? id)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
