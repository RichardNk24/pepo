import * as Speech from "expo-speech";
import type { VoiceOutputPort } from "./playback";
export const deviceSpeechPort: VoiceOutputPort = {
  voices: () => Speech.getAvailableVoicesAsync(),
  stop: () => Speech.stop(),
  speak: (text, voice, onError) =>
    Speech.speak(text, {
      language: voice.language,
      voice: voice.identifier,
      rate: 0.9,
      useApplicationAudioSession: false,
      onError,
    }),
};
