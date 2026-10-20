import { describe, expect, it, vi } from "vitest";
import {
  hasPremium,
  PremiumService,
} from "../apps/api/src/premium/premium.service";
import type { PostgresService } from "../apps/api/src/nest/infrastructure/postgres.service";
import type { Store } from "../apps/api/src/database";
import type { Profile } from "@pepo/types/model";
const actor = {
  id: "rider-a",
  phone: "+243999999999",
  role: "passenger",
  city: "lubumbashi",
} as Profile;
function setup(
  row?: Record<string, unknown>,
  dev = false,
  trips: unknown[] = [],
) {
  const query = vi.fn(async () => ({ rows: row ? [row] : [] }));
  const pg = {
    ready: true,
    query,
    transaction: vi.fn(async (work: any) => work({ query })),
  };
  const store = { trips: vi.fn(() => trips) };
  return {
    service: new PremiumService(
      pg as unknown as PostgresService,
      store as unknown as Store,
      dev,
    ),
    pg,
    store,
  };
}
const future = () => new Date(Date.now() + 3600000);
describe("Premium access", () => {
  it("rejects expired, invalid and revoked entitlements", () => {
    expect(hasPremium()).toBe(false);
    expect(hasPremium({ expires_at: "invalid" })).toBe(false);
    expect(hasPremium({ expires_at: new Date(Date.now()) })).toBe(false);
    expect(hasPremium({ expires_at: future(), revoked_at: new Date() })).toBe(
      false,
    );
    expect(hasPremium({ expires_at: future() })).toBe(true);
  });
  it("free account keeps classic, and billing never claims availability", async () => {
    const { service } = setup();
    const result = await service.status(actor);
    expect(result).toMatchObject({
      active: false,
      theme: "classic",
      billingAvailable: false,
      pricing: { monthly: 1, annual: 11.88 },
    });
    await expect(service.theme(actor, "purple")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("does not accept development entitlements outside explicit development mode", async () => {
    const { service, pg } = setup({
      expires_at: future(),
      source: "development",
    });
    expect((await service.status(actor)).active).toBe(false);
    await expect(service.preview(actor)).rejects.toMatchObject({ status: 404 });
    expect(pg.transaction).not.toHaveBeenCalled();
  });
  it("rejects drivers and unavailable database", async () => {
    const { service, pg } = setup();
    await expect(
      service.status({ ...actor, role: "driver" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(pg.query).not.toHaveBeenCalled();
    pg.ready = false;
    await expect(service.status(actor)).rejects.toMatchObject({ status: 503 });
  });
  it("persists only allowed themes under authenticated account id", async () => {
    const { service, pg } = setup({
      expires_at: future(),
      source: "apple",
      theme: "purple",
    });
    await expect(service.theme(actor, "arbitrary")).rejects.toMatchObject({
      status: 400,
    });
    expect(pg.query).not.toHaveBeenCalled();
    await service.theme(actor, "mono");
    expect(pg.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO premium_preferences"),
      [actor.id, "mono"],
    );
  });
  it("does not replace a paid entitlement with development preview", async () => {
    const { service, pg } = setup(
      { expires_at: future(), source: "apple" },
      true,
    );
    await service.preview(actor);
    expect(pg.transaction).not.toHaveBeenCalled();
  });
  it("creates temporary preview with a constrained development upsert", async () => {
    const { service, pg } = setup(undefined, true);
    await service.preview(actor);
    expect(pg.transaction).toHaveBeenCalledOnce();
    expect(pg.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE premium_access.source='development'"),
      [actor.id],
    );
  });
  it("summary only reads own completed trips in current month", async () => {
    const { service, store } = setup(
      { expires_at: future(), source: "apple" },
      false,
      [
        {
          completedAt: Date.now(),
          route: { distanceKm: 3.25 },
          agreedPrice: 5500,
          cashCollectedAt: Date.now(),
        },
        {
          completedAt: Date.now(),
          route: { distanceKm: 2 },
          agreedPrice: 4000,
        },
        { completedAt: 1, route: { distanceKm: 100 }, agreedPrice: 999999 },
      ],
    );
    const result = await service.summary(actor);
    expect(store.trips).toHaveBeenCalledWith(
      "SELECT data FROM trips WHERE riderId=? AND status='completed'",
      actor.id,
    );
    expect(result).toMatchObject({
      trips: 2,
      distanceKm: 5.3,
      agreedAmount: 9500,
      cashConfirmedAmount: 5500,
    });
  });
  it("blocks free summary access before reading ride history", async () => {
    const { service, store } = setup();
    await expect(service.summary(actor)).rejects.toMatchObject({ status: 403 });
    expect(store.trips).not.toHaveBeenCalled();
  });
});
