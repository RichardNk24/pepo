export type CapturePhase =
  | "idle"
  | "preparing"
  | "recording"
  | "transcribing"
  | "cancelling";
export type CapturePort = {
  prepare: () => Promise<void>;
  record: () => void;
  stop: () => Promise<void>;
  uri: () => string | null;
  status: () => {
    metering?: number;
    durationMillis: number;
    isRecording: boolean;
  };
  transcribe: (uri: string, signal: AbortSignal) => Promise<string>;
  cleanup: (uri: string | null) => Promise<void>;
};
/** Lifecycle independent of React/native modules; stale recordings never alter a new field. */
export class VoiceCapture {
  phase: CapturePhase = "idle";
  private version = 0;
  private timer?: ReturnType<typeof setInterval>;
  private controller?: AbortController;
  private preparation: Promise<void> = Promise.resolve();
  private operation: Promise<void> = Promise.resolve();
  private lastSound = 0;
  private heard = false;
  private peak = -Infinity;
  private recorded = false;
  private started = 0;
  constructor(
    private port: CapturePort,
    private events: {
      phase: (phase: CapturePhase) => void;
      result: (text: string) => void;
      error: (error: unknown) => void;
      progress?: (level: number, seconds: number) => void;
    },
  ) {}
  private setPhase(phase: CapturePhase) {
    this.phase = phase;
    this.events.phase(phase);
  }
  private clear() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  async start() {
    if (this.phase !== "idle") return;
    const version = ++this.version;
    this.setPhase("preparing");
    this.heard = false;
    this.peak = -Infinity;
    this.recorded = false;
    this.lastSound = 0;
    this.preparation = this.port.prepare();
    try {
      await this.preparation;
      if (version !== this.version) return;
      this.port.record();
      this.started = Date.now();
      this.setPhase("recording");
      this.timer = setInterval(() => {
        if (this.phase !== "recording") return;
        try {
          const status = this.port.status(),
            elapsed = Date.now() - this.started;
          if (status.isRecording && status.durationMillis > 0)
            this.recorded = true;
          const meter = status.metering;
          if (typeof meter === "number" && Number.isFinite(meter))
            this.peak = Math.max(this.peak, meter);
          this.events.progress?.(
            typeof meter === "number" && Number.isFinite(meter)
              ? Math.max(0, Math.min(1, (meter + 70) / 55))
              : 0,
            Math.floor(status.durationMillis / 1000),
          );
          if (typeof meter === "number" && meter > -55) {
            this.heard = true;
            this.lastSound = elapsed;
          }
          if (
            elapsed >= 12000 ||
            (elapsed > 2000 && this.heard && elapsed - this.lastSound > 1500) ||
            (!status.isRecording && elapsed > 500)
          )
            void this.finish();
        } catch (error) {
          this.events.error(error);
          void this.cancel();
        }
      }, 200);
    } catch (error) {
      if (version === this.version) {
        this.events.error(error);
        await this.port.cleanup(this.port.uri()).catch(() => {});
        if (version === this.version) this.setPhase("idle");
      }
    }
  }
  async finish() {
    if (this.phase !== "recording") return;
    const version = this.version;
    this.clear();
    // Sample once before stopping: a manual finish may precede the next polling tick.
    try {
      const status = this.port.status();
      this.recorded ||= status.durationMillis > 0;
      if (
        typeof status.metering === "number" &&
        Number.isFinite(status.metering)
      )
        this.peak = Math.max(this.peak, status.metering);
    } catch {}
    this.setPhase("transcribing");
    this.controller = new AbortController();
    this.operation = (async () => {
      try {
        await this.port.stop();
        if (version !== this.version) return;
        const uri = this.port.uri();
        if (!uri || !this.recorded || Date.now() - this.started < 350)
          throw new Error("empty-audio");
        // Do not reject soft voices just because they never crossed the pause detector.
        if (this.peak !== -Infinity && this.peak <= -90)
          throw new Error("silence");
        const text = await this.port.transcribe(uri, this.controller!.signal);
        if (version === this.version) this.events.result(text);
      } catch (error) {
        if (version === this.version) this.events.error(error);
      } finally {
        await this.port.cleanup(this.port.uri()).catch(() => {});
        if (version === this.version) this.setPhase("idle");
      }
    })();
    await this.operation;
  }
  async cancel() {
    if (this.phase === "idle" || this.phase === "cancelling") return;
    ++this.version;
    this.clear();
    this.controller?.abort();
    this.setPhase("cancelling");
    await this.preparation.catch(() => {});
    await this.operation.catch(() => {});
    await this.port.stop().catch(() => {});
    await this.port.cleanup(this.port.uri()).catch(() => {});
    this.setPhase("idle");
  }
}
