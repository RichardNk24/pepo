import {
  coordinatePlace,
  mapRoute,
  MAPS_API_URL,
  reverseMapPlace,
} from "@pepo/api-client/maps";
import { C } from "@pepo/config/tokens";
import MapBoard from "@pepo/maps/MapBoard";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import type { Place, Point } from "@pepo/types/model";
import { Button, Field, IconButton, s, Txt } from "@pepo/ui/UI";
import { CITIES, PLACES } from "@pepo/utils/cities";
import {
  humanAddress,
  isPlusCode,
  useReference,
  type ReferencedPlace,
} from "@pepo/utils/placeReferences";
import { haversine } from "@pepo/utils/rules";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Check } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LocationControls } from "./LocationControls";

export function MapPicker({
  visible,
  pickup,
  initialPlace,
  etaMinutes,
  onClose,
  onSelect,
}: {
  visible: boolean;
  pickup: boolean;
  initialPlace?: Place;
  /** Real driver arrival estimate, supplied by the caller when available. */
  etaMinutes?: number;
  onClose: () => void;
  onSelect: (place: Place) => void;
}) {
  if (!visible) return null;
  return (
    <Modal
      visible
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <MapPickerContent
        pickup={pickup}
        initialPlace={initialPlace}
        etaMinutes={etaMinutes}
        onClose={onClose}
        onSelect={(place) => {
          onSelect(place);
          onClose();
        }}
      />
    </Modal>
  );
}
export function MapPickerContent({
  pickup,
  initialPlace,
  etaMinutes,
  onClose,
  onSelect,
}: Omit<Parameters<typeof MapPicker>[0], "visible">) {
  const mapInsets = useSafeAreaInsets();
  const app = useApp(),
    location = useLocation(),
    city = app.settings.city;
  const [seed] = useState(
    () =>
      initialPlace ||
      (location.fix && haversine(location.fix, CITIES[city].center) < 60
        ? coordinatePlace(location.fix, city)
        : PLACES.find((p) => p.city === city)!),
  );
  const [point, setPoint] = useState<Point>(seed),
    [place, setPlace] = useState<ReferencedPlace>(seed),
    [moving, setMoving] = useState(true),
    [busy, setBusy] = useState(false),
    [real, setReal] = useState(false),
    [mapError, setMapError] = useState(""),
    [addressError, setAddressError] = useState(""),
    [recenter, setRecenter] = useState(0),
    [panelHeight, setPanelHeight] = useState(230),
    [height, setHeight] = useState(760);
  const [referenceNote, setReferenceNote] = useState("");
  const [showReferences, setShowReferences] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [routeMinutes, setRouteMinutes] = useState<number | null>(null);
  const etaFade = useRef(new Animated.Value(0)).current;
  const stretch = useRef(new Animated.Value(0)).current;
  const landingArmed = useRef(false),
    hasSettled = useRef(false);
  const lift = useRef(new Animated.Value(0)).current,
    requestId = useRef(0),
    idle = useRef(false);
  useEffect(() => {
    Keyboard.dismiss();
  }, []);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    const native = Platform.OS !== "web";
    let rebound: Animated.CompositeAnimation | undefined;
    const animation = Animated.parallel([
      Animated.timing(lift, {
        toValue: moving && !reduceMotion ? 1 : 0,
        duration: reduceMotion ? 0 : moving ? 160 : 180,
        easing: moving ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
        useNativeDriver: native,
      }),
      Animated.timing(stretch, {
        toValue: moving && !reduceMotion ? 1 : 0,
        duration: reduceMotion ? 0 : 160,
        useNativeDriver: native,
      }),
    ]);
    animation.start(({ finished }) => {
      if (
        !finished ||
        moving ||
        !idle.current ||
        !landingArmed.current ||
        !real
      )
        return;
      {
        landingArmed.current = false;
        if (native)
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
      }
      if (reduceMotion) return;
      rebound = Animated.sequence([
        Animated.timing(stretch, {
          toValue: -0.65,
          duration: 65,
          useNativeDriver: native,
        }),
        Animated.spring(stretch, {
          toValue: 0,
          tension: 220,
          friction: 16,
          useNativeDriver: native,
        }),
      ]);
      rebound.start();
    });
    return () => {
      animation.stop();
      rebound?.stop();
    };
  }, [moving, reduceMotion, lift, stretch, real]);
  useEffect(() => {
    const id = ++requestId.current;
    if (moving || !real || mapError || !idle.current) return;
    setPlace(coordinatePlace(point, city));
    setBusy(true);
    setAddressError("");
    const timer = setTimeout(() => {
      void reverseMapPlace(point, city)
        .then((p) => {
          if (id === requestId.current) setPlace(p);
        })
        .catch(() => {
          if (id === requestId.current)
            setAddressError(
              "Adresse indisponible. Le point choisi est conservé.",
            );
        })
        .finally(() => {
          if (id === requestId.current) setBusy(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      requestId.current++;
    };
  }, [point.latitude, point.longitude, moving, real, mapError, city]);
  // Only a configured routing service can produce a travel-time estimate.
  // This is distinct from a driver's arrival time and is labelled accordingly.
  const originLat = location.fix?.latitude;
  const originLng = location.fix?.longitude;
  useEffect(() => {
    let alive = true;
    setRouteMinutes(null);
    if (
      pickup ||
      moving ||
      busy ||
      !real ||
      mapError ||
      addressError ||
      !MAPS_API_URL ||
      originLat == null ||
      originLng == null ||
      haversine(point, CITIES[city].center) > 60
    )
      return;
    const timer = setTimeout(() => {
      void mapRoute(
        coordinatePlace({ latitude: originLat, longitude: originLng }, city),
        coordinatePlace(point, city),
      )
        .then((route) => {
          if (
            alive &&
            Number.isFinite(route.durationMin) &&
            route.durationMin > 0
          )
            setRouteMinutes(Math.max(1, Math.ceil(route.durationMin)));
        })
        .catch(() => {
          /* Keep the dot when routing is unavailable. */
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [
    pickup,
    moving,
    busy,
    real,
    mapError,
    addressError,
    originLat,
    originLng,
    point.latitude,
    point.longitude,
    city,
  ]);
  const outside = haversine(point, CITIES[city].center) > 60;
  const suppliedEta =
    etaMinutes != null && Number.isFinite(etaMinutes) && etaMinutes > 0
      ? Math.ceil(etaMinutes)
      : null;
  const minutes = suppliedEta ?? routeMinutes;
  const showMinutes =
    !moving &&
    !busy &&
    real &&
    !mapError &&
    !addressError &&
    !outside &&
    minutes != null;
  useEffect(() => {
    const animation = Animated.timing(etaFade, {
      toValue: showMinutes ? 1 : 0,
      duration: reduceMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [showMinutes, minutes, reduceMotion, etaFade]);
  return (
    <View style={{ flex: 1, backgroundColor: "#E5E9EC" }}>
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      >
        <MapBoard
          pickup={seed}
          vehicles={false}
          picking
          bottomInset={panelHeight}
          userPosition={location.fix}
          heading={location.heading}
          stale={location.stale}
          recenterKey={recenter}
          onReady={(isReal) => {
            setReal(isReal);
            setMapError("");
          }}
          onError={(m) => {
            setMapError(m);
            setReal(false);
          }}
          onMove={() => {
            if (hasSettled.current && real) landingArmed.current = true;
            idle.current = false;
            setReferenceNote("");
            setShowReferences(false);
            setMoving(true);
          }}
          onIdle={(p) => {
            hasSettled.current = true;
            idle.current = true;
            setPoint(p);
            setMoving(false);
          }}
        />
        <View style={[s.row, p.header, { top: mapInsets.top + 14 }]}>
          <IconButton
            icon={ArrowLeft}
            label="Retour à la recherche"
            onPress={onClose}
          />
          <View
            style={{
              backgroundColor: C.paper,
              padding: 12,
              borderRadius: 20,
              flex: 1,
            }}
          >
            <Txt variant="label">
              {pickup ? "Où vous retrouver ?" : "Où voulez-vous aller ?"}
            </Txt>
            <Txt variant="small" color={C.muted}>
              Déplacez la carte sous le repère.
            </Txt>
          </View>
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: "50%",
            top: Math.max(0, (height - panelHeight) / 2 - 76),
            marginLeft: -28,
            width: 56,
            height: 83,
            alignItems: "center",
          }}
        >
          <Animated.View
            style={{
              zIndex: 1,
              transform: [
                {
                  translateY: Animated.add(
                    lift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -16],
                    }),
                    stretch.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [2.2, 0, -3],
                    }),
                  ),
                },
                {
                  scaleX: stretch.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [1.08, 1, 0.94],
                  }),
                },
                {
                  scaleY: stretch.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [0.93, 1, 1.1],
                  }),
                },
              ],
            }}
          >
            <View style={{ width: 56, height: 76, alignItems: "center" }}>
              <View style={p.markerCircle}>
                <Animated.View
                  style={[
                    p.markerContent,
                    {
                      opacity: etaFade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                      transform: [
                        {
                          scale: etaFade.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0.7],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={p.markerDot} />
                </Animated.View>
                <Animated.View
                  style={[
                    p.markerContent,
                    {
                      opacity: etaFade,
                      transform: [
                        {
                          scale: etaFade.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.85, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={p.markerNumber}>{minutes ?? ""}</Text>
                  <Text style={p.markerUnit}>min</Text>
                </Animated.View>
              </View>
              <View style={p.markerStem} />
            </View>
          </Animated.View>
          <Animated.View
            style={{
              position: "absolute",
              top: 69,
              width: 14,
              height: 14,
              backgroundColor: "#17211144",
              borderRadius: 7,
              transform: [
                {
                  scale: lift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.65],
                  }),
                },
              ],
            }}
          />
        </View>
        <LocationControls
          bottom={panelHeight + 15}
          onLocate={() => {
            landingArmed.current = false;
            setMoving(true);
            setRecenter((n) => n + 1);
          }}
        />
        <View
          style={[p.panel, { paddingBottom: Math.max(mapInsets.bottom, 12) }]}
          onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
        >
          <View style={[s.rowBetween, { gap: 10 }]}>
            <Txt variant="h2" style={{ flex: 1 }}>
              {moving
                ? "Placez le repère"
                : outside
                  ? "En dehors de la zone"
                  : busy
                    ? "Recherche du lieu…"
                    : isPlusCode(place.name)
                      ? "Lieu choisi sur la carte"
                      : place.name}
            </Txt>
            {busy && <ActivityIndicator color={C.ink} />}
          </View>
          <Txt variant="small" color={C.muted}>
            {outside
              ? `Choisissez un lieu autour de ${CITIES[city].name}.`
              : moving
                ? "Relâchez la carte pour choisir cet endroit."
                : busy
                  ? "Recherche d’une référence proche…"
                  : addressError
                    ? CITIES[city].name
                    : humanAddress(place.address)}
          </Txt>
          {!moving && !busy && !!place.references?.length && (
            <View style={{ gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showReferences }}
                onPress={() => setShowReferences((v) => !v)}
                style={{ paddingVertical: 8 }}
              >
                <Txt variant="small">
                  {showReferences
                    ? "Masquer les références"
                    : "Voir les lieux proches et les entrées"}
                </Txt>
              </Pressable>
              {showReferences && (
                <ScrollView
                  style={{ maxHeight: 190 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {place.references.map((reference) => (
                    <View key={reference.id} style={{ gap: 4 }}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setPlace((previous) =>
                            useReference(
                              { ...previous, address: CITIES[city].name },
                              reference,
                            ),
                          );
                          setShowReferences(false);
                        }}
                        style={{
                          padding: 9,
                          borderRadius: 12,
                          backgroundColor: C.map,
                        }}
                      >
                        <Txt variant="small">{reference.name}</Txt>
                        <Txt variant="micro" color={C.muted}>
                          Référence · env. {reference.distanceMeters} m à vol
                          d’oiseau
                        </Txt>
                      </Pressable>
                      {reference.entrances?.map((entrance) => (
                        <Button
                          key={entrance.id}
                          compact
                          title={entrance.name}
                          onPress={() => onSelect(entrance)}
                        />
                      ))}
                    </View>
                  ))}
                </ScrollView>
              )}
              {showReferences && (
                <Field
                  value={referenceNote}
                  onChangeText={setReferenceNote}
                  maxLength={140}
                  placeholder="Précision : portail bleu, en face de l’école…"
                />
              )}
              {showReferences && (
                <Txt variant="micro" color={C.muted}>
                  Une référence garde votre point. Choisir une entrée change la
                  destination.
                </Txt>
              )}
            </View>
          )}
          {showMinutes && (
            <Txt variant="small" color={C.muted}>
              {suppliedEta != null
                ? `Arrivée estimée du chauffeur : ${minutes} min`
                : `Trajet depuis votre position : ${minutes} min`}
            </Txt>
          )}
          {place.googleAttribution && (
            <Txt variant="small" color="#5E5E5E">
              Google Maps
            </Txt>
          )}
          {!!addressError && (
            <Txt variant="small" color={C.muted}>
              {addressError}
            </Txt>
          )}
          {!real && !mapError && (
            <Txt variant="small" color={C.muted}>
              Une carte réelle est nécessaire. Activez Google Maps pour choisir
              un point.
            </Txt>
          )}
          <Button
            title={pickup ? "Confirmer ce départ" : "Choisir cette destination"}
            icon={Check}
            disabled={
              !real || !!mapError || moving || busy || outside || !idle.current
            }
            onPress={() =>
              onSelect(
                referenceNote.trim()
                  ? {
                      ...place,
                      address:
                        `${place.address} · ${referenceNote.trim()}`.slice(
                          0,
                          500,
                        ),
                    }
                  : place,
              )
            }
          />
        </View>
      </View>
    </View>
  );
}
const p = StyleSheet.create({
  markerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#171C17",
  },
  markerStem: {
    width: 4,
    height: 22,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: "#171C17",
  },
  markerContent: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFF81A",
  },
  markerNumber: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "800",
    color: "#FFF81A",
    includeFontPadding: false,
    textAlign: "center",
  },
  markerUnit: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "600",
    color: "#FFF81A",
    includeFontPadding: false,
    textAlign: "center",
  },
  header: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    alignItems: "center",
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    gap: 13,
  },
});
