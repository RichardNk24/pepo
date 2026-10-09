import { buildNavigationPlan } from "./routeAdapter";
import type { Landmark, NavigationStep, NavFix } from "./types";
import { lengthOf } from "./geometry";
/** Equatorial synthetic coordinates. NEVER returned by production API or search catalog. */
export function navigationFixture(scenario: string, now: number) {
  const a = { latitude: 0, longitude: 0 },
    b = { latitude: 0.003, longitude: 0 },
    c = { latitude: 0.003, longitude: 0.003 };
  const steps: NavigationStep[] = [
    {
      id: "depart",
      start: a,
      end: b,
      points: [a, b],
      distanceMeters: lengthOf([a, b]),
      maneuver: "straight",
      providerText: "Continuez tout droit.",
    },
    {
      id: "right",
      start: b,
      end: c,
      points: [b, c],
      distanceMeters: lengthOf([b, c]),
      maneuver: scenario === "B" ? "unknown" : "right",
      providerText:
        scenario === "B"
          ? "Tournez à droite sur l’avenue du 30 Juin (simulation)."
          : "Tournez à droite.",
    },
  ];
  const plan = buildNavigationPlan(
    `fixture-${scenario}-${now}`,
    steps,
    "fixture",
  )!;
  const landmarks: Landmark[] =
    scenario === "C"
      ? [
          {
            id: "fixture-fuel",
            city: "fixture",
            name: "station PetroCIL (simulation)",
            kind: "fuel",
            latitude: 0.0027,
            longitude: 0,
            aliases: [],
            source: "synthetic fixture",
            reliability: "verified",
            validatedAt: now - 1000,
            visibility: { day: true, night: true, bearing: 0, tolerance: 15 },
          },
        ]
      : [];
  const fix: NavFix = {
    latitude: 0.002,
    longitude: 0,
    accuracy: scenario === "F" ? 150 : 5,
    timestamp: now,
    speed: 10,
  };
  const entrance: Landmark = {
    id: "fixture-entry",
    city: "fixture",
    name: "entrée véhicules (simulation)",
    kind: "entrance",
    ...c,
    aliases: [],
    source: "synthetic fixture",
    reliability: "verified",
    validatedAt: now - 1000,
    entrance: { access: "vehicle", parentId: "fixture-building" },
    visibility: { day: true, night: true, bearing: 90, tolerance: 15 },
  };
  const anchor: Landmark = {
    id: "fixture-pharmacy",
    city: "fixture",
    name: "pharmacie (simulation)",
    kind: "pharmacy",
    ...b,
    aliases: [],
    source: "synthetic fixture",
    reliability: "verified",
    validatedAt: now - 1000,
  };
  const ids = ["fixture-parcel-1", "fixture-parcel-2", "fixture-parcel-3"];
  const parcels: Landmark[] = ids.map((id, i) => ({
    id,
    city: "fixture",
    name: `parcelle ${i + 1} (simulation)`,
    kind: "parcel",
    latitude: 0.003,
    longitude: 0.0003 * (i + 1),
    aliases: [],
    source: "synthetic fixture",
    reliability: "verified",
    validatedAt: now - 1000,
    parcel: {
      segmentId: "fixture-street",
      sequence: i + 1,
      anchorId: anchor.id,
      orderedIds: ids,
      directionBearing: 90,
      sequenceVerified: true,
    },
  }));
  return { plan, landmarks, fix, entrance, anchor, parcels };
}
