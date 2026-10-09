import { useVoicePreferences } from "./preferences";
import { profileFor } from "./profiles";
import {
  api,
  API_URL,
  getToken,
  LIVE,
  RequestError,
} from "@pepo/api-client/api";
import { useApp } from "@pepo/session/AppProvider";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import { Mic, Square, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Pressable,
  Text,
  View,
} from "react-native";
import { uploadVoice, VoiceUploadError } from "./voiceUpload";
import { VoiceCapture, type CapturePhase } from "./voiceCapture";

// Serialize microphone ownership across field changes and modal unmounts.
let audioLease: Promise<void> = Promise.resolve();

export function DestinationSpeechButton({
  onResult,
  onBusyChange,
  onFeedback,
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
  const app = useApp();
  const { preferences } = useVoicePreferences();
  const speechLanguage = profileFor(preferences.profile).language;
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    bitRate: 64000,
    isMeteringEnabled: true,
  });
  const [phase, setPhase] = useState<CapturePhase>("idle");
  const feedback = useRef({
    phase: "idle" as CapturePhase,
    level: 0,
    seconds: 0,
    message: "",
  });
  const callbacks = useRef({ onResult, onBusyChange, onFeedback });
  callbacks.current = { onResult, onBusyChange, onFeedback };
  const capture = useRef<VoiceCapture | null>(null);
  useEffect(() => {
    let alive = true;
    let lastUri: string | null = null;
    let releaseAudio: (() => void) | undefined;
    const cancelled = () => !alive || session.phase === "cancelling";
    const cleanup = async (uri: string | null) => {
      const release = releaseAudio;
      if (!release) return;
      releaseAudio = undefined;
      try {
        if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
      } finally {
        try {
          await setAudioModeAsync({ allowsRecording: false });
        } finally {
          release();
        }
      }
    };
    const session = new VoiceCapture(
      {
        prepare: async () => {
          if (!LIVE || app.demo) throw new Error("demo");
          const status = await api<{ enabled: boolean }>("/voice/status");
          if (!status.enabled) throw new Error("voice-disabled");
          const previous = audioLease;
          audioLease = new Promise<void>((resolve) => {
            releaseAudio = resolve;
          });
          await previous;
          if (cancelled()) throw new Error("cancelled");
          const permission = await requestRecordingPermissionsAsync();
          if (!permission.granted) throw new Error("permission");
          // Avoid starting a recorder after the screen was dismissed during the OS prompt.
          if (cancelled()) throw new Error("cancelled");
          await Speech.stop();
          await setAudioModeAsync({
            allowsRecording: true,
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            allowsBackgroundRecording: false,
          });
          if (cancelled()) throw new Error("cancelled");
          await setIsAudioActiveAsync(true);
          await recorder.prepareToRecordAsync({
            ...RecordingPresets.HIGH_QUALITY,
            numberOfChannels: 1,
            bitRate: 64000,
            isMeteringEnabled: true,
          });
        },
        record: () => {
          recorder.record();
          lastUri = recorder.uri;
        },
        stop: async () => {
          await recorder.stop();
        },
        uri: () => {
          try {
            lastUri = recorder.uri || lastUri;
          } catch {}
          return lastUri;
        },
        status: () => recorder.getStatus(),
        cleanup,
        transcribe: async (uri, signal) => {
          const info = await FileSystem.getInfoAsync(uri);
          if (!info.exists || !info.size || info.size > 1024 * 1024)
            throw new Error("empty-audio");
          const trace =
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2, 8);
          if (__DEV__)
            console.info("[pepo-voice] VOICE_UPLOAD_START", {
              trace,
              bytes: info.size,
            });
          // Use the native file transfer: it reads the finalized file directly and
          // supplies its own multipart boundary, without a JS Blob/URI cast.
          const task = FileSystem.createUploadTask(
            `${API_URL}/api/voice/transcribe`,
            uri,
            {
              httpMethod: "POST",
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
              fieldName: "audio",
              mimeType: "audio/mp4",
              parameters: {
                city: app.settings.city,
                language: speechLanguage,
              },
              headers: {
                Authorization: `Bearer ${getToken()}`,
                "X-Pepo-Voice-Trace": trace,
              },
            },
          );
          try {
            const text = await uploadVoice(task, signal);
            if (__DEV__)
              console.info("[pepo-voice] VOICE_UPLOAD_COMPLETE", { trace });
            return text;
          } catch (error) {
            if (error instanceof VoiceUploadError) {
              if (__DEV__)
                console.warn("[pepo-voice]", error.code, {
                  trace,
                  status: error.status,
                });
              throw new RequestError(error.code, error.status, error.code);
            }
            throw error;
          }
        },
      },
      {
        phase: (next) => {
          if (alive) {
            setPhase(next);
            callbacks.current.onBusyChange?.(next !== "idle");
            feedback.current = {
              ...feedback.current,
              phase: next,
              level: 0,
              seconds: next === "preparing" ? 0 : feedback.current.seconds,
            };
            callbacks.current.onFeedback?.(feedback.current);
          }
        },
        progress: (level, seconds) => {
          if (!alive) return;
          feedback.current = { ...feedback.current, level, seconds };
          callbacks.current.onFeedback?.(feedback.current);
        },
        result: (text) => {
          if (alive) callbacks.current.onResult(text);
        },
        error: (error) => {
          if (!alive) return;
          const reason = (error as Error).message;
          const code = error instanceof RequestError ? error.code : undefined;
          const key =
            reason === "permission"
              ? "voicePermission"
              : reason === "demo"
                ? "voiceConnectedOnly"
                : reason === "silence"
                  ? "voiceNoSound"
                  : reason === "empty-audio"
                    ? "voiceRecordFailed"
                    : reason === "voice-disabled" ||
                        code === "VOICE_DISABLED" ||
                        code === "VOICE_LANGUAGE_UNAVAILABLE"
                      ? "voiceServiceUnavailable"
                      : code === "VOICE_PROVIDER_AUTH" ||
                          code === "VOICE_PROVIDER_MODEL"
                        ? "voiceServiceUnavailable"
                        : code === "VOICE_EMPTY_TRANSCRIPT"
                          ? "voiceRetry"
                          : code === "VOICE_UPLOAD_TIMEOUT" ||
                              code === "VOICE_TIMEOUT"
                            ? "voiceTakingTooLong"
                            : error instanceof RequestError &&
                                error.status === 401
                              ? "voiceSessionExpired"
                              : error instanceof RequestError &&
                                  error.status === 429
                                ? "voiceQuota"
                                : error instanceof RequestError &&
                                    (error.status === 0 ||
                                      code === "VOICE_TIMEOUT")
                                  ? "voiceNetwork"
                                  : error instanceof RequestError &&
                                      error.status === 400
                                    ? "voiceRecordFailed"
                                    : "voiceRetry";
          feedback.current = { ...feedback.current, message: app.t(key) };
          callbacks.current.onFeedback?.(feedback.current);
          // Only a safe diagnostic code/status, never audio, transcripts or keys.
          if (__DEV__)
            console.warn(
              "[pepo-voice]",
              code || reason,
              error instanceof RequestError ? error.status : "capture",
            );
        },
      },
    );
    capture.current = session;
    const sub = AppState.addEventListener("change", (state) => {
      if (
        state === "background" ||
        (state === "inactive" && session.phase !== "preparing")
      )
        void session.cancel();
    });
    return () => {
      alive = false;
      sub.remove();
      callbacks.current.onBusyChange?.(false);
      void session.cancel();
    };
  }, [recorder, app.settings.city, speechLanguage, app.demo]);
  const recording = phase === "recording",
    busy = phase !== "idle" && !recording;
  return (
    <View style={{ width: 158, flexShrink: 0 }}>
      <View style={{ flexDirection: "row", gap: 5 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={app.t(recording ? "voiceFinish" : "voice")}
          disabled={busy}
          onPress={() => {
            Keyboard.dismiss();
            feedback.current = { ...feedback.current, message: "" };
            callbacks.current.onFeedback?.(feedback.current);
            if (recording) void capture.current?.finish();
            else void capture.current?.start();
          }}
          style={{
            minHeight: 44,
            width: 114,
            justifyContent: "center",
            borderRadius: 22,
            paddingHorizontal: 14,
            flexDirection: "row",
            gap: 7,
            alignItems: "center",
            backgroundColor: recording ? "#F5D54C" : "#F2F4F5",
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#20221F" />
          ) : recording ? (
            <Square size={16} />
          ) : (
            <Mic size={18} />
          )}
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 14 }}>
            {app.t(
              recording
                ? "voiceFinish"
                : phase === "transcribing"
                  ? "voiceTranscribing"
                  : phase === "preparing"
                    ? "voicePreparing"
                    : "voice",
            )}
          </Text>
        </Pressable>
        {phase !== "idle" && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={app.t("cancel")}
            onPress={() => void capture.current?.cancel()}
            style={{
              width: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
