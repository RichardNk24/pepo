import { z } from "zod";
import { point } from "../runtime";
import type { Store } from "../database";
import type { Landmark } from "@pepo/voice/types";
import { verifiedLandmark } from "@pepo/voice/landmarks";
export const landmarkInput = point
  .extend({
    name: z.string().trim().min(2).max(120),
    city: z.enum(["lubumbashi", "kinshasa", "kolwezi"]),
    kind: z.enum([
      "fuel",
      "market",
      "school",
      "hospital",
      "pharmacy",
      "roundabout",
      "bridge",
      "intersection",
      "building",
      "entrance",
      "pickup",
      "transfer",
      "parcel",
    ]),
    aliases: z.array(z.string().trim().min(1).max(100)).max(15).default([]),
    source: z.string().trim().min(3).max(300),
    visibility: z
      .object({
        day: z.boolean(),
        night: z.boolean(),
        bearing: z.number().min(0).lt(360),
        tolerance: z.number().min(0).max(35),
      })
      .optional(),
    entrance: z
      .object({
        access: z.enum(["vehicle", "pedestrian"]),
        parentId: z.string().min(1).max(100),
        allowedVehicles: z
          .array(
            z.enum([
              "moto",
              "motoSend",
              "taxi",
              "suv",
              "minibus",
              "tricycle",
              "truck",
              "pickupTruck",
            ]),
          )
          .max(8)
          .optional(),
      })
      .optional(),
    parcel: z
      .object({
        segmentId: z.string().min(1).max(100),
        sequence: z.number().int().min(1).max(100),
        anchorId: z.string().min(1).max(100),
        orderedIds: z.array(z.string().min(1).max(100)).max(100),
        directionBearing: z.number().min(0).lt(360),
        sequenceVerified: z.literal(false),
      })
      .optional(),
  })
  .strict();
export function initializeVoiceGeo(store: Store) {
  store.db.exec(
    `CREATE TABLE IF NOT EXISTS voice_geo(id TEXT PRIMARY KEY,actor TEXT NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,createdAt INTEGER NOT NULL);`,
  );
}
export function approvedLandmarks(
  store: Store,
  city: string,
  now = Date.now(),
): Landmark[] {
  return (
    store.db
      .prepare(
        "SELECT data FROM voice_geo WHERE status='verified' AND json_extract(data,'$.city')=? ORDER BY createdAt DESC LIMIT 2000",
      )
      .all(city) as { data: string }[]
  )
    .map((row) => JSON.parse(row.data) as Landmark)
    .filter((l) => l.city === city && verifiedLandmark(l, now));
}
