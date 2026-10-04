import {
api,
API_URL,
configureClient,
getToken,
LIVE,
loadToken,
RequestError,
saveToken,
} from "@pepo/api-client/api";
import { mapRoute,MAPS_API_URL,searchMapPlaces } from "@pepo/api-client/maps";
import { translate,type TranslationKey } from "@pepo/i18n/catalog";
import { I18nProvider } from "@pepo/i18n/Context";
import { safeLanguage } from "@pepo/i18n/locale";
import type {
ChatMessage,
CityId,
DocumentKind,
Language,
NewTrip,
Place,
Profile,
Role,
Route,
Settings,
Trip,
TripStatus,
} from "@pepo/types/model";
import { isActive } from "@pepo/types/model";
import { DEMO_DRIVERS,PLACES } from "@pepo/utils/cities";
import {
assertTransition,
canDrive,
estimateRoute,
estimateRouteWithStops,
fare,
suggestedFare,
validateNewTrip,
} from "@pepo/utils/rules";
import { releaseScheduled } from "@pepo/utils/scheduling";
import { estimatedStopOrder } from "@pepo/utils/stopOrdering";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
createContext,
useCallback,
useContext,
useEffect,
useRef,
useState,
type ReactNode,
} from "react";
import { AppState,Platform,Share } from "react-native";
import { io } from "socket.io-client";
import { useLocation } from "./LocationProvider";

