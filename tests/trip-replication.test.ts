import { afterEach, describe, expect, it } from "vitest";
import type { Trip } from "@pepo/types/model";
import { openDatabase } from "../apps/api/src/database";
import { installTripOutbox } from "../apps/api/src/trips/persistence/trip-outbox";
import { TripReplicationService } from "../apps/api/src/trips/persistence/trip-replication.service";
import type { PostgresService } from "../apps/api/src/nest/infrastructure/postgres.service";

const stores: ReturnType<typeof openDatabase>[] = [];
const workers: TripReplicationService[] = [];
afterEach(async () => {
  for (const w of workers.splice(0)) await w.onModuleDestroy();
  for (const s of stores.splice(0)) s.db.close();
});
function setup() {
  const s = openDatabase(":memory:"); stores.push(s);
  for (const [id,phone] of [["r1","+243999999991"],["r2","+243999999992"],["d1","+243999999993"]])
    s.db.prepare("INSERT INTO users VALUES(?,?,?)").run(id,phone,JSON.stringify({id,phone}));
  return s;
}
function trip(id="t1", riderId="r1", driverId: string | undefined=undefined, status="searching"): Trip {
  return {id,riderId,driverId,status,pickup:{city:"lubumbashi"},vehicle:"moto",createdAt:1000,updatedAt:1000,offers:[]} as Trip;
}
class Pg {
  ready = true; fail = false; source?: string; snapshots = new Map<string, {seq:number; data:string}>();
  async transaction(work: (c: any) => Promise<void>) {
    const next = new Map(this.snapshots); let source = this.source;
    await work({query: async (sql:string, v:any[]=[]) => {
      if (this.fail) throw new Error("offline");
      if (sql.startsWith("INSERT INTO trip_replication_source")) source ||= v[0];
      if (sql.startsWith("SELECT source_id")) return {rows:[{source_id:source}]};
      if (sql.startsWith("INSERT INTO trips")) {
        if ((next.get(v[0])?.seq || 0) < v[9]) next.set(v[0],{seq:v[9],data:v[7]});
      }
      return {rows:[]};
    }});
    this.snapshots=next;this.source=source;
  }
}
async function worker(s:ReturnType<typeof setup>, p:Pg) {
  const w=new TripReplicationService(s,p as unknown as PostgresService);workers.push(w);
  await w.onApplicationBootstrap();return w;
}
const pending=(s:ReturnType<typeof setup>) => Number(s.db.prepare("SELECT COUNT(*) AS n FROM trip_replication_queue").get()!.n);

describe("Durable trip mirror",()=>{
  it("backfills once and preserves the source identity",()=>{
    const s=setup();s.saveTrip(trip());const id=installTripOutbox(s);
    expect(pending(s)).toBe(1);expect(installTripOutbox(s)).toBe(id);expect(pending(s)).toBe(1);
  });
  it("rolls back the queue with the trip mutation",()=>{
    const s=setup();installTripOutbox(s);
    expect(()=>s.atomic(()=>{s.saveTrip(trip());throw Error("rollback");})).toThrow();
    expect(s.trip("t1")).toBeUndefined();expect(pending(s)).toBe(0);
  });
  it("rejects two active trips per rider without partial writes",()=>{
    const s=setup();installTripOutbox(s);s.saveTrip(trip());
    expect(()=>s.saveTrip(trip("t2"))).toThrow();expect(pending(s)).toBe(1);
  });
  it("rejects two assignments to the same driver and releases completed assignments",()=>{
    const s=setup();installTripOutbox(s);s.saveTrip(trip("t1","r1","d1","accepted"));
    expect(()=>s.saveTrip(trip("t2","r2","d1","accepted"))).toThrow();
    s.saveTrip(trip("t1","r1","d1","completed"));
    expect(()=>s.saveTrip(trip("t2","r2","d1","accepted"))).not.toThrow();
  });
  it("leaves historical duplicates intact and rolls back installation",()=>{
    const s=setup();s.saveTrip(trip());s.saveTrip(trip("t2"));
    expect(()=>installTripOutbox(s)).toThrow();expect(s.trip("t2")).toBeDefined();
    expect(s.db.prepare("SELECT name FROM sqlite_master WHERE name='trip_replication_queue'").get()).toBeUndefined();
  });
  it("captures direct SQL updates and ignores identical payloads",()=>{
    const s=setup();installTripOutbox(s);s.saveTrip(trip());s.saveTrip(trip());expect(pending(s)).toBe(1);
    s.db.prepare("UPDATE trips SET data=? WHERE id='t1'").run(JSON.stringify({...trip(),updatedAt:2000}));expect(pending(s)).toBe(2);
    expect(()=>s.db.prepare("DELETE FROM trips").run()).toThrow();
  });
  it("retains unacknowledged events during outage then catches up",async()=>{
    const s=setup(),p=new Pg();const w=await worker(s,p);s.saveTrip(trip());p.fail=true;
    await expect(w.flush()).rejects.toThrow();expect(pending(s)).toBe(1);
    p.fail=false;await w.flush();expect(pending(s)).toBe(0);expect(p.snapshots.has("t1")).toBe(true);
  });
  it("replays safely after PG commit but before SQLite acknowledgement",async()=>{
    const s=setup(),p=new Pg();const w=await worker(s,p);s.saveTrip(trip());
    s.db.exec("CREATE TRIGGER fail_ack BEFORE DELETE ON trip_replication_queue BEGIN SELECT RAISE(ABORT,'crash'); END;");
    await expect(w.flush()).rejects.toThrow();expect(p.snapshots.size).toBe(1);expect(pending(s)).toBe(1);
    s.db.exec("DROP TRIGGER fail_ack");await w.flush();expect(p.snapshots.size).toBe(1);expect(pending(s)).toBe(0);
  });
  it("refuses a different SQLite source without acknowledging data",async()=>{
    const s=setup();s.saveTrip(trip());const p=new Pg();p.source="another-db";
    await expect(worker(s,p)).rejects.toThrow("Source SQLite différente");expect(pending(s)).toBe(1);
  });
  it("coalesces concurrent flush calls and keeps new events during transfer",async()=>{
    const s=setup(),p=new Pg();const w=await worker(s,p);s.saveTrip(trip());
    const first=w.flush(),second=w.flush();expect(second).toBe(first);
    s.saveTrip({...trip(),updatedAt:3000});await first;expect(pending(s)).toBe(1);
    await w.flush();expect(JSON.parse(p.snapshots.get("t1")!.data).updatedAt).toBe(3000);
  });
});
