import { C } from "@pepo/config/tokens";
import { formatDate } from "@pepo/i18n/locale";
import { useApp } from "@pepo/session/AppProvider";
import { Header, Screen, Tag, Txt, s } from "@pepo/ui/UI";
import { fare } from "@pepo/utils/rules";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
export default function Earnings() {
  const app = useApp(),
    router = useRouter();
  const completed = app.trips.filter(
      (t) => t.status === "completed" && t.driverId === app.profile?.id,
    ),
    total = completed.reduce((n, t) => n + (t.agreedPrice || 0), 0);
  return (
    <Screen>
      <Header title={app.t("earnings")} eyebrow="Pepo Driver" />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View style={[s.card, { backgroundColor: C.yellowSoft, gap: 8 }]}>
          <Txt>{app.t("grossEarnings")}</Txt>
          <Txt variant="h1">{fare(total)}</Txt>
          <Txt color={C.muted}>
            {completed.length} · {app.t("completed")}
          </Txt>
          <Txt variant="small">{app.t("commissionPending")}</Txt>
        </View>
        {app.trips.length ? (
          app.trips.map((t) => (
            <Pressable
              key={t.id}
              style={[s.card, { gap: 6 }]}
              onPress={() =>
                router.push({ pathname: "/ride", params: { id: t.id } })
              }
            >
              <Txt variant="label">
                {t.pickup.name} → {t.destination.name}
              </Txt>
              <Txt color={C.muted}>
                {formatDate(t.createdAt, app.settings.language, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </Txt>
              <View style={s.rowBetween}>
                <Tag>
                  {app.t(
                    t.status === "completed"
                      ? "completed"
                      : t.status === "cancelled"
                        ? "cancelled"
                        : "active",
                  )}
                </Tag>
                <Txt>{fare(t.agreedPrice || t.proposedPrice)}</Txt>
              </View>
            </Pressable>
          ))
        ) : (
          <Txt>{app.t("noTrips")}</Txt>
        )}
      </ScrollView>
    </Screen>
  );
}
