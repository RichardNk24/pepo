import type { VehicleKind } from "@pepo/types/model";
import Svg,{ Image as SvgImage } from "react-native-svg";
import { VEHICLE_METRICS } from "./vehicleMetrics";
export function MapVehicle({
  kind = "moto",
  width,
}: {
  kind?: VehicleKind;
  width?: number;
}) {
  const taxi = [
    "taxi",
    "suv",
    "fourByFour",
    "minibus",
    "tricycle",
    "truck",
    "pickupTruck",
  ].includes(kind);
  const metrics = VEHICLE_METRICS[taxi ? "taxi" : "moto"];
  const displayWidth =
    width ?? (metrics.displayHeight * metrics.cropWidth) / metrics.cropHeight;
  const source = taxi
    ? require("../assets/vehicles/car-top.png")
    : require("../assets/vehicles/moto-top.png");
  return (
    <Svg
      width={displayWidth}
      height={(displayWidth * metrics.cropHeight) / metrics.cropWidth}
      viewBox={`${metrics.x} ${metrics.y} ${metrics.cropWidth} ${metrics.cropHeight}`}
      style={{ overflow: "hidden" }}
      accessibilityLabel={taxi ? "Taxi vu du ciel" : "Moto vue du ciel"}
    >
      <SvgImage
        href={source}
        x={0}
        y={0}
        width={metrics.width}
        height={metrics.height}
      />
    </Svg>
  );
}
