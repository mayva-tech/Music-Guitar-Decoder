// Minimal stroke icons (24px grid).
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const IconHome = (p: P) => <svg {...base(p)}><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></svg>;
export const IconMic = (p: P) => <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
export const IconWave = (p: P) => <svg {...base(p)}><path d="M3 12h2l2-6 3 12 3-15 3 15 2-6h3" /></svg>;
export const IconGuitar = (p: P) => (
  <svg {...base(p)}><path d="M14 10l6-6M18 2l4 4" /><path d="M10.5 9.5a4 4 0 0 0-5.7 1.3c-.8 1.4-2.8 1.3-2.8 3.7 0 3.6 3.9 7.5 7.5 7.5 2.4 0 2.3-2 3.7-2.8a4 4 0 0 0 1.3-5.7z" /><circle cx="9" cy="15" r="1.5" /></svg>
);
export const IconLibrary = (p: P) => <svg {...base(p)}><path d="M5 4v16M10 4v16M15 5l4 14.5" /></svg>;
export const IconChart = (p: P) => <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const IconSettings = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const IconPlay = (p: P) => <svg {...base(p)} fill="currentColor" stroke="none"><path d="M7 4.5v15l12.5-7.5z" /></svg>;
export const IconStop = (p: P) => <svg {...base(p)} fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
export const IconExpand = (p: P) => <svg {...base(p)}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
export const IconSpeaker = (p: P) => <svg {...base(p)}><path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6" /></svg>;
export const IconUpload = (p: P) => <svg {...base(p)}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>;
export const IconHeadphones = (p: P) => <svg {...base(p)}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="7" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></svg>;
export const IconRiff = (p: P) => <svg {...base(p)}><path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>;
