import type { VehicleKind } from "@pepo/types/model";
import type {
  Landmark,
  NavFix,
  NavigationDecision,
  NavigationPlan,
  StructuredInstruction,
} from "./types";
import { meters, project, validCoordinate } from "./geometry";
import { chooseLandmark, navigationLandmarkNight } from "./landmarks";
/** Small deterministic state, bounded per route. Evaluate on GPS updates; no provider/LLM calls. */
export class NavigationEngine {
  private progress: number | null = null;
  private lastFix: NavFix | null = null;
  private sent = new Set<string>();
  private last: StructuredInstruction | undefined;
  constructor(
    public plan: NavigationPlan,
    private context: { city: string; vehicle: VehicleKind; night: boolean },
    private landmarks: Landmark[] = [],
  ) {}
  repeat() {
    return this.last;
  }
  clear() {
    this.last = undefined;
    this.sent.clear();
    this.progress = null;
    this.lastFix = null;
  }
  evaluate(fix: NavFix, now = Date.now()): NavigationDecision {
    if (
      !validCoordinate(fix) ||
      !Number.isFinite(fix.timestamp) ||
      fix.timestamp > now + 3000 ||
      now - fix.timestamp > 15000 ||
      fix.accuracy === null ||
      !Number.isFinite(fix.accuracy) ||
      fix.accuracy < 0 ||
      fix.accuracy > 35
    )
      return { state: "gps" };
    if (this.lastFix && fix.timestamp < this.lastFix.timestamp)
      return { state: "gps" };
    if (this.lastFix && fix.timestamp === this.lastFix.timestamp)
      return { state: "ready", progressMeters: this.progress ?? undefined };
    const accuracy = fix.accuracy;
    const hits = project(fix, this.plan.points),
      best = hits[0];
    if (!best) return { state: "no_steps" };
    if (best.distance > Math.max(40, fix.accuracy * 2))
      return { state: "off_route" };
    if (
      hits.some(
        (h) =>
          h.distance < best.distance + Math.max(5, accuracy) &&
          Math.abs(h.along - best.along) > 80,
      )
    )
      return { state: "ambiguous" };
    if (this.lastFix && this.progress !== null) {
      const elapsed = (fix.timestamp - this.lastFix.timestamp) / 1000;
      if (elapsed > 30) {
        this.lastFix = null;
        this.progress = null;
        return { state: "gps" };
      }
      if (
        meters(this.lastFix, fix) > Math.max(70, elapsed * 45) ||
        Math.abs(best.along - this.progress) > Math.max(100, elapsed * 45)
      )
        return { state: "ambiguous" };
    }
    this.lastFix = fix;
    this.progress =
      this.progress === null
        ? best.along
        : Math.max(this.progress - 5, best.along);
    const upcoming = this.plan.steps.find(
      (s) => s.atMeters >= this.progress! - 12 && s.atMeters > 1,
    );
    if (!upcoming) return { state: "finished", progressMeters: this.progress };
    const distance = Math.max(0, upcoming.atMeters - this.progress);
    const speed =
      typeof fix.speed === "number" &&
      Number.isFinite(fix.speed) &&
      fix.speed >= 0
        ? Math.min(40, fix.speed)
        : 8;
    const complex = upcoming.maneuver.startsWith("roundabout");
    const prepare = Math.max(90, Math.min(450, speed * (complex ? 22 : 15)));
    const turn = Math.max(20, Math.min(65, speed * 4));
    const phase =
      upcoming.maneuver === "arrive"
        ? "arrival"
        : distance <= turn
          ? "turn"
          : "prepare";
    const threshold =
      phase === "arrival" ? 50 : phase === "turn" ? turn : prepare;
    if (distance > threshold)
      return { state: "ready", progressMeters: this.progress };
    const key = `${upcoming.id}:${phase}`;
    if (this.sent.has(key))
      return { state: "ready", progressMeters: this.progress };
    const instruction: StructuredInstruction = {
      routeId: this.plan.id,
      stepId: upcoming.id,
      phase,
      maneuver: upcoming.maneuver,
      distanceMeters: distance,
      providerText: upcoming.providerText,
      ...(phase !== "arrival"
        ? {
            landmark: chooseLandmark(
              this.plan,
              upcoming.atMeters,
              this.progress,
              this.landmarks,
              {
                ...this.context,
                now,
                night: navigationLandmarkNight(
                  this.context.city,
                  now,
                  this.context.night,
                ),
              },
            ),
          }
        : {}),
    };
    this.sent.add(key);
    this.last = instruction;
    return { state: "ready", progressMeters: this.progress, instruction };
  }
}
