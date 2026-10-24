/**
 * Browser SpeechSynthesis voice selection for English voiceover.
 *
 * Policy (same as JLPT-Trainer): prefer Microsoft Andrew; avoid
 * AndrewMultilingual when a plain Andrew exists (multilingual guesses the
 * language per line and can flip short EN into French/Spanish).
 */

export const ENGLISH_TTS_LANG = "en-US";
export const ENGLISH_TTS_VOICE_HINTS = ["Andrew"] as const;

/** Andrew's comfortable instruction rate (JLPT SPEECH_RATE_NORMAL). */
export const ENGLISH_TTS_RATE = 0.8;

function voiceName(v: SpeechSynthesisVoice): string {
  return v.name ?? "";
}

function isEnglishVoice(v: SpeechSynthesisVoice): boolean {
  return (v.lang ?? "").toLowerCase().startsWith("en");
}

function isAndrewVoice(v: SpeechSynthesisVoice): boolean {
  return /andrew/i.test(voiceName(v));
}

function isMultilingualVoice(v: SpeechSynthesisVoice): boolean {
  return /multilingual/i.test(voiceName(v));
}

function isNeuralLike(v: SpeechSynthesisVoice): boolean {
  const n = voiceName(v);
  return /online|natural|neural/i.test(n);
}

function isMicrosoftVoice(v: SpeechSynthesisVoice): boolean {
  return /microsoft/i.test(voiceName(v));
}

/**
 * Resolve the English TTS voice (Andrew preferred).
 *
 * Fallback order when Andrew is unavailable:
 * 1. Microsoft Andrew (non-multilingual preferred)
 * 2. Other Microsoft neural/online English voices (non-multilingual preferred)
 * 3. Any en-US / United States voice
 * 4. Any English voice
 * 5. null (caller uses system default)
 */
export function resolveEnglishVoice(
  voices: readonly SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const en = voices.filter(isEnglishVoice);
  if (en.length === 0) return null;

  const andrew = en.filter(isAndrewVoice);
  if (andrew.length > 0) {
    return (
      [...andrew].sort((a, b) => {
        // AndrewMultilingual guesses the language per line, so short
        // glosses come out in French.
        const score = (v: SpeechSynthesisVoice) =>
          (isMultilingualVoice(v) ? 0 : 4) +
          (isNeuralLike(v) ? 2 : 0) +
          (isMicrosoftVoice(v) ? 1 : 0) +
          (/en-us/i.test(v.lang) || /United States/i.test(voiceName(v)) ? 1 : 0);
        return score(b) - score(a);
      })[0] ?? null
    );
  }

  const microsoftNeural = en.filter((v) => isMicrosoftVoice(v) && isNeuralLike(v));
  if (microsoftNeural.length > 0) {
    return microsoftNeural.find((v) => !isMultilingualVoice(v)) ?? microsoftNeural[0] ?? null;
  }

  const us = en.filter(
    (v) => /en-us/i.test(v.lang) || /United States/i.test(voiceName(v))
  );
  if (us.length > 0) return us[0] ?? null;

  return en[0] ?? null;
}

export function getEnglishTtsVoiceName(
  voices: readonly SpeechSynthesisVoice[]
): string | null {
  return resolveEnglishVoice(voices)?.name ?? null;
}
