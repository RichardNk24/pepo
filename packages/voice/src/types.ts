import type { Point, VehicleKind } from "@pepo/types/model";
export type {
  RouteManeuver as Maneuver,
  RouteNavigationStep as NavigationStep,
} from "@pepo/types/model";
import type {
  RouteManeuver as Maneuver,
  RouteNavigationStep as NavigationStep,
} from "@pepo/types/model";
export type NavigationPlan = {
  id: string;
  source: "google" | "fixture";
  points: Point[];
  steps: (NavigationStep & { atMeters: number })[];
  lengthMeters: number;
};
export type NavFix = Point & {
  accuracy: number | null;
  timestamp: number;
  speed?: number | null;
};
export type LandmarkKind =
  | "fuel"
  | "market"
  | "school"
  | "hospital"
  | "pharmacy"
  | "roundabout"
  | "bridge"
  | "intersection"
  | "building"
  | "entrance"
  | "pickup"
  | "transfer"
  | "parcel";
export type Landmark = Point & {
  id: string;
  city: string;
  name: string;
  kind: LandmarkKind;
  aliases: string[];
  source: string;
  reliability: "pending" | "verified" | "rejected";
  validatedAt?: number;
  expiresAt?: number;
  /** A field reviewer has checked visibility from this precise route segment/direction. */
  visibility?: {
    day: boolean;
    night: boolean;
    bearing: number;
    tolerance: number;
  };
  entrance?: {
    access: "vehicle" | "pedestrian";
    parentId: string;
    allowedVehicles?: VehicleKind[];
  };
  parcel?: {
    segmentId: string;
    sequence: number;
    anchorId: string;
    orderedIds: string[];
    directionBearing: number;
    sequenceVerified: boolean;
  };
};
export type LandmarkRelation = {
  landmark: Landmark;
  relation: "after" | "before";
  distanceToTurn: number;
};
export type StructuredInstruction = {
  routeId: string;
  stepId: string;
  phase: "prepare" | "turn" | "arrival";
  maneuver: Maneuver;
  distanceMeters: number;
  landmark?: LandmarkRelation;
  providerText?: string;
};
export type NavigationDecision = {
  state: "ready" | "gps" | "off_route" | "ambiguous" | "no_steps" | "finished";
  instruction?: StructuredInstruction;
  progressMeters?: number;
};
