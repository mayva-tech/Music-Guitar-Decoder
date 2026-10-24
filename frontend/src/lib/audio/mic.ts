// Microphone access with friendly, specific errors.

export type MicErrorKind = "unsupported" | "insecure" | "denied" | "no-device" | "busy" | "unknown";

export class MicError extends Error {
  constructor(public kind: MicErrorKind, message: string) {
    super(message);
  }
}

export const MIC_MESSAGES: Record<MicErrorKind, string> = {
  unsupported: "This browser can't use a microphone. Try a recent Chrome, Edge, Firefox or Safari.",
  insecure: "The microphone only works on a secure page (https or localhost).",
  denied: "Microphone access was blocked. Allow it in your browser's site settings, then try again.",
  "no-device": "No microphone was found. Plug one in or check your system sound settings.",
  busy: "Another app is using the microphone. Close it and try again.",
  unknown: "The microphone couldn't start. Check your sound settings and try again.",
};

export function classifyMicError(err: unknown): MicError {
  if (err instanceof MicError) return err;
  const name = (err as { name?: string } | null)?.name ?? "";
  let kind: MicErrorKind = "unknown";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") kind = "denied";
  else if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") kind = "no-device";
  else if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") kind = "busy";
  return new MicError(kind, MIC_MESSAGES[kind]);
}

export interface MicEnv {
  isSecureContext?: boolean;
  mediaDevices?: { getUserMedia?: (c: MediaStreamConstraints) => Promise<MediaStream> };
}

/**
 * Ask for the microphone (see requestMicrophone). For guitar/humming analysis we turn OFF the browser's
 * speech processing (echo cancellation, noise suppression, auto gain), which would
 * otherwise distort musical notes.
 */
export function browserMicEnv(): MicEnv {
  if (typeof window === "undefined") return {};
  return { isSecureContext: window.isSecureContext, mediaDevices: navigator.mediaDevices };
}

export async function requestMicrophone(env: MicEnv = browserMicEnv()): Promise<MediaStream> {
  if (env.isSecureContext === false) throw new MicError("insecure", MIC_MESSAGES.insecure);
  const devices = env.mediaDevices;
  if (!devices?.getUserMedia) throw new MicError("unsupported", MIC_MESSAGES.unsupported);
  try {
    return await devices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
  } catch (e) {
    throw classifyMicError(e);
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}
