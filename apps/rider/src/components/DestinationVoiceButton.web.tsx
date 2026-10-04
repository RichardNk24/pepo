import type { CapturePhase } from "./voiceCapture";
import { VoiceButton } from "@pepo/voice/VoiceButton";
// Browser speech support depends on its engine. Expo Go uses the native recorder file.
export function DestinationVoiceButton({
  onResult,
}: {
  onResult: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onFeedback?: (feedback: {
    phase: CapturePhase;
    level: number;
    seconds: number;
    message: string;
  }) => void;
}) {
  return <VoiceButton onResult={onResult} />;
}
