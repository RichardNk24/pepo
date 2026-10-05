import { describe, expect, it } from "vitest";
import type { VehicleKind } from "@pepo/types/model";
import { demoFleet } from "../packages/maps/src/demoFleet";
import {
  arrangeVehicleOptions,
  vehicleOptionsDensity,
} from "../apps/rider/src/domain/rideLayout";

const kinds: VehicleKind[] = [
  "moto",
  "comfort",
  "taxi",
  "suv",
  "fourByFour",
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

  it("keeps the chosen vehicle first in compact mode and alone when collapsed", () => {
    const options = kinds.map((id) => ({ id }));
    expect(
      arrangeVehicleOptions(options, "suv", "compact").map((x) => x.id),
    ).toEqual(["suv", ...kinds.filter((kind) => kind !== "suv")]);
    expect(arrangeVehicleOptions(options, "suv", "selected")).toEqual([
      { id: "suv" },
    ]);
    expect(arrangeVehicleOptions(options, "suv", "expanded")).toEqual(options);
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
