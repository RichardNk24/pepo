import type { Point } from "@pepo/types/model";
// Self-contained: serialized into the Google Maps document and used natively.
// All distances are measured along the road polyline, never along a straight chord.
export function createRoutePulse(points: Point[]) {
  const colors = [
    "#000000",
    "#181601",
    "#443D03",
    "#706405",
    "#9C8B07",
    "#C8B109",
  ];
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          b.latitude - a.latitude,
          (b.longitude - a.longitude) *
            Math.cos(((a.latitude + b.latitude) * Math.PI) / 360),
        ),
    );
  }
  const total = lengths[lengths.length - 1] || 0;
  function sample(t: number) {
    const target = Math.max(0, Math.min(1, t)) * total;
    let lo = 0,
      hi = lengths.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (lengths[mid] < target) lo = mid;
      else hi = mid;
    }
    const a = points[lo],
      b = points[hi];
    const u = (target - lengths[lo]) / (lengths[hi] - lengths[lo] || 1);
    return {
      point: {
        latitude: a.latitude + (b.latitude - a.latitude) * u,
        longitude: a.longitude + (b.longitude - a.longitude) * u,
      },
      index: hi,
    };
  }
  function slice(from: number, to: number): Point[] {
    if (!total || to <= 0 || from >= 1 || from >= to) return [];
    const a = sample(from),
      b = sample(to);
    return [a.point, ...points.slice(a.index, b.index), b.point];
  }
  return {
    frame(elapsedMs: number) {
      // One complete sweep every 3 seconds, including its fading tail.
      const head = ((((elapsedMs % 3000) + 3000) % 3000) / 3000) * 1.24;
      const tail = head - 0.24;
      return Array.from({ length: 25 }, (_, i) => {
        const position = (i / 24) * 5,
          stop = Math.min(4, Math.floor(position)),
          mix = position - stop;
        const color =
          "#" +
          [1, 3, 5]
            .map((channel) =>
              Math.round(
                parseInt(colors[stop].slice(channel, channel + 2), 16) *
                  (1 - mix) +
                  parseInt(colors[stop + 1].slice(channel, channel + 2), 16) *
                    mix,
              )
                .toString(16)
                .padStart(2, "0"),
            )
            .join("");
        return {
          color,
          points: slice(
            tail + (i / 25) * 0.24,
            tail + ((i + 1) / 25) * 0.24 + 0.0001,
          ),
        };
      });
    },
  };
}
