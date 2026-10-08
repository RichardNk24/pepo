import { C } from "@pepo/config/tokens";
import { formatDate } from "@pepo/i18n/locale";
import { demoFleet } from "@pepo/maps/demoFleet";
import MapBoard from "@pepo/maps/MapBoard";
import { VehicleArt } from "@pepo/maps/VehicleArt";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import type {
  ActiveVehicleKind,
  Offer,
  Place,
  Route,
  VehicleKind,
} from "@pepo/types/model";
import {
  Avatar,
  Button,
  Divider,
  Field,
  IconButton,
  s,
  Tag,
  Txt,
  useUI,
} from "@pepo/ui/UI";
import { PLACES, VEHICLES } from "@pepo/utils/cities";
import { arrivalLabel } from "@pepo/utils/mapGeometry";
import { estimateRoute, fare, suggestedFare } from "@pepo/utils/rules";
import { scheduledLabel } from "@pepo/utils/scheduling";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarClock,
  Check,
  HardHat as Helmet,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  UserRound,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LocationControls } from "../src/components/LocationControls";
import { PlaceSearch } from "../src/components/PlaceSearch";
import { RouteSummary } from "../src/components/RouteSummary";
import { SchedulePicker } from "../src/components/SchedulePicker";
import { SnapSheet } from "../src/components/SnapSheet";
import { VehicleOptions } from "../src/components/VehicleOptions";
import { sheetGeometry, vehicleOptionsDensity } from "../src/domain/rideLayout";
function fromParam(
  value: string | string[] | undefined,
  fallback: Place,
): Place {
  try {
    const p = JSON.parse(String(value));
    return p &&
      typeof p.latitude === "number" &&
      typeof p.longitude === "number" &&
      typeof p.name === "string"
      ? p
      : fallback;
  } catch {
    return fallback;
  }
}
export default function Ride() {
  const mapInsets = useSafeAreaInsets();
  const app = useApp(),
    router = useRouter(),
    ui = useUI(),
    params = useLocalSearchParams<{
      id?: string;
      pickup?: string;
      destination?: string;
      vehicle?: string;
      schedule?: string;
    }>();
  const location = useLocation();
  const [sheetHeight, setSheetHeight] = useState(340);
  const [sheetSnapIndex, setSheetSnapIndex] = useState(2);
  const sheetInteraction = useRef(false);
  const [viewportHeight, setViewportHeight] = useState(700);
  const [headerHeight, setHeaderHeight] = useState(48);
  const [sheetMoving, setSheetMoving] = useState(false);
  const [footerHeight, setFooterHeight] = useState(120);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [stopsOpen, setStopsOpen] = useState(false);
  const [stops, setStops] = useState<Place[]>([]);
  const [optimizeStops, setOptimizeStops] = useState(true);
  const [scheduledAt, setScheduledAt] = useState<number>();
  const [scheduleOpen, setScheduleOpen] = useState(params.schedule === "1");
  const [forGuest, setForGuest] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("+243");
  const [guestConfirmed, setGuestConfirmed] = useState(false);
  const cleanGuestPhone = guestPhone.replace(/[\s()-]/g, "");
  const guestValid =
    !forGuest ||
    (guestConfirmed &&
      guestName.trim().length >= 2 &&
      /^\+[1-9]\d{7,14}$/.test(cleanGuestPhone));
  const [follow, setFollow] = useState(false),
    [recenter, setRecenter] = useState(0),
    [overview, setOverview] = useState(0),
    [routeRevision, setRouteRevision] = useState(0);
  const places = PLACES.filter((p) => p.city === app.settings.city);
  // Development-only map preview so local API sessions can verify vehicle
  // marker artwork before the live nearby-driver feed is implemented.
  const showMapDemoFleet =
    app.demo ||
    (__DEV__ && process.env.EXPO_PUBLIC_MAP_DEMO_FLEET === "true");
  const [pickup, setPickup] = useState(() =>
    fromParam(params.pickup, places[0]),
  );
  const [destination, setDestination] = useState(() =>
    fromParam(params.destination, places[2] || places[1]),
  );
  const [vehicle, setVehicle] = useState<ActiveVehicleKind>(
    VEHICLES.find((v) => v.id === params.vehicle)?.id || "moto",
  );
  const [route, setRoute] = useState<Route>(estimateRoute(pickup, destination));
  const [rawRouteBusy, setRouteBusy] = useState(true),
    [routeError, setRouteError] = useState("");
  const [resolvedRouteKey, setResolvedRouteKey] = useState("");
  const routeInputKey = JSON.stringify([
    pickup,
    destination,
    stops,
    optimizeStops,
  ]);
  const routeBusy =
    rawRouteBusy || (!routeError && resolvedRouteKey !== routeInputKey);
  const [price, setPrice] = useState(suggestedFare(route.distanceKm, vehicle));
  const [tripId, setTripId] = useState<string | undefined>(
    params.id || app.activeTrip?.id,
  );
  const [search, setSearch] = useState<
      "pickup" | "destination" | "stop" | null
    >(null),
    [counter, setCounter] = useState<Offer | null>(null),
    [counterPrice, setCounterPrice] = useState(5000),
    [rating, setRating] = useState(5),
    [now, setNow] = useState(Date.now());
  const trip = app.trips.find((t) => t.id === tripId) || app.activeTrip;
  const displayedStops = optimizeStops ? route.orderedStops || stops : stops;

  const terminal = trip && ["completed", "cancelled"].includes(trip.status);
  const choosing = !trip;
  const nearbyVehicles = useMemo(
    () =>
      showMapDemoFleet && (choosing || trip?.status === "searching")
        ? demoFleet(pickup, vehicle)
        : [],
    [
      showMapDemoFleet,
      choosing,
      trip?.status,
      pickup.latitude,
      pickup.longitude,
      vehicle,
    ],
  );
  useEffect(() => {
    if (!choosing) return;
    let disposed = false;
    setRouteBusy(true);
    setRouteError("");
    app
      .getRoute(pickup, destination, stops, optimizeStops)
      .then((r) => {
        if (!disposed) {
          setRoute(r);
          setResolvedRouteKey(routeInputKey);
        }
      })
      .catch((e) => {
        if (!disposed) setRouteError(e.message);
      })
      .finally(() => {
        if (!disposed) setRouteBusy(false);
      });
    return () => {
      disposed = true;
    };
  }, [
    pickup.id,
    destination.id,
    pickup.latitude,
    pickup.longitude,
    destination.latitude,
    destination.longitude,
    choosing,
    routeRevision,
    stops,
    optimizeStops,
    routeInputKey,
  ]);
  useEffect(() => {
    if (
      !choosing &&
      !["scheduled", "searching", "accepted", "arrived"].includes(
        trip?.status || "",
      )
    )
      return;
    const timer = setInterval(
      () => setNow(Date.now()),
      trip?.status === "searching" ? 1000 : 15000,
    );
    return () => clearInterval(timer);
  }, [trip?.status, choosing]);
  useEffect(() => {
    if (choosing) setPrice(suggestedFare(route.distanceKm, vehicle));
  }, [vehicle, route.distanceKm, choosing]);
  if (!app.ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.paper,
        }}
      >
        <ActivityIndicator color={C.ink} />
      </View>
    );
  if (!app.profile) return <Redirect href="/onboarding" />;
  const back = async () => {
    if (
      trip &&
      ["searching", "accepted", "arrived", "in_progress"].includes(trip.status)
    )
      router.replace("/(tabs)");
    else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };
  const cancel = async () => {
    if (
      trip &&
      (await ui.confirm(
        "Annuler la course ?",
        "Le conducteur et le passager seront informés de l’annulation.",
        true,
      ))
    ) {
      await app.cancelTrip(trip.id);
      router.replace("/(tabs)");
    }
  };
  const mapPickup = trip?.pickup || pickup,
    mapDest = trip?.destination || destination,
    mapRoute = trip?.route || route;
  const headerBottom = mapInsets.top + 15 + headerHeight;
  const sheetTop = headerBottom + 10;
  const sheetLayout = sheetGeometry(viewportHeight, footerHeight, sheetTop);
  const sheetExpanded = choosing && sheetHeight >= sheetLayout.maximum - 2;
  const showMapControls = !choosing || (!sheetMoving && !sheetExpanded);
  // Keep the renderer size fixed while the sheet moves; adjust the camera only at rest.
  const mapBottom = choosing ? sheetLayout.collapsed + footerHeight : 18;
  const cameraBottom = choosing
    ? Math.max(
        0,
        (sheetExpanded ? sheetLayout.snaps[1] : sheetHeight) -
          sheetLayout.collapsed,
      )
    : 0;
  const otherName = trip?.driver?.name;
  const call = async () => {
    if (app.demo) {
      ui.alert(
        "Appel en mode démo",
        "Ce profil est fictif. Aucun appel réel n’est lancé.",
      );
      return;
    }
    const phone = trip?.driver?.phone;
    if (!phone)
      throw new Error(
        "Le numéro sera disponible après confirmation de la course.",
      );
    await Linking.openURL("tel:" + phone);
  };
  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: C.paper }}
    >
      <KeyboardAvoidingView
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          style={[
            r.map,
            {
              flex: choosing
                ? 1
                : trip?.status === "searching"
                  ? 0.34
                  : terminal
                    ? 0.3
                    : 0.43,
            },
          ]}
        >
          <MapBoard
            nearbyVehicles={nearbyVehicles}
            pickup={mapPickup}
            destination={mapDest}
            route={choosing && (routeBusy || routeError) ? undefined : mapRoute}
            driver={trip?.driverLocation}
            driverVehicleKind={trip?.vehicle || vehicle}
            bottomInset={mapBottom}
            cameraTopInset={headerBottom + 24}
            cameraBottomInset={cameraBottom + 65}
            routeLabels={
              choosing &&
              !sheetExpanded &&
              !sheetMoving &&
              !routeBusy &&
              !routeError
            }
            stops={
              trip?.stops || (routeBusy || routeError ? [] : displayedStops)
            }
            vehicles={false}
            userPosition={location.fix}
            heading={location.heading}
            stale={location.stale}
            followUser={follow}
            recenterKey={recenter}
            overviewKey={overview}
            onPan={() => setFollow(false)}
          />
          <View
            onLayout={(event) =>
              setHeaderHeight(event.nativeEvent.layout.height)
            }
            style={[
              r.mapHeader,
              { top: mapInsets.top + 15, zIndex: 10, elevation: 6 },
              {
                backgroundColor: C.paper,
                borderRadius: 24,
                padding: 4,
                gap: 6,
              },
            ]}
          >
            <IconButton
              icon={X}
              label="Retour"
              onPress={() => void back()}
              style={{ width: 40, height: 40, borderRadius: 20 }}
            />
            <Pressable
              style={{ flex: 1 }}
              onPress={() => choosing && setSearch("pickup")}
              accessibilityLabel="Modifier le départ"
            >
              <Txt
                variant="small"
                numberOfLines={1}
                style={{ fontFamily: "DMSans_600SemiBold" }}
              >
                {mapPickup.name}
              </Txt>
            </Pressable>
            <ArrowRight size={18} color="#000000" />
            <Pressable
              style={{ flex: 1 }}
              onPress={() => choosing && setSearch("destination")}
              accessibilityLabel="Modifier la destination"
            >
              <Txt
                variant="small"
                color="#303000"
                numberOfLines={1}
                style={{ fontFamily: "DMSans_700Bold" }}
              >
                {mapDest.name}
              </Txt>
            </Pressable>
            {choosing && (
              <IconButton
                icon={Plus}
                style={{ width: 40, height: 40, borderRadius: 20 }}
                label="Ajouter ou modifier les étapes"
                onPress={() => setStopsOpen(true)}
              />
            )}
          </View>
          {showMapControls && (
            <LocationControls
              compass={false}
              bottom={choosing ? sheetHeight + footerHeight + 12 : 85}
              onLocate={() => {
                setFollow(true);
                setRecenter((n) => n + 1);
              }}
            />
          )}
          {showMapControls && (
            <IconButton
              icon={RotateCcw}
              label="Voir tout le trajet"
              style={{
                position: "absolute",
                left: 20,
                bottom: choosing ? sheetHeight + footerHeight + 12 : 85,
              }}
              onPress={() => {
                setFollow(false);
                setOverview((n) => n + 1);
              }}
            />
          )}
        </Animated.View>
        <SnapSheet
          enabled={choosing}
          bottom={footerHeight}
          topInset={sheetTop}
          containerHeight={viewportHeight}
          onMoving={(moving) => {
            setSheetMoving(moving);
            if (moving) sheetInteraction.current = true;
            else sheetInteraction.current = false;
          }}
          onHeight={(height) => {
            setSheetHeight(height);
            if (!sheetInteraction.current) return;
            const nextIndex = sheetLayout.snaps.reduce(
              (best, snap, index) =>
                Math.abs(snap - height) <
                Math.abs(sheetLayout.snaps[best] - height)
                  ? index
                  : best,
              0,
            );
            setSheetSnapIndex(nextIndex);
          }}
          style={r.sheet}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {trip?.guest && (
            <View
              style={{
                padding: 12,
                marginBottom: 12,
                borderRadius: 12,
                backgroundColor: C.yellowSoft,
                gap: 4,
              }}
            >
              <Txt variant="label">Course pour {trip.guest.name}</Txt>
              <Txt variant="small">
                {
                  "Transmettez le code de départ au passager. Aucun SMS automatique n’est envoyé."
                }
              </Txt>
            </View>
          )}
          {choosing ? (
            <>
              {routeBusy && <ActivityIndicator color={C.ink} />}
              <VehicleOptions
                value={vehicle}
                onChange={setVehicle}
                distanceKm={route.distanceKm}
                priceReady={!routeBusy && !routeError}
                density={vehicleOptionsDensity(sheetSnapIndex)}
              />
              {routeError && (
                <View style={{ gap: 10, marginVertical: 12 }}>
                  <Txt color={C.red}>{routeError}</Txt>
                  <Button
                    title="Recalculer le trajet"
                    compact
                    kind="secondary"
                    onPress={() => setRouteRevision((n) => n + 1)}
                  />
                </View>
              )}
            </>
          ) : trip.status === "scheduled" ? (
            <View style={{ gap: 18 }}>
              <View style={[s.row, { gap: 12 }]}>
                <CalendarClock size={30} color={C.ink} />
                <Tag tone="yellow">Départ programmé</Tag>
              </View>
              <Txt variant="h2">
                {scheduledLabel(trip.scheduledAt!, trip.pickup.city)}
              </Txt>
              <RouteSummary
                pickup={trip.pickup}
                destination={trip.destination}
                stops={trip.stops}
              />
              <View style={[s.rowBetween, s.card]}>
                <VehicleArt kind={trip.vehicle} width={84} />
                <View>
                  <Txt variant="label">
                    {VEHICLES.find((v) => v.id === trip.vehicle)?.name}
                  </Txt>
                  <Txt variant="h3">{fare(trip.proposedPrice)}</Txt>
                  <Txt variant="small" color={C.muted}>
                    Votre offre · à confirmer
                  </Txt>
                </View>
              </View>
              <Txt>
                La recherche commence 15 minutes avant le départ. Rouvrez Pepo
                pour choisir votre conducteur et confirmer le prix.
              </Txt>
              <Txt variant="small" color={C.muted}>
                Aucun conducteur n’est encore confirmé.
                {app.demo
                  ? " En démo, la recherche se lance uniquement lorsque Pepo est ouvert."
                  : " Aucun rappel par notification n’est envoyé dans cette version."}
              </Txt>
              <Button
                title="Voir mes courses programmées"
                onPress={() => router.replace("/(tabs)/activity")}
              />
              <Button
                title="Modifier l’heure"
                kind="secondary"
                onPress={() => setScheduleOpen(true)}
              />
              <Button
                title="Annuler la réservation"
                kind="secondary"
                onPress={cancel}
              />
            </View>
          ) : trip.status === "searching" ? (
            <>
              <View style={s.rowBetween}>
                <Txt variant="h2" style={{ flex: 1 }}>
                  {app.t("drivers")}
                </Txt>
                <Tag tone="yellow">{fare(trip.proposedPrice)}</Tag>
              </View>
              <Txt
                variant="small"
                color={C.muted}
                style={{ marginVertical: 8 }}
              >
                {trip.pickup.name} → {trip.destination.name}
              </Txt>
              {!trip.offers.length && (
                <View
                  style={{ paddingVertical: 30, alignItems: "center", gap: 14 }}
                >
                  <View style={r.searchCircle}>
                    <VehicleArt top kind={trip.vehicle} width={34} />
                  </View>
                  <Txt variant="h3">{app.t("searching")}</Txt>
                  <Txt
                    variant="small"
                    color={C.muted}
                    style={{ textAlign: "center" }}
                  >
                    {app.t("searchingDetail")}
                  </Txt>
                  <ActivityIndicator color={C.ink} />
                </View>
              )}
              {trip.offers.map((o) => (
                <View
                  key={o.id}
                  style={[s.card, { marginTop: 12, padding: 16, gap: 12 }]}
                >
                  <View style={s.row}>
                    <Avatar
                      name={o.driver.name}
                      imagePath={o.driver.avatarPath}
                      verified={o.driver.verification === "verified"}
                    />
                    <View style={{ flex: 1 }}>
                      <Txt variant="h3" style={{ fontSize: 17 }}>
                        {o.driver.name}
                      </Txt>
                      <View style={[s.row, { gap: 5, marginTop: 3 }]}>
                        <Star size={12} color={C.ink} fill={C.yellow} />
                        <Txt variant="small">
                          {o.driver.rating || "Nouveau"} · {o.eta} min
                        </Txt>
                        <Tag
                          tone={
                            o.driver.verification === "demo"
                              ? "yellow"
                              : "green"
                          }
                        >
                          {o.driver.verification === "demo"
                            ? "Démo"
                            : "Approuvé"}
                        </Tag>
                      </View>
                    </View>
                    <Txt variant="h3">{fare(o.price)}</Txt>
                  </View>
                  <Txt variant="small" color={C.muted}>
                    {o.driver.driver.model} · {o.driver.driver.plate}
                  </Txt>
                  {o.status === "countered" ? (
                    <Tag tone="yellow">
                      Votre prix : {fare(o.riderCounter!)} · en attente
                    </Tag>
                  ) : (
                    <View style={s.row}>
                      <Button
                        compact
                        style={{ flex: 1 }}
                        title={
                          o.expiresAt < now ? "Offre expirée" : app.t("accept")
                        }
                        disabled={o.expiresAt < now}
                        onPress={() => app.acceptOffer(trip.id, o.id)}
                      />
                      <Button
                        compact
                        style={{ flex: 1 }}
                        title="Négocier"
                        kind="secondary"
                        disabled={o.expiresAt < now}
                        onPress={() => {
                          setCounter(o);
                          setCounterPrice(Math.max(500, o.price - 500));
                        }}
                      />
                    </View>
                  )}
                </View>
              ))}
              <Button
                title={app.t("cancel")}
                kind="secondary"
                style={{ marginTop: 18 }}
                onPress={cancel}
              />
            </>
          ) : terminal ? (
            <>
              <View style={{ alignItems: "center", paddingTop: 8, gap: 12 }}>
                <View
                  style={[
                    r.searchCircle,
                    {
                      backgroundColor:
                        trip.status === "completed"
                          ? C.greenSoft
                          : C.background,
                    },
                  ]}
                >
                  {trip.status === "completed" ? (
                    <Check size={30} color={C.green} />
                  ) : (
                    <X size={30} color={C.muted} />
                  )}
                </View>
                <Txt variant="h1" style={{ fontSize: 31 }}>
                  {trip.status === "completed"
                    ? app.t("tripEnded")
                    : "Course annulée"}
                </Txt>
                <Txt variant="small" color={C.muted}>
                  #{trip.id.slice(0, 8).toUpperCase()} ·{" "}
                  {formatDate(trip.createdAt, app.settings.language)}
                </Txt>
              </View>
              <View style={{ marginTop: 22 }}>
                <RouteSummary
                  pickup={trip.pickup}
                  destination={trip.destination}
                  stops={trip.stops}
                />
              </View>
              <Divider />
              <View style={s.rowBetween}>
                <View>
                  <Txt variant="small" color={C.muted}>
                    Montant convenu
                  </Txt>
                  <Txt variant="h2">
                    {fare(trip.agreedPrice || trip.proposedPrice)}
                  </Txt>
                </View>
                <Tag icon={Banknote}>{app.t("cash")}</Tag>
              </View>
              {trip.status === "completed" && !trip.rating && (
                <View style={{ marginTop: 25, gap: 16 }}>
                  <Txt variant="h3" style={{ textAlign: "center" }}>
                    {app.t("rating")}
                  </Txt>
                  <View style={[s.row, { justifyContent: "center", gap: 15 }]}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${n} étoiles`}
                        key={n}
                        onPress={() => setRating(n)}
                      >
                        <Star
                          size={32}
                          color={n <= rating ? C.yellow : "#CBD1C6"}
                          fill={n <= rating ? C.yellow : "transparent"}
                        />
                      </Pressable>
                    ))}
                  </View>
                  <Button
                    title={app.t("rate")}
                    onPress={() => app.rate(trip.id, rating)}
                  />
                </View>
              )}
              {!!trip.rating && (
                <Tag tone="green">Votre avis : {trip.rating} / 5 · Merci !</Tag>
              )}
              <Button
                title="Retour à l’accueil"
                kind="secondary"
                style={{ marginTop: 20 }}
                onPress={() => router.replace("/(tabs)")}
              />
            </>
          ) : (
            <>
              {trip.status === "in_progress" && (
                <View style={{ marginBottom: 14, gap: 4 }}>
                  <Txt variant="h3">
                    Arrivée estimée :{" "}
                    {arrivalLabel(trip.route, trip.startedAt || trip.updatedAt)}
                  </Txt>
                  <Txt variant="small" color={C.muted}>
                    La durée dépend de la circulation et des arrêts.
                  </Txt>
                </View>
              )}
              <View style={s.rowBetween}>
                <Txt variant="h2" style={{ flex: 1 }}>
                  {app.t(
                    trip.status === "accepted"
                      ? "coming"
                      : trip.status === "arrived"
                        ? "arrived"
                        : "onTrip",
                  )}
                </Txt>
                <Tag tone="green" icon={ShieldCheck}>
                  Pepo
                </Tag>
              </View>
              <View style={[s.row, { marginTop: 18 }]}>
                <Avatar
                  name={otherName || "Pepo"}
                  imagePath={trip.driver?.avatarPath}
                  size={59}
                  verified={trip.driver?.verification === "verified"}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="h3">{otherName}</Txt>
                  <Txt variant="small" color={C.muted}>
                    {`${trip.driver?.driver.model} · ★ ${trip.driver?.rating || "Nouveau"}`}
                  </Txt>
                  {
                    <View style={s.row}>
                      <Tag>{trip.driver?.driver.plate}</Tag>
                      <Tag tone={app.demo ? "yellow" : "green"}>
                        {app.demo ? "Profil démo" : "Identité approuvée"}
                      </Tag>
                    </View>
                  }
                </View>
              </View>
              <View style={[s.row, { marginTop: 18 }]}>
                <Button
                  compact
                  kind="secondary"
                  icon={MessageCircle}
                  title={app.t("message")}
                  style={{ flex: 1 }}
                  onPress={() =>
                    router.push({
                      pathname: "/messages",
                      params: { id: trip.id },
                    })
                  }
                />
                <Button
                  compact
                  kind="secondary"
                  icon={Phone}
                  title={app.t("call")}
                  style={{ flex: 1 }}
                  onPress={call}
                />
              </View>
              {trip.status !== "in_progress" && (
                <View style={r.pinCard}>
                  <View style={s.rowBetween}>
                    <Txt variant="label">{app.t("pin")}</Txt>
                    <ShieldCheck size={19} color={C.green} />
                  </View>
                  <View style={[s.row, { gap: 8, marginVertical: 12 }]}>
                    {trip.pickupPin?.split("").map((n, i) => (
                      <View key={i} style={r.pinCell}>
                        <Txt variant="h2" style={{ fontSize: 30 }}>
                          {n}
                        </Txt>
                      </View>
                    ))}
                  </View>
                  <Txt variant="small" color={C.green}>
                    {app.t("pinDetail")}
                  </Txt>
                </View>
              )}
              {["moto", "comfort"].includes(trip.vehicle) && (
                <View style={[s.row, { marginTop: 15 }]}>
                  <Helmet size={18} color={C.green} />
                  <Txt variant="small" color={C.green}>
                    Vérifiez le casque avant de monter.
                  </Txt>
                </View>
              )}
              <Divider />
              <View style={s.rowBetween}>
                <View>
                  <Txt variant="small" color={C.muted}>
                    Prix convenu
                  </Txt>
                  <Txt variant="h2">{fare(trip.agreedPrice || 0)}</Txt>
                </View>
                <Tag icon={Banknote}>{app.t("cash")}</Tag>
              </View>

              <Button
                title={app.t("share")}
                icon={Share2}
                kind="secondary"
                style={{ marginTop: 18 }}
                onPress={() => app.shareTrip(trip.id)}
              />
              <Txt
                variant="small"
                color={C.muted}
                style={{ marginTop: 8, textAlign: "center" }}
              >
                {app.demo
                  ? "Le partage démo ne contient aucun suivi réel."
                  : "Suivi disponible quand l’application du conducteur est ouverte."}
              </Txt>
              {app.demo && (
                <View
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: C.yellowSoft,
                    gap: 8,
                  }}
                >
                  <Txt variant="micro">COMMANDES DE DÉMONSTRATION</Txt>
                  <Button
                    compact
                    kind="secondary"
                    title={
                      trip.status === "accepted"
                        ? "Simuler l’arrivée"
                        : trip.status === "arrived"
                          ? "Simuler le départ avec le code"
                          : "Simuler la fin du trajet"
                    }
                    onPress={() =>
                      app.simulate(
                        trip.id,
                        trip.status === "accepted"
                          ? "arrived"
                          : trip.status === "arrived"
                            ? "in_progress"
                            : "completed",
                      )
                    }
                  />
                </View>
              )}
              {trip.status !== "in_progress" && (
                <Button
                  title={app.t("cancel")}
                  kind="secondary"
                  style={{ marginTop: 12 }}
                  onPress={cancel}
                />
              )}
              <Button
                title={app.t("sos")}
                kind="secondary"
                icon={ShieldCheck}
                style={{ marginTop: 12 }}
                onPress={() => router.push("/help")}
              />
            </>
          )}
        </SnapSheet>
        {choosing && (
          <View
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 10,
              backgroundColor: C.paper,
              borderTopWidth: 1,
              borderTopColor: C.line,
            }}
          >
            <View style={[s.rowBetween, { marginBottom: 10 }]}>
              <Pressable
                accessibilityLabel="Options du passager et du prix"
                onPress={() => setOptionsOpen(true)}
                style={s.row}
              >
                <UserRound size={17} color={C.ink} />
                <Txt variant="small">
                  {forGuest ? guestName || "Autre passager" : "Pour moi"}
                </Txt>
                <SlidersHorizontal size={15} color={C.muted} />
              </Pressable>
              <Txt variant="small" color={C.muted}>
                {routeBusy
                  ? "Calcul…"
                  : `${route.durationMin} min · ${route.distanceKm} km`}
                {stops.length ? ` · ${stops.length} étape(s)` : ""}
              </Txt>
            </View>
            <View style={[s.row, { gap: 10 }]}>
              <Pressable
                onPress={() => setOptionsOpen(true)}
                style={{ minWidth: 74 }}
              >
                <Txt variant="small" color={C.muted}>
                  Votre offre
                </Txt>
                <Txt variant="h3">{fare(price)}</Txt>
              </Pressable>
              <Button
                style={{ flex: 1 }}
                title={scheduledAt ? "Programmer" : "Demander"}
                icon={ArrowRight}
                disabled={routeBusy || !!routeError || !guestValid}
                onPress={async () => {
                  if (routeBusy || routeError || !guestValid) return;
                  const freshRoute =
                    route.calculatedAt &&
                    Date.now() - route.calculatedAt > 120000
                      ? await app.getRoute(
                          pickup,
                          destination,
                          stops,
                          optimizeStops,
                        )
                      : route;
                  setRoute(freshRoute);
                  const t = await app.createTrip({
                    pickup,
                    destination,
                    stops: freshRoute.orderedStops || displayedStops,
                    vehicle,
                    proposedPrice: price,
                    route: freshRoute,
                    ...(scheduledAt ? { scheduledAt } : {}),
                    ...(forGuest
                      ? {
                          guest: {
                            name: guestName.trim(),
                            phone: cleanGuestPhone,
                          },
                        }
                      : {}),
                  });
                  setTripId(t.id);
                }}
              />
              <IconButton
                icon={CalendarClock}
                label="Programmer la course"
                style={{
                  backgroundColor: scheduledAt ? C.yellow : C.yellowSoft,
                }}
                onPress={() => setScheduleOpen(true)}
              />
            </View>
            {scheduledAt && (
              <Pressable onPress={() => setScheduleOpen(true)}>
                <Txt
                  variant="micro"
                  color={C.muted}
                  style={{ textAlign: "center", marginTop: 6 }}
                >
                  {scheduledLabel(scheduledAt, pickup.city)}
                </Txt>
              </Pressable>
            )}
          </View>
        )}
        <Modal
          visible={optionsOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setOptionsOpen(false)}
        >
          <View style={r.scrim}>
            <View style={[r.counter, { maxHeight: "85%" }]}>
              <View style={s.rowBetween}>
                <Txt variant="h3">Passager et offre</Txt>
                <IconButton
                  icon={X}
                  label="Fermer"
                  onPress={() => setOptionsOpen(false)}
                />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={{ marginTop: 16, gap: 10 }}>
                  <View style={[s.row, { gap: 8 }]}>
                    <Button
                      compact
                      title="Pour moi"
                      kind={forGuest ? "secondary" : "primary"}
                      onPress={() => setForGuest(false)}
                    />
                    <Button
                      compact
                      title="Pour quelqu’un d’autre"
                      kind={forGuest ? "primary" : "secondary"}
                      onPress={() => setForGuest(true)}
                    />
                  </View>
                  {forGuest && (
                    <View
                      style={{
                        gap: 10,
                        padding: 12,
                        borderRadius: 14,
                        backgroundColor: C.background,
                      }}
                    >
                      <Field
                        label="Nom du passager"
                        value={guestName}
                        maxLength={80}
                        onChangeText={(v) => {
                          setGuestName(v);
                          setGuestConfirmed(false);
                        }}
                      />
                      <Field
                        label="Téléphone du passager"
                        value={guestPhone}
                        keyboardType="phone-pad"
                        maxLength={24}
                        onChangeText={(v) => {
                          setGuestPhone(v);
                          setGuestConfirmed(false);
                        }}
                      />
                      <Txt variant="small">
                        Touchez le départ dans la barre de la carte pour
                        indiquer où le conducteur doit retrouver cette personne.
                        Vous gardez le suivi de la course.
                      </Txt>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: guestConfirmed }}
                        onPress={() => setGuestConfirmed(!guestConfirmed)}
                        style={[s.row, { paddingVertical: 8 }]}
                      >
                        <Txt>{guestConfirmed ? "☑" : "☐"}</Txt>
                        <Txt variant="small" style={{ flex: 1 }}>
                          Le passager est d’accord pour partager son numéro avec
                          le conducteur et j’ai vérifié son lieu de départ.
                        </Txt>
                      </Pressable>
                    </View>
                  )}
                </View>
                <Divider />
                <View style={s.rowBetween}>
                  <Txt variant="h3">{app.t("negotiate")}</Txt>
                  <Tag tone="yellow">À négocier</Tag>
                </View>
                <Txt variant="small" color={C.muted} style={{ marginTop: 5 }}>
                  {app.t("suggested")} :{" "}
                  {fare(suggestedFare(route.distanceKm, vehicle))}
                </Txt>
                <View style={[s.rowBetween, { paddingVertical: 18 }]}>
                  <IconButton
                    icon={Minus}
                    label="Baisser mon offre"
                    onPress={() => setPrice((p) => Math.max(500, p - 500))}
                  />
                  <View style={{ alignItems: "center" }}>
                    <Txt variant="small" color={C.muted}>
                      {app.t("yourOffer")}
                    </Txt>
                    <Txt variant="h2">{fare(price)}</Txt>
                  </View>
                  <IconButton
                    icon={Plus}
                    label="Augmenter mon offre"
                    onPress={() => setPrice((p) => Math.min(500000, p + 500))}
                  />
                </View>
                <View
                  style={[
                    s.row,
                    {
                      marginBottom: 18,
                      padding: 13,
                      borderRadius: 14,
                      backgroundColor: C.background,
                    },
                  ]}
                >
                  <Banknote size={22} color={C.green} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="label">{app.t("cash")}</Txt>
                    <Txt variant="small" color={C.muted}>
                      {app.t("cashDetail")}
                    </Txt>
                  </View>
                  <Check size={18} color={C.ink} />
                </View>
              </ScrollView>
              <Button
                title="Terminé"
                onPress={() => setOptionsOpen(false)}
                disabled={!guestValid}
              />
            </View>
          </View>
        </Modal>
        <Modal
          visible={stopsOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setStopsOpen(false)}
        >
          <View style={r.scrim}>
            <View style={r.counter}>
              <View style={s.rowBetween}>
                <Txt variant="h3">Étapes du trajet</Txt>
                <IconButton
                  icon={X}
                  label="Fermer"
                  onPress={() => setStopsOpen(false)}
                />
              </View>
              <View style={[s.row, { marginVertical: 12, gap: 8 }]}>
                {[true, false].map((value) => (
                  <Pressable
                    key={String(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: optimizeStops === value }}
                    onPress={() => setOptimizeStops(value)}
                    style={{
                      flex: 1,
                      minHeight: 48,
                      padding: 10,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        optimizeStops === value ? C.ink : C.background,
                    }}
                  >
                    <Txt
                      variant="small"
                      color={optimizeStops === value ? C.paper : C.ink}
                    >
                      {value ? "Ordre conseillé" : "Garder mon ordre"}
                    </Txt>
                  </Pressable>
                ))}
              </View>
              <Txt variant="small" color={C.muted}>
                {routeBusy
                  ? "Calcul de l’ordre…"
                  : routeError
                    ? "Calcul indisponible. Réessayez sur la carte."
                    : optimizeStops
                      ? route.stopOrderSource === "estimate"
                        ? "Ordre estimé en démo, sans les contraintes des routes."
                        : "Étapes organisées selon le trajet routier. La destination reste à la fin."
                      : "Vos étapes seront suivies dans cet ordre."}
              </Txt>
              <ScrollView style={{ maxHeight: 240 }}>
                {(routeBusy || routeError ? stops : displayedStops).map(
                  (p, i) => (
                    <View
                      key={p.id + i}
                      style={[s.rowBetween, { marginVertical: 8 }]}
                    >
                      <Txt numberOfLines={2} style={{ flex: 1 }}>
                        {i + 1}. {p.name}
                      </Txt>
                      {i > 0 && (
                        <IconButton
                          icon={ArrowLeft}
                          label="Avancer cette étape"
                          onPress={() => {
                            if (routeBusy || routeError) return;
                            const next = [...displayedStops];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            setOptimizeStops(false);
                            setStops(next);
                          }}
                        />
                      )}
                      <IconButton
                        icon={X}
                        label="Supprimer cette étape"
                        onPress={() =>
                          setStops((list) => {
                            const index = list.findIndex(
                              (item) =>
                                item.id === p.id &&
                                item.latitude === p.latitude &&
                                item.longitude === p.longitude,
                            );
                            return list.filter((_, n) => n !== index);
                          })
                        }
                      />
                    </View>
                  ),
                )}
              </ScrollView>
              <Txt variant="small" style={{ marginVertical: 8 }}>
                Destination finale : {destination.name}
              </Txt>
              <Button
                title="Ajouter une étape"
                icon={Plus}
                disabled={stops.length >= 3}
                onPress={() => {
                  setStopsOpen(false);
                  setSearch("stop");
                }}
              />
              <Txt variant="small" color={C.muted}>
                3 étapes maximum.
              </Txt>
            </View>
          </View>
        </Modal>
        <SchedulePicker
          visible={scheduleOpen}
          city={trip?.pickup.city || pickup.city}
          value={trip?.scheduledAt || scheduledAt}
          onClose={() => setScheduleOpen(false)}
          onChange={(value) => {
            if (trip?.status === "scheduled") {
              if (value)
                void app
                  .rescheduleTrip(trip.id, value)
                  .catch((e) => ui.alert("Programmation", e.message));
              else
                ui.alert(
                  "Départ immédiat",
                  "Annulez cette réservation puis créez une course pour maintenant.",
                );
            } else setScheduledAt(value);
          }}
        />
        <PlaceSearch
          routePickup={search === "stop" ? undefined : pickup}
          routeDestination={destination}
          onPickupSelect={
            search === "stop"
              ? undefined
              : (p) => {
                  setPickup(p);
                  setGuestConfirmed(false);
                }
          }
          onDestinationSelect={search === "stop" ? undefined : setDestination}
          initialPlace={search === "pickup" ? pickup : destination}
          visible={!!search}
          pickup={search === "pickup"}
          onClose={() => setSearch(null)}
          onSelect={(p) => {
            if (search === "pickup") {
              setPickup(p);
              setGuestConfirmed(false);
            } else if (search === "stop")
              setStops((list) => (list.length < 3 ? [...list, p] : list));
            else setDestination(p);
          }}
        />
        <Modal
          visible={!!counter}
          transparent
          animationType="slide"
          onRequestClose={() => setCounter(null)}
        >
          <View style={r.scrim}>
            <View style={r.counter}>
              <View style={s.rowBetween}>
                <Txt variant="h2">On en discute ?</Txt>
                <IconButton
                  icon={X}
                  label="Fermer"
                  onPress={() => setCounter(null)}
                />
              </View>
              <Txt color={C.muted}>
                Proposez votre prix à {counter?.driver.name.split(" ")[0]}.
              </Txt>
              <View style={[s.rowBetween, { paddingVertical: 20 }]}>
                <IconButton
                  icon={Minus}
                  label="Baisser la contre-offre"
                  onPress={() => setCounterPrice((p) => Math.max(500, p - 500))}
                />
                <Txt variant="h1" style={{ fontSize: 32 }}>
                  {fare(counterPrice)}
                </Txt>
                <IconButton
                  icon={Plus}
                  label="Augmenter la contre-offre"
                  onPress={() =>
                    setCounterPrice((p) => Math.min(500000, p + 500))
                  }
                />
              </View>
              <Button
                title="Envoyer ma contre-offre"
                onPress={async () => {
                  if (trip && counter) {
                    await app.counterOffer(trip.id, counter.id, counterPrice);
                    setCounter(null);
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const r = StyleSheet.create({
  map: {
    minHeight: 175,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#E5E9EC",
  },
  mapHeader: {
    position: "absolute",
    top: 15,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routePill: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.paper,
    borderRadius: 25,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  sheet: {
    flex: 0.57,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: C.paper,
    marginTop: -17,
  },
  handle: {
    width: 35,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#D9DDD2",
    alignSelf: "center",
    marginTop: 11,
    marginBottom: 22,
  },
  vehicle: {
    flex: 1,
    borderRadius: 19,
    alignItems: "center",
    paddingVertical: 14,
    borderWidth: 1,
  },
  pinCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 19,
    backgroundColor: C.greenSoft,
  },
  pinCell: {
    width: 44,
    height: 49,
    borderRadius: 11,
    backgroundColor: C.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  searchCircle: {
    width: 83,
    height: 83,
    backgroundColor: C.yellowSoft,
    borderRadius: 42,
    justifyContent: "center",
    alignItems: "center",
  },
  scrim: {
    flex: 1,
    backgroundColor: "#17211177",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  counter: {
    width: "100%",
    maxWidth: 460,
    padding: 25,
    paddingBottom: 40,
    borderTopLeftRadius: 27,
    borderTopRightRadius: 27,
    backgroundColor: C.paper,
    gap: 15,
  },
});
