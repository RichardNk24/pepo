# Pepo driver recommendation and matching

Pepo uses H3 to keep the candidate search bounded, then compares eligible
drivers by road ETA. Requests that arrive close together are matched as a
small batch. A driver receives an invitation to make an offer; Pepo does not
auto-accept a fare or assign a trip without the rider's choice.

## Current flow

1. The dispatch worker collects searching trips for 1.5 seconds, up to eight
   trips per city and vehicle group.
2. It expands H3 resolution-9 cells around each pickup and considers up to eight
   nearby drivers per trip. A position must be no older than 45 seconds, have
   reported accuracy no worse than 150 m, and belong to an online, verified,
   safety-eligible driver for that city and vehicle.
3. With `GOOGLE_MAPS_SERVER_KEY`, Pepo requests traffic-aware road durations
   only for the eligible driver-to-pickup pairs. Pair results are cached for 20
   seconds. Failed provider calls trigger a 10-second backoff.
4. A maximum-cardinality, minimum-total-ETA matching gives each free driver at
   most one invitation in a round. It gives every request a first invitation
   before using remaining drivers for second or third invitations.
5. Invitations expire after nine seconds if no offer is sent. At most three
   invitations are made per trip. Existing driver price offers and rider choice
   remain the final decision.

When the server key is absent or the Routes API is unavailable, Pepo uses a
conservative distance-based estimate to keep the dispatch flow usable. Treat
that value as approximate; it is not a road route or live-traffic ETA. A road
that the provider explicitly reports as unreachable is not replaced with this
estimate.

## Configure road ETAs

Put the server-restricted key in `apps/api/.env`:

```dotenv
GOOGLE_MAPS_SERVER_KEY=your-server-restricted-key
```

Enable Google Routes API and billing for the Google Cloud project, and restrict
the key to Routes API and the server environment. Never put this key in a
mobile `EXPO_PUBLIC_*` variable. Restart the API after changing `.env`.

## Current scale boundary

This version uses the repository's SQLite store and one dispatch worker per API
process. It bounds each candidate set and avoids a full Cartesian route matrix,
but it is not yet a multi-region, Uber-scale dispatch service. Before running
multiple API replicas, move trip, location, and invitation state to a shared
transactional database and use a distributed queue or lock plus an outbox for
reliable notifications. Then tune the batch window and candidate limits from
measured pickup ETA, driver acceptance, cancellation, and wait-time outcomes in
each city.

## Validation

Run `npx vitest run tests/dispatch-matching.test.ts tests/roles.test.ts` to
check global driver allocation, eligible-edge ETA calculation, fallback
behavior, fresh GPS filtering, and an end-to-end API invitation. `npm run
build:api` compiles the backend bundle.
