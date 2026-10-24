"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconChart, IconGuitar, IconHome, IconLibrary, IconMic, IconRiff, IconSettings, IconWave } from "./Icons";

export const NAV = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/record", label: "Record melody", short: "Record", Icon: IconMic },
  { href: "/decoder", label: "Music decoder", short: "Decoder", Icon: IconWave },
  { href: "/learn", label: "Guitar learning", short: "Learn", Icon: IconGuitar },
  { href: "/riffs", label: "Riff practice", short: "Riffs", Icon: IconRiff },
  { href: "/library", label: "Song library", short: "Library", Icon: IconLibrary },
  { href: "/progress", label: "My progress", short: "Progress", Icon: IconChart },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path?.startsWith("/onboarding")) return <>{children}</>;
  const active = (href: string) => (href === "/" ? path === "/" : path?.startsWith(href));
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden md:flex flex-col gap-8 border-r border-line px-5 py-7 sticky top-0 h-dvh">
        <Link href="/" className="block">
          <span className="display text-[1.35rem] block">Music Decoder</span>
          <span className="text-sm text-muted">Hum it. Rock it. Play it.</span>
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] ${
                active(href) ? "bg-panel-2 text-ink" : "text-muted hover:text-ink"
              }`}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto text-xs leading-relaxed text-faint">
          Sounds are synthesizer guides, not recordings of real instruments.
        </p>
      </aside>

      <header className="md:hidden flex items-center justify-between px-4 pt-4 pb-2">
        <Link href="/" className="display text-lg">Music Decoder</Link>
        <Link href="/settings" aria-label="Settings" className="text-muted p-2"><IconSettings /></Link>
      </header>

      <main className="px-4 pb-28 pt-2 md:px-10 md:pt-8 md:pb-12 min-w-0">{children}</main>

      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-tolex/95 backdrop-blur border-t border-line">
        <ul className="grid grid-cols-7">
          {NAV.filter((n) => n.href !== "/settings").map(({ href, label, short, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[0.64rem] ${active(href) ? "text-ink" : "text-faint"}`}
              >
                <Icon width={20} height={20} />
                {short ?? label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function PageTitle({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="display text-[2rem] md:text-[2.6rem]">{title}</h1>
        {lead && <p className="mt-2 text-muted text-[1.05rem] leading-relaxed">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "warn" | "ok"; children: ReactNode }) {
  const color = { info: "border-line", error: "border-bad", warn: "border-next", ok: "border-ok" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border-l-4 ${color} bg-panel px-4 py-3 text-[0.95rem] leading-relaxed`}>
      {children}
    </div>
  );
}
