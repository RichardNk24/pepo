import type {
  Point,
  Profile,
  SafetyReason,
  Trip,
  TripSafetyState,
} from "@pepo/types/model";
import { randomBytes } from "node:crypto";
import { haversine } from "@pepo/utils/rules";
import type { Store } from "../database";
import { ApiError, type ServerConfig } from "../runtime";
import {
  distanceFromRouteM,
  driverFingerprint,
  expectedStop,
  nightPolicy,
  monitoringThresholds,
  type NightTier,
  reviewedDriver,
  SAFETY,
} from "./policy";

export type SafetyFix = Point & { accuracy: number; capturedAt: number };
type StoredFix = SafetyFix & { receivedAt: number };
type Observation = {
  anchor?: Point;
  stationarySince?: number;
  offRouteSince?: number;
  lastAt?: number;
  lastCheckAt?: number;
  acceptedAt: number;
  tier?: NightTier;
  fix?: StoredFix;
};
type Check = {
  id: string;
  tripId: string;
  userId: string;
  role: string;
  reason: SafetyReason;
  createdAt: number;
  answeredAt?: number;
  answer?: string;
};
type Help = NonNullable<TripSafetyState["help"]> & {
  tripId: string;
  userId: string;
  role: string;
  source: string;
};
const active = (t: Trip) =>
  ["accepted", "arrived", "in_progress"].includes(t.status);
