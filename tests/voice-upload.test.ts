import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  uploadVoice,
  type VoiceUploadTask,
} from "../apps/rider/src/components/voiceUpload";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function task(
  value: { status: number; body: string } | null = {
    status: 200,
    body: '{"text":" Je vais à Karavia "}',
  },
): VoiceUploadTask {
  return {
    uploadAsync: vi.fn(async () => value),
    cancelAsync: vi.fn(async () => {}),
  };
}
describe("native voice upload contract", () => {
  it("returns the transcript and performs one upload without logging or storing it", async () => {
    const port = task();
    expect(await uploadVoice(port, new AbortController().signal)).toBe(
      "Je vais à Karavia",
    );
    expect(port.uploadAsync).toHaveBeenCalledTimes(1);
    expect(port.cancelAsync).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("distinguishes provider HTTP errors from transport failures without exposing the response body", async () => {
    await expect(
      uploadVoice(
        task({
          status: 503,
          body: '{"code":"VOICE_PROVIDER_AUTH","error":"private payload"}',
        }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      status: 503,
      code: "VOICE_PROVIDER_AUTH",
      message: "VOICE_PROVIDER_AUTH",
    });
    const failed = task();
    vi.mocked(failed.uploadAsync).mockRejectedValue(
      new Error("native network failure"),
    );
    await expect(
      uploadVoice(failed, new AbortController().signal),
    ).rejects.toMatchObject({ status: 0, code: "VOICE_UPLOAD_NETWORK" });
    expect(failed.uploadAsync).toHaveBeenCalledTimes(1);
  });
  it("allows a 20 second combined upload/transcription rather than applying the JSON request limit", async () => {
    const port = task();
    vi.mocked(port.uploadAsync).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ status: 200, body: '{"text":"Madini"}' }),
            20000,
          ),
        ),
    );
    const result = uploadVoice(port, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(20000);
    expect(await result).toBe("Madini");
    expect(port.cancelAsync).not.toHaveBeenCalled();
  });
  it("cancels native transfer on timeout and never retries a possible paid request", async () => {
    const port = task();
    vi.mocked(port.uploadAsync).mockImplementation(() => new Promise(() => {}));
    const result = uploadVoice(port, new AbortController().signal);
    const assertion = expect(result).rejects.toMatchObject({
      code: "VOICE_UPLOAD_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(45000);
    await assertion;
    expect(port.cancelAsync).toHaveBeenCalledTimes(1);
    expect(port.uploadAsync).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels an in-flight request and ignores a late transcript", async () => {
    const port = task();
    let complete!: (value: { status: number; body: string }) => void;
    vi.mocked(port.uploadAsync).mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const controller = new AbortController();
    const result = uploadVoice(port, controller.signal);
    const assertion = expect(result).rejects.toMatchObject({
      code: "VOICE_UPLOAD_CANCELLED",
    });
    controller.abort();
    await assertion;
    complete({ status: 200, body: '{"text":"old place"}' });
    expect(port.cancelAsync).toHaveBeenCalledTimes(1);
  });
  it("never starts a cancelled request and rejects invalid or empty responses", async () => {
    const controller = new AbortController();
    controller.abort();
    const port = task();
    await expect(uploadVoice(port, controller.signal)).rejects.toMatchObject({
      code: "VOICE_UPLOAD_CANCELLED",
    });
    expect(port.uploadAsync).not.toHaveBeenCalled();
    for (const body of [
      '{"text":""}',
      '{"text":42}',
      '{"text":"' + "x".repeat(301) + '"}',
    ])
      await expect(
        uploadVoice(task({ status: 200, body }), new AbortController().signal),
      ).rejects.toMatchObject({ code: "VOICE_EMPTY_TRANSCRIPT" });
    await expect(
      uploadVoice(
        task({ status: 500, body: "not json" }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "VOICE_UPLOAD_RESPONSE" });
  });
});
