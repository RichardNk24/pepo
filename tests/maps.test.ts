import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeRoute,
  MapsError,
  reversePlace,
  searchPlaces,
} from "../apps/api/src/maps";
import { PLACES } from "@pepo/utils/cities";
import {
  arrivalLabel,
  cardinalDirection,
  revealRoute,
  smoothHeading,
  validPoint,
} from "@pepo/utils/mapGeometry";
import { googleMapDocument } from "@pepo/maps/googleDocument";
afterEach(() => vi.unstubAllGlobals());
const reply = (data: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => data });
describe("Map planning and location edge cases", () => {
  it("turns across north by the short angle and accepts zero coordinates", () => {
    expect(smoothHeading(359, 1, 0.5)).toBe(0);
    expect(smoothHeading(1, 359, 0.5)).toBe(0);
    expect(cardinalDirection(-90)).toBe("Ouest");
    expect(cardinalDirection(360)).toBe("Nord");
    expect(validPoint({ latitude: 0, longitude: 0 })).toBe(true);
    expect(validPoint({ latitude: NaN, longitude: 27 })).toBe(false);
  });
  it("reveals a route by distance despite uneven vertex spacing", () => {
    const points = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.001 },
      { latitude: 0, longitude: 0.01 },
    ];
    expect(revealRoute(points, 0.5).at(-1)?.longitude).toBeCloseTo(0.005);
    expect(revealRoute(points, 1)).toEqual(points);
    expect(revealRoute([], 0.5)).toEqual([]);
  });
  it("calculates arrival in the city's timezone across midnight", () => {
    const route = {
      points: [],
      source: "google" as const,
      durationMin: 20,
      durationSeconds: 1200,
      distanceKm: 5,
      timeZone: "Africa/Lubumbashi",
    };
    expect(arrivalLabel(route, Date.parse("2026-09-30T21:50:00Z"))).toBe(
      "00:10",
    );
    expect(
      arrivalLabel(
        { ...route, timeZone: "Africa/Kinshasa" },
        Date.parse("2026-09-30T21:50:00Z"),
      ),
    ).toBe("23:10");
  });
  it("preserves the selected pin instead of moving it to a nearby geocoded address", async () => {
    const selected = { latitude: -11.662345, longitude: 27.485678 };
    vi.stubGlobal(
      "fetch",
      reply({
        status: "OK",
        results: [
          {
            formatted_address: "18 Avenue Kasaï, Lubumbashi",
            geometry: { location: { lat: -11.67, lng: 27.49 } },
            address_components: [
              { types: ["route"], long_name: "Avenue Kasaï" },
              { types: ["street_number"], long_name: "18" },
            ],
          },
        ],
      }),
    );
    const result = await reversePlace(
      selected,
      "lubumbashi",
      "server-test-key",
    );
    expect(result).toMatchObject({
      ...selected,
      name: "18 Avenue Kasaï",
      googleAttribution: true,
    });
  });
  it("keeps a coordinate-only pin when no street address exists", async () => {
    vi.stubGlobal("fetch", reply({ status: "ZERO_RESULTS" }));
    const result = await reversePlace(PLACES[0], "lubumbashi", "test-key");
    expect(result.latitude).toBe(PLACES[0].latitude);
    expect(result.name).toBe("Lieu choisi sur la carte");
  });
  it("uses road geometry, precise duration and traffic-aware route parameters", async () => {
    const fetch = reply({
      routes: [
        {
          distanceMeters: 4570,
          duration: "901s",
          polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
        },
      ],
    });
    vi.stubGlobal("fetch", fetch);
    const route = await computeRoute(PLACES[0], PLACES[2], "private-key");
    expect(route).toMatchObject({
      source: "google",
      distanceKm: 4.6,
      durationMin: 15,
      durationSeconds: 901,
      trafficAware: true,
      timeZone: "Africa/Lubumbashi",
    });
    expect(route.points).toHaveLength(3);
    const options = fetch.mock.calls[0][1];
    expect(JSON.parse(options.body)).toMatchObject({
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      polylineQuality: "HIGH_QUALITY",
    });
    expect(JSON.stringify(route)).not.toContain("private-key");
  });
  it("sends intermediate stops to Google in the selected order", async () => {
    const fetch = reply({
      routes: [
        {
          distanceMeters: 4570,
          duration: "901s",
          polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
        },
      ],
    });
    vi.stubGlobal("fetch", fetch);
    await computeRoute(PLACES[0], PLACES[2], "private-key", [
      PLACES[1],
      PLACES[3],
    ]);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.intermediates).toEqual(
      [PLACES[1], PLACES[3]].map((p) => ({
        location: { latLng: { latitude: p.latitude, longitude: p.longitude } },
      })),
    );
    expect(body.departureTime).toBeUndefined();
  });
  it("never invents a route when a configured Google service fails or finds no road", async () => {
    vi.stubGlobal("fetch", reply({}, false));
    await expect(
      computeRoute(PLACES[0], PLACES[2], "key"),
    ).rejects.toBeInstanceOf(MapsError);
    vi.stubGlobal("fetch", reply({ routes: [] }));
    await expect(
      computeRoute(PLACES[0], PLACES[2], "key"),
    ).rejects.toBeInstanceOf(MapsError);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("timeout with private-key")),
    );
    await expect(computeRoute(PLACES[0], PLACES[2], "key")).rejects.toThrow(
      "Google Maps ne répond pas",
    );
  });
  it("filters places outside the city and unsupported third-party attribution", async () => {
    const place = {
      id: "g1",
      displayName: { text: "Point testé" },
      formattedAddress: "Lubumbashi",
      location: PLACES[0],
    };
    vi.stubGlobal(
      "fetch",
      reply({
        places: [
          place,
          { ...place, id: "g2", attributions: [{}] },
          { ...place, id: "g3", location: { latitude: 48, longitude: 2 } },
        ],
      }),
    );
    expect(await searchPlaces("Point", "lubumbashi", "key")).toHaveLength(1);
  });
  it("keeps embedded key data inside the script and produces valid JavaScript", () => {
    const html = googleMapDocument(
      '</script><img src=x onerror="evil()">',
      "nonce-test",
    );
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toContain('nonce="nonce-test"');
    const script = html
      .split('<script nonce="nonce-test">')[1]
      .split("</script>")[0];
    expect(() => new Function(script)).not.toThrow();
    expect(script).not.toContain("</script>");
  });
});