const uid = () => randomBytes(16).toString("hex");
export function createSafety(store: Store, config: ServerConfig) {
  const now = config.safety?.now || Date.now;
  const enabled = config.safety?.enabled !== false;
  const policy = (t: Trip) => {
    const current = nightPolicy(t.pickup.city, now());
    // Once reinforced, an assigned ride keeps its controls until it ends.
    const observed = observation(t.id);
    const start = observed?.acceptedAt;
    const initial =
      observed?.tier ||
      (start ? nightPolicy(t.pickup.city, start).tier : "day");
    if (initial === "late" || (initial === "night" && current.tier === "day"))
      current.tier = initial;
    return current;
  };
  function observation(tripId: string) {
    const row = store.db
      .prepare("SELECT data FROM safety_observation WHERE tripId=?")
      .get(tripId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Observation) : undefined;
  }
  function saveObservation(t: Trip, o: Observation) {
    store.db
      .prepare(
        "INSERT INTO safety_observation VALUES(?,?,?) ON CONFLICT(tripId) DO UPDATE SET data=excluded.data,updatedAt=excluded.updatedAt",
      )
      .run(t.id, JSON.stringify(o), now());
  }
  const audit = (action: string, subject: string) =>
    store.db
      .prepare(
        "INSERT INTO safety_audit(action,subject,createdAt) VALUES(?,?,?)",
      )
      .run(action, subject, now());
  function fresh(fix: StoredFix | undefined) {
    return (
      !!fix &&
      fix.accuracy <= SAFETY.maxAccuracyM &&
      now() - fix.capturedAt <= SAFETY.fixMaxAgeMs &&
      now() - fix.receivedAt <= SAFETY.fixMaxAgeMs &&
      fix.capturedAt <= now() + 10000
    );
  }
  function lastDriverFix(userId: string) {
    const row = store.db
      .prepare("SELECT data FROM safety_driver_fix WHERE userId=?")
      .get(userId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as StoredFix) : undefined;
  }
  function approvalValid(p: Profile) {
    const approval = store.db
      .prepare(
        "SELECT fingerprint,expiresAt FROM safety_driver_approval WHERE userId=?",
      )
      .get(p.id) as { fingerprint: string; expiresAt: number } | undefined;
    return (
      (config.devAuth || p.phoneVerified === true) &&
      reviewedDriver(p) &&
      !!approval &&
      approval.expiresAt > now() &&
      approval.fingerprint === driverFingerprint(p)
    );
  }
  function eligible(t: Trip, p: Profile) {
    return (
      !enabled ||
      policy(t).tier === "day" ||
      (approvalValid(p) && fresh(lastDriverFix(p.id)))
    );
  }
  function requireEligible(t: Trip, p: Profile) {
    if (!enabled || policy(t).tier === "day") return;
    if (!approvalValid(p))
      throw new ApiError(
        403,
        "Ce conducteur doit être autorisé pour les courses de nuit.",
        "NIGHT_REVIEW_REQUIRED",
      );
    if (!fresh(lastDriverFix(p.id)))
      throw new ApiError(
        409,
        "Actualisez la position GPS du conducteur avant cette course de nuit.",
        "SAFETY_GPS_REQUIRED",
      );
  }
  function saveDriverFix(userId: string, fix: SafetyFix) {
    const at = now();
    if (fix.capturedAt > at + 10000 || at - fix.capturedAt > SAFETY.fixMaxAgeMs)
      throw new ApiError(
        400,
        "Cette position GPS est trop ancienne. Actualisez-la.",
        "SAFETY_GPS_REQUIRED",
      );
    const previous = lastDriverFix(userId);
    if (previous && fix.capturedAt <= previous.capturedAt) return previous;
    const value = { ...fix, receivedAt: at };
    store.db
      .prepare(
        "INSERT INTO safety_driver_fix VALUES(?,?,?) ON CONFLICT(userId) DO UPDATE SET data=excluded.data,receivedAt=excluded.receivedAt",
      )
      .run(userId, JSON.stringify(value), at);
    return value;
  }
  function assigned(t: Trip) {
    const fix = t.driverId ? lastDriverFix(t.driverId) : undefined;
    saveObservation(t, {
      acceptedAt: now(),
      tier: policy(t).tier,
      lastAt: fix && fresh(fix) ? fix.receivedAt : undefined,
      fix,
    });
    if (fix) {
      t.driverLocation = { latitude: fix.latitude, longitude: fix.longitude };
      t.driverLocationAt = fix.capturedAt;
      t.driverLocationAccuracy = fix.accuracy;
    }
  }
  function requirePickup(t: Trip) {
    if (!enabled || policy(t).tier === "day") return;
    const fix = t.driverId ? lastDriverFix(t.driverId) : undefined;
    if (!fresh(fix))
      throw new ApiError(
        409,
        "Actualisez la position GPS avant de confirmer le départ.",
        "SAFETY_GPS_REQUIRED",
      );
    if (haversine(fix!, t.pickup) * 1000 > SAFETY.pickupRadiusM)
      throw new ApiError(
        409,
        "Rejoignez le point de départ avant de confirmer l’arrivée ou le départ.",
        "SAFETY_PICKUP_DISTANCE",
      );
  }
  function requestHelp(
    t: Trip,
    actor: Pick<Profile, "id" | "role">,
    source = "manual",
  ) {
    const existing = store.db
      .prepare(
        "SELECT * FROM safety_help WHERE tripId=? AND userId=? AND role=? AND status<>'resolved'",
      )
      .get(t.id, actor.id, actor.role) as Help | undefined;
    if (existing) return existing;
    const at = now(),
      helpId = uid();
    store.db
      .prepare(
        "INSERT INTO safety_help(id,tripId,userId,role,source,status,createdAt) VALUES(?,?,?,?,?,'queued',?)",
      )
      .run(helpId, t.id, actor.id, actor.role, source, at);
    audit("help_queued", helpId);
    return {
      id: helpId,
      tripId: t.id,
      userId: actor.id,
      role: actor.role,
      source,
      status: "queued" as const,
      createdAt: at,
    };
  }
  function createChecks(t: Trip, reason: SafetyReason, o: Observation) {
    if (!enabled || now() - (o.lastCheckAt || 0) < SAFETY.checkCooldownMs)
      return false;
    let made = false;
    for (const [userId, role] of [
      [t.riderId, "passenger"],
      [t.driverId, "driver"],
    ] as const) {
      if (!userId) continue;
      const pending = store.db
        .prepare(
          "SELECT id FROM safety_checks WHERE tripId=? AND userId=? AND role=? AND answeredAt IS NULL",
        )
        .get(t.id, userId, role);
      if (!pending) {
        store.db
          .prepare(
            "INSERT INTO safety_checks(id,tripId,userId,role,reason,createdAt) VALUES(?,?,?,?,?,?)",
          )
          .run(uid(), t.id, userId, role, reason, now());
        made = true;
      }
    }
    o.lastCheckAt = now();
    return made;
  }
  function observe(t: Trip, fix: StoredFix) {
    if (!active(t)) return;
    const o = observation(t.id) || { acceptedAt: now() };
    o.tier = policy(t).tier;
    const thresholds = monitoringThresholds(o.tier);
    if (o.fix && fix.capturedAt <= o.fix.capturedAt) return;
    // Gaps, poor GPS and isolated outliers reset evidence rather than declaring danger.
    const previous = o.fix;
    const trustworthy =
      fresh(fix) &&
      (!previous ||
        haversine(fix, previous) * 1000 <=
          Math.max(200, ((fix.capturedAt - previous.capturedAt) / 1000) * 55));
    const continuous = previous && fix.capturedAt - previous.capturedAt < 60000;
    if (!trustworthy || !continuous || t.status !== "in_progress") {
      o.anchor = fix;
      o.stationarySince = now();
      o.offRouteSince = undefined;
    } else {
      if (
        !o.anchor ||
        haversine(fix, o.anchor) * 1000 > Math.max(100, fix.accuracy * 2)
      ) {
        o.anchor = fix;
        o.stationarySince = now();
      }
      const distance = distanceFromRouteM(fix, t.route);
      if (distance !== null && distance > SAFETY.deviationM + fix.accuracy)
        o.offRouteSince ??= now();
      else o.offRouteSince = undefined;
      if (o.offRouteSince && now() - o.offRouteSince >= thresholds.deviationMs)
        createChecks(t, "deviation", o);
      else if (
        o.stationarySince &&
        now() - o.stationarySince >= thresholds.stopMs &&
        !expectedStop(fix, t)
      )
        createChecks(t, "stop", o);
    }
    o.fix = fix;
    if (trustworthy) o.lastAt = now();
    saveObservation(t, o);
  }
  function tick() {
    if (!enabled) return [];
    const changed: Trip[] = [];
    const trips = store.trips(
      "SELECT data FROM trips WHERE status IN ('accepted','arrived','in_progress')",
    );
    store.atomic(() => {
      for (const t of trips) {
        const o = observation(t.id) || { acceptedAt: now() };
        o.tier = policy(t).tier;
        const thresholds = monitoringThresholds(o.tier);
        const made =
          now() - (o.lastAt || o.acceptedAt) >= thresholds.staleMs &&
          createChecks(t, "gps_unavailable", o);
        saveObservation(t, o);
        let escalated = false;
        const checks = store.db
          .prepare(
            "SELECT * FROM safety_checks WHERE tripId=? AND answeredAt IS NULL AND escalatedAt IS NULL AND reason<>'gps_unavailable' AND createdAt<?",
          )
          .all(t.id, now() - thresholds.checkGraceMs) as Check[];
        for (const c of checks) {
          // Non-response enters a review queue; it is never labelled a confirmed emergency.
          requestHelp(
            t,
            { id: c.userId, role: c.role as Profile["role"] },
            "check_unanswered",
          );
          store.db
            .prepare("UPDATE safety_checks SET escalatedAt=? WHERE id=?")
            .run(now(), c.id);
          escalated = true;
        }
        if (made || escalated) changed.push(t);
      }
    });
    return changed;
  }
  function state(t: Trip, actor: Profile): TripSafetyState {
    const at = now(),
      p = policy(t);
    const quality = !t.driverLocationAt
      ? "missing"
      : at - t.driverLocationAt > SAFETY.fixMaxAgeMs
        ? "stale"
        : (t.driverLocationAccuracy ?? Infinity) > SAFETY.maxAccuracyM
          ? "imprecise"
          : "fresh";
    const check = store.db
      .prepare(
        "SELECT id,reason,createdAt FROM safety_checks WHERE tripId=? AND userId=? AND role=? AND answeredAt IS NULL ORDER BY createdAt DESC LIMIT 1",
      )
      .get(t.id, actor.id, actor.role) as TripSafetyState["check"];
    const help = store.db
      .prepare(
        "SELECT id,status,createdAt,acknowledgedAt FROM safety_help WHERE tripId=? AND userId=? AND role=? ORDER BY createdAt DESC LIMIT 1",
      )
      .get(t.id, actor.id, actor.role) as TripSafetyState["help"];
    return {
      enabled,
      tier: p.tier,
      timeZone: p.timeZone,
      serverTime: at,
      lastLocationAt: t.driverLocationAt,
      locationQuality: quality,
      check,
      help,
      supportPhone: config.safety?.supportPhone,
    };
  }
  function finish(t: Trip) {
    if (active(t)) return;
    store.db.prepare("DELETE FROM safety_observation WHERE tripId=?").run(t.id);
    store.db
      .prepare("DELETE FROM safety_stop_context WHERE tripId=?")
      .run(t.id);
    store.db
      .prepare(
        "UPDATE safety_checks SET answeredAt=?,answer=COALESCE(answer,'trip_ended') WHERE tripId=? AND answeredAt IS NULL",
      )
      .run(now(), t.id);
    // Help tickets stay open for operations even if a ride is cancelled.
    if (t.driverId)
      store.db
        .prepare("DELETE FROM safety_driver_fix WHERE userId=?")
        .run(t.driverId);
  }
  function cleanup() {
    store.db
      .prepare("DELETE FROM safety_driver_fix WHERE receivedAt<?")
      .run(now() - 3600000);
    store.db
      .prepare("DELETE FROM safety_observation WHERE updatedAt<?")
      .run(now() - 86400000);
    store.db
      .prepare("DELETE FROM safety_stop_context WHERE expiresAt<?")
      .run(now());
    store.db
      .prepare("DELETE FROM safety_checks WHERE createdAt<?")
      .run(now() - SAFETY.retentionMs);
    store.db
      .prepare(
        "DELETE FROM safety_help WHERE status='resolved' AND resolvedAt<?",
      )
      .run(now() - SAFETY.retentionMs);
    store.db
      .prepare("DELETE FROM safety_audit WHERE createdAt<?")
      .run(now() - SAFETY.retentionMs);
    store.db
      .prepare("DELETE FROM safety_driver_approval WHERE expiresAt<?")
      .run(now());
  }
  return {
    now,
    enabled,
    policy,
    eligible,
    requireEligible,
    requirePickup,
    saveDriverFix,
    assigned,
    observe,
    tick,
    state,
    requestHelp,
    finish,
    cleanup,
    approvalValid,
    audit,
  };
}
export type SafetyService = ReturnType<typeof createSafety>;
