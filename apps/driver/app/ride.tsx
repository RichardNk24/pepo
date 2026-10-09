import { TripNavigation } from "@pepo/voice/TripNavigation";
import { C } from "@pepo/config/tokens";
import MapBoard from "@pepo/maps/MapBoard";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import {
  IconButton,
  Button,
  Field,
  Header,
  s,
  Tag,
  Txt,
  useUI,
} from "@pepo/ui/UI";
import { TripSafety } from "@pepo/ui/TripSafety";
import { ShieldCheck } from "lucide-react-native";
import { safetyText } from "@pepo/i18n/safety";
import { fare } from "@pepo/utils/rules";
import { parseVoice, type VoiceAction } from "@pepo/voice/commands";
import { navigationUrl } from "@pepo/voice/navigation";
import { useVoice } from "@pepo/voice/useVoice";
import { DestinationSpeechButton } from "@pepo/voice/DestinationSpeechButton";
import { useVoicePreferences } from "@pepo/voice/preferences";
import { profileFor } from "@pepo/voice/profiles";
import { understandSpeech } from "@pepo/voice/speechIntent";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RouteSummary } from "../src/components/RouteSummary";
export default function DriverRide() {
  const app = useApp(),
    location = useLocation(),
    ui = useUI(),
    router = useRouter(),
    insets = useSafeAreaInsets(),
    params = useLocalSearchParams<{ id: string }>();
  const [pin, setPin] = useState("");
  const { preferences } = useVoicePreferences();
  const [spokenCommand, setSpokenCommand] = useState<{
    text: string;
    id: number;
  }>();
  const [transcript, setTranscript] = useState("");
  const trip = app.trips.find((t) => t.id === params.id),
    voice = useVoice();
  if (!app.ready) return null;
  if (!app.profile) return <Redirect href="/onboarding" />;
  if (!trip) return <Redirect href="/(tabs)" />;
  const isPickup = trip.status === "accepted" || trip.status === "arrived";
  const navigate = () =>
    Linking.openURL(
      navigationUrl(
        isPickup ? trip.pickup : trip.destination,
        app.settings.language,
        location.stale ? undefined : location.fix || undefined,
        isPickup ? [] : trip.stops,
      ),
    );
  const finish = async () => {
    if (
      await ui.confirm(
        app.t("finish"),
        "Confirmez que vous avez atteint la destination avec le passager.",
      )
    )
      await app.transition(trip.id, "completed");
  };
  async function command(action: VoiceAction) {
    if (action === "back") return router.back();
    if (action === "home") return router.replace("/(tabs)");
    if (action === "account") return router.push("/account");
    if (action === "help") return router.push("/help");
    if (action === "arrive" && trip!.status === "accepted") {
      if (await ui.confirm(app.t("arrive"), app.t("voiceConfirm")))
        await app.transition(trip!.id, "arrived");
      return;
    }
    if (action === "finishTrip" && trip!.status === "in_progress")
      return finish();
    if (action === "startTrip" && trip!.status === "arrived") {
      ui.alert(app.t("enterPin"), app.t("pinDetail"));
      return;
    }
    if (
      action === "cancelTrip" &&
      ["accepted", "arrived"].includes(trip!.status)
    ) {
      if (await ui.confirm(app.t("cancel"), app.t("voiceConfirm"), true))
        await app.cancelTrip(trip!.id);
      return;
    }
    ui.alert(app.t("voice"), app.t("statusUnavailable"));
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={{ height: 270 }}>
        <MapBoard
          pickup={trip.pickup}
          destination={trip.destination}
          stops={trip.stops}
          route={trip.route}
          driver={trip.driverLocation}
          driverVehicleKind={trip.vehicle}
          userPosition={location.fix}
          routeLabels
          cameraTopInset={insets.top + 70}
          cameraBottomInset={50}
        />
        <View
          style={{ position: "absolute", top: insets.top, left: 0, right: 0 }}
        >
          <Header
            back
            right={
              ["accepted", "arrived", "in_progress"].includes(trip.status) ? (
                <IconButton
                  icon={ShieldCheck}
                  label={safetyText(app.settings.language, "help")}
                  onPress={() =>
                    router.push({
                      pathname: "/ride-safety",
                      params: { id: trip.id },
                    })
                  }
                />
              ) : undefined
            }
            title={app.t(
              trip.status === "completed"
                ? "completed"
                : trip.status === "cancelled"
                  ? "cancelled"
                  : isPickup
                    ? "pickup"
                    : "onTrip",
            )}
          />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingBottom: 24 + insets.bottom,
          gap: 14,
        }}
      >
        <Txt variant="h3">{trip.guest?.name || trip.riderName}</Txt>
        <RouteSummary
          pickup={trip.pickup}
          destination={trip.destination}
          stops={trip.stops}
        />
        <View style={s.rowBetween}>
          <Txt variant="h2">{fare(trip.agreedPrice || trip.proposedPrice)}</Txt>
          <Tag>{app.t("cash")}</Tag>
        </View>
        {["accepted", "arrived", "in_progress"].includes(trip.status) && (
          <TripSafety
            tripId={trip.id}
            demo={app.demo}
            driver
            onShare={() => app.shareTrip(trip.id)}
          />
        )}
        {app.demo ? <Tag tone="yellow">{app.t("demoOnly")}</Tag> : null}
        {isPickup || trip.status === "in_progress" ? (
          <>
            <Button
              title={app.t(isPickup ? "navigatePickup" : "navigateDropoff")}
              onPress={navigate}
            />
            <Txt variant="small" color={C.muted}>
              {app.t("navigationHelp")}
            </Txt>
          </>
        ) : null}
        {["accepted", "arrived", "in_progress"].includes(trip.status) ? (
          <TripNavigation
            trip={trip}
            spokenCommand={spokenCommand}
            onSettings={() => router.push("/voice-settings")}
          />
        ) : null}
        <Button
          title={app.t("voiceReadout")}
          kind="secondary"
          onPress={() =>
            voice.speak(
              `${app.t("departLabel")}: ${trip.pickup.name}. ${app.t("arriveLabel")}: ${trip.destination.name}. ${trip.route.durationMin} ${app.t("minutes")}.`,
            )
          }
        />
        {voice.message ? <Txt>{voice.message}</Txt> : null}
        {transcript ? <Txt>{transcript}</Txt> : null}
        <DestinationSpeechButton
          onResult={(text) => {
            setTranscript(text);
            const language = profileFor(preferences.profile).language;
            const nav = understandSpeech(text, language, false);
            if (["repeat", "mute", "unmute"].includes(nav.kind)) {
              setSpokenCommand({ text, id: Date.now() });
              return;
            }
            if (!["fr", "en", "sw", "ln"].includes(language)) {
              ui.alert(app.t("voice"), app.t("voiceNotUnderstood"));
              return;
            }
            const i = parseVoice(
              text,
              language as "fr" | "en" | "sw" | "ln",
              false,
            );
            if (i.kind === "command")
              void command(i.action).catch((e) =>
                ui.alert("Pepo", (e as Error).message),
              );
            else ui.alert(app.t("voice"), app.t("voiceNotUnderstood"));
          }}
        />
        {trip.status === "accepted" ? (
          <Button
            title={app.t("arrive")}
            onPress={() => app.transition(trip.id, "arrived")}
          />
        ) : null}
        {trip.status === "arrived" ? (
          <>
            <Field
              label={app.t("enterPin")}
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, ""))}
              keyboardType="number-pad"
              maxLength={4}
            />
            {app.demo ? <Txt>Passager démo · code 4826</Txt> : null}
            <Button
              title={app.t("start")}
              disabled={pin.length !== 4}
              onPress={() => app.transition(trip.id, "in_progress", pin)}
            />
          </>
        ) : null}
        {trip.status === "in_progress" ? (
          <Button title={app.t("finish")} onPress={finish} />
        ) : null}
        {["accepted", "arrived", "in_progress"].includes(trip.status) ? (
          <Button
            title={app.t("message")}
            kind="secondary"
            onPress={() =>
              router.push({ pathname: "/messages", params: { id: trip.id } })
            }
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
