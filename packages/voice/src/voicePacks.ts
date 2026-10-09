import type { VoiceProfileId } from "./profiles";
export type VoicePack = {
  id: string;
  version: number;
  profile: VoiceProfileId;
  reviewer: string;
  reviewedAt: number;
  clips: { text: string; localUri: string; sha256: string }[];
};
/** Clips are complete, reviewed utterances; never concatenate fragments into a new direction. */
export function validatedClip(
  pack: VoicePack,
  profile: VoiceProfileId,
  text: string,
) {
  if (
    pack.profile !== profile ||
    !pack.reviewer.trim() ||
    !Number.isFinite(pack.reviewedAt) ||
    pack.reviewedAt <= 0 ||
    pack.reviewedAt > Date.now() ||
    pack.version < 1
  )
    return undefined;
  return pack.clips.find(
    (c) =>
      c.text === text &&
      /^(file:\/\/|asset:\/\/)/.test(c.localUri) &&
      /^[a-f0-9]{64}$/.test(c.sha256),
  );
}
export interface ClipPort {
  verify: (uri: string, sha256: string) => Promise<boolean>;
  play: (uri: string) => Promise<void>;
  stop: () => Promise<void>;
}
export class VoicePackPlayer {
  private epoch = 0;
  constructor(private port: ClipPort) {}
  async stop() {
    this.epoch++;
    await this.port.stop();
  }
  async play(pack: VoicePack, profile: VoiceProfileId, text: string) {
    const token = ++this.epoch;
    const clip = validatedClip(pack, profile, text);
    if (!clip) return false;
    if (
      !(await this.port.verify(clip.localUri, clip.sha256)) ||
      token !== this.epoch
    )
      return false;
    await this.port.stop();
    if (token !== this.epoch) return false;
    await this.port.play(clip.localUri);
    return true;
  }
}
