import { useEffect, useRef, useState } from "react";
import { ScrollView, View, Platform } from "react-native";
import { useApp } from "@pepo/session/AppProvider";
import { api, LIVE } from "@pepo/api-client/api";
import { resolveMapRequest } from "@pepo/api-client/maps";
import type { Place } from "@pepo/types/model";
import { Button, Header, Screen, Txt, Field, Tag } from "@pepo/ui/UI";
import { useVoicePreferences } from "./preferences";
import { profileFor } from "./profiles";
import { DestinationSpeechButton } from "./DestinationSpeechButton";
import { NavigationEngine } from "./engine";
import { navigationFixture } from "./fixtures";
import { formatInstruction } from "./instructions";
import { InstructionSpeaker } from "./playback";
import { deviceSpeechPort } from "./nativeOutput";
import { understandSpeech } from "./speechIntent";
import { verifiedParcel } from "./landmarks";
import type { StructuredInstruction } from "./types";
import type { CapturePhase } from "./voiceCapture";
const scenarios = [
  "A · Virage classique",
  "B · Avenue",
  "C · Repère vérifié",
  "D · Entrée véhicules",
  "E · Parcelles vérifiées",
  "F · GPS imprécis",
  "G · Changement de route",
];
export function VoiceLab() {
  return __DEV__ ? (
    <VoiceLabContent />
  ) : (
    <Screen>
      <Header back title="Voix" />
      <Txt>Laboratoire disponible dans une session de développement.</Txt>
    </Screen>
  );
}
function VoiceLabContent() {
  const app = useApp(),
    { preferences } = useVoicePreferences(),
    profile = profileFor(preferences.profile);
  const [text, setText] = useState(""),
    [places, setPlaces] = useState<Place[]>([]),
    [selected, setSelected] = useState<Place | null>(null),
    [searchState, setSearchState] = useState(""),
    [capability, setCapability] = useState(""),
    [result, setResult] = useState(""),
    [audio, setAudio] = useState(""),
    [feedback, setFeedback] = useState({
      phase: "idle" as CapturePhase,
      level: 0,
      seconds: 0,
      message: "",
    }),
    [busy, setBusy] = useState(false),
    [offline, setOffline] = useState(false),
    [instruction, setInstruction] = useState<StructuredInstruction>(),
    [elapsed, setElapsed] = useState(0);
  const started = useRef(0),
    speaker = useRef<InstructionSpeaker | null>(null);
  if (!speaker.current)
    speaker.current = new InstructionSpeaker(deviceSpeechPort, () =>
      setAudio("Lecture impossible."),
    );
  useEffect(() => {
    void speaker.current!.stop();
    setAudio("");
    setInstruction(undefined);
  }, [profile.id]);
  useEffect(
    () => () => {
      void speaker.current!.stop();
    },
    [],
  );
  useEffect(() => {
    let active = true;
    if (offline) {
      setCapability("Simulation hors ligne : aucune requête au serveur.");
      return;
    }
    if (!LIVE || app.demo) {
      setCapability(
        "Transcription serveur : connexion à un compte réel nécessaire.",
      );
      return;
    }
    void api<{
      enabled: boolean;
      profiles: { id: string; transcriptionEnabled: boolean; speech: string }[];
    }>("/voice/capabilities")
      .then((v) => {
        if (active) {
          const p = v.profiles.find((p) => p.id === profile.id);
          setCapability(
            p?.transcriptionEnabled
              ? `Transcription activée · qualité ${p.speech} · aucune mesure terrain disponible`
              : "Transcription indisponible pour ce profil ou serveur non configuré.",
          );
        }
      })
      .catch((e) => {
        if (active) setCapability((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [profile.id, app.demo, offline]);
  useEffect(() => {
    setSelected(null);
    setPlaces([]);
    if (text.trim().length < 2 || busy || offline) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      const intent = understandSpeech(text, profile.language);
      if (intent.kind !== "destination") {
        setSearchState(
          `Intention : ${intent.kind} · aucune action de course exécutée`,
        );
        return;
      }
      const began = Date.now();
      setSearchState(
        intent.spatial
          ? "Description relative : confirmer un point exact, aucune coordonnée déduite."
          : "Recherche…",
      );
      void (
        LIVE && !app.demo
          ? resolveMapRequest(
              intent.query,
              app.settings.city,
              profile.language,
              false,
              controller.signal,
            ).then((v) => v.places)
          : app.search(intent.query)
      )
        .then((v) => {
          if (active) {
            setPlaces(v);
            setSearchState(
              v.length
                ? "Choisis explicitement le bon établissement / la bonne branche."
                : "Aucun lieu confirmé. Essaie le nom du lieu.",
            );
            setElapsed(Date.now() - began);
          }
        })
        .catch((e) => {
          if (active) setSearchState((e as Error).message);
        });
    }, 650);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, profile.id, busy, offline, app.settings.city]);
  const simulate = (scenario: string) => {
    void speaker.current!.stop();
    setAudio("");
    setInstruction(undefined);
    const now = Date.now(),
      f = navigationFixture(scenario, now);
    const engine = new NavigationEngine(
      f.plan,
      { city: "fixture", vehicle: "taxi", night: false },
      f.landmarks,
    );
    const decision = engine.evaluate(f.fix, now);
    if (scenario === "D") {
      setResult(
        `Entrée vérifiée : ${f.entrance.name}. Centre du bâtiment distinct ; aucune entrée réelle inventée.`,
      );
      return;
    }
    if (scenario === "E") {
      const parcel = verifiedParcel(
        f.anchor,
        f.parcels,
        3,
        "fixture-street",
        90,
        now,
      );
      setResult(
        parcel
          ? `Séquence fictive vérifiée : ${parcel.name}. Sans séquence validée : aucune indication par parcelle.`
          : "Parcelle non vérifiable.",
      );
      return;
    }
    if (scenario === "G") {
      setResult(
        "Ancienne annonce invalidée : arrêt du lecteur et remplacement du moteur. Nouvelle route requise.",
      );
      return;
    }
    const formatted = decision.instruction
      ? formatInstruction(decision.instruction, profile, true)
      : null;
    setInstruction(decision.instruction);
    setResult(
      formatted
        ? `${formatted.text}${formatted.approved ? "" : " · BROUILLON linguistique"}`
        : `État : ${decision.state} · aucune direction annoncée`,
    );
  };
  return (
    <Screen>
      <Header back title="Pepo Voice Intelligence Lab" />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}
      >
        <Tag tone="yellow">
          Laboratoire · simulations séparées des trajets réels
        </Tag>
        <Txt variant="h3">{profile.label}</Txt>
        <Txt>{capability}</Txt>
        <Field
          value={text}
          onChangeText={setText}
          placeholder="Dis ou écris ta destination"
          editable={!busy}
        />
        {!offline ? (
          <DestinationSpeechButton
            onResult={setText}
            onBusyChange={(value) => {
              setBusy(value);
              if (value) started.current = Date.now();
              else if (started.current)
                setElapsed(Date.now() - started.current);
            }}
            onFeedback={setFeedback}
          />
        ) : (
          <Txt>Capture serveur suspendue pendant la simulation hors ligne.</Txt>
        )}
        {busy ? (
          <View style={{ gap: 8 }}>
            <View
              style={{ height: 8, borderRadius: 4, backgroundColor: "#EDEFEA" }}
            >
              <View
                style={{
                  height: 8,
                  width: `${Math.round(feedback.level * 100)}%`,
                  backgroundColor: "#F5D54C",
                  borderRadius: 4,
                }}
              />
            </View>
            <Txt>
              {feedback.phase} · {feedback.seconds}s
            </Txt>
          </View>
        ) : null}
        {feedback.message ? <Txt>{feedback.message}</Txt> : null}
        <Txt variant="small">
          La transcription serveur apparaît après la fin de la phrase ; ce
          chemin ne diffuse pas de texte en direct.
        </Txt>
        <Txt>{searchState}</Txt>
        {places.slice(0, 8).map((p) => (
          <Button
            key={p.id}
            title={`${p.name} — ${p.address}`}
            kind={selected?.id === p.id ? "yellow" : "secondary"}
            onPress={() => setSelected(p)}
          />
        ))}
        {selected ? (
          <Txt>
            Lieu confirmé : {selected.name} · {selected.latitude.toFixed(5)},{" "}
            {selected.longitude.toFixed(5)}. Aucun trajet réservé
            automatiquement.
          </Txt>
        ) : null}
        <Txt variant="small">
          Dernière opération : {elapsed} ms · navigation ordinaire : 0 appel LLM
        </Txt>
        <Button
          title={offline ? "Revenir en ligne" : "Simuler sans réseau"}
          kind="secondary"
          onPress={() => {
            setOffline(!offline);
            setSearchState("");
          }}
        />
        <Txt variant="small">
          {offline
            ? "Simulation sans requête réseau. Aucun recalcul hors ligne. La voix système peut encore dépendre de son fournisseur."
            : "Les scénarios ci-dessous utilisent une géométrie fictive, aucun appel Google."}
        </Txt>
        {scenarios.map((s) => (
          <Button
            key={s}
            title={s}
            kind="secondary"
            onPress={() => simulate(s[0])}
          />
        ))}
        <Txt>{result}</Txt>
        <Button
          title="Écouter cette simulation"
          disabled={!instruction}
          onPress={async () => {
            if (!instruction) return;
            await speaker.current!.configure(instruction.routeId, profile);
            setAudio(
              await speaker.current!.speak(
                instruction,
                preferences.voiceId,
                true,
              ),
            );
          }}
        />
        <Button
          title="Arrêter la voix"
          kind="secondary"
          onPress={() => speaker.current!.stop()}
        />
        <Txt>{audio}</Txt>
        <Txt variant="small">
          SW/LN : aperçus non validés par des locuteurs natifs. Tshiluba,
          kikongo et kituba : aucune formulation ou voix fictive.
        </Txt>
      </ScrollView>
    </Screen>
  );
}
