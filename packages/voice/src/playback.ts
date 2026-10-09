import type { StructuredInstruction } from "./types";
import type { VoiceProfile, DeviceVoice } from "./profiles";
import { selectDeviceVoice } from "./profiles";
import { formatInstruction } from "./instructions";
export interface VoiceOutputPort {
  voices: () => Promise<DeviceVoice[]>;
  stop: () => Promise<void>;
  speak: (text: string, voice: DeviceVoice, onError: () => void) => void;
}
export type PlaybackResult =
  | "spoken"
  | "unavailable"
  | "unreviewed"
  | "cancelled";
/** Epoch checks guard all asynchronous boundaries; route/language changes stop obsolete audio. */
export class InstructionSpeaker {
  private epoch = 0;
  private profile?: VoiceProfile;
  private routeId = "";
  private latest?: StructuredInstruction;
  private cache = new Map<string, string>();
  constructor(
    private port: VoiceOutputPort,
    private error: () => void = () => {},
  ) {}
  async configure(routeId: string, profile: VoiceProfile) {
    this.epoch++;
    this.routeId = routeId;
    this.profile = profile;
    this.latest = undefined;
    await this.port.stop();
  }
  async stop() {
    this.epoch++;
    this.latest = undefined;
    await this.port.stop();
  }
  async speak(
    i: StructuredInstruction,
    voiceId?: string,
    preview = false,
  ): Promise<PlaybackResult> {
    if (i.routeId !== this.routeId || !this.profile) return "cancelled";
    const formatted = formatInstruction(i, this.profile, preview);
    if (!formatted) return "unreviewed";
    const token = ++this.epoch,
      profile = this.profile;
    this.latest = i;
    try {
      const voices = await this.port.voices();
      if (token !== this.epoch || i.routeId !== this.routeId)
        return "cancelled";
      const voice = selectDeviceVoice(voices, profile, voiceId);
      if (!voice) return "unavailable";
      await this.port.stop();
      if (token !== this.epoch || i.routeId !== this.routeId)
        return "cancelled";
      const key = `${profile.id}:${formatted.text}`;
      let text = this.cache.get(key);
      if (!text) {
        text = formatted.text;
        this.cache.set(key, text);
        if (this.cache.size > 64)
          this.cache.delete(this.cache.keys().next().value!);
      }
      this.port.speak(text, voice, () => {
        if (token === this.epoch) this.error();
      });
      return "spoken";
    } catch {
      if (token === this.epoch) this.error();
      return token === this.epoch ? "unavailable" : "cancelled";
    }
  }
  repeat(voiceId?: string) {
    return this.latest
      ? this.speak(this.latest, voiceId)
      : Promise.resolve("cancelled" as const);
  }
}
