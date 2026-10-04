import { C } from "@pepo/config/tokens";
import { useLocation } from "@pepo/session/LocationProvider";
import { Txt, useUI } from "@pepo/ui/UI";
import type { LocationFix } from "@pepo/utils/mapGeometry";
import { cardinalDirection } from "@pepo/utils/mapGeometry";
import { ArrowUp, LocateFixed } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
export function LocationControls({
  bottom = 20,
  onLocate,
  compass = false,
}: {
  compass?: boolean;
  bottom?: number;
  onLocate: (fix: LocationFix) => void;
}) {
  const location = useLocation(),
    ui = useUI(),
    [busy, setBusy] = useState(false);
  return (
    <View style={[l.controls, { bottom }]}>
      {compass && location.heading != null && (
        <View style={l.compass} pointerEvents="none">
          <Txt variant="micro" color={C.muted}>
            N
          </Txt>
          <ArrowUp
            size={22}
            color="#3478F6"
            style={{ transform: [{ rotate: `${location.heading}deg` }] }}
          />
          <Txt variant="small">{cardinalDirection(location.heading)}</Txt>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Revenir à ma position"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        style={l.locate}
        onPress={async () => {
          setBusy(true);
          try {
            const fix = await location.enable();
            onLocate(fix);
          } catch (e) {
            const settings =
              Platform.OS !== "web" &&
              (await ui.confirm(
                "Localisation",
                `${(e as Error).message}\n\nOuvrir les réglages ?`,
              ));
            if (settings) void Linking.openSettings();
            else if (Platform.OS === "web")
              ui.alert("Localisation", (e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <ActivityIndicator color={C.ink} />
        ) : (
          <LocateFixed size={21} color={C.ink} />
        )}
      </Pressable>
    </View>
  );
}
export function LocationStatus() {
  const { fix, status, stale, heading, headingReliable } = useLocation();
  const text =
    status === "searching"
      ? "Recherche de votre position…"
      : fix
        ? stale
          ? "Dernière position · signal à actualiser"
          : `GPS${fix.accuracy == null ? "" : ` · ± ${Math.max(1, Math.round(fix.accuracy))} m`}${heading != null && !headingReliable ? " · orientation à calibrer" : ""}`
        : status === "denied"
          ? "Localisation désactivée"
          : status === "disabled"
            ? "Activez le GPS du téléphone"
            : "Touchez Ma position pour vous situer";
  return (
    <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 7,
          backgroundColor: fix && !stale ? "#3478F6" : C.muted,
        }}
      />
      <Txt variant="small" color={C.muted}>
        {text}
      </Txt>
    </View>
  );
}
const l = StyleSheet.create({
  controls: {
    position: "absolute",
    right: 16,
    alignItems: "flex-end",
    gap: 10,
  },
  locate: {
    height: 44,
    width: 44,
    justifyContent: "center",
    backgroundColor: C.paper,
    borderRadius: 25,
    paddingHorizontal: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: C.ink,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  compass: {
    backgroundColor: C.paper,
    borderRadius: 18,
    padding: 10,
    minWidth: 61,
    alignItems: "center",
    gap: 2,
  },
});
