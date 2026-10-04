import { C } from "@pepo/config/tokens";
import { formatDate } from "@pepo/i18n/locale";
import { useApp } from "@pepo/session/AppProvider";
import type { DocumentKind, VehicleKind } from "@pepo/types/model";
import { Button, Field, Header, s, Screen, Tag, Txt } from "@pepo/ui/UI";
import { VEHICLES } from "@pepo/utils/cities";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  CarFront,
  Check,
  FileBadge2,
  FileCheck2,
  Upload,
  UserRound,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
const kinds: {
  id: DocumentKind;
  title: string;
  detail: string;
  icon: typeof UserRound;
}[] = [
  {
    id: "identity",
    title: "Pièce d’identité",
    detail: "Document officiel lisible.",
    icon: FileBadge2,
  },
  {
    id: "license",
    title: "Permis de conduire",
    detail: "Nom et date de validité visibles.",
    icon: FileCheck2,
  },
  {
    id: "vehicle",
    title: "Véhicule et plaque",
    detail: "Photo nette du véhicule et de la plaque.",
    icon: CarFront,
  },
  {
    id: "selfie",
    title: "Votre visage",
    detail:
      "Prenez un selfie maintenant, sans filtre et visage découvert. Notre équipe le compare à votre pièce d’identité.",
    icon: UserRound,
  },
];
export default function Documents() {
  const app = useApp();
  const [model, setModel] = useState(app.profile?.driver?.model || ""),
    [plate, setPlate] = useState(app.profile?.driver?.plate || ""),
    [vehicle, setVehicle] = useState<VehicleKind>(
      app.profile?.driver?.vehicle || "moto",
    );
  const driver = app.profile?.role === "driver";
  const status = driver
    ? app.profile?.verification
    : app.profile?.identityVerification;
  const shownKinds = kinds.filter(
    (k) => driver || ["identity", "selfie"].includes(k.id),
  );
  useEffect(() => {
    if (app.profile) {
      setModel(app.profile.driver?.model || "");
      setPlate(app.profile.driver?.plate || "");
      setVehicle(app.profile.driver?.vehicle || "moto");
    }
  }, [app.profile?.id]);
  const upload = async (kind: DocumentKind, camera = false) => {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted")
      throw new Error(
        "Autorisez l’accès à la caméra ou aux photos dans les réglages.",
      );
    const result = camera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
    if (result.canceled) return;
    const image = await manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: SaveFormat.JPEG },
    );
    await app.submitDocument(kind, {
      uri: image.uri,
      fileName: kind + ".jpg",
      mimeType: "image/jpeg",
    });
  };
  return (
    <Screen>
      <Header
        title={driver ? "Votre dossier" : "Mon identité"}
        eyebrow={driver ? "CONDUCTEUR PEPO" : "DEUX ÉTAPES SIMPLES"}
        back
      />
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: 4,
          paddingBottom: 40,
        }}
      >
        <View
          style={[
            s.card,
            {
              backgroundColor:
                status === "verified" ? C.greenSoft : C.yellowSoft,
              gap: 10,
            },
          ]}
        >
          <Tag tone={status === "verified" ? "green" : "yellow"}>
            {status === "demo"
              ? "Profil démo"
              : status === "verified"
                ? "Dossier approuvé"
                : status === "rejected"
                  ? "À corriger"
                  : "Vérification manuelle"}
          </Tag>
          <Txt>
            {app.demo
              ? "En mode démo, utilisez uniquement des photos et documents fictifs."
              : "Vos documents restent privés. Notre équipe compare votre pièce d’identité et votre selfie. Ajouter une photo de profil ne suffit pas."}
          </Txt>
        </View>
        {driver && (
          <>
            <Txt variant="h3" style={{ marginTop: 25, marginBottom: 16 }}>
              Votre véhicule
            </Txt>
            <View style={{ gap: 13 }}>
              <Field
                label="Modèle"
                placeholder="Haojue HJ125"
                value={model}
                onChangeText={setModel}
                maxLength={80}
              />
              <Field
                label="Plaque d’immatriculation"
                placeholder="LSH 2841 AB"
                value={plate}
                onChangeText={setPlate}
                autoCapitalize="characters"
                maxLength={25}
              />
              <View style={[s.row, { flexWrap: "wrap" }]}>
                {VEHICLES.map(({ id: v, name }) => (
                  <Button
                    key={v}
                    style={{ minWidth: 90, paddingHorizontal: 12 }}
                    compact
                    title={name}
                    kind={vehicle === v ? "yellow" : "secondary"}
                    onPress={() => setVehicle(v)}
                  />
                ))}
              </View>
              <Button
                title="Enregistrer le véhicule"
                kind="secondary"
                disabled={model.trim().length < 2 || plate.trim().length < 4}
                onPress={() =>
                  app.updateProfile({
                    driver: {
                      vehicle,
                      model: model.trim(),
                      plate: plate.trim(),
                      helmet: ["moto", "comfort"].includes(vehicle),
                    },
                  })
                }
              />
            </View>
          </>
        )}
        <Txt variant="h3" style={{ marginTop: 26, marginBottom: 16 }}>
          {driver ? "Les quatre documents" : "Votre pièce et votre selfie"}
        </Txt>
        {shownKinds.map((k) => (
          <View key={k.id} style={[s.card, { marginBottom: 13, gap: 13 }]}>
            <View style={s.row}>
              <k.icon size={22} color={C.ink} />
              <View style={{ flex: 1 }}>
                <Txt variant="label">{k.title}</Txt>
                <Txt variant="small" color={C.muted}>
                  {k.detail}
                </Txt>
              </View>
              {app.profile?.documents?.[k.id] && (
                <Check size={22} color={C.green} />
              )}
            </View>
            {app.profile?.documents?.[k.id] && (
              <Txt variant="small" color={C.green}>
                Document reçu ·{" "}
                {formatDate(
                  app.profile.documents[k.id]!.submittedAt,
                  app.settings.language,
                )}
              </Txt>
            )}
            <View style={s.row}>
              {k.id !== "selfie" && (
                <Button
                  style={{ flex: 1 }}
                  compact
                  title="Importer"
                  kind="secondary"
                  icon={Upload}
                  onPress={() => upload(k.id)}
                />
              )}
              <Button
                style={{ flex: 1 }}
                compact
                title={k.id === "selfie" ? "Prendre mon selfie" : "Photo"}
                kind="secondary"
                icon={Camera}
                onPress={() => upload(k.id, true)}
              />
            </View>
          </View>
        ))}
        <Txt variant="small" color={C.muted}>
          L’équipe Pepo examine votre dossier avant de le valider. Si vous
          changez vos documents, un nouvel examen sera nécessaire.
        </Txt>
      </ScrollView>
    </Screen>
  );
}
