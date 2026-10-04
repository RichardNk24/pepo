import type { CityId, Place } from "@pepo/types/model";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
const point = {
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};
const entry = z.object({
  id: z.string().min(1).max(150),
  name: z.string().min(1).max(150),
  ...point,
});
const catalog = z
  .array(
    z.object({
      ...point,
      id: z.string().min(1).max(150),
      name: z.string().min(1).max(150),
      city: z.enum(["lubumbashi", "kinshasa", "kolwezi"]),
      address: z.string().max(500).default(""),
      aliases: z.array(z.string().min(1).max(100)).max(15).optional(),
      entrances: z.array(entry).max(10).optional(),
    }),
  )
  .max(2000);
// Optional PEPO-owned, field-checked landmarks. Never seeded with guessed coordinates.
export async function localLandmarks(
  city: CityId,
): Promise<(Place & { entrances?: Place[]; aliases?: string[] })[]> {
  try {
    const data = catalog.parse(
      JSON.parse(
        await readFile(
          resolve(process.env.PEPO_LANDMARKS_FILE || "server/landmarks.json"),
          "utf8",
        ),
      ),
    );
    return data
      .filter((p) => p.city === city)
      .map((p) => ({
        ...p,
        entrances: p.entrances?.map((e) => ({
          ...e,
          city,
          name: `${p.name} — ${e.name}`,
          address: `${e.name} · ${p.address}`,
        })),
      }));
  } catch {
    return [];
  }
}
