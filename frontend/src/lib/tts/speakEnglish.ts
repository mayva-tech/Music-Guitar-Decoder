/**
 * English voiceover via browser SpeechSynthesis, preferring Microsoft Andrew
 * (same selection + utterance rules as JLPT-Trainer's speakEnglish path).
 */

import {
  ENGLISH_TTS_LANG,
  ENGLISH_TTS_RATE,
  resolveEnglishVoice,
} from "./ttsVoices";

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function allVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

/** Wait until Chromium/Edge has populated the voice list (Andrew often arrives late). */
export function loadTtsVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const existing = allVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const finish = () => {
        synth.removeEventListener("voiceschanged", finish);
        resolve(allVoices());
      };
      synth.addEventListener("voiceschanged", finish);
      // Some browsers never fire voiceschanged if the list is already empty.
      window.setTimeout(finish, 1500);
    });
  }
  return voicesReady;
}

export function cancelEnglishSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export type SpeakEnglishOptions = {
  /** Utterance rate. Defaults to Andrew's JLPT normal (0.8). */
  rate?: number;
  /** Abort before speaking (e.g. effect cleanup while voices are still loading). */
  signal?: AbortSignal;
};

/**
 * Speak English with Microsoft Andrew when available.
 * Voice is assigned before rate — Chromium resets rate when voice is set.
 */
export async function speakEnglish(
  text: string,
  options: SpeakEnglishOptions = {}
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (options.signal?.aborted) return;

  const voices = await loadTtsVoices();
  if (options.signal?.aborted) return;

  const voice = resolveEnglishVoice(voices);
  const rate = options.rate ?? ENGLISH_TTS_RATE;

  cancelEnglishSpeech();

  const utter = new SpeechSynthesisUtterance(trimmed);
  utter.lang = ENGLISH_TTS_LANG;
  // Voice must be set before rate — Chromium resets rate when voice is assigned.
  if (voice) utter.voice = voice;
  utter.rate = rate;

  window.speechSynthesis.speak(utter);
}
