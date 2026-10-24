import { describe, expect, it } from "vitest";
import {
  ENGLISH_TTS_LANG,
  ENGLISH_TTS_VOICE_HINTS,
  getEnglishTtsVoiceName,
  resolveEnglishVoice,
} from "@/lib/tts/ttsVoices";

function voice(
  name: string,
  lang: string,
  extras?: Partial<SpeechSynthesisVoice>
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    localService: false,
    default: false,
    voiceURI: name,
    ...extras,
  } as SpeechSynthesisVoice;
}

describe("English Andrew TTS policy", () => {
  it("documents Andrew identity hints", () => {
    expect(ENGLISH_TTS_VOICE_HINTS.join(" ")).toMatch(/Andrew/);
    expect(ENGLISH_TTS_LANG).toBe("en-US");
  });

  it("resolves en-US to Microsoft Andrew when available", () => {
    const voices = [
      voice("Google US English", "en-US"),
      voice("Microsoft Andrew Online (Natural) - English (United States)", "en-US"),
      voice("Microsoft David", "en-US"),
    ];
    const resolved = resolveEnglishVoice(voices);
    expect(resolved?.name).toMatch(/Andrew/i);
    expect(getEnglishTtsVoiceName(voices)).toMatch(/Andrew/i);
  });

  it("prefers English-only Andrew over AndrewMultilingual", () => {
    const voices = [
      voice(
        "Microsoft AndrewMultilingual Online (Natural) - English (United States)",
        "en-US"
      ),
      voice("Microsoft Andrew Online (Natural) - English (United States)", "en-US"),
    ];
    expect(resolveEnglishVoice(voices)?.name).toBe(
      "Microsoft Andrew Online (Natural) - English (United States)"
    );
  });

  it("still uses AndrewMultilingual when it is the only Andrew", () => {
    const voices = [
      voice(
        "Microsoft AndrewMultilingual Online (Natural) - English (United States)",
        "en-US"
      ),
      voice("Google US English", "en-US"),
    ];
    expect(resolveEnglishVoice(voices)?.name).toMatch(/AndrewMultilingual/);
  });

  it("falls back only when Andrew is unavailable", () => {
    const microsoftNeural = resolveEnglishVoice([
      voice("Google US English", "en-US"),
      voice("Microsoft Aria Online (Natural) - English (United States)", "en-US"),
    ]);
    expect(microsoftNeural?.name).toMatch(/Aria/i);

    const us = resolveEnglishVoice([voice("Google US English", "en-US")]);
    expect(us?.name).toBe("Google US English");

    expect(resolveEnglishVoice([voice("Microsoft Nanami", "ja-JP")])).toBeNull();
  });
});
