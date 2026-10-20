/** Explicit integration test: isolated temporary schema, never modifies public tables. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { openDatabase } from "../../database";
import { TripReplicationService } from "./trip-replication.service";
import type { PostgresService } from "../../nest/infrastructure/postgres.service";
import { PLACES } from "@pepo/utils/cities";
import type { Trip } from "@pepo/types/model";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL absent");
  const schema = "pepo_trip_test_" + randomUUID().replaceAll("-", "");
  const admin = new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
  const pool = new Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema}`,connectionTimeoutMillis:5000});
  const store = openDatabase(":memory:");
  let service: TripReplicationService | undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    for (const file of ["001_core.sql","002_trip_replication.sql"])
      await pool.query(await readFile(resolve("src/nest/infrastructure/migrations",file),"utf8"));
    for (const [id,phone] of [["r1","+243999999991"],["r2","+243999999992"],["d1","+243999999993"]]) {
      store.db.prepare("INSERT INTO users VALUES(?,?,?)").run(id,phone,JSON.stringify({id,phone}));
      await pool.query("INSERT INTO users(id,phone,data) VALUES($1,$2,'{}')",[id,phone]);
    }
    const pg = {ready:true,transaction:async<T>(work:(c:any)=>Promise<T>)=>{
      const client=await pool.connect();
      try {await client.query("BEGIN");const r=await work(client);await client.query("COMMIT");return r;}
      catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
    }};
    service=new TripReplicationService(store,pg as unknown as PostgresService);
    await service.onApplicationBootstrap();
    const t: Trip={riderName:"Test",riderVerification:"verified",destination:PLACES[1],proposedPrice:5000,payment:"cash",route:{points:[],distanceKm:1,durationMin:3,source:"estimate"},id:"t1",riderId:"r1",driverId:"d1",status:"accepted",pickup:PLACES[0],vehicle:"moto",createdAt:1000,updatedAt:1000,offers:[]};
    store.saveTrip(t);await service.flush();
    assert.equal((await pool.query("SELECT status FROM trips WHERE id='t1'")).rows[0].status,"accepted");
    // Verify the actual PostgreSQL unique index, not a mock of it.
    await assert.rejects(pool.query(`INSERT INTO trips(id,rider_id,driver_id,status,city,vehicle,created_at,data)
      VALUES('t2','r2','d1','accepted','lubumbashi','moto',now(),'{}')`),{code:"23505"});
    store.saveTrip({...t,status:"completed",updatedAt:2000});
    // Simulate a crash after commit and before acknowledgement, then replay.
    store.db.exec("CREATE TRIGGER fail_ack BEFORE DELETE ON trip_replication_queue BEGIN SELECT RAISE(ABORT,'test'); END;");
    await assert.rejects(service.flush());
    store.db.exec("DROP TRIGGER fail_ack");
    await service.flush();
    assert.equal((await pool.query("SELECT status FROM trips WHERE id='t1'")).rows[0].status,"completed");
    assert.equal(Number(store.db.prepare("SELECT COUNT(*) AS n FROM trip_replication_queue").get()!.n),0);
    console.log("PASS : copie réelle PostgreSQL, refus double affectation, rejeu après commit et file vidée.");
  } finally {
    await service?.onModuleDestroy();
    store.db.close();await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();
  }
}
void main().catch((error) => {console.error("Test PostgreSQL échoué :",error instanceof Error ? error.name : "erreur");process.exitCode=1;});
