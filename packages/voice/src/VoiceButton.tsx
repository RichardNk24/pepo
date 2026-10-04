import { useI18n } from "@pepo/i18n/Context";
import { Mic,MicOff } from "lucide-react-native";
import { Pressable,Text,View } from "react-native";
import { useVoice } from "./useVoice";
export function VoiceButton({
  onResult,
}: {
  onResult: (text: string) => void;
}) {
  const { t } = useI18n(),
    voice = useVoice(onResult);
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(voice.listening ? "stopListening" : "voice")}
        onPress={() => (voice.listening ? voice.stop() : void voice.start())}
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          backgroundColor: voice.listening ? "#F5D54C" : "#F2F4F5",
          flexDirection: "row",
          gap: 7,
          paddingHorizontal: 12,
        }}
      >
        {voice.listening ? <MicOff size={18} /> : <Mic size={18} />}
        <Text style={{ fontSize: 14, color: "#20221F" }}>
          {t(voice.listening ? "listening" : "voice")}
        </Text>
      </Pressable>
      {voice.message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontSize: 12, color: "#666", maxWidth: 290 }}
        >
          {voice.message}
        </Text>
      ) : null}
    </View>
  );
}
