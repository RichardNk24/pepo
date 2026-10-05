import type { ActiveVehicleKind } from "@pepo/types/model";

export function sheetGeometry(
  containerHeight: number,
  bottom: number,
  top: number,
) {
  const maximum = Math.max(
    0,
    containerHeight - Math.max(0, bottom) - Math.max(0, top),
  );
  const collapsed = Math.min(maximum, Math.max(100, containerHeight * 0.2));
  const middle = Math.min(maximum, Math.max(collapsed, containerHeight * 0.45));
  return { maximum, collapsed, snaps: [collapsed, middle, maximum] };
}

export type VehicleOptionsDensity = "expanded" | "compact" | "selected";

export function vehicleOptionsDensity(
  snapIndex: number,
): VehicleOptionsDensity {
  return snapIndex >= 2 ? "expanded" : snapIndex === 1 ? "compact" : "selected";
}

export function isVehicleVisible(
  id: ActiveVehicleKind,
  selected: ActiveVehicleKind,
  density: VehicleOptionsDensity,
): boolean {
  return density !== "selected" || id === selected;
}

export function shouldShowVehicleDetails(
  id: ActiveVehicleKind,
  selected: ActiveVehicleKind,
  density: VehicleOptionsDensity,
): boolean {
  return density === "expanded" || (density === "compact" && id === selected);
}
