import type { CityId, Place, Point, Route } from "@pepo/types/model";
import { CITIES } from "@pepo/utils/cities";
import { API_URL, LIVE, api } from "./api";

export const MAPS_API_URL = (process.env.EXPO_PUBLIC_MAPS_API_URL || API_URL)
  .trim()
  .replace(/\/+$/, "");
export const GOOGLE_WEB_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY || "";
export const GOOGLE_MAP_URL = MAPS_API_URL ? `${MAPS_API_URL}/maps/mobile` : "";
async function request<T>(path: string, body?: object): Promise<T> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 16000);
  try {
    const res = await fetch(`${MAPS_API_URL}/api/maps${path}`, {
      signal: controller.signal,
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!res.ok)
      throw new Error(
        json.error || "Le service cartographique est indisponible.",
      );
    return json as T;
  } catch (e) {
    if (
      (e as Error).name === "AbortError" ||
      (e as Error).message === "Failed to fetch" ||
      (e as Error).message === "Network request failed"
    )
      throw new Error(
        "Impossible de joindre les cartes. Vérifiez Internet et le serveur, puis réessayez.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export const searchMapPlaces = (query: string, city: CityId) =>
  request<Place[]>(`/places?q=${encodeURIComponent(query)}&city=${city}`);
export const mapRoute = (
  pickup: Place,
  destination: Place,
  stops: Place[] = [],
  optimizeStops = false,
) => request<Route>("/routes", { pickup, destination, stops, optimizeStops });
export function coordinatePlace(point: Point, city: CityId): Place {
  return {
    ...point,
    city,
    id: `pin-${point.latitude.toFixed(6)}-${point.longitude.toFixed(6)}`,
    name: "Lieu choisi sur la carte",
    address: `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)} · ${CITIES[city].name}`,
  };
}
export const reverseMapPlace = (point: Point, city: CityId) =>
  LIVE
    ? api<Place>("/reverse", { method: "POST", body: { ...point, city } })
    : MAPS_API_URL
      ? request<Place>("/reverse", { ...point, city })
      : Promise.resolve(coordinatePlace(point, city));

/** Debounced, authenticated search. No paid AI requests from a demo session. */
export const resolveMapRequest = (
  query: string,
  city: CityId,
  language: string,
  allowAi = false,
  signal?: AbortSignal,
) =>
  api<{ places: Place[]; source: string; status: string }>("/places/resolve", {
    method: "POST",
    body: { query, city, language, allowAi },
    signal,
  });
