/** Exercises the shared HTML renderer with a Google API double, without live services. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { chromium } = require("playwright");
const { googleMapDocument } = require("../packages/maps/src/googleDocument.ts");
(async () => {
  const app = express();
  app.get("/", (_req, res) =>
    res.send(googleMapDocument("technical-test-key")),
  );
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 620 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://maps.googleapis.com/**", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: fs.readFileSync(
          path.join(
            __dirname,
            "../apps/rider/scripts/fixtures/google-maps-mock.js",
          ),
          "utf8",
        ),
      }),
    );
    await page.goto(`http://127.0.0.1:${server.address().port}`, {
      waitUntil: "networkidle",
    });
    const a = { latitude: -11.664, longitude: 27.478 },
      b = { latitude: -11.662, longitude: 27.484 };
    await page.evaluate(
      ({ a, b }) =>
        window.pepoUpdate({
          pickup: a,
          destination: b,
          route: { points: [a, { latitude: -11.659, longitude: 27.478 }, b] },
          routeLabels: true,
          labels: { pickup: "Départ", destination: "Arrivée" },
          cameraTopInset: 60,
          cameraBottomInset: 60,
          motionEnabled: false,
        }),
      { a, b },
    );
    const bubbles = page.locator("[data-pepo-endpoint]");
    await bubbles.first().waitFor({ state: "visible" });
    assert.equal(await bubbles.count(), 2);
    assert.equal(
      await page
        .locator('[data-pane="floatPane"] [data-pepo-endpoint]')
        .count(),
      2,
      "Labels must sit above route and marker panes",
    );
    for (const bubble of await bubbles.all()) {
      assert.equal(
        await bubble.evaluate((node) => getComputedStyle(node).pointerEvents),
        "none",
      );
      const rect = await bubble.boundingBox();
      assert.ok(
        rect.x >= 7 && rect.x + rect.width <= 383,
        "Bubble must fit within viewport",
      );
      assert.equal(
        await bubble.locator("div").count(),
        2,
        "Text update must preserve pointer",
      );
    }
    // Move both endpoints to the left edge; the tip still points to the exact coordinate.
    await page.evaluate(() => {
      const m = window.__pepoTestMap;
      const s = window.__pepoTestLastState;
      m.setCenter({
        lat: s.pickup.latitude,
        lng: s.pickup.longitude + (195 - 12) * 0.00004,
      });
    });
    const geometry = await bubbles
      .first()
      .evaluate((node) => ({
        left: parseFloat(node.style.left),
        tip: parseFloat(node.lastElementChild.style.left),
      }));
    assert.ok(
      Math.abs(geometry.left + geometry.tip - 12) < 1,
      "Tip must remain anchored after edge clamping",
    );
    await page.evaluate(() =>
      window.pepoUpdate({
        ...window.__pepoTestLastState,
        labels: { pickup: "Pickup", destination: "Drop-off" },
      }),
    );
    await page.getByText("Drop-off", { exact: true }).waitFor();
    assert.equal(await bubbles.last().locator("div").count(), 2);
    await page.screenshot({
      path: path.join(os.tmpdir(), "pepo-ui-smoke", "map-labels.png"),
    });
    await page.evaluate(() =>
      window.pepoUpdate({ ...window.__pepoTestLastState, picking: true }),
    );
    assert.equal(await bubbles.first().isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      "Route bubbles: upper pane, edge clamping, anchored tips, language update and picker visibility passed (Google API double).",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
