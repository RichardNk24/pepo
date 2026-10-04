import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { openDatabase } from "../apps/api/src/database";
import { attachRealtime } from "../apps/api/src/realtime/socket";
import { PLACES } from "@pepo/utils/cities";
import type { Trip } from "@pepo/types/model";
const event = (socket: Socket, name: string) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(name, handler);
      resolve("timeout");
    }, 2500);
    const handler = (value: unknown) => {
      clearTimeout(timer);
      resolve(value || "received");
    };
    socket.once(name, handler);
  });
describe("Authenticated realtime invalidation", () => {
  it("notifies the two participants and rejects invalid or expired sessions", async () => {
    const store = openDatabase(":memory:");
    const http = createServer();
    const realtime = attachRealtime(http, store, []);
    const sockets: Socket[] = [];
    try {
      for (const [id, token] of [
        ["rider", "r-token"],
        ["driver", "d-token"],
        ["outsider", "o-token"],
        ["expired", "expired-token"],
      ]) {
        store.saveUser({
          id,
          name: id,
          phone:
            "+2438" + String(sockets.length + id.length).padStart(8, "0") + id,
          role: "passenger",
          city: "lubumbashi",
          online: false,
          verification: "unverified",
          trips: 0,
          rating: 0,
        });
        store.db
          .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
          .run(
            createHash("sha256").update(token).digest("hex"),
            id,
            id === "expired" ? 1 : Date.now() + 60000,
            "passenger",
          );
      }
      await new Promise<void>((resolve) =>
        http.listen(0, "127.0.0.1", resolve),
      );
      const port = (http.address() as { port: number }).port;
      const make = (token: string) => {
        const s = io("http://127.0.0.1:" + port, {
          auth: { token },
          transports: ["websocket"],
          autoConnect: false,
          reconnection: false,
        });
        sockets.push(s);
        return s;
      };
      const r = make("r-token"),
        d = make("d-token"),
        o = make("o-token");
      const ready = [r, d, o].map((s) => {
        const pending = event(s, "connect");
        s.connect();
        return pending;
      });
      expect(await Promise.all(ready)).not.toContain("timeout");
      for (const token of ["invalid", "expired-token"]) {
        const s = make(token),
          failure = event(s, "connect_error");
        s.connect();
        expect(await failure).toBeInstanceOf(Error);
      }
      let outsiderRefresh = false;
      o.on("refresh", () => {
        outsiderRefresh = true;
      });
      const notified = [event(r, "refresh"), event(d, "refresh")];
      realtime.publish({
        riderId: "rider",
        driverId: "driver",
        status: "accepted",
        offers: [],
        pickup: PLACES[0],
        destination: PLACES[2],
        vehicle: "moto",
      } as Trip);
      expect(await Promise.all(notified)).toEqual(["received", "received"]);
      await new Promise((r) => setTimeout(r, 60));
      expect(outsiderRefresh).toBe(false);
    } finally {
      for (const s of sockets) s.disconnect();
      realtime.close();
      store.db.close();
    }
  });
});
