import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import { Button, Header, s, Screen, Tag, Txt, useUI } from "@pepo/ui/UI";
import { VoiceButton } from "@pepo/voice/VoiceButton";
import { parseVoice } from "@pepo/voice/commands";
import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { IncomingRideRequest } from "../../src/components/IncomingRideRequest";
export default function DriverHome() {
  const app = useApp(),
    location = useLocation(),
    router = useRouter(),
    ui = useUI();
  const [busy, setBusy] = useState(false);
  const ready = app.demo || app.profile?.verification === "verified";
  return (
    <Screen>
      <Header title={app.t("driverHome")} eyebrow="Pepo Driver" />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1, gap: 5 }}>
            <Txt variant="h3">{app.profile?.name}</Txt>
            <Tag tone={app.profile?.online ? "green" : "neutral"}>
              {app.t(app.profile?.online ? "online" : "offline")}
            </Tag>
          </View>
          <Switch
            disabled={busy || !ready}
            accessibilityLabel={app.t("driverAvailability")}
            value={!!app.profile?.online}
            onValueChange={async (v) => {
              setBusy(true);
              try {
                if (v && !app.demo) await location.enable();
                await app.setOnline(v);
              } catch (e) {
                ui.alert("Pepo", (e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            trackColor={{ false: C.line, true: C.yellow }}
          />
        </View>
        {app.demo ? <Tag tone="yellow">{app.t("demoOnly")}</Tag> : null}
        {!ready ? (
          <View style={[s.card, { gap: 12 }]}>
            <Txt>{app.t("driverDocumentsHint")}</Txt>
            <Button
              title={app.t("documents")}
              onPress={() => router.push("/documents")}
            />
          </View>
        ) : null}
        <VoiceButton
          onResult={(text) => {
            const i = parseVoice(text, app.settings.language, false);
            if (i.kind !== "command")
              return ui.alert(app.t("voice"), app.t("voiceNotUnderstood"));
            if (i.action === "account") router.push("/account");
            else if (i.action === "activity") router.push("/activity");
            else if (i.action === "help") router.push("/help");
            else if (app.activeTrip)
              router.push({
                pathname: "/ride",
                params: { id: app.activeTrip.id },
              });
            else ui.alert(app.t("voice"), app.t("statusUnavailable"));
          }}
        />
        {app.connectionError ? (
          <Button
            kind="secondary"
            title={app.t("reconnect")}
            onPress={() => app.refresh()}
          />
        ) : null}
        {app.activeTrip ? (
          <Button
            title={app.t("onTrip")}
            icon={ArrowRight}
            onPress={() =>
              router.push({
                pathname: "/ride",
                params: { id: app.activeTrip!.id },
              })
            }
          />
        ) : app.profile?.online ? (
          <>
            <Txt variant="h3">{app.t("requests")}</Txt>
            {app.requests.length ? (
              app.requests.map((t) => (
                <IncomingRideRequest key={t.id} trip={t} />
              ))
            ) : (
              <Txt color={C.muted}>{app.t("noRequests")}</Txt>
            )}
          </>
        ) : (
          <Txt color={C.muted}>{app.t("driverAvailability")}</Txt>
        )}
      </ScrollView>
    </Screen>
  );
}