type Snapshot = {
  profile: Profile | null;
  trips: Trip[];
  requests: Trip[];
  messages: ChatMessage[];
  settings: Settings;
  incidents: {
    id: string;
    category: string;
    detail: string;
    createdAt: number;
  }[];
};
const initial: Snapshot = {
  profile: null,
  trips: [],
  requests: [],
  messages: [],
  settings: { city: "lubumbashi", language: "fr" },
  incidents: [],
};
type ContextValue = Snapshot & {
  ready: boolean;
  demo: boolean;
  testAuth: boolean;
  connectionError: string | null;
  activeTrip: Trip | undefined;
  t: (key: TranslationKey) => string;
  requestOtp: (phone: string) => Promise<string | undefined>;
  signIn: (input: {
    phone: string;
    code: string;
    name: string;
    role: Role;
    city: CityId;
  }) => Promise<void>;
  enterDemo: (role?: Role) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  setLanguage: (l: Language) => void;
  setOnline: (value: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  search: (query: string) => Promise<Place[]>;
  getRoute: (
    pickup: Place,
    destination: Place,
    stops?: Place[],
    optimizeStops?: boolean,
  ) => Promise<Route>;
  createTrip: (input: NewTrip) => Promise<Trip>;
  cancelTrip: (id: string) => Promise<void>;
  rescheduleTrip: (id: string, scheduledAt: number) => Promise<void>;
  acceptOffer: (tripId: string, offerId: string) => Promise<void>;
  counterOffer: (
    tripId: string,
    offerId: string,
    price: number,
  ) => Promise<void>;
  submitOffer: (tripId: string, price: number) => Promise<void>;
  acceptCounter: (tripId: string, offerId: string) => Promise<void>;
  transition: (
    tripId: string,
    status: TripStatus,
    pin?: string,
  ) => Promise<void>;
  simulate: (tripId: string, status: TripStatus) => Promise<void>;
  rate: (tripId: string, rating: number) => Promise<void>;
  shareTrip: (tripId: string) => Promise<void>;
  loadMessages: (tripId: string) => Promise<ChatMessage[]>;
  sendMessage: (tripId: string, text: string) => Promise<void>;
  report: (
    category: string,
    detail: string,
    tripId?: string,
  ) => Promise<string>;
  submitDocument: (
    kind: DocumentKind,
    asset: {
      uri: string;
      fileName?: string | null;
      mimeType?: string | null;
      file?: File;
    },
  ) => Promise<void>;
};
const Context = createContext<ContextValue | null>(null);
const uuid = () => Crypto.randomUUID();
const demoProfile = (
  role: Role,
  name = role === "driver" ? "Patrick Mbuyi" : "Amina Ilunga",
  phone = "+243812345678",
  city: CityId = "lubumbashi",
): Profile => ({
  id: "demo-self",
  name,
  phone,
  role,
  city,
  verification: role === "driver" ? "demo" : "unverified",
  rating: 4.9,
  trips: 0,
  online: false,
  ...(role === "driver"
    ? {
        driver: {
          vehicle: "moto",
          model: "Haojue HJ125",
          plate: "LSH 2841 AB",
          helmet: true,
        } as const,
      }
    : {}),
});
const demoRequest = (city: CityId): Trip => {
  const places = PLACES.filter((p) => p.city === city);
  const pickup = places[0],
    destination = places[2] || places[1];
  const route = estimateRoute(pickup, destination);
  return {
    id: uuid(),
    riderId: "demo-amina",
    riderName: "Amina Ilunga",
    riderVerification: "unverified",
    pickup,
    destination,
    vehicle: "moto",
    proposedPrice: suggestedFare(route.distanceKm, "moto"),
    status: "searching",
    offers: [],
    route,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pickupPin: "4826",
    payment: "cash",
  };
};

export function AppProvider({
  children,
  appRole = "passenger",
}: {
  children: ReactNode;
  appRole?: Role;
}) {
  configureClient(appRole);
  const storageKey = LIVE
    ? `pepo-${appRole}-live-settings-v2`
    : `pepo-${appRole}-demo-v2`;
  const location = useLocation();
  const [state, setState] = useState<Snapshot>(initial);
  const ref = useRef(state);
  const [ready, setReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [testAuth, setTestAuth] = useState(
    process.env.EXPO_PUBLIC_DEV_AUTH === "true",
  );
  const saving = useRef(Promise.resolve());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const refreshing = useRef(false);
  const commit = useCallback((fn: (s: Snapshot) => Snapshot) => {
    const next = fn(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    setState(next);
  }, []);
  const putTrip = useCallback(
    (trip: Trip) =>
      commit((s) => ({
        ...s,
        trips: [trip, ...s.trips.filter((t) => t.id !== trip.id)],
      })),
    [commit],
  );
  const refresh = useCallback(async () => {
    if (!LIVE || !getToken() || refreshing.current) return;
    refreshing.current = true;
    const sessionToken = getToken();
    try {
      const profile = await api<Profile>("/me");
      if (profile.role !== appRole) {
        await saveToken("");
        commit((s) => ({ ...s, profile: null, trips: [], requests: [] }));
        return;
      }
      const [trips, requests] = await Promise.all([
        api<Trip[]>("/trips"),
        profile.role === "driver" &&
        profile.verification === "verified" &&
        profile.online
          ? api<Trip[]>("/requests")
          : Promise.resolve([]),
      ]);
      if (getToken() !== sessionToken) return;
      commit((s) => ({
        ...s,
        profile,
        trips,
        requests,
        settings: { ...s.settings, city: profile.city },
      }));
      setConnectionError(null);
    } catch (e) {
      if (getToken() !== sessionToken) return;
      if (e instanceof RequestError && e.status === 401) {
        await saveToken("");
        commit((s) => ({ ...s, profile: null, trips: [], requests: [] }));
      }
      setConnectionError((e as Error).message);
    } finally {
      refreshing.current = false;
    }
  }, [commit, appRole]);
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        let stored = await AsyncStorage.getItem(storageKey);
        if (!stored && appRole === "passenger")
          stored = await AsyncStorage.getItem(
            LIVE ? "pepo-live-settings-v1" : "pepo-demo-v1",
          );
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!LIVE && parsed.profile?.role !== appRole) {
            parsed.profile = null;
            parsed.trips = [];
            parsed.requests = [];
          }
          const settings = {
            ...initial.settings,
            ...(LIVE ? parsed : parsed.settings),
          };
          settings.language = safeLanguage(settings.language);
          if (disposed) return;
          commit(() =>
            LIVE
              ? { ...initial, settings }
              : { ...initial, ...parsed, settings },
          );
        }
        if (LIVE) {
          try {
            const meta = await (
              await fetch(`${API_URL}/health`, {
                signal: AbortSignal.timeout(8000),
              })
            ).json();
            if (!disposed) setTestAuth(Boolean(meta.devAuth));
          } catch {}
          await loadToken();
          await refresh();
        }
      } catch {
        if (!disposed) commit(() => initial);
      } finally {
        if (!disposed) setReady(true);
      }
    })();
    return () => {
      disposed = true;
      timers.current.forEach(clearTimeout);
    };
  }, [commit, refresh]);
  useEffect(() => {
    if (!ready) return;
    // The connected app caches preferences only. Identity documents, PINs and trip data stay off AsyncStorage.
    const value = JSON.stringify(LIVE ? state.settings : state);
    saving.current = saving.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(storageKey, value));
  }, [state, ready]);
  useEffect(() => {
    if (!LIVE || !state.profile) return;
    const socket = io(API_URL, {
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
    });
    let queued: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      if (AppState.currentState !== "active") return;
      clearTimeout(queued);
      queued = setTimeout(() => void refresh(), 120);
    };
    socket.on("refresh", invalidate);
    socket.on("connect", invalidate);
    const timer = setInterval(() => {
      if (AppState.currentState === "active" && !socket.connected)
        void refresh();
    }, 15000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        socket.connect();
        void refresh();
      } else {
        clearTimeout(queued);
        socket.disconnect();
      }
    });
    return () => {
      socket.disconnect();
      clearTimeout(queued);
      clearInterval(timer);
      sub.remove();
    };
  }, [state.profile?.id, refresh]);
  const activeTrip = state.trips.find(isActive);
  useEffect(() => {
    if (LIVE || !state.profile) return;
    const timer = setInterval(() => {
      commit((s) => {
        const released = releaseScheduled(s.trips, Date.now());
        if (released.length)
          s = {
            ...s,
            trips: s.trips.map((t) => released.find((r) => r.id === t.id) || t),
          };
        const waiting =
          (s.profile?.role === "passenger" &&
            s.trips.some((t) => t.status === "searching")) ||
          (s.profile?.role === "driver" &&
            s.requests.some((t) => t.offers.length));
        if (!waiting) return s;
        let changed = false;
        const copy: Snapshot = JSON.parse(JSON.stringify(s));
        const trip = copy.trips.find((t) => t.status === "searching");
        if (trip && copy.profile?.role === "passenger") {
          const next = DEMO_DRIVERS[trip.offers.length];
          if (
            next &&
            Date.now() - (trip.dispatchStartedAt || trip.createdAt) >
              (trip.offers.length + 1) * 1500
          ) {
            const driver = {
              ...next,
              driver: {
                ...next.driver,
                vehicle: trip.vehicle,
                ...([
                  "taxi",
                  "suv",
                  "fourByFour",
                  "minibus",
                  "tricycle",
                  "truck",
                  "pickupTruck",
                ].includes(trip.vehicle)
                  ? {
                      model:
                        trip.vehicle === "taxi"
                          ? "Toyota Corolla"
                          : trip.vehicle === "suv"
                            ? "Toyota RAV4"
                            : trip.vehicle === "truck"
                              ? "Camion"
                              : trip.vehicle === "pickupTruck"
                                ? "Pick-up"
                                : trip.vehicle === "tricycle"
                                  ? "Tricycle"
                                  : trip.vehicle === "minibus"
                                    ? "Minibus"
                                    : "Toyota Land Cruiser",
                      helmet: false,
                    }
                  : {}),
              },
            };
            trip.offers.push({
              id: uuid(),
              tripId: trip.id,
              driver,
              price: trip.proposedPrice + (trip.offers.length === 0 ? 500 : 0),
              eta: 2 + trip.offers.length,
              status: "pending",
              createdAt: Date.now(),
              expiresAt: Date.now() + 120000,
            });
            changed = true;
          }
          for (const o of trip.offers)
            if (o.status === "countered" && Date.now() - o.createdAt > 2500) {
              o.price = o.riderCounter!;
              delete o.riderCounter;
              o.status = "pending";
              o.expiresAt = Date.now() + 120000;
              changed = true;
            }
        }
        const request = copy.requests.find(
          (t) =>
            t.status === "searching" &&
            t.offers.length &&
            Date.now() - t.offers[0].createdAt > 2500,
        );
        if (request && copy.profile?.role === "driver") {
          changed = true;
          const o = request.offers[0];
          request.driverId = copy.profile.id;
          request.driver = o.driver;
          request.agreedPrice = o.price;
          request.status = "accepted";
          request.updatedAt = Date.now();
          copy.trips = [
            request,
            ...copy.trips.filter((t) => t.id !== request.id),
          ];
          copy.requests = copy.requests.filter((t) => t.id !== request.id);
        }
        return changed ? copy : s;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [state.profile?.id, state.profile?.role, commit]);
  const locationSent = useRef({ timestamp: 0, trip: "" });
  useEffect(() => {
    const fix = location.fix;
    if (
      !LIVE ||
      state.profile?.role !== "driver" ||
      !activeTrip ||
      !["accepted", "arrived", "in_progress"].includes(activeTrip.status) ||
      !fix ||
      location.stale ||
      AppState.currentState !== "active"
    )
      return;
    if (
      locationSent.current.trip === activeTrip.id &&
      fix.timestamp - locationSent.current.timestamp < 5000
    )
      return;
    locationSent.current = { timestamp: fix.timestamp, trip: activeTrip.id };
    void api(`/trips/${activeTrip.id}/location`, {
      method: "POST",
      body: { latitude: fix.latitude, longitude: fix.longitude },
    }).catch(() => {
      locationSent.current.timestamp = 0;
    });
  }, [
    location.fix?.timestamp,
    location.stale,
    activeTrip?.id,
    activeTrip?.status,
    state.profile?.role,
  ]);

  const profileRequired = () => {
    const p = ref.current.profile;
    if (!p) throw new Error("Reconnectez-vous pour continuer.");
    return p;
  };
  const tripRequired = (id: string) => {
    const t = ref.current.trips.find((t) => t.id === id);
    if (!t) throw new Error("Course introuvable.");
    return JSON.parse(JSON.stringify(t)) as Trip;
  };
  const applyStatus = async (
    tripId: string,
    status: TripStatus,
    pin?: string,
    simulation = false,
  ) => {
    if (LIVE) {
      putTrip(
        await api<Trip>(`/trips/${tripId}/status`, {
          method: "POST",
          body: { status, pin },
        }),
      );
      return;
    }
    const t = tripRequired(tripId);
    const p = profileRequired();
    const actor = simulation
      ? { ...p, id: t.driverId!, role: "driver" as const }
      : p;
    assertTransition(t, status, actor, pin);
    t.status = status;
    if (status === "in_progress") t.startedAt = Date.now();
    t.updatedAt = Date.now();
    if (status === "arrived") t.driverLocation = t.pickup;
    if (status === "in_progress")
      t.driverLocation = t.route.points[Math.floor(t.route.points.length / 2)];
    if (status === "completed") t.driverLocation = t.destination;
    if (status === "completed") t.completedAt = Date.now();
    putTrip(t);
    if (status === "completed")
      commit((s) => ({
        ...s,
        profile: { ...s.profile!, trips: s.profile!.trips + 1 },
      }));
  };
  const value: ContextValue = {
    ...state,
    ready,
    demo: !LIVE,
    testAuth,
    connectionError,
    activeTrip,
    refresh,
    t: (key) => translate(state.settings.language, key),
    requestOtp: async (phone) => {
      if (!LIVE) return "2468";
      return (
        await api<{ devCode?: string }>("/auth/request", {
          method: "POST",
          body: { phone },
        })
      ).devCode;
    },
    signIn: async (input) => {
      if (!LIVE) {
        if (input.code !== "2468")
          throw new Error("Pour la démo, utilisez le code 2468.");
        const p = demoProfile(appRole, input.name, input.phone, input.city);
        commit((s) => ({
          ...s,
          profile: p,
          trips: [],
          messages: [],
          requests: input.role === "driver" ? [demoRequest(input.city)] : [],
          settings: { ...s.settings, city: input.city },
        }));
      } else {
        const result = await api<{ token: string; profile: Profile }>(
          "/auth/verify",
          { method: "POST", body: { ...input, role: appRole } },
        );
        await saveToken(result.token);
        commit((s) => ({
          ...s,
          profile: result.profile,
          settings: { ...s.settings, city: result.profile.city },
        }));
        await refresh();
      }
    },
    enterDemo: async (_role = appRole) => {
      const role = appRole;
      if (LIVE)
        throw new Error(
          "Cette installation est connectée au serveur. Utilisez votre numéro.",
        );
      const p = demoProfile(role);
      commit((s) => ({
        ...s,
        profile: p,
        trips: [],
        messages: [],
        requests: role === "driver" ? [demoRequest(p.city)] : [],
      }));
    },
    signOut: async () => {
      if (
        ref.current.trips.some(
          (t) => isActive(t) || (!LIVE && t.status === "scheduled"),
        )
      )
        throw new Error(
          "Terminez ou annulez votre course avant de vous déconnecter.",
        );
      if (LIVE) {
        await api("/logout", { method: "POST" });
        await saveToken("");
      }
      timers.current.forEach(clearTimeout);
      commit((s) => ({ ...initial, settings: s.settings }));
    },
    updateProfile: async (patch) => {
      if (patch.role && patch.role !== appRole)
        throw new Error("Utilisez l’application Pepo Driver pour conduire.");
      if (
        (patch.role || patch.city || patch.driver) &&
        ref.current.trips.some((t) => isActive(t) || t.status === "scheduled")
      )
        throw new Error(
          "Terminez ou annulez votre course avant de changer ces informations.",
        );
      if (LIVE) {
        const p = await api<Profile>("/me", { method: "PATCH", body: patch });
        commit((s) => ({
          ...s,
          profile: p,
          settings: { ...s.settings, city: p.city },
        }));
        await refresh();
      } else {
        const p = { ...profileRequired(), ...patch };
        if (patch.role === "driver" && !p.driver) {
          p.driver = demoProfile("driver").driver;
          p.verification = "demo";
        }
        commit((s) => ({
          ...s,
          profile: p,
          requests: p.role === "driver" ? [demoRequest(p.city)] : [],
          settings: { ...s.settings, city: p.city },
        }));
      }
    },
    setLanguage: (language) =>
      commit((s) => ({ ...s, settings: { ...s.settings, language } })),
    setOnline: async (online) => {
      const p = profileRequired();
      if (online && !canDrive(p))
        throw new Error(
          "Ajoutez vos documents et attendez l’approbation de votre dossier.",
        );
      if (LIVE) {
        const profile = await api<Profile>("/me/online", {
          method: "POST",
          body: { online },
        });
        commit((s) => ({ ...s, profile }));
        await refresh();
      } else
        commit((s) => ({
          ...s,
          profile: { ...s.profile!, online },
          requests: s.requests.length ? s.requests : [demoRequest(p.city)],
        }));
    },
    search: async (query) => {
      const city = ref.current.settings.city;
      if (LIVE && query.trim().length >= 2)
        return api<Place[]>(
          `/places?q=${encodeURIComponent(query.trim())}&city=${city}`,
        );
      if (MAPS_API_URL && query.trim().length >= 2)
        return searchMapPlaces(query.trim(), city);
      return PLACES.filter(
        (p) =>
          p.city === city &&
          `${p.name} ${p.address}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      );
    },
    getRoute: async (pickup, destination, stops = [], optimizeStops = false) =>
      LIVE
        ? api<Route>("/routes", {
            method: "POST",
            body: { pickup, destination, stops, optimizeStops },
          })
        : MAPS_API_URL
          ? mapRoute(pickup, destination, stops, optimizeStops)
          : {
              ...estimateRouteWithStops(
                pickup,
                destination,
                optimizeStops
                  ? estimatedStopOrder(pickup, destination, stops)
                  : stops,
              ),
              orderedStops: optimizeStops
                ? estimatedStopOrder(pickup, destination, stops)
                : [...stops],
              stopOrderSource:
                optimizeStops && stops.length > 1 ? "estimate" : "manual",
              calculatedAt: Date.now(),
              timeZone:
                pickup.city === "kinshasa"
                  ? "Africa/Kinshasa"
                  : "Africa/Lubumbashi",
            },
    createTrip: async (input) => {
      validateNewTrip(input);
      const p = profileRequired();
      if (!input.scheduledAt && ref.current.trips.some(isActive))
        throw new Error("Vous avez déjà une course active.");
      if (LIVE) {
        const t = await api<Trip>("/trips", { method: "POST", body: input });
        putTrip(t);
        return t;
      }
      const future = ref.current.trips.filter((t) => t.status === "scheduled");
      if (
        input.scheduledAt &&
        (future.length >= 10 ||
          future.some(
            (t) => Math.abs(t.scheduledAt! - input.scheduledAt!) < 3600000,
          ))
      )
        throw new Error(
          "Gardez une heure entre deux départs programmés, avec au maximum 10 réservations à venir.",
        );
      const t: Trip = {
        ...input,
        id: uuid(),
        riderId: p.id,
        riderName: p.name,
        riderVerification: input.guest ? "unverified" : p.verification,
        ...(input.guest
          ? { riderPhone: input.guest.phone, riderPhoneVerified: false }
          : {}),
        status: input.scheduledAt ? "scheduled" : "searching",
        offers: [],
        pickupPin: String(Math.floor(1000 + Math.random() * 9000)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        payment: "cash",
      };
      putTrip(t);
      return t;
    },
    cancelTrip: (id) => applyStatus(id, "cancelled"),
    rescheduleTrip: async (id, scheduledAt) => {
      if (LIVE) {
        putTrip(
          await api<Trip>(`/trips/${id}/schedule`, {
            method: "PATCH",
            body: { scheduledAt },
          }),
        );
        return;
      }
      const trip = tripRequired(id);
      if (trip.riderId !== profileRequired().id || trip.status !== "scheduled")
        throw new Error("Cette réservation n’est plus modifiable.");
      validateNewTrip({ ...trip, scheduledAt });
      if (
        ref.current.trips.some(
          (t) =>
            t.id !== id &&
            t.status === "scheduled" &&
            Math.abs(t.scheduledAt! - scheduledAt) < 3600000,
        )
      )
        throw new Error("Gardez une heure entre deux départs programmés.");
      putTrip({ ...trip, scheduledAt, updatedAt: Date.now() });
    },
    acceptOffer: async (tripId, offerId) => {
      if (LIVE) {
        putTrip(
          await api<Trip>(`/trips/${tripId}/accept`, {
            method: "POST",
            body: { offerId },
          }),
        );
        return;
      }
      const t = tripRequired(tripId);
      assertTransition(t, "accepted", profileRequired());
      const o = t.offers.find((o) => o.id === offerId);
      if (!o || o.expiresAt < Date.now() || o.status !== "pending")
        throw new Error("Cette offre a expiré.");
      t.driver = o.driver;
      t.driverId = o.driver.id;
      t.agreedPrice = o.price;
      t.status = "accepted";
      t.updatedAt = Date.now();
      t.driverLocation = {
        latitude: t.pickup.latitude + 0.003,
        longitude: t.pickup.longitude - 0.002,
      };
      t.offers = t.offers.map((v) => ({
        ...v,
        status: v.id === offerId ? "accepted" : "rejected",
      }));
      putTrip(t);
    },
    counterOffer: async (tripId, offerId, price) => {
      if (price < 500 || price > 500000) throw new Error("Prix invalide.");
      if (LIVE) {
        putTrip(
          await api<Trip>(`/trips/${tripId}/offers/${offerId}/counter`, {
            method: "POST",
            body: { price },
          }),
        );
        return;
      }
      const t = tripRequired(tripId);
      const o = t.offers.find((o) => o.id === offerId)!;
      o.riderCounter = price;
      o.status = "countered";
      o.createdAt = Date.now();
      putTrip(t);
    },
    submitOffer: async (tripId, price) => {
      if (LIVE) {
        await api(`/trips/${tripId}/offers`, {
          method: "POST",
          body: { price, eta: 3 },
        });
        await refresh();
        return;
      }
      const p = profileRequired();
      if (!p.online || !canDrive(p))
        throw new Error("Passez en ligne pour répondre.");
      commit((s) => ({
        ...s,
        requests: s.requests.map((t) =>
          t.id !== tripId
            ? t
            : {
                ...t,
                offers: [
                  {
                    id: uuid(),
                    tripId,
                    driver: {
                      id: p.id,
                      name: p.name,
                      rating: p.rating,
                      trips: p.trips,
                      verification: p.verification,
                      driver: p.driver!,
                    },
                    price,
                    eta: 3,
                    status: "pending",
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 120000,
                  },
                ],
              },
        ),
      }));
    },
    acceptCounter: async (tripId, offerId) => {
      if (LIVE) {
        await api(`/trips/${tripId}/offers/${offerId}/accept-counter`, {
          method: "POST",
        });
        await refresh();
      }
    },
    transition: (tripId, status, pin) => applyStatus(tripId, status, pin),
    simulate: async (tripId, status) => {
      if (LIVE) throw new Error("Cette action est réservée à la démo.");
      const t = tripRequired(tripId);
      await applyStatus(tripId, status, t.pickupPin, true);
    },
    rate: async (tripId, rating) => {
      if (LIVE) {
        putTrip(
          await api<Trip>(`/trips/${tripId}/rating`, {
            method: "POST",
            body: { rating },
          }),
        );
        return;
      }
      const t = tripRequired(tripId);
      if (t.status !== "completed" || t.rating)
        throw new Error("Cette course ne peut plus être notée.");
      t.rating = rating;
      putTrip(t);
    },
    shareTrip: async (tripId) => {
      const t = tripRequired(tripId);
      if (LIVE) {
        const { url } = await api<{ url: string }>(`/trips/${tripId}/share`, {
          method: "POST",
        });
        await Share.share({
          message: `Mon trajet Pepo : ${t.pickup.name} → ${t.destination.name}. Suivi : ${url}`,
          url,
        });
      } else
        await Share.share({
          message: `[DÉMO PEPO — aucun suivi réel] ${t.pickup.name} → ${t.destination.name}. Conducteur fictif : ${t.driver?.name}, ${t.driver?.driver.plate}. Prix : ${fare(t.agreedPrice || t.proposedPrice)}.`,
        });
    },
    loadMessages: async (tripId) => {
      if (LIVE) return api<ChatMessage[]>(`/trips/${tripId}/messages`);
      return ref.current.messages.filter((m) => m.tripId === tripId);
    },
    sendMessage: async (tripId, text) => {
      if (LIVE) {
        await api(`/trips/${tripId}/messages`, {
          method: "POST",
          body: { text },
        });
        return;
      }
      const p = profileRequired();
      const t = tripRequired(tripId);
      const msg = {
        id: uuid(),
        tripId,
        text,
        senderId: p.id,
        createdAt: Date.now(),
      };
      commit((s) => ({ ...s, messages: [...s.messages, msg] }));
      const timer = setTimeout(
        () =>
          commit((s) => ({
            ...s,
            messages: [
              ...s.messages,
              {
                id: uuid(),
                tripId,
                text:
                  p.role === "passenger"
                    ? "Bonjour ! Je suis près du point de départ. À tout de suite. (Démo)"
                    : "Merci, je vous attends au point de départ. (Démo)",
                senderId: p.role === "passenger" ? t.driverId! : t.riderId,
                createdAt: Date.now(),
              },
            ],
          })),
        1600,
      );
      timers.current.push(timer);
    },
    report: async (category, detail, tripId) => {
      if (LIVE)
        return (
          await api<{ id: string }>("/incidents", {
            method: "POST",
            body: { category, detail, tripId },
          })
        ).id;
      const incident = { id: uuid(), category, detail, createdAt: Date.now() };
      commit((s) => ({ ...s, incidents: [...s.incidents, incident] }));
      return incident.id;
    },
    submitDocument: async (kind, asset) => {
      if (LIVE) {
        const form = new FormData();
        if (Platform.OS === "web")
          form.append(
            "document",
            asset.file || (await (await fetch(asset.uri)).blob()),
            asset.fileName || `${kind}.jpg`,
          );
        else
          form.append("document", {
            uri: asset.uri,
            name: asset.fileName || `${kind}.jpg`,
            type: asset.mimeType || "image/jpeg",
          } as unknown as Blob);
        const profile = await api<Profile>(`/me/documents/${kind}`, {
          method: "POST",
          form,
        });
        commit((s) => ({ ...s, profile }));
      } else
        commit((s) => ({
          ...s,
          profile: {
            ...s.profile!,
            ...(["identity", "selfie"].includes(kind)
              ? { identityVerification: "pending" as const }
              : {}),
            documents: {
              ...s.profile!.documents,
              [kind]: {
                name: asset.fileName || kind + ".jpg",
                submittedAt: Date.now(),
              },
            },
          },
        }));
    },
  };
  return (
    <Context.Provider value={value}>
      <I18nProvider language={state.settings.language}>{children}</I18nProvider>
    </Context.Provider>
  );
}
export function useApp() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Pepo context missing");
  return ctx;
}
