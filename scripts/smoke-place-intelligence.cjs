/** Signed-in Rider + real local API; fictional own catalog, AI disabled. */
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const express = require("express");
const { chromium } = require("playwright");
const { createApp } = require("../apps/api/src/app.ts");
const { openDatabase } = require("../apps/api/src/database.ts");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pepo-search-"));
  const previousFile = process.env.PEPO_LANDMARKS_FILE,
    previousFlag = process.env.PEPO_AI_PLACES_ENABLED;
  const file = path.join(dir, "catalog.json");
  fs.writeFileSync(
    file,
    JSON.stringify([
      {
        id: "fixture-mall",
        name: "Complexe Test",
        aliases: ["mall"],
        city: "lubumbashi",
        address: "Fixture technique",
        latitude: -11.664,
        longitude: 27.48,
        entrances: [
          {
            id: "fixture-parking",
            name: "Entrée parking",
            latitude: -11.6641,
            longitude: 27.4801,
          },
        ],
      },
    ]),
  );
  process.env.PEPO_LANDMARKS_FILE = file;
  process.env.PEPO_AI_PLACES_ENABLED = "false";
  const store = openDatabase(path.join(dir, "db.sqlite"));
  const web = express();
  web.use(express.static(path.join(__dirname, "../apps/rider/dist")));
  web.use((_req, res) =>
    res.sendFile(path.join(__dirname, "../apps/rider/dist/index.html")),
  );
  const webServer = await new Promise((r) => {
    const s = web.listen(0, "127.0.0.1", () => r(s));
  });
  const url = `http://127.0.0.1:${webServer.address().port}`;
  const api = createApp(store, {
    devAuth: true,
    publicUrl: "http://127.0.0.1:4019",
    adminToken: "test-admin",
    dataDir: dir,
    corsOrigins: [url],
  }).app;
  const apiServer = await new Promise((r) => {
    const s = api.listen(4019, "127.0.0.1", () => r(s));
  });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const post = async (p, b) =>
      (
        await fetch("http://127.0.0.1:4019/api" + p, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(b),
        })
      ).json();
    const phone = "+243812345678",
      code = (await post("/auth/request", { phone })).devCode;
    const session = await post("/auth/verify", {
      phone,
      code,
      name: "Test",
      role: "passenger",
      city: "lubumbashi",
    });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      ({ token, origin }) => {
        if (location.origin === origin)
          localStorage.setItem("pepo-rider-session", token);
      },
      { token: session.token, origin: url },
    );
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByText("Où allez-vous ?", { exact: true }).first().click();
    await page
      .getByRole("textbox", { name: "Destination", exact: true })
      .fill("Amène-moi au mall, entrée parking");
    await page
      .getByText("Complexe Test — Entrée parking", { exact: true })
      .waitFor();
    if (
      await page
        .getByRole("button", { name: "Comprendre ma demande", exact: true })
        .count()
    )
      throw new Error("Old action button remains");
    await page
      .getByText("Vérifiez le lieu et l’entrée avant de choisir.", {
        exact: true,
      })
      .waitFor();
    const out = path.join(os.tmpdir(), "pepo-ui-smoke");
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({
      path: path.join(out, "rider-intelligence.png"),
      fullPage: true,
    });
    await page
      .getByText("Complexe Test — Entrée parking", { exact: true })
      .click();
    await page.waitForURL(/\/ride\?/);
    const destination = JSON.parse(
      new URL(page.url()).searchParams.get("destination"),
    );
    if (destination.id !== "fixture-parking")
      throw new Error("Chosen entrance was not passed to booking");
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "Signed-in Rider: automatic resolve, declared parking entrance, confirmation and booking passed. No paid OpenAI call.",
    );
  } finally {
    await browser?.close();
    await new Promise((r) => apiServer.close(r));
    await new Promise((r) => webServer.close(r));
    store.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
    if (previousFile === undefined) delete process.env.PEPO_LANDMARKS_FILE;
    else process.env.PEPO_LANDMARKS_FILE = previousFile;
    if (previousFlag === undefined) delete process.env.PEPO_AI_PLACES_ENABLED;
    else process.env.PEPO_AI_PLACES_ENABLED = previousFlag;
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
