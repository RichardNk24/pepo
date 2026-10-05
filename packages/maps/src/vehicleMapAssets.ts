import type { VehicleKind } from "@pepo/types/model";

/** Safe, bundled files used by the API-backed Google Maps renderer. */
export const VEHICLE_MAP_ASSET_CANDIDATES: Record<VehicleKind, string[]> = {
  moto: ["moto-top.png", "catalog/moto.png"],
  motoSend: ["moto-send.png", "moto-send-top.png", "moto-top.png", "catalog/moto.png"],
  taxi: ["car-top.png", "car-topo.png", "taxi-top.png", "catalog/taxi.png"],
  suv: ["suv-top.png", "catalog/suv.png"],
  minibus: ["minibus-top.png", "minibus.png", "catalog/minibus.png"],
  tricycle: ["petita-top.png", "tricycle-top.png", "catalog/tricycle.png"],
  truck: ["camion-top.png", "truck-top.png", "catalog/camion.png"],
  pickupTruck: ["pickup-truck-top.png", "pickup-truc-top.png", "pickup-top.png", "catalog/pick-up truck.png", "catalog/pickup.png"],
  // Keep rendering older trips and driver records without offering these types.
  comfort: ["catalog/moto.png"],
  fourByFour: ["catalog/suv.png"],
};

export const LEGACY_MAP_ASSETS = ["car-top.png", "moto-top.png"] as const;
