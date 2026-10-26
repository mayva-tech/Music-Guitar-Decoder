"use client";

import { KEY_CHART } from "@/lib/theory/ear";

export function KeyChart() {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl bg-panel px-3 py-3" data-testid="ear-key-chart">
      <table className="min-w-[520px] w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-[0.65rem] uppercase tracking-wide text-muted">Key</th>
            {KEY_CHART.majorHeader.map((h, i) => (
              <th
                key={h}
                className={`px-2 py-1.5 text-center font-mono text-xs ${KEY_CHART.tryFirstMajor.includes(i) ? "rounded-t-md" : ""}`}
                style={
                  KEY_CHART.tryFirstMajor.includes(i)
                    ? { background: "var(--lane-chords-bg)", color: "var(--lane-chords)" }
                    : { color: "var(--color-muted)" }
                }
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KEY_CHART.major.map(([key, chords]) => (
            <tr key={key}>
              <td className="px-2 py-1.5 font-mono font-bold">{key}</td>
              {chords.map((c, i) => (
                <td
                  key={`${key}-${c}`}
                  className="px-2 py-1.5 text-center font-mono"
                  style={
                    KEY_CHART.tryFirstMajor.includes(i)
                      ? { background: "var(--lane-chords-bg)", color: "var(--lane-chords)" }
                      : undefined
                  }
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={7} className="border-t-2 border-line pt-2" />
          </tr>
          <tr>
            <th className="px-2 py-1.5 text-left text-[0.65rem] uppercase tracking-wide text-muted">Key</th>
            {KEY_CHART.minorHeader.map((h, i) => (
              <th
                key={h}
                className="px-2 py-1.5 text-center font-mono text-xs"
                style={
                  KEY_CHART.tryFirstMinor.includes(i)
                    ? { background: "var(--lane-chords-bg)", color: "var(--lane-chords)" }
                    : { color: "var(--color-muted)" }
                }
              >
                {h}
              </th>
            ))}
          </tr>
          {KEY_CHART.minor.map(([key, chords]) => (
            <tr key={key}>
              <td className="px-2 py-1.5 font-mono font-bold">{key}</td>
              {chords.map((c, i) => (
                <td
                  key={`${key}-${c}`}
                  className="px-2 py-1.5 text-center font-mono"
                  style={
                    KEY_CHART.tryFirstMinor.includes(i)
                      ? { background: "var(--lane-chords-bg)", color: "var(--lane-chords)" }
                      : undefined
                  }
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">{KEY_CHART.note}</p>
    </div>
  );
}
