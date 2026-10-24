// Shared app state. Preferences and work-in-progress persist in localStorage (no account needed);
// arrangements and practice history are also saved by the backend (SQLite).
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Arrangement, DetectedMelody, HarmonizeResponse, PracticeSessionRecord, UserPreferences } from "./types";

export const DEFAULT_PREFS: UserPreferences = {
  favoriteSong: "",
  skillLevel: "zero",
  handedness: "right",
  style: "classic_rock",
  viewMode: "beginner",
  instructionMode: "text",
  fretsShown: 12,
  equalFretSpacing: false,
  showNoteNames: true,
  a4: 440,
  toleranceCents: 40,
  clarityThreshold: 0.8,
  noiseGate: 0.01,
  handOverlay: true,
  handOpacity: 0.5,
  showScale: false,
  markerLabel: "finger",
  techniques: "auto",
  animateHand: true,
  developerMode: false,
  autoReadAloud: true,
};

export interface AppState {
  prefs: UserPreferences;
  onboarded: boolean;
  melody: DetectedMelody | null;
  harmony: HarmonizeResponse | null;
  selectedHarmonization: string | null; // kind
  arrangement: Arrangement | null;
  recentSessions: PracticeSessionRecord[];
  setPrefs: (p: Partial<UserPreferences>) => void;
  completeOnboarding: (p: Partial<UserPreferences>) => void;
  resetOnboarding: () => void;
  setMelody: (m: DetectedMelody | null) => void;
  setHarmony: (h: HarmonizeResponse | null) => void;
  selectHarmonization: (kind: string | null) => void;
  setArrangement: (a: Arrangement | null) => void;
  addSession: (s: PracticeSessionRecord) => void;
  clearAll: () => void;
}

export const STORE_KEY = "music-decoder";

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      onboarded: false,
      melody: null,
      harmony: null,
      selectedHarmonization: null,
      arrangement: null,
      recentSessions: [],
      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      completeOnboarding: (p) => set((s) => ({ prefs: { ...s.prefs, ...p }, onboarded: true })),
      resetOnboarding: () => set({ onboarded: false }),
      setMelody: (melody) => set({ melody, harmony: null, selectedHarmonization: null }),
      setHarmony: (harmony) => set({ harmony }),
      selectHarmonization: (selectedHarmonization) => set({ selectedHarmonization }),
      setArrangement: (arrangement) => set({ arrangement }),
      addSession: (s) => set((st) => ({ recentSessions: [s, ...st.recentSessions].slice(0, 50) })),
      clearAll: () => set({ prefs: DEFAULT_PREFS, onboarded: false, melody: null, harmony: null, selectedHarmonization: null, arrangement: null, recentSessions: [] }),
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        prefs: s.prefs, onboarded: s.onboarded, melody: s.melody, harmony: s.harmony,
        selectedHarmonization: s.selectedHarmonization, arrangement: s.arrangement, recentSessions: s.recentSessions,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return { ...current, ...p, prefs: { ...DEFAULT_PREFS, ...(p.prefs ?? {}) } };
      },
    },
  ),
);

/** True once the persisted state has been read from localStorage (avoids flashing onboarding). */
export function useHydrated(): boolean {
  const [h, setH] = useState(false);
  useEffect(() => {
    const unsub = useApp.persist?.onFinishHydration?.(() => setH(true));
    if (useApp.persist?.hasHydrated?.()) setH(true);
    return unsub;
  }, []);
  return h;
}

