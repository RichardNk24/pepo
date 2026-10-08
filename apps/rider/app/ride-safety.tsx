import { useApp } from "@pepo/session/AppProvider";
import { safetyText } from "@pepo/i18n/safety";
import { TripSafety } from "@pepo/ui/TripSafety";
import { Header, Screen, Txt } from "@pepo/ui/UI";
import { Redirect, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
export default function RideSafetyScreen() {
  const app = useApp(),
    params = useLocalSearchParams<{ id?: string }>();
  const trip = app.trips.find(
    (t) => t.id === (params.id || app.activeTrip?.id),
  );
  if (!app.ready) return null;
  if (!app.profile) return <Redirect href="/onboarding" />;
  return (
    <Screen>
      <Header back title={safetyText(app.settings.language, "day")} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {trip &&
        ["accepted", "arrived", "in_progress"].includes(trip.status) ? (
          <TripSafety
            tripId={trip.id}
            demo={app.demo}
            driver={app.profile.role === "driver"}
            onShare={() => app.shareTrip(trip.id)}
          />
        ) : (
          <Txt>{app.t("statusUnavailable")}</Txt>
        )}
      </ScrollView>
    </Screen>
  );
}
