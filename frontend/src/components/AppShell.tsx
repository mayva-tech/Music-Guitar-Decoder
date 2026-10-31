"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { IconChart, IconDrum, IconGuitar, IconHome, IconLibrary, IconMic, IconRiff, IconSearch, IconSettings, IconWave } from "./Icons";

export const NAV = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/songs", label: "Song search", short: "Songs", Icon: IconSearch },
  { href: "/record", label: "Record melody", short: "Record", Icon: IconMic },
  { href: "/decoder", label: "Music decoder", short: "Decoder", Icon: IconWave },
  { href: "/learn", label: "Guitar learning", short: "Learn", Icon: IconGuitar },
  { href: "/learn/theory", label: "Theory map", short: "Theory", Icon: IconWave },
  { href: "/learn/solo", label: "Lead solos", short: "Solos", Icon: IconRiff },
  { href: "/learn/greats", label: "Guitar greats", short: "Greats", Icon: IconGuitar },
  { href: "/learn/backing", label: "Backing tracks", short: "Backing", Icon: IconDrum },
  { href: "/learn/find", label: "Find", short: "Find", Icon: IconLibrary },
  { href: "/learn/by-ear", label: "Play by ear", short: "By ear", Icon: IconMic },
  { href: "/riffs", label: "Riff practice", short: "Riffs", Icon: IconRiff },
  { href: "/library", label: "Song library", short: "Library", Icon: IconLibrary },
  { href: "/progress", label: "My progress", short: "Progress", Icon: IconChart },
  { href: "/settings", label: "Settings", Icon: IconSettings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path?.startsWith("/onboarding")) return <>{children}</>;
  const active = (href: string) => {
    if (href === "/") return path === "/";
    // Keep Learn vs Theory / By ear distinct (they share the /learn prefix).
    if (href === "/learn") {
      return (
        path === "/learn" ||
        (path?.startsWith("/learn/") === true &&
          !path.startsWith("/learn/theory") &&
          !path.startsWith("/learn/by-ear") &&
          !path.startsWith("/learn/solo") &&
          !path.startsWith("/learn/greats") &&
          !path.startsWith("/learn/backing") &&
          !path.startsWith("/learn/find"))
      );
    }
    return path?.startsWith(href) === true;
  };
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden md:flex flex-col gap-6 overflow-y-auto border-r border-line px-5 py-7 sticky top-0 h-dvh">
        <Link href="/" className="block">
          <span className="display text-[1.35rem] block">Music Decoder</span>
          <span className="text-sm text-muted">Hum it. Rock it. Play it.</span>
        </Link>
        <SidebarSearch />
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
        <div className="flex items-center">
          <Link href="/songs" aria-label="Song search" className="text-muted p-2" data-testid="mobile-song-search"><IconSearch /></Link>
          <Link href="/settings" aria-label="Settings" className="text-muted p-2"><IconSettings /></Link>
        </div>
      </header>

      <main className="px-4 pb-[calc(12rem+env(safe-area-inset-bottom))] pt-2 md:px-10 md:pt-8 md:pb-12 min-w-0">{children}</main>

      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-tolex/95 backdrop-blur border-t border-line">
        <ul className="grid grid-cols-4 sm:grid-cols-8">
          {NAV.filter((n) => n.href !== "/settings" && n.href !== "/songs").map(({ href, label, short, Icon }) => (
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

/** Sidebar box: type a song title, press Enter, land on /songs?q=… */
function SidebarSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    router.push(`/songs?q=${encodeURIComponent(v)}`);
    setQ("");
  };
  return (
    <form role="search" onSubmit={go} className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 focus-within:border-ink" data-testid="sidebar-song-search">
      <IconSearch />
      <label htmlFor="sidebar-q" className="sr-only">Search a song</label>
      <input id="sidebar-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a song…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
    </form>
  );
}
