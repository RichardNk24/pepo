import { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import { api } from "@pepo/api-client/api";
import { Button, Txt } from "@pepo/ui/UI";
import type { Trip } from "@pepo/types/model";
import type { Landmark, NavigationPlan } from "./types";
import { profileFor } from "./profiles";
import { useVoicePreferences } from "./preferences";
import { NavigationEngine } from "./engine";
import { InstructionSpeaker } from "./playback";
import { deviceSpeechPort } from "./nativeOutput";
import { understandSpeech } from "./speechIntent";
import { formatInstruction } from "./instructions";
export function TripNavigation({
  trip,
  spokenCommand,
  onSettings,
}: {
  trip: Trip;
  spokenCommand?: { text: string; id: number };
  onSettings: () => void;
}) {
  const app = useApp(),
    location = useLocation(),
    { preferences, save, ready } = useVoicePreferences(),
    profile = profileFor(preferences.profile);
  const [plan, setPlan] = useState<NavigationPlan | null>(null),
    [landmarks, setLandmarks] = useState<Landmark[]>([]),
    [night, setNight] = useState(false),
    [message, setMessage] = useState(""),
    [line, setLine] = useState(""),
    [running, setRunning] = useState(false);
  const generation = useRef(0),
    request = useRef<AbortController | null>(null),
    engine = useRef<NavigationEngine | null>(null),
    speaker = useRef<InstructionSpeaker | null>(null),
    active = useRef(true);
  const snapshot = useRef({
    preferences,
    profile,
    fix: location.fix,
    stale: location.stale,
  });
  snapshot.current = {
    preferences,
    profile,
    fix: location.fix,
    stale: location.stale,
  };
  if (!speaker.current)
    speaker.current = new InstructionSpeaker(deviceSpeechPort, () =>
      setMessage(
        "Voix indisponible. Utilise les instructions visuelles ou Google Maps.",
      ),
    );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (s) => {
      active.current = s === "active";
      if (!active.current) {
        request.current?.abort();
        generation.current++;
        void speaker.current!.stop();
        setMessage("Guidage en pause hors de Pepo.");
      }
    });
    return () => {
      active.current = false;
      generation.current++;
      request.current?.abort();
      subscription.remove();
      void speaker.current!.stop();
    };
  }, []);
  useEffect(() => {
    generation.current++;
    request.current?.abort();
    setPlan(null);
    setLine("");
    setRunning(false);
    engine.current = null;
    void speaker.current!.stop();
  }, [trip.id, trip.status, trip.route.navigationVersion]);
  useEffect(() => {
    void speaker.current!.stop();
    if (!plan) return;
    engine.current = new NavigationEngine(
      plan,
      { city: trip.pickup.city, vehicle: trip.vehicle, night },
      landmarks,
    );
    void speaker.current!.configure(plan.id, profile);
    setLine("");
  }, [plan, profile.id, preferences.voiceId, landmarks, night]);
  useEffect(() => {
    if (!spokenCommand) return;
    const command = understandSpeech(
      spokenCommand.text,
      profile.language,
      false,
    );
    if (command.kind === "repeat")
      void speaker.current!.repeat(preferences.voiceId);
    else if (command.kind === "mute") save({ enabled: false });
    else if (command.kind === "unmute" && profile.navigation === "ready")
      save({ enabled: true });
  }, [spokenCommand?.id]);
  useEffect(() => {
    if (!preferences.enabled) void speaker.current!.stop();
  }, [preferences.enabled]);
  useEffect(() => {
    if (!plan || !running) return;
    const tick = () => {
      const state = snapshot.current;
      if (!active.current) return;
      if (!state.fix || state.stale) {
        void speaker.current!.stop();
        setMessage("GPS ancien ou absent : annonces suspendues.");
        return;
      }
      const decision = engine.current?.evaluate(state.fix);
      if (!decision) return;
      if (decision.state !== "ready" && decision.state !== "finished") {
        void speaker.current!.stop();
        setMessage(
          decision.state === "off_route"
            ? "Écart à l’itinéraire : guidage suspendu. Utilise Google Maps pour recalculer."
            : "GPS imprécis ou position ambiguë : annonces suspendues.",
        );
        return;
      }
      setMessage(decision.state === "finished" ? "Fin du guidage." : "");
      if (decision.instruction) {
        const formatted = formatInstruction(
          decision.instruction,
          state.profile,
        );
        setLine(formatted?.text || "Annonce indisponible dans cette langue.");
        if (state.preferences.enabled) {
          void speaker
            .current!.speak(decision.instruction, state.preferences.voiceId)
            .then((result) => {
              if (result === "unavailable")
                setMessage("Aucune voix disponible pour cette langue.");
            });
        }
      }
    };
    tick();
    const timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, [plan, running]);
  const start = async () => {
    if (!ready) return;
    if (app.demo) {
      setMessage(
        "Le guidage réel exige une course connectée ; utilise le Lab pour simuler.",
      );
      return;
    }
    if (!active.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const token = ++generation.current;
    setMessage("Préparation du guidage…");
    try {
      const fix = await location.enable();
      if (token !== generation.current || !active.current) return;
      if (
        fix.accuracy === null ||
        fix.accuracy > 35 ||
        Date.now() - fix.timestamp > 15000
      )
        throw new Error(
          "Le guidage exige un GPS récent et une précision de 35 m ou meilleure.",
        );
      const value = await api<{
        plan: NavigationPlan;
        landmarks: Landmark[];
        night: boolean;
      }>(`/trips/${encodeURIComponent(trip.id)}/voice-navigation`, {
        method: "POST",
        body: {
          latitude: fix.latitude,
          longitude: fix.longitude,
          accuracy: fix.accuracy,
          timestamp: fix.timestamp,
        },
        signal: controller.signal,
      });
      if (token !== generation.current || !active.current) return;
      setLandmarks(value.landmarks);
      setNight(value.night);
      setPlan(value.plan);
      setRunning(true);
      setMessage("");
    } catch (e) {
      if (token === generation.current) setMessage((e as Error).message);
    }
  };
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 18,
        backgroundColor: "#F7F7F0",
      }}
    >
      <Txt variant="h3">Guidage Pepo · {profile.label}</Txt>
      <Button
        title={running ? "Recharger le guidage" : "Démarrer le guidage Pepo"}
        kind="secondary"
        onPress={start}
      />
      {line ? <Txt>{line}</Txt> : null}
      {message ? <Txt>{message}</Txt> : null}
      {running ? (
        <>
          <Button
            title="Répéter"
            kind="secondary"
            onPress={() => speaker.current!.repeat(preferences.voiceId)}
          />
          <Button
            disabled={profile.navigation !== "ready"}
            title={preferences.enabled ? "Couper la voix" : "Activer la voix"}
            kind="secondary"
            onPress={() => save({ enabled: !preferences.enabled })}
          />
          <Button
            title="Arrêter le guidage"
            kind="secondary"
            onPress={() => {
              generation.current++;
              request.current?.abort();
              setRunning(false);
              void speaker.current!.stop();
              setLine("");
            }}
          />
        </>
      ) : null}
      <Button title="Langue et voix" kind="secondary" onPress={onSettings} />
      <Txt variant="small">
        Au premier plan uniquement. Aucun recalcul hors ligne. Google Maps reste
        disponible.
      </Txt>
    </View>
  );
}
