import type { VoiceLanguage } from "@pepo/voice/profiles";
export type TranscriptionInput = {
  audio: Uint8Array;
  mime: string;
  filename: string;
  language: VoiceLanguage;
  context: string;
  signal: AbortSignal;
};
/** A replacement adapter must preserve transcription, cancellation and error contracts. */
export interface SpeechProvider {
  id: string;
  transcribe(input: TranscriptionInput): Promise<{ text: string }>;
}
export class SpeechProviderError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function openAISpeechProvider(
  key: string,
  model: string,
  fetcher: typeof fetch = fetch,
): SpeechProvider {
  return {
    id: "openai",
    async transcribe(input) {
      const body = new FormData();
      body.append("model", model);
      body.append(
        "file",
        new Blob([new Uint8Array(input.audio)], { type: input.mime }),
        input.filename,
      );
      body.append(
        "prompt",
        `Destination in Congo. Language hint: ${input.language}. Transcribe only what is spoken, preserving mixed languages and local names; do not invent speech from silence. ${input.context.slice(0, 1600)}`,
      );
      const response = await fetcher(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body,
          signal: input.signal,
        },
      );
      if (!response.ok)
        throw new SpeechProviderError(
          response.status,
          response.status === 401 || response.status === 403
            ? "VOICE_PROVIDER_AUTH"
            : response.status === 404
              ? "VOICE_PROVIDER_MODEL"
              : response.status === 429
                ? "VOICE_PROVIDER_QUOTA"
                : "VOICE_PROVIDER_ERROR",
        );
      const value = await response.json();
      if (
        typeof value?.text !== "string" ||
        !value.text.trim() ||
        value.text.trim().length > 300
      )
        throw new SpeechProviderError(503, "VOICE_EMPTY_TRANSCRIPT");
      return { text: value.text.trim() };
    },
  };
}
