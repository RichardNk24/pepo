/** Exercises the real admin queue on disposable test data. Never opens the project's database. */
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { createApp } = require("../apps/api/src/app");
const { openDatabase } = require("../apps/api/src/database");
const { PLACES } = require("@pepo/utils/cities");
const { chromium } = require("playwright");
(async () => {
  const dir = mkdtempSync(join(tmpdir(), "pepo-safety-ui-"));
  const store = openDatabase(":memory:");
  let browser, server;
  process.env.PEPO_API_ADMIN_DIR = resolve(__dirname, "../apps/api/src/admin");
  try {
    for (const [id, role, phone] of [
      ["rider", "passenger", "+243811111111"],
      ["driver", "driver", "+243812222222"],
    ]) {
      store.saveUser({
        id,
        role,
        phone,
        name: id === "rider" ? "Amina Test" : "Patrick Test",
        city: "lubumbashi",
        verification: "verified",
        identityVerification: "verified",
        phoneVerified: true,
        online: role === "driver",
        trips: 0,
        rating: 5,
        ...(role === "driver"
          ? {
              driver: {
                vehicle: "taxi",
                model: "Toyota Test",
                plate: "LSH TEST",
                helmet: false,
              },
              documents: Object.fromEntries(
                ["identity", "selfie", "license", "vehicle"].map((k) => [
                  k,
                  { name: k, submittedAt: Date.now() },
                ]),
              ),
            }
          : {}),
      });
    }
    const trip = {
      id: "test-trip",
      riderId: "rider",
      riderName: "Amina Test",
      riderVerification: "verified",
      driverId: "driver",
      vehicle: "taxi",
      proposedPrice: 5000,
      agreedPrice: 5000,
      status: "accepted",
      pickup: PLACES[0],
      destination: PLACES[2],
      route: {
        source: "estimate",
        points: [PLACES[0], PLACES[2]],
        distanceKm: 4,
        durationMin: 12,
      },
      offers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      payment: "cash",
    };
    store.saveTrip(trip);
    store.db
      .prepare(
        "INSERT INTO safety_help(id,tripId,userId,role,source,status,createdAt) VALUES('ui-ticket',?,'rider','passenger','manual','queued',?)",
      )
      .run(trip.id, Date.now());
    const service = createApp(store, {
      devAuth: true,
      publicUrl: "http://localhost",
      adminToken: "local-test-admin",
      dataDir: dir,
      corsOrigins: [],
    });
    server = await new Promise((r) => {
      const s = service.app.listen(0, "127.0.0.1", () => r(s));
    });
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PEPO_BROWSER_PATH
        ? { executablePath: process.env.PEPO_BROWSER_PATH }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}/admin`);
    await page
      .getByPlaceholder("Secret administrateur")
      .fill("local-test-admin");
    await page.getByRole("button", { name: "Ouvrir les dossiers" }).click();
    await page
      .locator("#night-drivers")
      .getByText("Patrick Test", { exact: false })
      .waitFor();
    await page
      .locator("#safety-queue")
      .getByText("Amina Test", { exact: false })
      .waitFor();
    await page
      .getByRole("button", { name: "Autoriser 7 jours", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Retirer l’autorisation", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Prendre en charge", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Clôturer après vérification", exact: true })
      .waitFor();
    const output = process.env.PEPO_SMOKE_OUTPUT || dir;
    await page.screenshot({
      path: join(output, "pepo-safety-admin.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Clôturer après vérification", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Clôturer après vérification", exact: true })
      .waitFor({ state: "hidden" });
    if (
      store.db
        .prepare("SELECT status FROM safety_help WHERE id='ui-ticket'")
        .get().status !== "resolved"
    )
      throw new Error("Queue action was not persisted");
    await page
      .getByRole("button", { name: "Fermer la session", exact: true })
      .click();
    if (await page.locator("#safety-queue").textContent())
      throw new Error("Queue remains visible after logout");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "Safety admin browser check passed: approval, queue, acknowledge, resolve and logout.",
    );
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
