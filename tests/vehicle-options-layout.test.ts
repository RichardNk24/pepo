import { describe, expect, it } from "vitest";
import type { ActiveVehicleKind } from "@pepo/types/model";
import { demoFleet } from "../packages/maps/src/demoFleet";
import {
  isVehicleVisible,
  shouldShowVehicleDetails,
  vehicleOptionsDensity,
} from "../apps/rider/src/domain/rideLayout";

const kinds: ActiveVehicleKind[] = [
  "moto",
  "motoSend",
  "taxi",
  "suv",
  "minibus",
  "tricycle",
  "truck",
  "pickupTruck",
];

describe("vehicle options sheet", () => {
  it("maps expanded, middle, and minimum snaps to the matching layouts", () => {
    expect([0, 1, 2].map(vehicleOptionsDensity)).toEqual([
      "selected",
      "compact",
      "expanded",
    ]);
  });

  it("keeps list order and reveals only the chosen row when collapsed", () => {
    expect(
      kinds.filter((id) => isVehicleVisible(id, "suv", "compact")),
    ).toEqual(kinds);
    expect(
      kinds.filter((id) => isVehicleVisible(id, "suv", "selected")),
    ).toEqual(["suv"]);
    expect(shouldShowVehicleDetails("suv", "suv", "compact")).toBe(true);
    expect(shouldShowVehicleDetails("moto", "suv", "compact")).toBe(false);
  });
});

describe("demo vehicle illustrations", () => {
  it.each(kinds)(
    "uses the selected %s type for every moving marker",
    (kind) => {
      for (const center of [
        { latitude: -11.664, longitude: 27.479 },
        { latitude: -4.325, longitude: 15.322 },
      ]) {
        const fleet = demoFleet(center, kind);
        expect(fleet).toHaveLength(6);
        expect(fleet.every((vehicle) => vehicle.kind === kind)).toBe(true);
      }
    },
  );

  it("preserves mixed demo types when no selection is supplied", () => {
    expect(
      demoFleet({ latitude: -11.664, longitude: 27.479 }).map((v) => v.kind),
    ).toEqual(["moto", "taxi", "moto", "taxi", "moto", "taxi"]);
  });
});
