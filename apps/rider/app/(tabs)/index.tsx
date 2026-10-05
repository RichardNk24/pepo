import { coordinatePlace } from "@pepo/api-client/maps";
import { C } from "@pepo/config/tokens";
import { demoFleet } from "@pepo/maps/demoFleet";
import MapBoard from "@pepo/maps/MapBoard";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import type { ActiveVehicleKind, Place } from "@pepo/types/model";
import { PepoLogo } from "@pepo/ui/PepoLogo";
import { Button, s, Tag, Txt, useUI } from "@pepo/ui/UI";
import { CITIES, PLACES } from "@pepo/utils/cities";
import { haversine } from "@pepo/utils/rules";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  MapPin,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LocationControls } from "../../src/components/LocationControls";
import { PlaceSearch } from "../../src/components/PlaceSearch";
import { RouteSummary } from "../../src/components/RouteSummary";
import { SnapSheet } from "../../src/components/SnapSheet";

export default function Home() {
  const app = useApp(),
    router = useRouter(),
    ui = useUI();
  const location = useLocation();
  const [follow, setFollow] = useState(true),
    [recenter, setRecenter] = useState(0),
    [panelHeight, setPanelHeight] = useState(340);
  const manualPickup = useRef(false),
    located = useRef(false);
  const cityPlaces = PLACES.filter((p) => p.city === app.settings.city);
  const [pickup, setPickup] = useState<Place>(cityPlaces[0]);
  const [search, setSearch] = useState<"pickup" | "destination" | null>(null);
  const [planLater, setPlanLater] = useState(false);
  const [vehicle, setVehicle] = useState<ActiveVehicleKind>("moto");
  // Development-only map preview for testing the selected vehicle artwork
  // while using a local API session.
  const showMapDemoFleet =
    app.demo ||
    (__DEV__ && process.env.EXPO_PUBLIC_MAP_DEMO_FLEET === "true");
  useEffect(() => {
    manualPickup.current = false;
    located.current = false;
    setPickup(PLACES.find((p) => p.city === app.settings.city)!);
  }, [app.settings.city]);
  useEffect(() => {
    if (
      !manualPickup.current &&
      !located.current &&
      location.fix &&
      !location.stale &&
      (location.fix.accuracy ?? 1000) <= 100 &&
      haversine(location.fix, CITIES[app.settings.city].center) <= 60
    ) {
      located.current = true;
      setPickup({
        ...coordinatePlace(location.fix, app.settings.city),
        name: "Ma position",
      });
    }
  }, [location.fix?.timestamp, app.settings.city]);
  const active = app.activeTrip;
  const nearbyVehicles = useMemo(
    () =>
      showMapDemoFleet && !active ? demoFleet(pickup, vehicle) : [],
    [showMapDemoFleet, !!active, pickup.latitude, pickup.longitude, vehicle],
  );
  const book = (destination: Place) =>
    router.push({
      pathname: "/ride",
      params: {
        pickup: JSON.stringify(
          !manualPickup.current &&
            location.fix &&
            !location.stale &&
            (location.fix.accuracy ?? 1000) <= 100 &&
            haversine(location.fix, CITIES[app.settings.city].center) <= 60
            ? {
                ...coordinatePlace(location.fix, app.settings.city),
                name: "Ma position",
              }
            : pickup,
        ),
        destination: JSON.stringify(destination),
        vehicle,
        ...(planLater ? { schedule: "1" } : {}),
      },
    });
  return (
    <View style={{ flex: 1, backgroundColor: C.map }}>
      <MapBoard
        nearbyVehicles={nearbyVehicles}
        pickup={active?.pickup || pickup}
        destination={active?.destination}
        stops={active?.stops}
        route={active?.route}
        driver={active?.driverLocation}
        driverVehicleKind={active?.vehicle}
        bottomInset={panelHeight}
        userPosition={location.fix}
        heading={location.heading}
        stale={location.stale}
        followUser={follow && !active}
        recenterKey={recenter}
        onPan={() => setFollow(false)}
      />
      <SafeAreaView
        edges={["top"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      >
        <View style={h.header}>
          <Pressable
            onPress={() => router.push("/account")}
            style={[s.row, h.city]}
          >
            <PepoLogo size={42} />
            <View>
              <Txt variant="small" color={C.muted}>
                pepo /{" "}
                {app.demo
                  ? app.t("demo")
                  : app.testAuth
                    ? "Test local"
                    : app.t("live")}
              </Txt>
              <View style={[s.row, { gap: 4 }]}>
                <Txt variant="label">{CITIES[app.settings.city].name}</Txt>
                <ChevronDown size={14} color={C.ink} />
              </View>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>
      <LocationControls
        bottom={panelHeight + 16}
        onLocate={() => {
          setFollow(true);
          setRecenter((n) => n + 1);
        }}
      />
      <SnapSheet
        onHeight={setPanelHeight}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
      >
        {app.connectionError && (
          <Pressable
            onPress={() => void app.refresh()}
            style={{
              backgroundColor: C.redSoft,
              padding: 10,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <Txt variant="small" color={C.red}>
              Connexion interrompue · Appuyez pour réessayer
            </Txt>
          </Pressable>
        )}
        {active ? (
          <>
            <View style={s.rowBetween}>
              <Txt variant="h2">Votre trajet continue.</Txt>
              <Tag tone="yellow">{app.t("active")}</Tag>
            </View>
            <View style={{ marginVertical: 15 }}>
              <RouteSummary
                pickup={active.pickup}
                destination={active.destination}
              />
            </View>
            <Button
              title="Retrouver ma course"
              icon={ArrowRight}
              onPress={() =>
                router.push({ pathname: "/ride", params: { id: active.id } })
              }
            />
          </>
        ) : (
          <>
            <View style={[s.rowBetween, { marginBottom: 16 }]}>
              <View>
                <Txt variant="small" color={C.muted}>
                  {app.t("hello")}, {app.profile?.name.split(" ")[0]}
                </Txt>
                <Txt variant="h1" style={{ fontSize: 32, lineHeight: 38 }}>
                  {app.t("headline")}
                </Txt>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Programmer une course"
                onPress={() => {
                  setPlanLater(true);
                  setSearch("destination");
                }}
                style={h.timePill}
              >
                <CalendarClock size={17} color={C.green} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={app.t("destination")}
              onPress={() => {
                setPlanLater(false);
                setSearch("destination");
              }}
              style={h.search}
            >
              <MapPin size={21} color={C.yellow} />
              <Txt variant="h3" color="#fff" style={{ flex: 1 }}>
                {app.t("destination")}
              </Txt>
              <View style={h.arrow}>
                <ArrowRight size={18} color={C.ink} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => setSearch("pickup")}
              style={[s.row, { marginTop: 13, marginBottom: 18 }]}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 6,
                  backgroundColor: C.green,
                }}
              />
              <Txt variant="small" color={C.muted}>
                Départ : {pickup.name}
              </Txt>
              <ChevronDown size={13} color={C.muted} />
            </Pressable>
          </>
        )}
      </SnapSheet>
      <PlaceSearch
        routePickup={pickup}
        onPickupSelect={(p) => {
          manualPickup.current = true;
          setFollow(false);
          setPickup(p);
        }}
        onDestinationSelect={book}
        visible={!!search}
        pickup={search === "pickup"}
        onClose={() => setSearch(null)}
        initialPlace={pickup}
        onSelect={(p) => {
          if (search === "pickup") {
            manualPickup.current = true;
            setFollow(false);
            setPickup(p);
          } else book(p);
        }}
      />
    </View>
  );
}
const h = StyleSheet.create({
  header: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  city: {
    backgroundColor: "#fff",
    padding: 9,
    paddingRight: 15,
    borderRadius: 22,
  },
  logo: {
    width: 35,
    height: 35,
    borderRadius: 13,
    backgroundColor: C.yellow,
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 23,
    shadowColor: "#223316",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 6,
  },
  handle: {
    width: 35,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#D9DDD2",
    alignSelf: "center",
    marginBottom: 19,
  },
  search: {
    backgroundColor: C.ink,
    borderRadius: 17,
    padding: 15,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  arrow: {
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: C.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  timePill: {
    padding: 9,
    backgroundColor: C.greenSoft,
    borderRadius: 20,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  vehicle: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    gap: 3,
  },
});
