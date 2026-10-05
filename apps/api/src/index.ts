import { createServer } from "node:http";
import { resolve } from "node:path";
import { clearInterval, setInterval } from "node:timers";
import { createApp } from "./app";
import { openDatabase } from "./database";
import { attachRealtime } from "./realtime/socket";

const port = Number(process.env.PORT || 4000);
const production = process.env.NODE_ENV === "production";
if (production) {
  process.env.PEPO_API_ADMIN_DIR ||= resolve("dist/admin");
  process.env.PEPO_MAP_ASSETS_DIR ||= resolve("dist/map-assets");
}
const devAuth = process.env.DEV_AUTH === "true";
if (production && devAuth)
  throw new Error("DEV_AUTH doit être désactivé en production.");
if (
  production &&
  (!process.env.ADMIN_TOKEN ||
    !process.env.STORAGE_KEY ||
    !process.env.PUBLIC_URL?.startsWith("https://"))
)
  throw new Error("Configurez ADMIN_TOKEN, STORAGE_KEY et PUBLIC_URL HTTPS.");
const dataDir = resolve(process.env.DATA_DIR || "data");
const store = openDatabase(resolve(dataDir, "pepo.sqlite"));
const corsOrigins = (
  process.env.CORS_ORIGINS ||
  "http://localhost:8081,http://127.0.0.1:8081,http://localhost:8082,http://127.0.0.1:8082"
).split(",");
const twilioSid = process.env.TWILIO_ACCOUNT_SID,
  twilioToken = process.env.TWILIO_AUTH_TOKEN,
  twilioFrom = process.env.TWILIO_FROM;
const sendSms =
  twilioSid && twilioToken && twilioFrom
    ? async (phone: string, text: string) => {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: {
              Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone,
              From: twilioFrom,
              Body: text,
            }),
          },
        );
        if (!response.ok)
          throw new Error(
            "L’envoi SMS a échoué. Vérifiez le fournisseur et réessayez.",
          );
      }
    : undefined;
const service = createApp(store, {
  devAuth,
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${port}`,
  googleKey: process.env.GOOGLE_MAPS_SERVER_KEY,
  googleWebKey: process.env.GOOGLE_MAPS_WEB_KEY,
  adminToken: process.env.ADMIN_TOKEN || "",
  storageKey: process.env.STORAGE_KEY,
  dataDir,
  corsOrigins,
  sendSms,
});
const httpServer = createServer(service.app);
const realtime = attachRealtime(httpServer, store, corsOrigins);
service.setOnChange(realtime.publish);
const cleanup = setInterval(() => {
  store.db.prepare("DELETE FROM sessions WHERE expiresAt<?").run(Date.now());
  store.db.prepare("DELETE FROM otp WHERE expiresAt<?").run(Date.now());
  store.db.prepare("DELETE FROM shares WHERE expiresAt<?").run(Date.now());
  store.db.prepare("DELETE FROM live_activity_tokens WHERE updatedAt<?").run(Date.now() - 48 * 60 * 60 * 1000);
}, 3600000);
const dispatch = () => {
  try {
    service.dispatchScheduled();
  } catch (error) {
    console.error("Programmation Pepo :", (error as Error).message);
  }
};
dispatch();
const scheduler = setInterval(dispatch, 15000);
httpServer.listen(port, "0.0.0.0", () =>
  console.log(
    `Pepo API ready on port ${port}. Auth: ${devAuth ? "development (no SMS)" : "SMS"}.`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    clearInterval(cleanup);
    clearInterval(scheduler);
    realtime.close();
    httpServer.close(() => {
      store.db.close();
      process.exit(0);
    });
  });
