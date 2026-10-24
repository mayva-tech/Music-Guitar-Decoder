// In-memory (this tab only) handle to the last recording, so the decoder can play it back
// for comparison. Audio is not written to localStorage.
let last: { blob: Blob; url: string; name: string } | null = null;

export function setLastRecording(blob: Blob, name: string) {
  if (last) URL.revokeObjectURL(last.url);
  last = { blob, url: URL.createObjectURL(blob), name };
}

export function getLastRecording() {
  return last;
}
