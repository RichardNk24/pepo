import {
  smoothHeading,
  validPoint,
  type LocationFix,
} from "@pepo/utils/mapGeometry";
import * as Location from "expo-location";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";

type Status =
  | "idle"
  | "searching"
  | "ready"
  | "denied"
  | "disabled"
  | "error"
  | "paused";
type Value = {
  fix: LocationFix | null;
  heading: number | null;
  headingReliable: boolean;
  status: Status;
  error: string;
  stale: boolean;
  enable: () => Promise<LocationFix>;
};
const Context = createContext<Value | null>(null);
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [fix, setFix] = useState<LocationFix | null>(null),
    [heading, setHeading] = useState<number | null>(null),
    [headingReliable, setHeadingReliable] = useState(false);
  const [status, setStatus] = useState<Status>("idle"),
    [error, setError] = useState(""),
    [granted, setGranted] = useState(false),
    [active, setActive] = useState(AppState.currentState === "active"),
    [clock, setClock] = useState(Date.now());
  const alive = useRef(true),
    current = useRef(fix),
    lastHeading = useRef(0);
  current.current = fix;
  const accept = (position: Location.LocationObject) => {
    if (!alive.current || !validPoint(position.coords)) return;
    const value = {
      latitude: position.coords.latitude,
      ...(position.coords.speed != null &&
      Number.isFinite(position.coords.speed) &&
      position.coords.speed >= 0
        ? { speed: position.coords.speed }
        : {}),
      longitude: position.coords.longitude,
      accuracy:
        position.coords.accuracy != null &&
        Number.isFinite(position.coords.accuracy) &&
        position.coords.accuracy >= 0
          ? position.coords.accuracy
          : null,
      timestamp: Number.isFinite(position.timestamp)
        ? position.timestamp
        : Date.now(),
    };
    setFix(value);
    setStatus("ready");
    setError("");
    return value;
  };
  useEffect(() => {
    alive.current = true;
    let prompting = false,
      startupAttempted = false;
    const syncPermission = async () => {
      if (prompting) return;
      prompting = true;
      try {
        let p = await Location.getForegroundPermissionsAsync();
        if (
          alive.current &&
          Platform.OS !== "web" &&
          AppState.currentState === "active" &&
          !startupAttempted &&
          p.status === "undetermined" &&
          p.canAskAgain
        ) {
          startupAttempted = true;
          p = await Location.requestForegroundPermissionsAsync();
        }
        if (alive.current) {
          setGranted(p.granted);
          if (!p.granted) {
            setFix(null);
            setStatus(p.status === "denied" ? "denied" : "idle");
          }
        }
      } catch {
        /* Manual location control remains available after a transient OS error. */
      } finally {
        prompting = false;
      }
    };
    void syncPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state !== "active") {
        setStatus("paused");
        setHeading(null);
      } else void syncPermission();
    });
    const timer = setInterval(() => setClock(Date.now()), 10000);
    return () => {
      alive.current = false;
      subscription.remove();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!granted || !active) return;
    let disposed = false,
      position: Location.LocationSubscription | undefined,
      orientation: Location.LocationSubscription | undefined;
    setStatus(current.current ? "ready" : "searching");
    void (async () => {
      if (!(await Location.hasServicesEnabledAsync())) {
        if (!disposed) setStatus("disabled");
        return;
      }
      position = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (p) => {
          if (!disposed) accept(p);
        },
        () => {
          if (!disposed) {
            setStatus("error");
            setError("Signal GPS indisponible. Réessayez à l’extérieur.");
          }
        },
      );
      if (disposed) {
        position.remove();
        return;
      }
      if (Platform.OS !== "web") {
        orientation = await Location.watchHeadingAsync((h) => {
          if (disposed || Date.now() - lastHeading.current < 120) return;
          lastHeading.current = Date.now();
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (value < 0 || !Number.isFinite(value)) return;
          setHeading((prev) =>
            prev === null ? value : smoothHeading(prev, value),
          );
          setHeadingReliable(h.accuracy >= 2);
        }).catch(() => undefined);
        if (disposed) orientation?.remove();
      }
    })().catch(() => {
      if (!disposed && !current.current) {
        setStatus("error");
        setError(
          "Impossible de lire la position. Vérifiez les réglages de localisation.",
        );
      }
    });
    return () => {
      disposed = true;
      position?.remove();
      orientation?.remove();
    };
  }, [granted, active]);
  const enable = async () => {
    setError("");
    setStatus("searching");
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted) {
        setGranted(false);
        setStatus("denied");
        throw new Error(
          "Autorisez la localisation dans les réglages d’Expo Go, ou choisissez un lieu sur la carte.",
        );
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setStatus("disabled");
        throw new Error(
          "Activez la localisation du téléphone, puis réessayez.",
        );
      }
      setGranted(true);
      if (current.current && Date.now() - current.current.timestamp < 15000) {
        setStatus("ready");
        return current.current;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    "Le GPS met du temps à répondre. Réessayez à l’extérieur ou choisissez sur la carte.",
                  ),
                ),
              20000,
            );
          }),
        ]);
        const value = accept(result);
        if (!value) throw new Error("La position reçue est invalide.");
        return value;
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus((s) => (s === "denied" || s === "disabled" ? s : "error"));
      throw e;
    }
  };
  return (
    <Context.Provider
      value={{
        fix,
        heading,
        headingReliable,
        status,
        error,
        stale: !!fix && (clock - fix.timestamp > 45000 || !active),
        enable,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLocation() {
  const value = useContext(Context);
  if (!value) throw new Error("LocationProvider manquant");
  return value;
}
