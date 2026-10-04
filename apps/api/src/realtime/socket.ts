import type { Trip } from "@pepo/types/model";
import { createHash } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { Store } from "../database";
import { availableDriverIds } from "../dispatch/availableDrivers";
export function attachRealtime(
  httpServer: HttpServer,
  store: Store,
  origins: string[],
) {
  const io = new Server(httpServer, { cors: { origin: origins } });
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length > 512)
      return next(new Error("Session invalide."));
    const hash = createHash("sha256").update(token).digest("hex");
    const row = store.db
      .prepare(
        "SELECT userId,expiresAt FROM sessions WHERE hash=? AND expiresAt>?",
      )
      .get(hash, Date.now()) as
      | { userId: string; expiresAt: number }
      | undefined;
    if (!row) return next(new Error("Session invalide."));
    socket.data.userId = row.userId;
    socket.data.tokenHash = hash;
    socket.data.expiresAt = row.expiresAt;
    next();
  });
  io.on(
    "connection",
    (socket) => void socket.join(`user:${socket.data.userId}`),
  );
  const timer = setInterval(() => {
    for (const socket of io.sockets.sockets.values()) {
      if (
        socket.data.expiresAt <= Date.now() ||
        !store.db
          .prepare("SELECT hash FROM sessions WHERE hash=?")
          .get(socket.data.tokenHash)
      )
        socket.disconnect(true);
    }
  }, 60000);
  timer.unref();
  return {
    publish(trip: Trip) {
      const ids = new Set([
        trip.riderId,
        ...trip.offers.map((o) => o.driver.id),
        ...(trip.driverId ? [trip.driverId] : []),
        ...(trip.status === "searching" ? availableDriverIds(store, trip) : []),
      ]);
      // Only an invalidation event is sent; REST verifies the role, participant and session again.
      for (const id of ids) io.to(`user:${id}`).emit("refresh");
    },
    close() {
      clearInterval(timer);
      io.close();
    },
  };
}
