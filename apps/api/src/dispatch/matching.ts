export type DispatchCandidate = {
  tripId: string;
  driverId: string;
  etaSeconds: number;
};

export type DispatchSlot = { tripId: string; slots: number };

type Edge = { to: number; rev: number; cap: number; cost: number };

function addEdge(
  graph: Edge[][],
  from: number,
  to: number,
  cap: number,
  cost: number,
) {
  const forward: Edge = { to, rev: graph[to].length, cap, cost };
  const reverse: Edge = {
    to: from,
    rev: graph[from].length,
    cap: 0,
    cost: -cost,
  };
  graph[from].push(forward);
  graph[to].push(reverse);
  return forward;
}

/**
 * Minimise the total road ETA while serving the largest possible number of
 * requests. Each round gives at most one new driver to each trip, so a second
 * suggestion is considered only after the batch has had a chance to cover all
 * requests once.
 */
export function matchDispatchBatch(
  slots: DispatchSlot[],
  candidates: DispatchCandidate[],
): DispatchCandidate[] {
  const remaining = new Map(
    slots
      .filter((slot) => slot.slots > 0)
      .map((slot) => [slot.tripId, slot.slots]),
  );
  const freeDrivers = new Set(
    candidates.map((candidate) => candidate.driverId),
  );
  const assignments: DispatchCandidate[] = [];

  while (remaining.size && freeDrivers.size) {
    const tripIds = [...remaining.keys()].sort();
    const driverIds = [...freeDrivers].sort();
    const source = 0;
    const tripBase = 1;
    const driverBase = tripBase + tripIds.length;
    const sink = driverBase + driverIds.length;
    const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
    const candidateEdges: { candidate: DispatchCandidate; edge: Edge }[] = [];
    const tripIndex = new Map(tripIds.map((id, i) => [id, tripBase + i]));
    const driverIndex = new Map(driverIds.map((id, i) => [id, driverBase + i]));

    tripIds.forEach((tripId, i) => addEdge(graph, source, tripBase + i, 1, 0));
    driverIds.forEach((driverId, i) =>
      addEdge(graph, driverBase + i, sink, 1, 0),
    );
    for (const candidate of candidates) {
      const from = tripIndex.get(candidate.tripId);
      const to = driverIndex.get(candidate.driverId);
      if (
        from === undefined ||
        to === undefined ||
        !Number.isFinite(candidate.etaSeconds) ||
        candidate.etaSeconds < 0
      )
        continue;
      const edge = addEdge(
        graph,
        from,
        to,
        1,
        Math.round(candidate.etaSeconds * 1000) + to,
      );
      candidateEdges.push({ candidate, edge });
    }

    // Successive shortest augmenting paths. Bellman-Ford handles the reverse
    // edges, which carry negative cost when a previous choice must be swapped.
    while (true) {
      const distance = Array<number>(graph.length).fill(
        Number.POSITIVE_INFINITY,
      );
      const previousNode = Array<number>(graph.length).fill(-1);
      const previousEdge = Array<number>(graph.length).fill(-1);
      distance[source] = 0;
      for (let pass = 0; pass < graph.length - 1; pass++) {
        let changed = false;
        for (let node = 0; node < graph.length; node++) {
          if (!Number.isFinite(distance[node])) continue;
          graph[node].forEach((edge, edgeIndex) => {
            if (
              edge.cap <= 0 ||
              distance[edge.to] <= distance[node] + edge.cost
            )
              return;
            distance[edge.to] = distance[node] + edge.cost;
            previousNode[edge.to] = node;
            previousEdge[edge.to] = edgeIndex;
            changed = true;
          });
        }
        if (!changed) break;
      }
      if (!Number.isFinite(distance[sink])) break;
      for (let node = sink; node !== source; node = previousNode[node]) {
        const edge = graph[previousNode[node]][previousEdge[node]];
        edge.cap--;
        graph[node][edge.rev].cap++;
      }
    }

    const round = candidateEdges
      .filter(({ edge }) => edge.cap === 0)
      .map(({ candidate }) => candidate);
    if (!round.length) break;
    for (const candidate of round) {
      assignments.push(candidate);
      freeDrivers.delete(candidate.driverId);
      const left = (remaining.get(candidate.tripId) || 0) - 1;
      if (left > 0) remaining.set(candidate.tripId, left);
      else remaining.delete(candidate.tripId);
    }
  }
  return assignments;
}
