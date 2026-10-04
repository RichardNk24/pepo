import { localeFor } from "@pepo/i18n/locale";
import type { Language,Place,Point } from "@pepo/types/model";
export function navigationUrl(
  destination: Place,
  language: Language,
  origin?: Point,
  stops: Place[] = [],
) {
  const query = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
    dir_action: "navigate",
    hl: localeFor(language),
  });
  if (origin) query.set("origin", `${origin.latitude},${origin.longitude}`);
  if (stops.length)
    query.set(
      "waypoints",
      stops.map((p) => `${p.latitude},${p.longitude}`).join("|"),
    );
  return "https://www.google.com/maps/dir/?" + query.toString();
}
