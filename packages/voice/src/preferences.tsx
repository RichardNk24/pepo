import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "@pepo/session/AppProvider";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  defaultVoiceProfile,
  safeVoicePreferences,
  type VoicePreferences,
} from "./profiles";
const Context = createContext<{
  preferences: VoicePreferences;
  ready: boolean;
  save: (patch: Partial<VoicePreferences>) => void;
  error: string;
} | null>(null);
/** Per-account device preferences. Never changes interface language or backend safety settings. */
export function VoicePreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const app = useApp(),
    key = `pepo-voice-v1-${app.profile?.role || "guest"}-${app.profile?.id || "guest"}`;
  const [preferences, set] = useState<VoicePreferences>(() => ({
      profile: defaultVoiceProfile(app.settings.language),
      enabled: false,
    })),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0),
    write = useRef(Promise.resolve());
  useEffect(() => {
    const version = ++generation.current;
    setReady(false);
    setError("");
    set({
      profile: defaultVoiceProfile(app.settings.language),
      enabled: false,
    });
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (version !== generation.current) return;
        try {
          set(
            safeVoicePreferences(
              raw ? JSON.parse(raw) : null,
              defaultVoiceProfile(app.settings.language),
            ),
          );
        } catch {
          setError("Réglages vocaux réinitialisés.");
        }
      })
      .catch(() => {
        if (version === generation.current)
          setError("Réglages vocaux indisponibles.");
      })
      .finally(() => {
        if (version === generation.current) setReady(true);
      });
    return () => {
      generation.current++;
    };
  }, [key]);
  const current = useRef(preferences);
  current.current = preferences;
  const save = (patch: Partial<VoicePreferences>) => {
    if (!ready) return;
    const next = safeVoicePreferences(
      { ...current.current, ...patch },
      preferences.profile,
    );
    current.current = next;
    set(next);
    const version = generation.current;
    write.current = write.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(next)))
      .catch(() => {
        if (version === generation.current)
          setError("Impossible de sauvegarder ces réglages.");
      });
  };
  return (
    <Context.Provider value={{ preferences, ready, save, error }}>
      {children}
    </Context.Provider>
  );
}
export function useVoicePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("VoicePreferencesProvider manquant");
  return value;
}
