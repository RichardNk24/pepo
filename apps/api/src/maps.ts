import { createHash } from "node:crypto";
import { decodeSteps } from "@pepo/voice/routeAdapter";
import type { CityId, Place, Point, Route } from "@pepo/types/model";
import { CITIES, PLACES } from "@pepo/utils/cities";
import { validPoint } from "@pepo/utils/mapGeometry";
import {
  humanAddress,
  isPlusCode,
  rankReferences,
  useReference,
  type ReferencedPlace,
} from "@pepo/utils/placeReferences";
import {
  decodePolyline,
  estimateRouteWithStops,
  haversine,
} from "@pepo/utils/rules";
import { applyStopIndices, estimatedStopOrder } from "@pepo/utils/stopOrdering";
import { localLandmarks } from "./landmarks";
import { withLocalAliases } from "./map-search/aliases";
import { localChoices } from "./map-search/intelligence";
import { destinationQuery } from "./map-search/query";
import { mergePlaceResults } from "./map-search/results";
export class MapsError extends Error {}
async function googleFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12000,
) {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok)
      throw new MapsError(
        "Google Maps est indisponible. Vérifiez les API activées et réessayez.",
      );
    return await response.json();
  } catch (e) {
    if (e instanceof MapsError) throw e;
    throw new MapsError(
      "Google Maps ne répond pas. Vérifiez Internet et réessayez.",
    );
  }
}
export function pointPlace(point: Point, city: CityId): Place {
  return {
    ...point,
    city,
    id: `pin-${point.latitude.toFixed(6)}-${point.longitude.toFixed(6)}`,
    name: "Lieu choisi sur la carte",
    address: `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} · ${CITIES[city].name}`,
  };
}
export async function searchPlaces(
  query: string,
  city: CityId,
  key?: string,
): Promise<Place[]> {
  const searchQuery = destinationQuery(query);
  if (!searchQuery) return [];
  const catalog = withLocalAliases(await localLandmarks(city));
  const local = localChoices(query, catalog).candidates;
  if (!key)
    return mergePlaceResults(
      local,
      localChoices(
        query,
        PLACES.filter((p) => p.city === city),
      ).candidates,
    );
  const data = await googleFetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.attributions",
      },
      body: JSON.stringify({
        textQuery: `${searchQuery}, ${CITIES[city].name}, République démocratique du Congo`,
        pageSize: 20,
        languageCode: "fr",
        regionCode: "CD",
        locationBias: {
          circle: { center: CITIES[city].center, radius: 25000 },
        },
      }),
    },
    8000,
  );
  // Third-party listings are excluded until their attribution can be rendered. Google attribution is shown in the search sheet.
  const found: Place[] = (data.places || [])
    .filter(
      (p: any) =>
        typeof p.id === "string" &&
        p.id.length > 0 &&
        typeof p.displayName?.text === "string" &&
        p.displayName.text.trim().length > 0 &&
        validPoint(p.location) &&
        !p.attributions?.length &&
        !isPlusCode(p.displayName?.text || p.formattedAddress) &&
        haversine(p.location, CITIES[city].center) <= 60,
    )
    .map((p: any) => ({
      id: p.id,
      name: p.displayName?.text || p.formattedAddress,
      address: humanAddress(p.formattedAddress),
      city,
      ...p.location,
      googleAttribution: true,
    }));
  return mergePlaceResults(found, local);
}
async function googleNearby(
  point: Point,
  city: CityId,
  key: string,
): Promise<(Place & { entrances?: Place[] })[]> {
  const data = await googleFetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.attributions,places.businessStatus,places.entrances",
      },
      body: JSON.stringify({
        languageCode: "fr",
        regionCode: "CD",
        rankPreference: "DISTANCE",
        maxResultCount: 20,
        locationRestriction: { circle: { center: point, radius: 300 } },
      }),
    },
  );
  return (data.places || [])
    .filter(
      (p: any) =>
        validPoint(p.location) &&
        p.id &&
        p.displayName?.text &&
        !p.attributions?.length &&
        p.businessStatus !== "CLOSED_PERMANENTLY",
    )
    .map((p: any) => ({
      id: p.id,
      name: String(p.displayName.text).slice(0, 150),
      address: humanAddress(p.formattedAddress).slice(0, 500),
      city,
      ...p.location,
      googleAttribution: true,
      entrances: (p.entrances || [])
        .filter(
          (e: any) =>
            validPoint(e.location) && haversine(e.location, p.location) <= 1,
        )
        .slice(0, 6)
        .map((e: any, i: number) => ({
          id: `${p.id}-entrance-${i}`,
          ...e.location,
          city,
          name: `${p.displayName.text} — Entrée ${i + 1}`,
          address: `Entrée ${i + 1} · ${humanAddress(p.formattedAddress)}`,
          googleAttribution: true,
        })),
    }));
}
export async function reversePlace(
  point: Point,
  city: CityId,
  key?: string,
): Promise<ReferencedPlace> {
  let result: ReferencedPlace = pointPlace(point, city);
  const [nearby, local, geocoding] = await Promise.allSettled([
    key ? googleNearby(point, city, key) : Promise.resolve([]),
    localLandmarks(city),
    key
      ? googleFetch(
          `https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams(
            {
              latlng: `${point.latitude},${point.longitude}`,
              key,
              language: "fr",
              region: "CD",
            },
          )}`,
        )
      : Promise.resolve(null),
  ]);
  const data = geocoding.status === "fulfilled" ? geocoding.value : null;
  let namedPlace = false;
  if (data?.status === "OK") {
    // Look through all results: the first can be a Plus Code even when a road is known.
    const addresses = data.results || [];
    const poi = addresses.find(
      (a: any) =>
        a.types?.some((t: string) =>
          ["establishment", "point_of_interest", "premise"].includes(t),
        ) &&
        !isPlusCode(a.formatted_address) &&
        a.geometry?.location &&
        haversine(point, {
          latitude: a.geometry.location.lat,
          longitude: a.geometry.location.lng,
        }) <= 25,
    );
    const street = addresses.find((a: any) =>
      a.address_components?.some((c: any) => c.types?.includes("route")),
    );
    const address = poi || street;
    if (address) {
      const components = address.address_components || [];
      const road = components.find((c: any) =>
        c.types?.includes("route"),
      )?.long_name;
      const number = components.find((c: any) =>
        c.types?.includes("street_number"),
      )?.long_name;
      result = {
        ...result,
        name: (poi
          ? address.formatted_address.split(",")[0]
          : [number, road].filter(Boolean).join(" ")
        ).slice(0, 200),
        address: humanAddress(address.formatted_address).slice(0, 500),
        googleAttribution: true,
      };
      namedPlace = !!poi;
    } else {
      const area = addresses
        .flatMap((a: any) => a.address_components || [])
        .find((c: any) =>
          c.types?.some((t: string) =>
            ["sublocality", "neighborhood"].includes(t),
          ),
        )?.long_name;
      result.address = area
        ? `${area} · ${CITIES[city].name}`
        : CITIES[city].name;
    }
  } else result.address = CITIES[city].name;
  const references = rankReferences(point, [
    ...(local.status === "fulfilled" ? local.value : []),
    ...(nearby.status === "fulfilled" ? nearby.value : []),
  ]);
  if (references.length && !namedPlace)
    result = useReference(result, references[0]);
  if (!references.length && !data && key && geocoding.status === "rejected")
    throw geocoding.reason;
  return { ...result, references };
}
export async function computeRoute(
  pickup: Place,
  destination: Place,
  key?: string,
  stops: Place[] = [],
  optimizeStops = false,
): Promise<Route> {
  const calculatedAt = Date.now(),
    timeZone =
      pickup.city === "kinshasa" ? "Africa/Kinshasa" : "Africa/Lubumbashi";
  if (stops.length > 3) throw new MapsError("3 étapes maximum.");
  const optimize = optimizeStops && stops.length > 1;
  if (!key) {
    const orderedStops = optimize
      ? estimatedStopOrder(pickup, destination, stops)
      : [...stops];
    return {
      ...estimateRouteWithStops(pickup, destination, orderedStops),
      calculatedAt,
      timeZone,
      orderedStops,
      stopOrderSource: optimize ? "estimate" : "manual",
    };
  }
  const data = await googleFetch(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.distanceMeters,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.navigationInstruction" +
          (optimize ? ",routes.optimizedIntermediateWaypointIndex" : ""),
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: { latitude: pickup.latitude, longitude: pickup.longitude },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          },
        },
        intermediates: stops.map((p) => ({
          location: {
            latLng: { latitude: p.latitude, longitude: p.longitude },
          },
        })),
        ...(optimize ? { optimizeWaypointOrder: true } : {}),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        polylineQuality: "HIGH_QUALITY",
        languageCode: "fr",
        units: "METRIC",
      }),
    },
  );
  const r = data.routes?.[0];
  if (!r?.polyline?.encodedPolyline)
    throw new MapsError(
      "Aucun trajet routier disponible entre ces lieux. Essayez un point accessible par la route.",
    );
  const points = decodePolyline(r.polyline.encodedPolyline),
    seconds = parseFloat(r.duration);
  if (
    points.length < 2 ||
    points.length > 20000 ||
    !points.every(validPoint) ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    !Number.isFinite(r.distanceMeters) ||
    r.distanceMeters <= 0
  )
    throw new MapsError("L’itinéraire Google reçu est invalide. Réessayez.");
  let orderedStops = [...stops];
  if (optimize) {
    try {
      orderedStops = applyStopIndices(
        stops,
        r.optimizedIntermediateWaypointIndex,
      );
    } catch {
      throw new MapsError("L’ordre des étapes reçu est invalide. Réessayez.");
    }
  }
  return {
    navigationSteps: decodeSteps(r.legs, decodePolyline),
    navigationVersion: `google-${calculatedAt}-${createHash("sha256").update(r.polyline.encodedPolyline).digest("hex").slice(0, 16)}`,
    orderedStops,
    stopOrderSource: optimize ? "google" : "manual",
    points,
    distanceKm: Math.round(r.distanceMeters / 100) / 10,
    durationMin: Math.max(1, Math.round(seconds / 60)),
    durationSeconds: seconds,
    calculatedAt,
    timeZone,
    trafficAware: true,
    source: "google",
  };
}
