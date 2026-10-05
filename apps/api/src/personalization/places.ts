import type {
  CityId,
  PersonalPlaceSuggestions,
  Place,
  PlaceSuggestion,
  RecentPlace,
  SavedPlace,
  Trip,
} from "@pepo/types/model";
import { haversine } from "@pepo/utils/rules";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  ApiError,
  city,
  id as newId,
  place,
  wrap,
  type AuthRequest,
  type RouteContext,
} from "../runtime";

const category = z.enum([
  "home",
  "work",
  "school",
  "hospital",
  "favorite",
  "custom",
]);
const savedPlaceBody = z
  .object({
    category,
    label: z.string().trim().min(1).max(60),
    note: z.string().trim().max(180).optional(),
    place: place
      .extend({ googleAttribution: z.boolean().optional() })
      .strict(),
  })
  .strict();

type Visit = { startedAt: number; completedAt: number };
type PlaceGroup = { place: Place; visits: Visit[] };
const LOOKBACK_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_TRIPS = 300;

function clock(at: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lubumbashi",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdays[values.weekday] ?? 0;
  const hour = Number(values.hour);
  return { weekday, hour, weekend: weekday === 0 || weekday === 6 };
}

function clusterVisits(trips: Trip[], cityId: CityId, now: number) {
  const groups: PlaceGroup[] = [];
  const byId = new Map<string, PlaceGroup>();
  for (const trip of trips) {
    if (trip.status !== "completed" || trip.destination.city !== cityId)
      continue;
    const place = trip.destination;
    const completedAt = trip.completedAt || trip.updatedAt || trip.createdAt;
    const startedAt = trip.startedAt || trip.createdAt;
    if (
      !Number.isFinite(completedAt) ||
      !Number.isFinite(startedAt) ||
      completedAt > now ||
      now - completedAt > LOOKBACK_MS
    )
      continue;
    let group = byId.get(place.id);
    // A map pin receives a coordinate-based ID. Treat repeated selections within
    // 70 m as one personal place, while keeping distinct Google branches apart.
    if (!group && place.id.startsWith("pin-"))
      group = groups.find(
        (candidate) =>
          candidate.place.id.startsWith("pin-") &&
          haversine(candidate.place, place) <= 0.07,
      );
    if (!group) {
      group = { place, visits: [] };
      groups.push(group);
      byId.set(place.id, group);
    }
    group.visits.push({ startedAt, completedAt });
  }
  return groups;
}

function hourDistance(a: number, b: number) {
  const distance = Math.abs(a - b);
  return Math.min(distance, 24 - distance);
}

function dayPart(hour: number) {
  if (hour < 5 || hour >= 21) return "night";
  if (hour < 11) return "morning";
  if (hour < 15) return "midday";
  if (hour < 19) return "afternoon";
  return "evening";
}

/**
 * Bounded, private ranking over recent completed rides. This uses no external
 * model call and deliberately never merges separate named Google branches.
 */
