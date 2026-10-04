import { GOOGLE_MAP_URL } from "@pepo/api-client/maps";
import { C } from "@pepo/config/tokens";
import { useI18n } from "@pepo/i18n/Context";
import { Txt } from "@pepo/ui/UI";
import { haversine } from "@pepo/utils/rules";
import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import MapView, {
  Circle,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import Svg, { Path, Circle as SvgCircle } from "react-native-svg";
import { DemoMap } from "./DemoMap";
import GoogleMap from "./GoogleMap.native";
import { MAP_STYLE, type MapProps } from "./MapTypes";
import { MapVehicle } from "./MapVehicle";
import { RouteGlow } from "./RouteGlow.native";
import { isExpoGoEnvironment, selectMapRenderer } from "./renderer";

export default function MapBoard(props: MapProps) {
  const { t } = useI18n();
  props = {
    ...props,
    labels: { pickup: t("departLabel"), destination: t("arriveLabel") },
  };
  const renderer = selectMapRenderer({
    mode: process.env.EXPO_PUBLIC_MAP_RENDERER,
    expoGo: isExpoGoEnvironment(
      Constants.executionEnvironment,
      Constants.appOwnership,
    ),
    googleMapUrl: GOOGLE_MAP_URL,
    nativeKey:
      Platform.OS === "ios"
        ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY
        : process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY,
  });
  if (renderer === "google-web") return <GoogleMap {...props} />;
  if (renderer === "google-native") return <NativeMap {...props} />;
  if (renderer === "demo") return <DemoMap {...props} />;
  return <GoogleConfigurationNotice {...props} />;
}
function GoogleConfigurationNotice(props: MapProps) {
  const { t } = useI18n();
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    latest.current.onReady?.(false);
  }, []);
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          bottom: props.bottomInset || 0,
          backgroundColor: C.map,
          justifyContent: "center",
          paddingHorizontal: 32,
        },
      ]}
    >
      <View
        style={{
          backgroundColor: C.paper,
          borderRadius: 20,
          padding: 24,
          gap: 12,
        }}
      >
        <Txt variant="h2">{t("googleMapSetup")}</Txt>
        <Txt>{t("googleMapSetupHelp")}</Txt>
      </View>
    </View>
  );
}
function NativeMap(props: MapProps) {
  const {
    pickup,
    destination,
    route,
    driver,
    bottomInset = 0,
    userPosition,
    heading,
    picking,
  } = props;
  const ref = useRef<MapView>(null),
    lastRecenter = useRef(0),
    ready = useRef(false),
    latest = useRef(props);
  latest.current = props;
  const signature = `${pickup.latitude},${pickup.longitude}:${destination?.latitude},${destination?.longitude}`;
  const fit = () => {
    if (!ready.current) return;
    const p = latest.current;
    if (p.recenterKey !== lastRecenter.current && p.userPosition) {
      lastRecenter.current = p.recenterKey || 0;
      ref.current?.animateToRegion(
        { ...p.userPosition, latitudeDelta: 0.008, longitudeDelta: 0.008 },
        450,
      );
    } else if (p.destination && !p.picking)
      ref.current?.fitToCoordinates(
        [...(p.route?.points || []), p.pickup, p.destination],
        {
          animated: true,
          edgePadding: {
            top: p.cameraTopInset || 80,
            left: 45,
            right: 45,
            bottom: p.cameraBottomInset || 65,
          },
        },
      );
    else
      ref.current?.animateToRegion(
        {
          ...(p.followUser && p.userPosition ? p.userPosition : p.pickup),
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        450,
      );
  };
  useEffect(() => {
    const timer = setTimeout(fit, 180);
    return () => clearTimeout(timer);
  }, [
    signature,
    route,
    props.recenterKey,
    props.overviewKey,
    picking,
    bottomInset,
    props.cameraTopInset,
    props.cameraBottomInset,
  ]);
  useEffect(() => {
    if (ready.current && userPosition && props.followUser)
      ref.current?.animateCamera({ center: userPosition }, { duration: 450 });
  }, [userPosition?.timestamp, props.followUser]);
  return (
    <MapView
      ref={ref}
      style={[StyleSheet.absoluteFill, { bottom: bottomInset }]}
      provider={PROVIDER_GOOGLE}
      customMapStyle={MAP_STYLE}
      initialRegion={{ ...pickup, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
      showsCompass={false}
      showsBuildings={false}
      showsTraffic={false}
      showsUserLocation={false}
      rotateEnabled={false}
      toolbarEnabled={false}
      onMapReady={() => {
        ready.current = true;
        props.onReady?.(true);
        fit();
      }}
      onPanDrag={() => {
        props.onPan?.();
        props.onMove?.();
      }}
      onRegionChange={() => {
        if (picking) props.onMove?.();
      }}
      onRegionChangeComplete={(region) =>
        props.onIdle?.({
          latitude: region.latitude,
          longitude: region.longitude,
        })
      }
      onPress={(event) => {
        if (picking)
          ref.current?.animateCamera(
            { center: event.nativeEvent.coordinate },
            { duration: 350 },
          );
      }}
    >
      {!picking && route && (
        <>
          <Polyline
            coordinates={route.points}
            strokeColor="#fff"
            strokeWidth={9}
            lineCap="round"
            lineJoin="round"
          />
          <Polyline
            coordinates={route.points}
            strokeColor="#000000"
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
          <RouteGlow points={route.points} visible={!picking} />
        </>
      )}
      {!picking &&
        (props.routeLabels ||
          !userPosition ||
          haversine(pickup, userPosition) > 0.015) && (
          <Marker
            coordinate={pickup}
            zIndex={200}
            title={pickup.name}
            pinColor={C.ink}
            anchor={props.routeLabels ? { x: 0.5, y: 0.8 } : undefined}
          >
            {props.routeLabels && (
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    backgroundColor: C.ink,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 12,
                    marginBottom: 5,
                  }}
                >
                  <Txt
                    variant="label"
                    color={C.paper}
                    style={{ fontSize: 12, lineHeight: 16 }}
                  >
                    {props.labels?.pickup || "Départ"}
                  </Txt>
                </View>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: C.ink,
                    borderWidth: 3,
                    borderColor: C.paper,
                  }}
                />
              </View>
            )}
          </Marker>
        )}
      {!picking &&
        props.stops?.map((p, i) => (
          <Marker
            key={p.id + i}
            coordinate={p}
            title={`Étape ${i + 1} : ${p.name}`}
            pinColor="#9C8B07"
          />
        ))}
      {!picking && destination && (
        <Marker
          coordinate={destination}
          zIndex={201}
          title={destination.name}
          pinColor={C.yellow}
          anchor={props.routeLabels ? { x: 0.5, y: 0.8 } : undefined}
        >
          {props.routeLabels && (
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  backgroundColor: C.ink,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 12,
                  marginBottom: 5,
                }}
              >
                <Txt
                  variant="label"
                  color={C.yellow}
                  style={{ fontSize: 12, lineHeight: 16 }}
                >
                  {props.labels?.destination || "Arrivée"}
                </Txt>
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: C.yellow,
                  borderWidth: 3,
                  borderColor: C.paper,
                }}
              />
            </View>
          )}
        </Marker>
      )}
      {!picking && driver && (
        <Marker
          coordinate={driver}
          anchor={{ x: 0.5, y: 0.5 }}
          title="Conducteur"
        >
          <MapVehicle kind={props.driverVehicleKind} />
        </Marker>
      )}
      {!picking &&
        props.nearbyVehicles?.map((taxi) => (
          <Marker
            key={taxi.id}
            coordinate={taxi}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Véhicule de démonstration — non réservable"
          >
            <MapVehicle kind={taxi.kind} />
          </Marker>
        ))}
      {userPosition && (
        <>
          <Circle
            center={userPosition}
            radius={Math.max(0, userPosition.accuracy || 0)}
            strokeColor="#3478F629"
            fillColor="#3478F615"
            strokeWidth={1}
          />
          <Marker
            coordinate={userPosition}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Votre position GPS"
            zIndex={10}
            tracksViewChanges
          >
            <View
              style={{
                width: 64,
                height: 64,
                opacity: props.stale ? 0.45 : 1,
                transform: [{ rotate: `${heading || 0}deg` }],
              }}
            >
              <Svg width={64} height={64}>
                {heading != null && (
                  <Path
                    d="M21 25 L32 4 L43 25 L32 21Z"
                    fill={C.ink}
                    opacity={0.65}
                  />
                )}
                <SvgCircle cx={32} cy={32} r={10} fill="#fff" />
                <SvgCircle cx={32} cy={32} r={8} fill={C.ink} />
              </Svg>
            </View>
          </Marker>
        </>
      )}
    </MapView>
  );
}
