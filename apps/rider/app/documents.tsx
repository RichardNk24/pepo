import { C } from "@pepo/config/tokens";
import { formatDate } from "@pepo/i18n/locale";
import { useApp } from "@pepo/session/AppProvider";
import type { DocumentKind } from "@pepo/types/model";
import { Button, Header, s, Screen, Tag, Txt } from "@pepo/ui/UI";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  Check,
  FileBadge2,
  Upload,
  UserRound,
} from "lucide-react-native";
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
    id: "selfie",
    title: "Votre visage",
    detail:
      "Prenez un selfie maintenant, sans filtre et visage découvert. Notre équipe le compare à votre pièce d’identité.",
    icon: UserRound,
  },
];
export default function Documents() {
  const app = useApp();
  const status = app.profile?.identityVerification;
  const shownKinds = kinds;
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
      <Header title={"Mon identité"} eyebrow={"DEUX ÉTAPES SIMPLES"} back />
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
            {app.demo
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

        <Txt variant="h3" style={{ marginTop: 26, marginBottom: 16 }}>
          {"Votre pièce et votre selfie"}
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
