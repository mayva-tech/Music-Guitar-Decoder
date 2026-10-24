import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Music Decoder — Hum it. Rock it. Play it.",
  description: "Hum a tune, get chords and an easy rock solo, and learn to play it on guitar.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1a1b1e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
