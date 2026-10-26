"use client";

import { COMMON_PROGRESSIONS, TROUBLESHOOTING } from "@/lib/theory/ear";

export function CheatSheet() {
  return (
    <div className="grid gap-4 ear-cheat" data-testid="ear-cheat-sheet">
      <div className="overflow-x-auto rounded-2xl border border-line bg-panel/50 p-4">
        <h3 className="text-lg font-bold">Common progressions</h3>
        <table className="mt-3 min-w-[480px] w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[0.65rem] uppercase tracking-wide text-muted">
              <th className="px-2 py-1.5">Name</th>
              <th className="px-2 py-1.5">Numbers</th>
              <th className="px-2 py-1.5">In G</th>
              <th className="px-2 py-1.5">In C</th>
              <th className="px-2 py-1.5">Heard in</th>
            </tr>
          </thead>
          <tbody>
            {COMMON_PROGRESSIONS.map((p) => (
              <tr key={p.name} className="border-t border-line">
                <td className="px-2 py-2 font-semibold">{p.name}</td>
                <td className="px-2 py-2 font-mono text-xs">{p.numbers}</td>
                <td className="px-2 py-2 font-mono text-xs">{p.inG}</td>
                <td className="px-2 py-2 font-mono text-xs">{p.inC}</td>
                <td className="px-2 py-2 text-muted">{p.heard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-line bg-panel/50 p-4">
        <h3 className="text-lg font-bold">If you get stuck</h3>
        <ul className="mt-3 space-y-3">
          {TROUBLESHOOTING.map((t) => (
            <li key={t.problem}>
              <p className="text-sm font-bold">{t.problem}</p>
              <p className="text-sm text-muted">{t.fix}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
