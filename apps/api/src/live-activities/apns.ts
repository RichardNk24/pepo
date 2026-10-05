import type { Trip, TripStatus } from "@pepo/types/model";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { connect, type ClientHttp2Session } from "node:http2";
import type { DatabaseSync } from "node:sqlite";

type ActivityLanguage = "fr" | "en" | "sw" | "ln";
type ActivityToken = {
  tripId: string;
  activityId: string;
  pushToken: string;
  language: ActivityLanguage;
};
type ActivityProps = {
  statusLabel: string;
  vehicleLabel: string;
  compactLabel: string;
  openLabel: string;
};

const labels: Record<ActivityLanguage, Record<string, string>> = {
  fr: {
    searching: "Recherche d’un conducteur", accepted: "Votre conducteur arrive", arrived: "Votre conducteur est là", in_progress: "Course en cours", completed: "Vous êtes arrivé", cancelled: "Course annulée",
    searchShort: "Recherche…", acceptedShort: "En route", arrivedShort: "Arrivé", rideShort: "En course", doneShort: "Terminé", cancelShort: "Annulée",
    moto: "Moto", motoSend: "Moto colis", taxi: "Taxi", suv: "SUV", minibus: "Minibus", tricycle: "Tricycle", truck: "Camion", pickupTruck: "Pick-up",
    open: "Touchez pour ouvrir Pepo",
  },
  en: {
    searching: "Finding a driver", accepted: "Your driver is on the way", arrived: "Your driver is here", in_progress: "Ride in progress", completed: "You have arrived", cancelled: "Ride cancelled",
    searchShort: "Finding…", acceptedShort: "On the way", arrivedShort: "Arrived", rideShort: "On trip", doneShort: "Done", cancelShort: "Cancelled",
    moto: "Motorbike", motoSend: "Moto delivery", taxi: "Taxi", suv: "SUV", minibus: "Minibus", tricycle: "Tricycle", truck: "Truck", pickupTruck: "Pickup",
    open: "Tap to open Pepo",
  },
  sw: {
    searching: "Tunatafuta dereva", accepted: "Dereva wako anakuja", arrived: "Dereva wako amefika", in_progress: "Safari inaendelea", completed: "Umefika", cancelled: "Safari imeghairiwa",
    searchShort: "Tunatafuta…", acceptedShort: "Anakuja", arrivedShort: "Amefika", rideShort: "Safarini", doneShort: "Imekamilika", cancelShort: "Imeghairiwa",
    moto: "Pikipiki", motoSend: "Pikipiki ya mizigo", taxi: "Teksi", suv: "SUV", minibus: "Basi dogo", tricycle: "Bajaji", truck: "Lori", pickupTruck: "Pickup",
    open: "Gusa ili ufungue Pepo",
  },
  ln: {
    searching: "Tokómi koluka motambwisi", accepted: "Motambwisi azali koya", arrived: "Motambwisi akómi", in_progress: "Mobembo ezali kokende", completed: "Okómi", cancelled: "Mobembo elongolami",
    searchShort: "Boluki…", acceptedShort: "Azali koya", arrivedShort: "Akómi", rideShort: "Na mobembo", doneShort: "Esili", cancelShort: "Elongolami",
    moto: "Moto", motoSend: "Moto ya biloko", taxi: "Taxi", suv: "SUV", minibus: "Minibus", tricycle: "Tricycle", truck: "Kamio", pickupTruck: "Pick-up",
    open: "Finá mpo na kofungola Pepo",
  },
};

function toProps(status: TripStatus, vehicle: string, language: ActivityLanguage): ActivityProps {
  const words = labels[language];
  const shortKey: Record<string, string> = {
    searching: "searchShort", accepted: "acceptedShort", arrived: "arrivedShort",
    in_progress: "rideShort", completed: "doneShort", cancelled: "cancelShort",
  };
  return {
    statusLabel: words[status] || words.searching,
    vehicleLabel: words[vehicle] || words.taxi,
    compactLabel: words[shortKey[status]] || words.searchShort,
    openLabel: words.open,
  };
}

let cachedJwt = "";
let cachedJwtAt = 0;
function authorizationToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwtAt < 45 * 60) return cachedJwt;
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n") ||
    (process.env.APNS_PRIVATE_KEY_PATH ? readFileSync(process.env.APNS_PRIVATE_KEY_PATH, "utf8") : "");
  if (!teamId || !keyId || !privateKey) return null;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "ES256", kid: keyId })}.${encode({ iss: teamId, iat: now })}`;
  const signature = createSign("SHA256").update(unsigned).end().sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  cachedJwt = `${unsigned}.${signature}`;
  cachedJwtAt = now;
  return cachedJwt;
}

function pushToApns(token: ActivityToken, event: "update" | "end", props: ActivityProps) {
  const jwt = authorizationToken();
  if (!jwt) return Promise.resolve(null);
  const production = process.env.APNS_ENVIRONMENT === "production";
  const host = production ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const topic = `${process.env.APNS_BUNDLE_ID || "app.pepo.mobility"}.push-type.liveactivity`;
  const aps: Record<string, unknown> = {
    timestamp: Math.floor(Date.now() / 1000),
    event,
    "content-state": { name: "PepoRideActivity", props: JSON.stringify(props) },
  };
  if (event === "end") aps["dismissal-date"] = Math.floor(Date.now() / 1000) + 60 * 60;
  const payload = JSON.stringify({ aps });
  return new Promise<number>((resolve, reject) => {
    let client: ClientHttp2Session | undefined;
    try {
      client = connect(host);
      client.once("error", reject);
      const request = client.request({
        ":method": "POST",
        ":path": `/3/device/${token.pushToken}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": topic,
        "apns-push-type": "liveactivity",
        "apns-priority": "10",
        "content-type": "application/json",
      });
      request.setTimeout(10000, () => request.close());
      request.on("response", (headers) => resolve(Number(headers[":status"] || 0)));
      request.once("error", reject);
      request.once("close", () => client?.close());
      request.end(payload);
    } catch (error) {
      client?.destroy();
      reject(error);
    }
  });
}

const signatures = new Map<string, string>();
export function sendTripActivityUpdate(db: DatabaseSync, trip: Trip) {
  const signature = `${trip.status}:${trip.vehicle}`;
  if (signatures.get(trip.id) === signature && trip.status !== "completed" && trip.status !== "cancelled") return;
  signatures.set(trip.id, signature);
  if (signatures.size > 5_000) signatures.delete(signatures.keys().next().value as string);
  const rows = db.prepare(
    "SELECT tripId,activityId,pushToken,language FROM live_activity_tokens WHERE tripId=?",
  ).all(trip.id) as ActivityToken[];
  const terminal = trip.status === "completed" || trip.status === "cancelled";
  for (const token of rows) {
    void pushToApns(token, terminal ? "end" : "update", toProps(trip.status, trip.vehicle, token.language))
      .then((status) => {
        if (status === null || status === 200) return;
        if (status === 410 || terminal)
          db.prepare("DELETE FROM live_activity_tokens WHERE tripId=? AND activityId=?").run(token.tripId, token.activityId);
        else console.warn(`[pepo-live-activity] APNs rejected update (HTTP ${status}).`);
      })
      .catch(() => console.warn("[pepo-live-activity] APNs request failed."));
  }
  if (terminal) {
    signatures.delete(trip.id);
    db.prepare("DELETE FROM live_activity_tokens WHERE tripId=?").run(trip.id);
  }
}
