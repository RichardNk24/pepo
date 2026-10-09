export type VoiceMetric = {
  stage: "capture" | "transcription" | "instruction" | "playback";
  durationMs: number;
  outcome: "ok" | "error" | "suppressed";
  profile: string;
};
export class VoiceTelemetry {
  private values: VoiceMetric[] = [];
  record(value: VoiceMetric) {
    if (!Number.isFinite(value.durationMs) || value.durationMs < 0) return;
    this.values.push({ ...value, durationMs: Math.round(value.durationMs) });
    if (this.values.length > 100) this.values.shift();
  }
  summary() {
    return {
      count: this.values.length,
      errors: this.values.filter((v) => v.outcome === "error").length,
      averageMs: this.values.length
        ? Math.round(
            this.values.reduce((s, v) => s + v.durationMs, 0) /
              this.values.length,
          )
        : 0,
    };
  }
  clear() {
    this.values = [];
  }
}
