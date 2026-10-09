import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { api, API_URL, getToken, LIVE } from "@pepo/api-client/api";
import { useApp } from "@pepo/session/AppProvider";
import * as FileSystem from "expo-file-system/legacy";
import { Button, Field, Header, Screen, Txt, Tag } from "@pepo/ui/UI";
import {
  CORPUS_CITIES,
  CORPUS_PROMPTS,
  type CorpusCity,
  type CorpusSample,
} from "./corpus";
import { DestinationSpeechButton } from "./DestinationSpeechButton";
import { uploadVoice } from "./voiceUpload";
import { CorpusAudio, stopCorpusPlayback } from "./CorpusAudio";
import { evaluateVoiceSamples } from "./evaluation";
export function VoiceCorpus() {
  return __DEV__ ? (
    <CorpusWorkshop />
  ) : (
    <Screen>
      <Header back title="Voix" />
      <Txt>Atelier réservé au développement.</Txt>
    </Screen>
  );
}
function CorpusWorkshop() {
  const app = useApp();
  const [city, setCity] = useState<CorpusCity>("lubumbashi"),
    [prompt, setPrompt] = useState(0),
    [samples, setSamples] = useState<CorpusSample[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState(""),
    [remove, setRemove] = useState(false),
    [feedback, setFeedback] = useState({ level: 0, seconds: 0, message: "" });
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const refresh = async () => {
    const v = await api<{ samples: CorpusSample[] }>("/voice/corpus");
    if (alive.current) setSamples(v.samples);
  };
  useEffect(() => {
    if (LIVE && !app.demo)
      void refresh().catch(() =>
        setMessage("Connecte-toi à Pepo et démarre l’API."),
      );
  }, [app.demo]);
  const chosen = samples.find((v) => v.id === selected),
    task = CORPUS_PROMPTS[prompt];
  const run = async (fn: () => Promise<void>) => {
    setWorking(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      if (alive.current) setMessage((e as Error).message);
    } finally {
      if (alive.current) setWorking(false);
    }
  };
  const tested = samples.filter(
    (v) => v.reviewed && v.test?.revision === v.revision,
  );
  const metrics = evaluateVoiceSamples(
    tested.map((v) => ({
      profile: v.profile,
      expectedText: v.expectedText,
      transcript: v.test!.transcript,
      latencyMs: v.test!.latencyMs,
    })),
  )[0];
  return (
    <Screen>
      <Header back title="Atelier · Swahili du Katanga" />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
      >
        <Tag tone="yellow">Corpus privé · aucune réservation</Tag>
        <Txt>
          Parle dans ton swahili habituel. Enregistrer sauvegarde cet exemple
          pour ton atelier Pepo. Aucun appel OpenAI pendant la collecte.
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CORPUS_CITIES.map((v) => (
            <Button
              key={v}
              title={v}
              kind={v === city ? "yellow" : "secondary"}
              disabled={busy || working}
              onPress={() => setCity(v)}
            />
          ))}
        </View>
        <Txt variant="h3">
          Exemple {prompt + 1}/{CORPUS_PROMPTS.length} · {task.kind}
        </Txt>
        <Txt>{task.text}</Txt>
        <Button
          title="Consigne suivante"
          kind="secondary"
          disabled={busy || working}
          onPress={() => setPrompt((prompt + 1) % CORPUS_PROMPTS.length)}
        />
        {!working ? (
          <DestinationSpeechButton
            recordingTarget={{
              key: city + "-" + prompt,
              prepare: async () => {
                await stopCorpusPlayback();
                await api("/voice/corpus/status");
              },
              upload: async (uri, signal) => {
                const taskUpload = FileSystem.createUploadTask(
                  API_URL + "/api/voice/corpus",
                  uri,
                  {
                    httpMethod: "POST",
                    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                    sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
                    fieldName: "audio",
                    mimeType: "audio/mp4",
                    headers: { Authorization: "Bearer " + getToken() },
                    parameters: {
                      city,
                      kind: task.kind,
                      profile: "sw-CD-katanga",
                      prompt: task.text,
                      consent: "true",
                    },
                  },
                );
                return uploadVoice(taskUpload, signal);
              },
            }}
            onBusyChange={setBusy}
            onFeedback={setFeedback}
            onResult={(id) => {
              setSelected(id);
              setText("");
              setRemove(false);
              void refresh().catch(() =>
                setMessage("Recharge l’atelier pour retrouver ton exemple."),
              );
              setMessage(
                "Enregistré. Réécoute puis écris exactement les mots prononcés.",
              );
            }}
          />
        ) : null}
        {busy ? (
          <>
            <View
              style={{ height: 8, backgroundColor: "#EEE", borderRadius: 4 }}
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
            <Txt>{feedback.seconds}s · capture / sauvegarde</Txt>
          </>
        ) : null}
        {feedback.message ? <Txt>{feedback.message}</Txt> : null}
        {message ? <Txt>{message}</Txt> : null}
        {chosen ? (
          <>
            <Txt variant="h3">Écouter et vérifier</Txt>
            <Txt>
              {chosen.city} · {chosen.seconds.toFixed(1)} s · {chosen.kind}
            </Txt>
            <Txt>{chosen.prompt}</Txt>
            <CorpusAudio
              key={chosen.id}
              id={chosen.id}
              disabled={busy || working}
            />
            <Field
              value={text}
              onChangeText={setText}
              placeholder="Texte swahili exact entendu"
              multiline
              editable={!busy && !working}
            />
            <Button
              title="Valider le texte exact"
              disabled={busy || working || !text.trim()}
              onPress={() =>
                void run(async () => {
                  const v = await api<CorpusSample>(
                    "/voice/corpus/" + chosen.id,
                    {
                      method: "PATCH",
                      body: {
                        expectedText: text,
                        reviewed: true,
                        revision: chosen.revision,
                      },
                    },
                  );
                  await refresh();
                  setText(v.expectedText);
                  setMessage(
                    "Texte vérifié par toi. Aucun modèle entraîné ni guidage publié.",
                  );
                })
              }
            />
            <Button
              title="Tester la reconnaissance · 1 appel OpenAI"
              kind="secondary"
              disabled={
                busy ||
                working ||
                !chosen.reviewed ||
                text !== chosen.expectedText
              }
              onPress={() =>
                void run(async () => {
                  await api("/voice/corpus/" + chosen.id + "/test", {
                    method: "POST",
                    timeoutMs: 30000,
                  });
                  await refresh();
                })
              }
            />
            {chosen.test ? (
              <>
                <Txt>Reconnu : {chosen.test.transcript}</Txt>
                <Txt>Référence : {chosen.expectedText}</Txt>
                <Txt>
                  {chosen.test.latencyMs} ms · {chosen.test.model}
                </Txt>
              </>
            ) : null}
            <Button
              title={
                remove
                  ? "Confirmer la suppression de cet exemple"
                  : "Supprimer cet exemple"
              }
              kind="secondary"
              disabled={busy || working}
              onPress={() => {
                if (!remove) {
                  setRemove(true);
                  return;
                }
                void run(async () => {
                  await api("/voice/corpus/" + chosen.id, { method: "DELETE" });
                  setSelected(null);
                  setText("");
                  setRemove(false);
                  await refresh();
                });
              }}
            />
          </>
        ) : null}
        <Txt variant="h3">Mes exemples · {samples.length}/200</Txt>
        <Txt>
          {tested.length} tests vérifiés
          {metrics
            ? ` · WER ${(metrics.wer * 100).toFixed(1)}% · latence P50 ${metrics.latencyP50Ms} ms`
            : ""}
        </Txt>
        <Txt variant="small">
          WER : erreurs de mots comparées à ton texte. Ces mesures concernent
          tes exemples ; elles ne prouvent pas la qualité pour tous les
          locuteurs.
        </Txt>
        {samples.map((v) => (
          <Button
            key={v.id}
            title={`${v.city} · ${v.expectedText || v.prompt} ${v.reviewed ? "✓" : ""}`}
            kind={selected === v.id ? "yellow" : "secondary"}
            disabled={busy || working}
            onPress={() => {
              setSelected(v.id);
              setText(v.expectedText);
              setRemove(false);
            }}
          />
        ))}
        <Button
          title="Actualiser"
          kind="secondary"
          disabled={busy || working}
          onPress={() => void run(refresh)}
        />
        <Txt variant="small">
          Likasi et Kasumbalesa classent les enregistrements : cela n’active pas
          de nouvelles villes de course. Les phrases de navigation attendent une
          revue séparée avant diffusion.
        </Txt>
      </ScrollView>
    </Screen>
  );
}
