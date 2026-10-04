import { C } from "@pepo/config/tokens";
import type { Place } from "@pepo/types/model";
import { Txt } from "@pepo/ui/UI";
import { StyleSheet, View } from "react-native";
export function RouteSummary({
  pickup,
  destination,
  stops = [],
}: {
  pickup: Place;
  destination: Place;
  stops?: Place[];
}) {
  return (
    <View style={{ gap: 14, paddingVertical: 4 }}>
      <View style={r.line} />
      {[pickup, ...stops, destination].map((p, i) => (
        <View key={i} style={r.row}>
          <View
            style={[
              r.dot,
              {
                backgroundColor: i === 0 ? C.ink : C.yellow,
                borderRadius: i === 0 ? 8 : 3,
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Txt variant="label" numberOfLines={1}>
              {p.name}
            </Txt>
            <Txt variant="small" color={C.muted} numberOfLines={1}>
              {p.address}
            </Txt>
          </View>
        </View>
      ))}
    </View>
  );
}
const r = StyleSheet.create({
  row: { flexDirection: "row", gap: 15, alignItems: "center" },
  dot: { width: 10, height: 10, marginLeft: 4 },
  line: {
    position: "absolute",
    width: 1,
    backgroundColor: C.line,
    top: 21,
    left: 8.5,
    bottom: 24,
  },
});
