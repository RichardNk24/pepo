import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  createAudioPlayer,
  type AudioPlayer,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { API_URL, getToken } from "@pepo/api-client/api";
import { Button, Txt } from "@pepo/ui/UI";
let activeStop: (() => Promise<void>) | undefined;
export async function stopCorpusPlayback() {
  await activeStop?.();
}
export function CorpusAudio({
  id,
  disabled,
}: {
  id: string;
  disabled: boolean;
}) {
  const player = useRef<AudioPlayer | null>(null),
    generation = useRef(0),
    temporary = useRef<string | null>(null),
    modeChange = useRef<Promise<void>>(Promise.resolve());
  const [message, setMessage] = useState("");
  const stop = async () => {
    generation.current++;
    player.current?.remove();
    player.current = null;
    const file = temporary.current;
    temporary.current = null;
    await modeChange.current.catch(() => {});
    if (file) await FileSystem.deleteAsync(file, { idempotent: true });
  };
  useEffect(() => {
    if (disabled) void stop();
  }, [disabled]);
  useEffect(() => {
    activeStop = stop;
    const sub = AppState.addEventListener("change", () => void stop());
    return () => {
      if (activeStop === stop) activeStop = undefined;
      sub.remove();
      void stop();
    };
  }, [id]);
  return (
    <>
      <Button
        title="Réécouter"
        kind="secondary"
        disabled={disabled}
        onPress={async () => {
          await stop();
          const epoch = generation.current;
          setMessage("Chargement…");
          const file =
            FileSystem.cacheDirectory +
            "pepo-corpus-" +
            id +
            "-" +
            Date.now() +
            ".m4a";
          try {
            const result = await FileSystem.downloadAsync(
              API_URL + "/api/voice/corpus/" + id + "/audio",
              file,
              { headers: { Authorization: "Bearer " + getToken() } },
            );
            if (result.status !== 200) throw new Error("Lecture indisponible.");
            if (epoch !== generation.current) {
              await FileSystem.deleteAsync(file, { idempotent: true });
              return;
            }
            temporary.current = file;
            modeChange.current = setAudioModeAsync({
              allowsRecording: false,
              playsInSilentMode: true,
              shouldPlayInBackground: false,
            });
            await modeChange.current;
            if (epoch !== generation.current) return;
            const audio = createAudioPlayer(file);
            player.current = audio;
            audio.addListener("playbackStatusUpdate", (status) => {
              if (status.didJustFinish) {
                setMessage("");
                void stop();
              }
            });
            audio.play();
            setMessage("Lecture de ton enregistrement");
          } catch (e) {
            await FileSystem.deleteAsync(file, { idempotent: true });
            if (epoch === generation.current)
              setMessage("Impossible de réécouter. Vérifie ta connexion.");
          }
        }}
      />
      <Button
        title="Arrêter la lecture"
        kind="secondary"
        onPress={() => void stop()}
      />
      {message ? <Txt>{message}</Txt> : null}
    </>
  );
}
