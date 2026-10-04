import { describe, it, expect } from "vitest";
import { createApp } from "../apps/api/src/app";
import { openDatabase } from "../apps/api/src/database";
import {
  releaseScheduled,
  scheduleSlots,
  scheduledLabel,
  DISPATCH_LEAD,
} from "@pepo/utils/scheduling";
import {
  validateNewTrip,
  estimateRoute,
  assertTransition,
  suggestedFare,
} from "@pepo/utils/rules";
import { PLACES, VEHICLES } from "@pepo/utils/cities";
import type { Trip, Profile } from "@pepo/types/model";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const now = Date.UTC(2026, 9, 1, 10);
const makeTrip = (patch: Partial<Trip> = {}): Trip => ({
  id: "scheduled-one",
  riderId: "rider",
  riderName: "Richard",
  riderVerification: "unverified",
  pickup: PLACES[0],
  destination: PLACES[2],
  vehicle: "suv",
  proposedPrice: 9000,
  route: estimateRoute(PLACES[0], PLACES[2]),
  scheduledAt: now + 3600000,
  status: "scheduled",
  offers: [],
  createdAt: now,
  updatedAt: now,
  payment: "cash",
  ...patch,
});
describe("Scheduled departures", () => {
  it("waits until 15 minutes before pickup and dispatches once", () => {
    const trip = makeTrip();
    expect(
      releaseScheduled([trip], trip.scheduledAt! - DISPATCH_LEAD - 1),
    ).toEqual([]);
    const [released] = releaseScheduled(
      [trip],
      trip.scheduledAt! - DISPATCH_LEAD,
    );
    expect(released.status).toBe("searching");
    expect(released.driver).toBeUndefined();
    expect(released.agreedPrice).toBeUndefined();
    expect(
      releaseScheduled([released], trip.scheduledAt! - DISPATCH_LEAD + 1),
    ).toEqual([]);
  });
  it("blocks dispatch during an active ride and expires unconfirmed slots", () => {
    const queued = makeTrip();
    const current = makeTrip({
      id: "current",
      status: "in_progress",
      scheduledAt: undefined,
    });
    expect(releaseScheduled([current, queued], queued.scheduledAt!)).toEqual(
      [],
    );
    expect(
      releaseScheduled([current, queued], queued.scheduledAt! + 1800001)[0]
        .status,
    ).toBe("cancelled");
    expect(
      releaseScheduled([makeTrip({ status: "accepted" })], now + 86400000),
    ).toEqual([]);
    expect(
      releaseScheduled([makeTrip({ status: "searching" })], now + 86400000)[0]
        .status,
    ).toBe("cancelled");
  });
  it("does not activate a cancelled booking; only its owner can cancel", () => {
    const trip = makeTrip();
    expect(() =>
      assertTransition(trip, "cancelled", { id: "outsider" } as Profile),
    ).toThrow();
    expect(() =>
      assertTransition(trip, "cancelled", { id: "rider" } as Profile),
    ).not.toThrow();
    expect(
      releaseScheduled([{ ...trip, status: "cancelled" }], now + 3600000),
    ).toEqual([]);
  });
  it("uses the city timezone even when the device is abroad", () => {
    const lateUtc = Date.UTC(2026, 9, 1, 22, 15);
    expect(scheduledLabel(lateUtc, "kinshasa")).toContain("23:15");
    expect(scheduledLabel(lateUtc, "lubumbashi")).toContain("00:15");
    expect(scheduleSlots(lateUtc, "kinshasa", 0)).toEqual([]);
    const slots = scheduleSlots(lateUtc, "lubumbashi", 0);
    expect(slots[0]).toBe(Date.UTC(2026, 9, 1, 23));
    expect(slots.every((t) => t >= lateUtc + 1800000)).toBe(true);
  });
  it("validates booking limits and distinct prices for every category", () => {
    for (const scheduledAt of [
      Date.now() - 1000,
      Date.now() + 60000,
      Date.now() + 31 * 86400000,
      NaN,
    ])
      expect(() => validateNewTrip(makeTrip({ scheduledAt }))).toThrow();
    expect(() =>
      validateNewTrip(makeTrip({ scheduledAt: Date.now() + 3600000 })),
    ).not.toThrow();
    const prices = VEHICLES.map((v) => suggestedFare(4, v.id));
    expect(new Set(prices).size).toBe(VEHICLES.length);
  });
  it("survives a database restart and persists the worker transition", () => {
    const dir = mkdtempSync(join(tmpdir(), "pepo-schedule-"));
    let store = openDatabase(join(dir, "test.sqlite"));
    try {
      store.saveTrip(makeTrip());
      store.db.close();
      store = openDatabase(join(dir, "test.sqlite"));
      const service = createApp(store, {
        devAuth: true,
        publicUrl: "https://pepo.test",
        adminToken: "test",
        dataDir: dir,
        corsOrigins: [],
      });
      const notifications: Trip[] = [];
      service.setOnChange((t) => notifications.push(t));
      service.dispatchScheduled(now + 3600000 - DISPATCH_LEAD);
      service.dispatchScheduled(now + 3600000 - DISPATCH_LEAD);
      expect(store.trip("scheduled-one")?.status).toBe("searching");
      expect(notifications).toHaveLength(1);
    } finally {
      store.db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
