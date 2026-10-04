/** Browser check over both static Expo web exports. No Google, SMS or microphone service is called. */
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const express = require("express");
const { chromium } = require("playwright");
const { catalogs } = require("@pepo/i18n/catalog");
const root = path.resolve(__dirname, "..");
const start = async (app) => {
  const dir = path.join(root, "apps", app, "dist");
  if (!fs.existsSync(path.join(dir, "index.html")))
    throw new Error("Export web requis pour " + app);
  const service = express();
  service.use(express.static(dir));
  service.use((_req, res) => res.sendFile(path.join(dir, "index.html")));
  const server = await new Promise((r) => {
    const s = service.listen(0, "127.0.0.1", () => r(s));
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};
(async () => {
  const servers = [],
    browser = await chromium.launch({ headless: true });
  const out =
    process.env.PEPO_SMOKE_OUTPUT || path.join(os.tmpdir(), "pepo-ui-smoke");
  fs.mkdirSync(out, { recursive: true });
  let errors = [];
  try {
    for (const app of ["rider", "driver"]) {
      const s = await start(app);
      servers.push(s.server);
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(app + ": " + e.message));
      page.on("console", (e) => {
        if (
          e.type() === "error" &&
          /Text strings must|Cannot read|Maximum update/.test(e.text())
        )
          errors.push(app + ": " + e.text());
      });
      await page.goto(s.url, { waitUntil: "networkidle" });
      await page
        .getByRole("button", { name: catalogs.fr.tryDemo, exact: true })
        .waitFor({ timeout: 30000 });
      for (const [id, label] of [
        ["en", "English"],
        ["sw", "Kiswahili"],
        ["ln", "Lingala"],
        ["fr", "Français"],
      ]) {
        await page.getByRole("button", { name: label, exact: true }).click();
        await page
          .getByRole("button", { name: catalogs[id].getStarted, exact: true })
          .waitFor();
      }
      await page
        .getByRole("button", { name: catalogs.fr.tryDemo, exact: true })
        .click();
      await page.waitForTimeout(600);
      console.log(
        app +
          " home: " +
          (await page.locator("body").innerText()).slice(0, 900),
      );
      await page.screenshot({
        path: path.join(out, app + "-home.png"),
        fullPage: true,
      });
      if (app === "rider") {
        await page
          .getByText(catalogs.fr.destination, { exact: true })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Parler", exact: true })
          .waitFor();
        await page
          .getByRole("textbox", { name: "Lieu de départ", exact: true })
          .waitFor();
        await page
          .getByRole("textbox", { name: "Destination", exact: true })
          .waitFor();
        const mapButtons = page.getByRole("button", {
          name: /Choisir .* sur la carte/,
        });
        if ((await mapButtons.count()) !== 2)
          throw new Error("Both route fields must have a map button");
        const size = await mapButtons.first().boundingBox();
        if (size.width > 50 || size.height > 50)
          throw new Error("Map action must stay compact");
        await page
          .getByRole("textbox", { name: "Lieu de départ", exact: true })
          .fill("Golf Malela");
        await page.getByText("Golf Malela", { exact: true }).last().click();
        await page
          .getByRole("textbox", { name: "Destination", exact: true })
          .waitFor();
        const departure = page.getByRole("textbox", {
          name: "Lieu de départ",
          exact: true,
        });
        if ((await departure.inputValue()) !== "Golf Malela")
          throw new Error("Manual pickup was lost");
        console.log(
          "rider two-field route search, manual pickup and compact map actions passed",
        );
        await page.getByText("Marché Kenya", { exact: true }).last().waitFor();
        await page.screenshot({
          path: path.join(out, "rider-search.png"),
          fullPage: true,
        });
        await page
          .getByRole("button", {
            name: "Choisir le départ sur la carte",
            exact: true,
          })
          .click();
        await page.getByText("Où vous retrouver ?", { exact: true }).waitFor();
        await page
          .getByRole("button", { name: "Retour à la recherche", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Choisir la destination sur la carte",
            exact: true,
          })
          .click();
        await page
          .getByText("Où voulez-vous aller ?", { exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Retour à la recherche", exact: true })
          .click();
        await page.getByText("Marché Kenya", { exact: true }).last().click();
        await page.waitForURL(/\/ride\?/);
        const chosenPickup = JSON.parse(
          new URL(page.url()).searchParams.get("pickup"),
        );
        if (chosenPickup.name !== "Golf Malela")
          throw new Error("Booking overwrote the manual pickup");
        console.log(
          "rider pickup/destination map selection and booking retain manual pickup",
        );
      }
      await context.close();
    }
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(
      "Rider / Driver: four-language welcome, demo startup and Rider destination search passed. Screenshots: " +
        out,
    );
  } finally {
    await browser.close();
    for (const s of servers) s.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
