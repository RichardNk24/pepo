import { useEffect, useState } from "react";
import { ScrollView, View, Platform } from "react-native";
import { useApp } from "@pepo/session/AppProvider";
import { Button, Header, Screen, Txt, Tag } from "@pepo/ui/UI";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import { useVoicePreferences } from "./preferences";
import {
  VOICE_PROFILES,
  profileFor,
  selectDeviceVoice,
  type DeviceVoice,
} from "./profiles";
export function VoiceSettings() {
  const app = useApp(),
    router = useRouter(),
    { preferences, save, ready, error } = useVoicePreferences(),
    profile = profileFor(preferences.profile);
  const [voices, setVoices] = useState<DeviceVoice[]>([]),
    [message, setMessage] = useState("");
  const en = app.settings.language === "en";
  useEffect(() => {
    let active = true;
    void Speech.getAvailableVoicesAsync()
      .then((v) => {
        if (active) setVoices(v);
      })
      .catch(() => {
        if (active)
          setMessage(
            en
              ? "Voice inventory unavailable."
              : "Liste des voix indisponible.",
          );
      });
    return () => {
      active = false;
      void Speech.stop();
    };
  }, []);
  const available = voices.filter(
    (v) => v.language.replaceAll("_", "-").split("-")[0] === profile.language,
  );
  return (
    <Screen>
      <Header back title={en ? "Voice and navigation" : "Voix et navigation"} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}
      >
        <Txt>
          {en
            ? "Independent of the app language. Microphone starts only when you tap Speak."
            : "Indépendant de la langue de l’application. Le micro démarre uniquement quand tu touches Parler."}
        </Txt>
        {VOICE_PROFILES.map((p) => (
          <View key={p.id} style={{ gap: 4 }}>
            <Button
              disabled={!ready}
              title={p.label}
              kind={p.id === profile.id ? "yellow" : "secondary"}
              onPress={() => {
                void Speech.stop();
                save({ profile: p.id, voiceId: undefined });
                setMessage("");
              }}
            />
            <Txt variant="small">
              {p.navigation === "ready"
                ? en
                  ? "Navigation templates implemented · device voice required"
                  : "Formulations de navigation disponibles · voix du téléphone requise"
                : p.navigation === "review"
                  ? en
                    ? "Navigation awaiting local language review · speech testing in Lab"
                    : "Navigation en attente de revue linguistique · transcription à tester dans le Lab"
                  : en
                    ? "Planned · recording strategy required"
                    : "En préparation · enregistrements natifs à prévoir"}
            </Txt>
          </View>
        ))}
        <Button
          disabled={
            !ready || profile.navigation !== "ready" || available.length === 0
          }
          title={
            preferences.enabled
              ? en
                ? "Mute navigation"
                : "Couper les annonces"
              : en
                ? "Enable navigation speech"
                : "Activer les annonces"
          }
          kind={preferences.enabled ? "yellow" : "secondary"}
          onPress={() => {
            void Speech.stop();
            save({ enabled: !preferences.enabled });
          }}
        />
        <Txt variant="h3">
          {en ? "Voices on this device" : "Voix présentes sur cet appareil"}
        </Txt>
        {!available.length ? (
          <Txt>
            {en
              ? "No voice for this language. No replacement language will be used."
              : "Aucune voix pour cette langue. Pepo ne la remplace pas par une autre langue."}
          </Txt>
        ) : (
          <>
            <Button
              title={en ? "Automatic voice" : "Voix automatique"}
              kind={!preferences.voiceId ? "yellow" : "secondary"}
              onPress={() => save({ voiceId: undefined })}
            />
            {available.map((v) => (
              <Button
                key={v.identifier}
                title={`${v.name} · ${v.language}`}
                kind={
                  preferences.voiceId === v.identifier ? "yellow" : "secondary"
                }
                onPress={() => save({ voiceId: v.identifier })}
              />
            ))}
          </>
        )}
        <Button
          title={en ? "Test pronunciation" : "Tester la prononciation"}
          disabled={!available.length}
          onPress={async () => {
            const voice = selectDeviceVoice(
              voices,
              profile,
              preferences.voiceId,
            );
            if (!voice) {
              setMessage("Voix indisponible.");
              return;
            }
            await Speech.stop();
            Speech.speak(
              profile.language === "fr"
                ? "Marché Kenya. Hôtel Pullman Grand Karavia."
                : profile.language === "en"
                  ? "Market Kenya. Pullman Grand Karavia Hotel."
                  : "PetroCIL. Marché Kenya. Karavia.",
              {
                voice: voice.identifier,
                language: voice.language,
                useApplicationAudioSession: false,
                onError: () => setMessage("Lecture impossible."),
              },
            );
          }}
        />
        {Platform.OS === "ios" ? (
          <Txt variant="small">
            {en
              ? "Turn off silent mode to test spoken audio on iPhone."
              : "Désactive le mode silencieux pour tester la voix sur iPhone."}
          </Txt>
        ) : null}
        {error || message ? <Tag>{error || message}</Tag> : null}
        {__DEV__ ? (
          <Button
            title="Pepo Voice Intelligence Lab"
            kind="secondary"
            onPress={() => router.push("/voice-lab")}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
