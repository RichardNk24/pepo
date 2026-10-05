import type { VehicleKind } from "@pepo/types/model";
import { Image, View } from "react-native";
import { C } from "@pepo/config/tokens";
import { VEHICLE_IMAGES } from "./vehicleCatalog.generated";
export function MapVehicle({
  kind = "moto",
  width,
}: {
  kind?: VehicleKind;
  width?: number;
}) {
  const activeKind =
    kind === "comfort" || kind === "fourByFour" ? undefined : kind;
  const legacySource =
    kind === "fourByFour" ? VEHICLE_IMAGES.suv : VEHICLE_IMAGES.moto;
  const source =
    (activeKind ? VEHICLE_IMAGES[activeKind] : undefined) ||
    legacySource ||
    require("../assets/vehicles/catalog/moto.png");
  const size = width ?? 34;
  return (
    <View
      accessibilityLabel={kind === "motoSend" ? "Moto avec colis" : kind}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={source}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
      {kind === "motoSend" && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 15,
            height: 15,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 5,
            borderWidth: 1,
            borderColor: C.ink,
            backgroundColor: C.yellow,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderWidth: 1,
              borderColor: C.ink,
              borderRadius: 1,
            }}
          >
            <View style={{ height: 1, marginTop: 2, backgroundColor: C.ink }} />
          </View>
        </View>
      )}
    </View>
  );
}
