/** Native transport port. Kept pure for cancellation and HTTP contract tests. */
export type VoiceUploadTask = {
  uploadAsync: () => Promise<
    { status: number; body: string } | undefined | null
  >;
  cancelAsync: () => Promise<void>;
};
export class VoiceUploadError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function uploadVoice(
  task: VoiceUploadTask,
  signal: AbortSignal,
  timeoutMs = 45000,
): Promise<string> {
  if (signal.aborted) throw new VoiceUploadError(0, "VOICE_UPLOAD_CANCELLED");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  let stopTask = false;
  const limit = new Promise<never>((_resolve, reject) => {
    abort = () => {
      stopTask = true;
      reject(new VoiceUploadError(0, "VOICE_UPLOAD_CANCELLED"));
    };
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      stopTask = true;
      reject(new VoiceUploadError(0, "VOICE_UPLOAD_TIMEOUT"));
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([task.uploadAsync(), limit]);
    if (!response) throw new VoiceUploadError(0, "VOICE_UPLOAD_CANCELLED");
    let value: { text?: unknown; code?: unknown };
    try {
      value = JSON.parse(response.body);
    } catch {
      throw new VoiceUploadError(response.status, "VOICE_UPLOAD_RESPONSE");
    }
    if (!value || typeof value !== "object")
      throw new VoiceUploadError(response.status, "VOICE_UPLOAD_RESPONSE");
    if (response.status < 200 || response.status >= 300)
      throw new VoiceUploadError(
        response.status,
        typeof value.code === "string" ? value.code : "VOICE_HTTP_ERROR",
      );
    if (
      typeof value.text !== "string" ||
      !value.text.trim() ||
      value.text.length > 300
    )
      throw new VoiceUploadError(response.status, "VOICE_EMPTY_TRANSCRIPT");
    return value.text.trim();
  } catch (error) {
    if (error instanceof VoiceUploadError) throw error;
    throw new VoiceUploadError(0, "VOICE_UPLOAD_NETWORK");
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    // Wait for cancellation before the recording lifecycle deletes the file.
    if (stopTask) await task.cancelAsync().catch(() => {});
  }
}
