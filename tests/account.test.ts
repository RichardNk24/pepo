import { afterEach, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type Store } from "../apps/api/src/database";
import { createApp } from "../apps/api/src/app";
import { PLACES } from "@pepo/utils/cities";
import type { Profile } from "@pepo/types/model";
let store: Store,
  app: ReturnType<typeof createApp>["app"],
  dir: string,
  n = 0;
const input = {
  pickup: PLACES[0],
  destination: PLACES[2],
  vehicle: "moto",
  proposedPrice: 5000,
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4VIAAAAASUVORK5CYII=",
  "base64",
);
const auth = (token: string) => ({ Authorization: "Bearer " + token });
async function user(role: "passenger" | "driver" = "passenger") {
  const phone = "+2438" + String(++n).padStart(8, "0");
  const code = (
    await request(app).post("/api/auth/request").send({ phone }).expect(200)
  ).body.devCode;
  const result = await request(app)
    .post("/api/auth/verify")
    .send({ phone, code, name: role + " Test", role, city: "lubumbashi" })
    .expect(200);
  return result.body as { token: string; profile: Profile };
}
describe("Account privacy and persistence", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pepo-test-"));
    store = openDatabase(":memory:");
    app = createApp(store, {
      devAuth: true,
      publicUrl: "https://pepo.test",
      adminToken: "admin-test",
      dataDir: dir,
      corsOrigins: [],
    }).app;
  });
  afterEach(() => {
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps passenger identity pending until an administrator reviews both documents", async () => {
    const p = await user();
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ identityVerification: "verified" })
      .expect(400);
    await request(app)
      .post(`/api/admin/identities/${p.profile.id}/review`)
      .set(auth("admin-test"))
      .send({ approved: true })
      .expect(400);
    for (const kind of ["identity", "selfie"])
      await request(app)
        .post("/api/me/documents/" + kind)
        .set(auth(p.token))
        .attach("document", png, {
          filename: "photo.png",
          contentType: "image/png",
        })
        .expect(200);
    expect(store.user(p.profile.id)?.identityVerification).toBe("pending");
    await request(app)
      .get(`/api/admin/drivers/${p.profile.id}/documents/identity`)
      .set(auth(p.token))
      .expect(403);
    const doc = await request(app)
      .get(`/api/admin/drivers/${p.profile.id}/documents/identity`)
      .set(auth("admin-test"))
      .expect(200);
    expect(Buffer.from(doc.body)).toEqual(png);
    await request(app)
      .post(`/api/admin/identities/${p.profile.id}/review`)
      .set(auth("admin-test"))
      .send({ approved: true })
      .expect(200);
    expect(store.user(p.profile.id)?.identityVerification).toBe("verified");
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ name: "Nouveau Nom" })
      .expect(200);
    expect(store.user(p.profile.id)?.identityVerification).toBe("pending");
    await request(app)
      .post("/api/me/documents/license")
      .set(auth(p.token))
      .attach("document", png, {
        filename: "photo.png",
        contentType: "image/png",
      })
      .expect(403);
  });
  it("returns a private avatar without revoking driver approval", async () => {
    const p = await user("driver"),
      other = await user();
    store.saveUser({
      ...store.user(p.profile.id)!,
      verification: "verified",
      online: true,
    });
    await request(app)
      .post("/api/me/documents/avatar")
      .set(auth(p.token))
      .attach("document", png, {
        filename: "photo.png",
        contentType: "image/png",
      })
      .expect(200);
    expect(store.user(p.profile.id)?.verification).toBe("verified");
    expect(store.user(p.profile.id)?.online).toBe(true);
    await request(app).get("/api/me/avatar").expect(401);
    await request(app).get("/api/me/avatar").set(auth(other.token)).expect(404);
    const result = await request(app)
      .get("/api/me/avatar")
      .set(auth(p.token))
      .expect(200);
    expect(result.body.dataUri).toBe(
      "data:image/png;base64," + png.toString("base64"),
    );
    const row = store.db
      .prepare("SELECT path FROM documents WHERE userId=?")
      .get(p.profile.id) as { path: string };
    expect(readFileSync(row.path).includes(png)).toBe(false);
  });
  it("persists contacts, updates the primary contact, and removes the last contact", async () => {
    const p = await user();
    const contacts = [
      { name: "Maman Test", phone: "+243812345678" },
      { name: "Papa Test", phone: "+243912345678" },
    ];
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ trustedContacts: contacts })
      .expect(200);
    expect(store.user(p.profile.id)?.emergencyContact).toEqual(contacts[0]);
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ trustedContacts: [contacts[1], contacts[0]] })
      .expect(200);
    expect(store.user(p.profile.id)?.emergencyContact).toEqual(contacts[1]);
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ trustedContacts: [contacts[0], contacts[0]] })
      .expect(400);
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ trustedContacts: [...contacts, ...contacts] })
      .expect(400);
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ trustedContacts: [] })
      .expect(200);
    expect(store.user(p.profile.id)?.emergencyContact).toBeNull();
  });
  it("stores Mobile Money numbers but refuses card details and duplicate wallets", async () => {
    const p = await user();
    const paymentMethods = ["airtel", "mpesa", "orange", "afri"].map(
      (provider, i) => ({ id: String(i), provider, phone: "+243812345678" }),
    );
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ paymentMethods })
      .expect(200);
    expect(
      (await request(app).get("/api/me").set(auth(p.token)).expect(200)).body
        .paymentMethods,
    ).toEqual(paymentMethods);
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({
        paymentMethods: [paymentMethods[0], { ...paymentMethods[0], id: "5" }],
      })
      .expect(400);
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ paymentMethods: [{ ...paymentMethods[0], cvv: "123" }] })
      .expect(400);
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ paymentMethods: [{ ...paymentMethods[0], provider: "card" }] })
      .expect(400);
    await request(app)
      .patch("/api/me")
      .set(auth(p.token))
      .send({ paymentMethods: [{ ...paymentMethods[0], phone: "+243123" }] })
      .expect(400);
  });
});