export function rankPersonalDestinations(
  trips: Trip[],
  cityId: CityId,
  now = Date.now(),
): { suggestions: PlaceSuggestion[]; recent: RecentPlace[] } {
  const current = clock(now);
  const groups = clusterVisits(trips, cityId, now).map((group) => {
    let score = 0;
    let usualTimeVisits = 0;
    let lastVisitedAt = 0;
    for (const visit of group.visits) {
      const past = clock(visit.startedAt);
      const hoursApart = hourDistance(current.hour, past.hour);
      const hourFit = Math.exp(-(hoursApart ** 2) / (2 * 3.5 ** 2));
      const sameWeekendType = current.weekend === past.weekend;
      const sameWeekday = current.weekday === past.weekday;
      const dayFit = sameWeekday ? 1 : sameWeekendType ? 0.72 : 0.32;
      const sameDayPart = dayPart(current.hour) === dayPart(past.hour);
      const ageDays = (now - visit.completedAt) / 86_400_000;
      const freshness = Math.exp(-ageDays / 75);
      const context = 0.45 * hourFit + 0.35 * dayFit + 0.2 * Number(sameDayPart);
      score += freshness * (0.22 + 0.78 * context);
      if (sameWeekendType && hoursApart <= 2.5) usualTimeVisits++;
      lastVisitedAt = Math.max(lastVisitedAt, visit.completedAt);
    }
    // A small support adjustment rewards repeated use without allowing a single
    // burst of trips to overwhelm a strong time-of-week match.
    score *= 1 + Math.min(0.3, Math.log1p(group.visits.length) * 0.12);
    return { ...group, score, lastVisitedAt, usualTimeVisits };
  });

  const suggestions = groups
    .filter((group) => group.visits.length >= 2)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.lastVisitedAt - a.lastVisitedAt ||
        a.place.id.localeCompare(b.place.id),
    )
    .slice(0, 3)
    .map(
      (group): PlaceSuggestion => ({
        place: group.place,
        visitCount: group.visits.length,
        lastVisitedAt: group.lastVisitedAt,
        reason: group.usualTimeVisits >= 2 ? "usual_time" : "frequent",
      }),
    );

  const recent = groups
    .sort((a, b) => b.lastVisitedAt - a.lastVisitedAt)
    .slice(0, 5)
    .map(
      (group): RecentPlace => ({
        place: group.place,
        visitCount: group.visits.length,
        lastVisitedAt: group.lastVisitedAt,
      }),
    );
  return { suggestions, recent };
}

function savedPlacesFor(store: RouteContext["store"], userId: string) {
  const rows = store.db
    .prepare(
      "SELECT id,category,label,note,placeData,createdAt,updatedAt FROM saved_places WHERE userId=? ORDER BY updatedAt DESC LIMIT 30",
    )
    .all(userId) as {
    id: string;
    category: SavedPlace["category"];
    label: string;
    note: string | null;
    placeData: string;
    createdAt: number;
    updatedAt: number;
  }[];
  return rows.map(
    (row): SavedPlace => ({
      id: row.id,
      category: row.category,
      label: row.label,
      ...(row.note ? { note: row.note } : {}),
      place: JSON.parse(row.placeData) as Place,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }),
  );
}

function ensurePassenger(req: AuthRequest) {
  if (req.actor.role !== "passenger")
    throw new ApiError(403, "Ces lieux personnels sont disponibles dans Pepo Passager.");
}

