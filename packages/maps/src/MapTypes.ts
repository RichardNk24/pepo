import type { Place,Point,Route } from "@pepo/types/model";
import type { LocationFix } from "@pepo/utils/mapGeometry";
export type MapProps = {
  labels?: { pickup: string; destination: string };
  motionEnabled?: boolean;
  nearbyVehicles?: import("./demoFleet").DemoVehicle[];
  pickup: Place;
  stops?: Place[];
  destination?: Place;
  route?: Route;
  driver?: Point;
  driverVehicleKind?: import("@pepo/types/model").VehicleKind;
  vehicles?: boolean;
  bottomInset?: number;
  cameraTopInset?: number;
  cameraBottomInset?: number;
  routeLabels?: boolean;
  onCenter?: () => void;
  userPosition?: LocationFix | null;
  heading?: number | null;
  stale?: boolean;
  followUser?: boolean;
  recenterKey?: number;
  overviewKey?: number;
  picking?: boolean;
  onMove?: () => void;
  onIdle?: (point: Point) => void;
  onPan?: () => void;
  onReady?: (real: boolean) => void;
  onError?: (message: string) => void;
};
/** Cool daylight map: muted landmarks, white roads and pale blue water.
 * Shared by the Google WebView, web iframe and native Google renderer.
 * POI colours are removed at icon level, without hiding useful landmarks.
 */
export const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#E5E9EC" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#667B92" }] },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#F5F7F8" }, { weight: 2 }],
  },
  {
    elementType: "labels.icon",
    stylers: [{ saturation: -100 }, { lightness: 15 }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#E5E9EC" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry.stroke",
    stylers: [{ color: "#DBE1E5" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#E5E9EC" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "on" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6A819E" }],
  },
  {
    featureType: "poi",
    elementType: "labels.icon",
    stylers: [{ saturation: -100 }, { lightness: 20 }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#A9DFBC" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#639F7B" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#DCE2E7" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#50585F" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#FFFFFF" }, { weight: 2 }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#D6DDE3" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.icon",
    stylers: [{ saturation: -100 }, { lightness: 20 }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#ACD4EE" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#628EAB" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8898A5" }],
  },
];
