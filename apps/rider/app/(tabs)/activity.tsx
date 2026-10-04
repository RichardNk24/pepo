import { C } from "@pepo/config/tokens";
import { formatDate } from "@pepo/i18n/locale";
import { VehicleArt } from "@pepo/maps/VehicleArt";
import { useApp } from "@pepo/session/AppProvider";
import { Button, Header, Screen, Tag, Txt, s } from "@pepo/ui/UI";
import { fare } from "@pepo/utils/rules";
import { scheduledLabel } from "@pepo/utils/scheduling";
import { useRouter } from "expo-router";
import { ArrowRight, ArrowUpRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { RouteSummary } from "../../src/components/RouteSummary";
export default function Activity() {
  const app = useApp(),
    router = useRouter();
  const [filter, setFilter] = useState<
    "all" | "scheduled" | "completed" | "cancelled"
  >("all");
  const trips = app.trips.filter(
    (t) => filter === "all" || t.status === filter,
  );
  const completed = app.trips.filter((t) => t.status === "completed");
  const money = completed.reduce((n, t) => n + (t.agreedPrice || 0), 0);
  return (
    <Screen>
      <Header
        title={app.t("history")}
        eyebrow="VOTRE VILLE. VOS HISTOIRES."
        right={
          <Tag tone="yellow">
            {app.demo ? "DÉMO" : app.testAuth ? "TEST LOCAL" : "PEPO"}
          </Tag>
        }
      />
      <ScrollView
        contentContainerStyle={{
          padding: 24,
          paddingTop: 8,
          paddingBottom: 35,
        }}
      >
        <View style={a.stats}>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="micro" color={C.muted}>
              TRAJETS TERMINÉS
            </Txt>
            <Txt variant="h1">
              {completed.length.toString().padStart(2, "0")}
            </Txt>
          </View>
          <View style={{ height: 50, width: 1, backgroundColor: "#DFE5D7" }} />
          <View style={{ flex: 1, gap: 4, paddingLeft: 15 }}>
            <Txt variant="micro" color={C.muted}>
              {app.profile?.role === "driver"
                ? "REVENUS CONVENUS"
                : "MONTANTS CONVENUS"}
            </Txt>
            <Txt variant="h2" style={{ fontSize: 22 }}>
              {fare(money)}
            </Txt>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginVertical: 22 }}
        >
          {(["all", "scheduled", "completed", "cancelled"] as const).map(
            (f) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: filter === f }}
                key={f}
                onPress={() => setFilter(f)}
                style={[
                  a.filter,
                  { backgroundColor: filter === f ? C.ink : C.background },
                ]}
              >
                <Txt variant="small" color={filter === f ? "#fff" : C.muted}>
                  {f === "all"
                    ? "Tous"
                    : f === "scheduled"
                      ? "Programmés"
                      : app.t(f)}
                </Txt>
              </Pressable>
            ),
          )}
        </ScrollView>
        {!trips.length ? (
          <View style={{ paddingVertical: 50, alignItems: "center", gap: 16 }}>
            <VehicleArt width={165} />
            <Txt variant="h2" style={{ textAlign: "center" }}>
              {app.t("noTrips")}
            </Txt>
            <Txt color={C.muted} style={{ textAlign: "center" }}>
              Les trajets de cette catégorie apparaîtront ici.
            </Txt>
            <Button
              title="Explorer la ville"
              icon={ArrowRight}
              onPress={() => router.replace("/(tabs)")}
            />
          </View>
        ) : (
          trips.map((t) => (
            <Pressable
              key={t.id}
              onPress={() =>
                router.push({ pathname: "/ride", params: { id: t.id } })
              }
              style={[s.card, { marginBottom: 15 }]}
            >
              <View style={s.rowBetween}>
                <View style={s.row}>
                  <VehicleArt kind={t.vehicle} width={54} />
                  <View>
                    <Txt variant="label">
                      {formatDate(
                        t.scheduledAt || t.createdAt,
                        app.settings.language,
                        {
                          day: "numeric",
                          month: "short",
                        },
                      )}
                    </Txt>
                    <Txt variant="small" color={C.muted}>
                      {formatDate(
                        t.scheduledAt || t.createdAt,
                        app.settings.language,
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </Txt>
                  </View>
                </View>
                <ArrowUpRight size={19} color={C.muted} />
              </View>
              <View style={{ marginVertical: 16 }}>
                <RouteSummary
                  pickup={t.pickup}
                  destination={t.destination}
                  stops={t.stops}
                />
              </View>
              {!!t.scheduledAt && (
                <Txt
                  variant="small"
                  color={C.muted}
                  style={{ marginBottom: 10 }}
                >
                  Départ prévu : {scheduledLabel(t.scheduledAt, t.pickup.city)}
                </Txt>
              )}
              {!!t.cancellationReason && (
                <Txt variant="small" color={C.red} style={{ marginBottom: 10 }}>
                  {t.cancellationReason}
                </Txt>
              )}
              <View style={s.rowBetween}>
                <Tag
                  tone={
                    t.status === "completed"
                      ? "green"
                      : t.status === "cancelled"
                        ? "neutral"
                        : "yellow"
                  }
                >
                  {t.status === "scheduled"
                    ? "Programmé"
                    : app.t(
                        t.status === "completed"
                          ? "completed"
                          : t.status === "cancelled"
                            ? "cancelled"
                            : "active",
                      )}
                </Tag>
                <Txt variant="h3">{fare(t.agreedPrice || t.proposedPrice)}</Txt>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
const a = StyleSheet.create({
  stats: {
    padding: 20,
    backgroundColor: C.greenSoft,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
  },
  filter: { paddingHorizontal: 17, paddingVertical: 10, borderRadius: 20 },
});