export function register_personalized_places(ctx: RouteContext) {
  const { app, store, validateMapArea } = ctx;
  const writes = rateLimit({
    windowMs: 60_000,
    limit: 40,
    keyGenerator: (req) => (req as AuthRequest).actor.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Patientez avant de modifier vos lieux." },
  });

  app.get(
    "/api/me/saved-places",
    wrap((req, res) => {
      ensurePassenger(req);
      res.setHeader("Cache-Control", "private, no-store");
      res.json(savedPlacesFor(store, req.actor.id));
    }),
  );

  // PUT with a stable client ID is safe to retry after a dropped mobile-data
  // connection; a retry updates the same private record instead of duplicating it.
  app.put(
    "/api/me/saved-places/:id",
    writes,
    wrap((req, res) => {
      ensurePassenger(req);
      const savedId = z
        .string()
        .regex(/^[a-zA-Z0-9_-]{8,80}$/)
        .parse(String(req.params.id));
      const input = savedPlaceBody.parse(req.body);
      validateMapArea(input.place);
      const existing = store.db
        .prepare("SELECT createdAt FROM saved_places WHERE userId=? AND id=?")
        .get(req.actor.id, savedId) as { createdAt: number } | undefined;
      const count = store.db
        .prepare("SELECT COUNT(*) AS count FROM saved_places WHERE userId=?")
        .get(req.actor.id) as { count: number };
      if (!existing && count.count >= 30)
        throw new ApiError(409, "Vous pouvez enregistrer jusqu’à 30 lieux.");
      const now = Date.now();
      store.db
        .prepare(
          `INSERT INTO saved_places(userId,id,category,label,note,placeData,createdAt,updatedAt)
           VALUES(?,?,?,?,?,?,?,?)
           ON CONFLICT(userId,id) DO UPDATE SET category=excluded.category,label=excluded.label,note=excluded.note,placeData=excluded.placeData,updatedAt=excluded.updatedAt`,
        )
        .run(
          req.actor.id,
          savedId,
          input.category,
          input.label,
          input.note || null,
          JSON.stringify(input.place),
          now,
          now,
        );
      res.setHeader("Cache-Control", "private, no-store");
      res.json({
        id: savedId,
        ...input,
        ...(input.note ? { note: input.note } : {}),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
    }),
  );

  app.delete(
    "/api/me/saved-places/:id",
    writes,
    wrap((req, res) => {
      ensurePassenger(req);
      const savedId = z
        .string()
        .regex(/^[a-zA-Z0-9_-]{8,80}$/)
        .parse(String(req.params.id));
      store.db
        .prepare("DELETE FROM saved_places WHERE userId=? AND id=?")
        .run(req.actor.id, savedId);
      res.status(204).end();
    }),
  );

  app.get(
    "/api/me/place-preferences",
    wrap((req, res) => {
      ensurePassenger(req);
      const row = store.db
        .prepare(
          "SELECT suggestionsEnabled FROM place_preferences WHERE userId=?",
        )
        .get(req.actor.id) as { suggestionsEnabled: number } | undefined;
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ personalizedSuggestions: row?.suggestionsEnabled !== 0 });
    }),
  );

  app.put(
    "/api/me/place-preferences",
    writes,
    wrap((req, res) => {
      ensurePassenger(req);
      const { personalizedSuggestions } = z
        .object({ personalizedSuggestions: z.boolean() })
        .strict()
        .parse(req.body);
      store.db
        .prepare(
          `INSERT INTO place_preferences(userId,suggestionsEnabled,updatedAt) VALUES(?,?,?)
           ON CONFLICT(userId) DO UPDATE SET suggestionsEnabled=excluded.suggestionsEnabled,updatedAt=excluded.updatedAt`,
        )
        .run(req.actor.id, Number(personalizedSuggestions), Date.now());
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ personalizedSuggestions });
    }),
  );

  app.get(
    "/api/places/suggestions",
    wrap((req, res) => {
      ensurePassenger(req);
      const requestedCity =
        req.query.city === undefined ? req.actor.city : city.parse(req.query.city);
      if (requestedCity !== req.actor.city)
        throw new ApiError(403, "Les suggestions sont limitées à votre ville actuelle.");
      const preference = store.db
        .prepare(
          "SELECT suggestionsEnabled FROM place_preferences WHERE userId=?",
        )
        .get(req.actor.id) as { suggestionsEnabled: number } | undefined;
      const personalizationEnabled = preference?.suggestionsEnabled !== 0;
      const savedPlaces = savedPlacesFor(store, req.actor.id);
      const now = Date.now();
      const trips = personalizationEnabled
        ? store.trips(
            `SELECT data FROM trips
             WHERE riderId=? AND city=? AND status='completed' AND createdAt>=?
             ORDER BY createdAt DESC LIMIT ${MAX_TRIPS}`,
            req.actor.id,
            requestedCity,
            now - LOOKBACK_MS,
          )
        : [];
      const ranked = rankPersonalDestinations(trips, requestedCity, now);
      const result: PersonalPlaceSuggestions = {
        savedPlaces,
        suggestions: personalizationEnabled ? ranked.suggestions : [],
        recent: personalizationEnabled ? ranked.recent : [],
        completedTripsAnalyzed: trips.length,
        personalizationEnabled,
        generatedAt: now,
      };
      res.setHeader("Cache-Control", "private, no-store");
      res.json(result);
    }),
  );
}
