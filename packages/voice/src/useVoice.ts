import { VOICE_PROFILES, type VoiceLanguage } from "./profiles";
import { useI18n } from "@pepo/i18n/Context";
import type { TranslationKey } from "@pepo/i18n/catalog";
import { chooseSpeechLocale } from "@pepo/i18n/locale";
import Constants from "expo-constants";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
type Recognition =
  typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule;
export function useVoice(
  onResult?: (text: string) => void,
  selectedLanguage?: VoiceLanguage,
) {
  const { language: interfaceLanguage, t } = useI18n();
  const language = selectedLanguage || interfaceLanguage;
  const chooseLocale = (locales: string[], lang: VoiceLanguage) => {
    if (["fr", "en", "sw", "ln"].includes(lang))
      return chooseSpeechLocale(locales, lang as "fr" | "en" | "sw" | "ln");
    const profile = VOICE_PROFILES.find((p) => p.language === lang);
    return (
      locales.find((l) => profile?.locales.includes(l.replaceAll("_", "-"))) ||
      null
    );
  };
  const [transcriptText, setTranscriptText] = useState("");
  const [listening, setListening] = useState(false),
    [message, setMessage] = useState("");
  const module = useRef<Recognition | null>(null),
    subs = useRef<{ remove: () => void }[]>([]),
    timeout = useRef<ReturnType<typeof setTimeout> | null>(null),
    alive = useRef(true),
    busy = useRef(false),
    callback = useRef(onResult),
    generation = useRef(0);
  callback.current = onResult;
  const clear = () => {
    subs.current.forEach((s) => s.remove());
    subs.current = [];
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    busy.current = false;
  };
  const stop = () => {
    generation.current++;
    module.current?.abort();
    clear();
    if (alive.current) setListening(false);
  };
  const fail = (key: TranslationKey) => {
    stop();
    if (alive.current) setMessage(t(key));
  };
  useEffect(() => {
    alive.current = true;
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") stop();
    });
    return () => {
      alive.current = false;
      stop();
      void Speech.stop();
      sub.remove();
    };
  }, []);
  useEffect(() => {
    stop();
    setMessage("");
    void Speech.stop();
  }, [language]);
  async function start() {
    if (busy.current) return;
    busy.current = true;
    setMessage("");
    setTranscriptText("");
    const token = ++generation.current;
    const current = () => alive.current && token === generation.current;
    try {
      if (Platform.OS !== "web" && Constants.appOwnership === "expo")
        return fail("voiceNeedsBuild");
      await Speech.stop();
      const m = (await import("expo-speech-recognition"))
        .ExpoSpeechRecognitionModule;
      if (!current()) return;
      module.current = m;
      if (!m.isRecognitionAvailable()) return fail("voiceUnavailable");
      let locale: string | null = null,
        inventoryKnown = false;
      try {
        const supported = await m.getSupportedLocales({});
        inventoryKnown = supported.locales.length > 0;
        locale = chooseLocale(supported.locales, language);
      } catch {}
      if (!current()) return;
      // Web and older Android do not expose locale inventories. Never guess Swahili or Lingala.
      if (
        !inventoryKnown &&
        !locale &&
        (language === "fr" || language === "en")
      )
        locale = language === "fr" ? "fr-FR" : "en-US";
      if (!locale) return fail("voiceLanguageUnavailable");
      const permission = await m.requestPermissionsAsync();
      if (!current()) return;
      if (!permission.granted) return fail("voicePermission");
      let transcript = "",
        delivered = false;
      const deliver = () => {
        if (delivered || !current()) return;
        delivered = true;
        if (transcript.trim()) callback.current?.(transcript.trim());
        else setMessage(t("voiceNotUnderstood"));
      };
      subs.current = [
        m.addListener("start", () => {
          if (current()) setListening(true);
        }),
        m.addListener("result", (e) => {
          transcript = e.results[0]?.transcript || "";
          if (current()) setTranscriptText(transcript);
          if (e.isFinal) deliver();
        }),
        m.addListener("error", () => fail("voiceNotUnderstood")),
        m.addListener("end", () => {
          deliver();
          clear();
          if (current()) setListening(false);
        }),
      ];
      m.start({
        lang: locale,
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
      });
      timeout.current = setTimeout(() => {
        if (current()) stop();
      }, 12000);
    } catch {
      if (current()) fail("voiceUnavailable");
    }
  }
  async function speak(text: string) {
    stop();
    setMessage("");
    const token = generation.current;
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      if (!alive.current || generation.current !== token) return;
      const locale = chooseLocale(
        voices.map((v) => v.language),
        language,
      );
      if (!locale) return setMessage(t("voiceLanguageUnavailable"));
      const voice = voices.find(
        (v) => v.language.replaceAll("_", "-") === locale,
      );
      await Speech.stop();
      if (!alive.current || generation.current !== token) return;
      Speech.speak(text, {
        language: locale,
        voice: voice?.identifier,
        rate: 0.9,
        onError: () => {
          if (alive.current) setMessage(t("voiceUnavailable"));
        },
      });
    } catch {
      if (alive.current) setMessage(t("voiceUnavailable"));
    }
  }
  const finish = () => module.current?.stop();
  return {
    start,
    stop,
    finish,
    speak,
    listening,
    message,
    transcript: transcriptText,
  };
}
