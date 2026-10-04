import type { CityId,Point } from "@pepo/types/model";
import { CITIES } from "./cities";
import { haversine } from "./rules";

export function phoneDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("243") && digits.length > 9) digits = digits.slice(3);
  return digits.replace(/^0/, "").slice(0, 9);
}
export function formatPhone(digits: string) {
  return [
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4, 6),
    digits.slice(6, 9),
  ]
    .filter(Boolean)
    .join(" ");
}
/** Match the same 60 km service area used by the server; never guess a distant city. */
export function cityFromLocation(point: Point): CityId | null {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude))
    return null;
  const cities = (Object.keys(CITIES) as CityId[]).sort(
    (a, b) =>
      haversine(point, CITIES[a].center) - haversine(point, CITIES[b].center),
  );
  return haversine(point, CITIES[cities[0]].center) <= 60 ? cities[0] : null;
}
