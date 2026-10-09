import { C } from "@pepo/config/tokens";
import { LANGUAGES } from "@pepo/i18n/locale";
import { useApp } from "@pepo/session/AppProvider";
import { Avatar, Button, Header, s, Screen, Txt, useUI } from "@pepo/ui/UI";
import { useVoice } from "@pepo/voice/useVoice";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
export default function DriverAccount() {
  const app = useApp(),
    router = useRouter(),
    ui = useUI(),
    voice = useVoice();
  return (
    <Screen>
      <Header title={app.t("account")} eyebrow="Pepo Driver" />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Button
          title="Voix et navigation"
          kind="secondary"
          onPress={() => router.push("/voice-settings")}
        />
        {__DEV__ ? (
          <Button
            title="Pepo Voice Intelligence Lab"
            kind="secondary"
            onPress={() => router.push("/voice-lab")}
          />
        ) : null}

        <View style={s.row}>
          <Avatar name={app.profile?.name || "Pepo"} />
          <View>
            <Txt variant="h3">{app.profile?.name}</Txt>
            <Txt>{app.profile?.phone}</Txt>
          </View>
        </View>
        <Button
          title={app.t("documents")}
          kind="secondary"
          onPress={() => router.push("/documents")}
        />
        <Button
          title={app.t("safety")}
          kind="secondary"
          onPress={() => router.push("/safety")}
        />
        <Txt variant="h3">{app.t("voiceSettings")}</Txt>
        <View style={{ gap: 8 }}>
          {LANGUAGES.map((l) => (
            <Button
              key={l.id}
              title={l.label}
              kind={app.settings.language === l.id ? "yellow" : "secondary"}
              onPress={() => app.setLanguage(l.id)}
            />
          ))}
        </View>
        <Button
          title={app.t("listen")}
          kind="secondary"
          onPress={() => voice.speak(app.t("driverDocumentsHint"))}
        />
        {voice.message ? <Txt color={C.muted}>{voice.message}</Txt> : null}
        <Txt variant="small" color={C.muted}>
          {app.t("voicePrivacy")}
        </Txt>
        <Button
          title={app.t("signOut")}
          kind="secondary"
          onPress={async () => {
            if (
              await ui.confirm(
                app.t("signOut"),
                "Vous retrouverez votre compte avec votre numéro de téléphone.",
              )
            ) {
              await app.signOut();
              router.replace("/onboarding");
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
