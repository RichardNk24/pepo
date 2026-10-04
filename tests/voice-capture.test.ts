import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VoiceCapture,
  type CapturePort,
} from "../apps/rider/src/components/voiceCapture";
function setup(overrides: Partial<CapturePort> = {}) {
  const port: CapturePort = {
    prepare: vi.fn(async () => {}),
    record: vi.fn(),
    stop: vi.fn(async () => {}),
    uri: () => "file:///sample.m4a",
    status: () => ({ durationMillis: 500, metering: -20, isRecording: true }),
    transcribe: vi.fn(async () => "Je vais à Karavia"),
    cleanup: vi.fn(async () => {}),
    ...overrides,
  };
  const events = {
    phase: vi.fn(),
    result: vi.fn(),
    error: vi.fn(),
    progress: vi.fn(),
  };
  return { port, events, session: new VoiceCapture(port, events) };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("destination recording lifecycle", () => {
  it("records once, stops after speech and a pause, then delivers one transcript", async () => {
    let meter = -20;
    const { session, port, events } = setup({
      status: () => ({
        durationMillis: 1000,
        metering: meter,
        isRecording: true,
      }),
    });
    await session.start();
    await session.start();
    await vi.advanceTimersByTimeAsync(800);
    meter = -100;
    await vi.advanceTimersByTimeAsync(2000);
    expect(port.record).toHaveBeenCalledTimes(1);
    expect(port.transcribe).toHaveBeenCalledTimes(1);
    expect(events.result).toHaveBeenCalledWith("Je vais à Karavia");
    expect(port.cleanup).toHaveBeenCalledWith("file:///sample.m4a");
    expect(session.phase).toBe("idle");
  });
  it("does not send silence, and caps continuous ambient sound at 12 seconds", async () => {
    const quiet = setup({
      status: () => ({
        durationMillis: 1000,
        metering: -100,
        isRecording: true,
      }),
    });
    await quiet.session.start();
    await vi.advanceTimersByTimeAsync(12200);
    expect(quiet.port.transcribe).not.toHaveBeenCalled();
    expect(quiet.events.error).toHaveBeenCalled();
    const noisy = setup();
    await noisy.session.start();
    await vi.advanceTimersByTimeAsync(12200);
    expect(noisy.port.transcribe).toHaveBeenCalledTimes(1);
    expect(noisy.session.phase).toBe("idle");
  });
  it("cancels while permission/prepare is pending without ever recording", async () => {
    let done!: () => void;
    const { session, port, events } = setup({
      prepare: () =>
        new Promise<void>((r) => {
          done = r;
        }),
    });
    const starting = session.start();
    const cancelling = session.cancel();
    done();
    await Promise.all([starting, cancelling]);
    expect(port.record).not.toHaveBeenCalled();
    expect(port.transcribe).not.toHaveBeenCalled();
    expect(events.result).not.toHaveBeenCalled();
    expect(session.phase).toBe("idle");
  });
  it("ignores a late transcript after cancellation/field change, and cleans the file", async () => {
    let done!: (text: string) => void, signal: AbortSignal | undefined;
    const { session, port, events } = setup({
      transcribe: (_uri, s) => {
        signal = s;
        return new Promise<string>((r) => {
          done = r;
        });
      },
    });
    await session.start();
    await vi.advanceTimersByTimeAsync(800);
    const finishing = session.finish();
    await Promise.resolve();
    const cancelled = session.cancel();
    done("Wrong old destination");
    await Promise.all([finishing, cancelled]);
    expect(signal?.aborted).toBe(true);
    expect(events.result).not.toHaveBeenCalled();
    expect(port.cleanup).toHaveBeenCalled();
  });
  it("allows manual finish without waiting for silence and ignores duplicate taps", async () => {
    const { session, port } = setup();
    await session.start();
    await vi.advanceTimersByTimeAsync(800);
    await Promise.all([session.finish(), session.finish()]);
    expect(port.transcribe).toHaveBeenCalledTimes(1);
  });
  it("permission refusal and provider failure keep typing available", async () => {
    const denied = setup({
      prepare: async () => {
        throw new Error("permission");
      },
    });
    await denied.session.start();
    expect(denied.port.record).not.toHaveBeenCalled();
    expect(denied.session.phase).toBe("idle");
    const failed = setup({
      transcribe: async () => {
        throw new Error("offline");
      },
    });
    await failed.session.start();
    await vi.advanceTimersByTimeAsync(800);
    await failed.session.finish();
    expect(failed.session.phase).toBe("idle");
    expect(failed.events.result).not.toHaveBeenCalled();
    expect(failed.port.cleanup).toHaveBeenCalled();
  });
  it("captures soft speech without treating a pause threshold as a validity threshold", async () => {
    const { session, port, events } = setup({
      status: () => ({ durationMillis: 700, metering: -65, isRecording: true }),
    });
    await session.start();
    await vi.advanceTimersByTimeAsync(800);
    await session.finish();
    expect(port.transcribe).toHaveBeenCalledTimes(1);
    expect(events.progress).toHaveBeenCalledWith(expect.any(Number), 0);
    expect(events.result).toHaveBeenCalledWith("Je vais à Karavia");
  });
  it("does not claim audio capture when the recorder never advances", async () => {
    const { session, port, events } = setup({
      status: () => ({ durationMillis: 0, metering: -20, isRecording: false }),
    });
    await session.start();
    await vi.advanceTimersByTimeAsync(800);
    expect(port.transcribe).not.toHaveBeenCalled();
    expect(events.error.mock.calls[0][0].message).toBe("empty-audio");
    expect(session.phase).toBe("idle");
  });
});
