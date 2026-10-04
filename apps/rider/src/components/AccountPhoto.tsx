import { api } from "@pepo/api-client/api";
import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { Avatar, Button, Txt } from "@pepo/ui/UI";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
const demoPhotos = new Map<string, string>();
export function AccountPhoto({
  open,
  onPress,
}: {
  open?: boolean;
  onPress?: () => void;
}) {
  const app = useApp();
  const [uri, setUri] = useState<string>();
  const stamp = app.profile?.documents?.avatar?.submittedAt;
  useEffect(() => {
    let alive = true;
    setUri(
      app.demo && app.profile ? demoPhotos.get(app.profile.id) : undefined,
    );
    if (stamp && !app.demo)
      void api<{ dataUri: string }>("/me/avatar")
        .then((r) => {
          if (alive) setUri(r.dataUri);
        })
        .catch(() => {});
    return () => {
      alive = false;
    };
  }, [stamp, app.profile?.id, app.demo]);
  const upload = async (camera: boolean) => {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Autorisez les photos ou la caméra dans les réglages du téléphone.",
      );
    const options = {
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.8,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const image = await manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 512 } }],
      { compress: 0.75, format: SaveFormat.JPEG },
    );
    if (app.demo && app.profile) demoPhotos.set(app.profile.id, image.uri);
    await app.submitDocument("avatar", {
      uri: image.uri,
      fileName: "profil.jpg",
      mimeType: "image/jpeg",
    });
    setUri(image.uri);
  };
  return (
    <View style={{ alignItems: "center", gap: 12 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Modifier ma photo de profil"
        disabled={!onPress}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: 76, height: 76, borderRadius: 38 }}
          />
        ) : (
          <Avatar name={app.profile?.name || "Pepo"} size={76} />
        )}
        <View
          style={{
            position: "absolute",
            right: -3,
            bottom: -3,
            backgroundColor: C.ink,
            borderRadius: 20,
            padding: 7,
            borderWidth: 3,
            borderColor: C.paper,
          }}
        >
          <Camera color={C.paper} size={15} />
        </View>
      </Pressable>
      {open && (
        <>
          <Txt style={{ textAlign: "center" }}>
            Une photo nette aide le conducteur à vous reconnaître.
          </Txt>
          <Button
            title="Prendre une photo"
            icon={Camera}
            onPress={() => upload(true)}
          />
          <Button
            title="Choisir dans mes photos"
            kind="secondary"
            onPress={() => upload(false)}
          />
          <Txt variant="small" color={C.muted}>
            Ajouter une photo ne valide pas votre identité.
          </Txt>
        </>
      )}
    </View>
  );
}
