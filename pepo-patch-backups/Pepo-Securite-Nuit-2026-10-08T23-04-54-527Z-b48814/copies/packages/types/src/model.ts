export type Role = "passenger" | "driver";
/** Current vehicle options. Retired kinds remain in VehicleKind for old trip history. */
export type ActiveVehicleKind =
  | "moto"
  | "motoSend"
  | "taxi"
  | "suv"
  | "minibus"
  | "tricycle"
  | "truck"
  | "pickupTruck";
export type RetiredVehicleKind = "comfort" | "fourByFour";
export type VehicleKind = ActiveVehicleKind | RetiredVehicleKind;
export const ACTIVE_VEHICLE_KINDS: ActiveVehicleKind[] = [
  "moto",
  "motoSend",
  "taxi",
  "suv",
  "minibus",
  "tricycle",
  "truck",
  "pickupTruck",
];
export type CityId = "lubumbashi" | "kinshasa" | "kolwezi";
export type Language = "fr" | "en" | "sw" | "ln";
export type Verification =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected"
  | "demo";
export type DocumentKind =
  | "identity"
  | "license"
  | "vehicle"
  | "selfie"
  | "avatar";
export type Point = { latitude: number; longitude: number };
export type Place = Point & {
  id: string;
  name: string;
  address: string;
  city: CityId;
  googleAttribution?: boolean;
};
export type SavedPlaceCategory =
  | "home"
  | "work"
  | "school"
  | "hospital"
  | "favorite"
  | "custom";
export type SavedPlace = {
  /** Client-generated stable ID makes save/update retries idempotent. */
  id: string;
  category: SavedPlaceCategory;
  label: string;
  note?: string;
  place: Place;
  createdAt: number;
  updatedAt: number;
};
export type SavedPlaceInput = Pick<
  SavedPlace,
  "id" | "category" | "label" | "place"
> & { note?: string };
export type PlaceSuggestionReason = "frequent" | "usual_time";
export type PlaceSuggestion = {
  place: Place;
  visitCount: number;
  lastVisitedAt: number;
  reason: PlaceSuggestionReason;
};
export type RecentPlace = {
  place: Place;
  visitCount: number;
  lastVisitedAt: number;
};
export type PlacePersonalizationPreferences = {
  personalizedSuggestions: boolean;
};
export type PersonalPlaceSuggestions = {
  savedPlaces: SavedPlace[];
  suggestions: PlaceSuggestion[];
  recent: RecentPlace[];
  completedTripsAnalyzed: number;
  personalizationEnabled: boolean;
  generatedAt: number;
};
export type DriverDetails = {
  /** Legacy values can still appear in existing driver records. */
  vehicle: VehicleKind;
  model: string;
  plate: string;
  helmet: boolean;
};
export type TrustedContact = { name: string; phone: string };
export type MobileMoneyProvider = "airtel" | "mpesa" | "orange" | "afri";
export type PaymentMethod = {
  id: string;
  provider: MobileMoneyProvider;
  phone: string;
};
export type Profile = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  city: CityId;
  verification: Verification;
  rating: number;
  trips: number;
  online: boolean;
  phoneVerified?: boolean;
  driver?: DriverDetails;
  emergencyContact?: TrustedContact | null;
  trustedContacts?: TrustedContact[];
  paymentMethods?: PaymentMethod[];
  identityVerification?: "unverified" | "pending" | "verified" | "rejected";
  documents?: Partial<
    Record<DocumentKind, { name: string; submittedAt: number }>
  >;
};
export type PublicDriver = Pick<
  Profile,
  "id" | "name" | "verification" | "rating" | "trips"
> & {
  driver: DriverDetails;
  phone?: string;
  avatarPath?: string;
};
export type Offer = {
  id: string;
  tripId: string;
  driver: PublicDriver;
  price: number;
  eta: number;
  status: "pending" | "countered" | "accepted" | "rejected";
  riderCounter?: number;
  expiresAt: number;
  createdAt: number;
};
export type TripStatus =
  | "scheduled"
  | "searching"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";
export type Route = {
  points: Point[];
  distanceKm: number;
  durationMin: number;
  source: "google" | "estimate";
  durationSeconds?: number;
  calculatedAt?: number;
  trafficAware?: boolean;
  timeZone?: string;
  orderedStops?: Place[];
  stopOrderSource?: "google" | "estimate" | "manual";
};
export type Trip = {
  stops?: Place[];
  scheduledAt?: number;
  dispatchStartedAt?: number;
  cancellationReason?: string;
  guest?: { name: string; phone?: string };
  id: string;
  riderId: string;
  riderName: string;
  riderVerification: Verification;
  riderPhoneVerified?: boolean;
  pickup: Place;
  destination: Place;
  vehicle: VehicleKind;
  proposedPrice: number;
  agreedPrice?: number;
  status: TripStatus;
  offers: Offer[];
  driverId?: string;
  driver?: PublicDriver;
  riderPhone?: string;
  pickupPin?: string;
  route: Route;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  startedAt?: number;
  rating?: number;
  driverLocation?: Point;
  payment: "cash";
};
export type NewTrip = Pick<
  Trip,
  | "pickup"
  | "destination"
  | "proposedPrice"
  | "route"
  | "guest"
  | "scheduledAt"
  | "stops"
> & { vehicle: ActiveVehicleKind };
export type ChatMessage = {
  id: string;
  tripId: string;
  senderId: string;
  text: string;
  createdAt: number;
};
export type Incident = {
  id: string;
  tripId?: string;
  category: string;
  detail: string;
  createdAt: number;
};
export type Settings = { language: Language; city: CityId };
export type UserCapability = "RIDER" | "DRIVER" | "ADMIN" | "SUPPORT";
export type User = Pick<
  Profile,
  "id" | "name" | "phone" | "phoneVerified" | "city"
> & { capabilities: UserCapability[] };
export type RiderProfile = {
  userId: string;
  trustedContacts: TrustedContact[];
  paymentMethods: PaymentMethod[];
};
export type DriverProfile = {
  userId: string;
  verification: Verification;
  online: boolean;
  vehicle?: DriverDetails;
  documents?: Profile["documents"];
  rating: number;
  trips: number;
};
export type EarningsSummary = {
  completedTrips: number;
  grossAmount: number;
  distanceKm: number;
  commissionAmount: null;
  netAmount: null;
  currency: "CDF";
};
export const ACTIVE_STATUSES: TripStatus[] = [
  "searching",
  "accepted",
  "arrived",
  "in_progress",
];
export const isActive = (trip: Trip) => ACTIVE_STATUSES.includes(trip.status);
