import { useVoice } from "./useVoice";
import { useVoicePreferences } from "./preferences";
import { profileFor } from "./profiles";
import { useApp } from "@pepo/session/AppProvider";
import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import type { CapturePhase } from "./voiceCapture";
export function DestinationSpeechButton({
  onResult,
  onBusyChange,
  onFeedback,
}: {
  onResult: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
  onFeedback?: (value: {
    phase: CapturePhase;
    level: number;
    seconds: number;
    message: string;
  }) => void;
}) {
  const app = useApp(),
    { preferences } = useVoicePreferences();
  const callbacks = useRef({ onBusyChange, onFeedback });
  callbacks.current = { onBusyChange, onFeedback };
  const voice = useVoice(onResult, profileFor(preferences.profile).language);
  useEffect(() => {
    callbacks.current.onBusyChange?.(voice.listening);
    callbacks.current.onFeedback?.({
      phase: voice.listening ? "recording" : "idle",
      level: 0,
      seconds: 0,
      message: voice.message,
    });
  }, [voice.listening, voice.message]);
  return (
    <View style={{ width: 158 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => (voice.listening ? voice.finish() : void voice.start())}
        style={{
          minHeight: 44,
          borderRadius: 22,
          backgroundColor: voice.listening ? "#F5D54C" : "#F2F4F5",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text>{app.t(voice.listening ? "voiceFinish" : "voice")}</Text>
      </Pressable>
      {voice.transcript ? <Text>{voice.transcript}</Text> : null}
      {voice.message ? <Text>{voice.message}</Text> : null}
    </View>
  );
}
