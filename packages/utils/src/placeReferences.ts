import type { Place,Point } from "@pepo/types/model";
import { haversine } from "./rules";

export type NearbyReference = Place & {
  distanceMeters: number;
  entrances?: Place[];
};
export type ReferencedPlace = Place & {
  references?: NearbyReference[];
  referenceId?: string;
  referenceDistanceMeters?: number;
};
const plusCode =
  /\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/gi;
export function humanAddress(value = ""): string {
  return value
    .replace(plusCode, "")
    .replace(/^[\s,·-]+/, "")
    .trim();
}
export function isPlusCode(value = ""): boolean {
  return /\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/i.test(
    value,
  );
}
export function rankReferences(
  point: Point,
  candidates: (Place & { entrances?: Place[] })[],
): NearbyReference[] {
  const ids = new Set<string>();
  return candidates
    .map((p) => ({
      ...p,
      distanceMeters: Math.round(haversine(point, p) * 1000),
    }))
    .filter(
      (p) => p.distanceMeters <= 300 && !!p.name.trim() && !isPlusCode(p.name),
    )
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .filter((p) => {
      if (ids.has(p.id)) return false;
      ids.add(p.id);
      return true;
    })
    .slice(0, 3);
}
export function useReference(
  point: Place,
  reference: NearbyReference,
): ReferencedPlace {
  return {
    ...point,
    // The reference describes the selected point; it never snaps it to a building.
    name:
      reference.distanceMeters <= 25
        ? reference.name
        : `À proximité de ${reference.name}`,
    address:
      `Référence : ${reference.name} · env. ${reference.distanceMeters} m à vol d’oiseau${humanAddress(point.address) ? ` · ${humanAddress(point.address)}` : ""}`.slice(
        0,
        500,
      ),
    referenceId: reference.id,
    referenceDistanceMeters: reference.distanceMeters,
    googleAttribution: point.googleAttribution || reference.googleAttribution,
  };
}
