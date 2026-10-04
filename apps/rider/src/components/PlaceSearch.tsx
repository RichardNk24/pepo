import { LIVE } from "@pepo/api-client/api";
import { resolveMapRequest, reverseMapPlace } from "@pepo/api-client/maps";
import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import type { Place } from "@pepo/types/model";
import { IconButton, Screen, Txt, s } from "@pepo/ui/UI";
import { CITIES, PLACES } from "@pepo/utils/cities";
import {
  humanAddress,
  type ReferencedPlace,
} from "@pepo/utils/placeReferences";
import { haversine } from "@pepo/utils/rules";
import { VoiceButton } from "@pepo/voice/VoiceButton";
import { parseVoice } from "@pepo/voice/commands";
import { useRouter } from "expo-router";
import {
  ArrowUpRight,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { MapPickerContent } from "./MapPicker";

type Target = "pickup" | "destination";
export function PlaceSearch({
  visible,
  pickup = false,
  onClose,
  onSelect,
  initialPlace,
  routePickup,
  routeDestination,
  onPickupSelect,
  onDestinationSelect,
}: {
  visible: boolean;
  initialPlace?: Place;
  pickup?: boolean;
  onClose: () => void;
  onSelect: (p: Place) => void;
  routePickup?: Place;
  routeDestination?: Place;
  onPickupSelect?: (p: Place) => void;
  onDestinationSelect?: (p: Place) => void;
}) {
  const app = useApp(),
    location = useLocation(),
    router = useRouter();
  const routeMode = !!routePickup && !!onPickupSelect && !!onDestinationSelect;
  const [active, setActive] = useState<Target>(
    pickup ? "pickup" : "destination",
  );
  const [mapPicking, setMapPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const requestVersion = useRef(0);
  const [resolving, setResolving] = useState(false);
  const [resolveNotice, setResolveNotice] = useState("");
  const pickupInput = useRef<TextInput>(null),
    destinationInput = useRef<TextInput>(null);
  const selectingPickup = routeMode ? active === "pickup" : pickup;
  const selectedPlace = routeMode
    ? selectingPickup
      ? routePickup
      : routeDestination
    : initialPlace;
  useEffect(() => {
    if (visible) {
      setMapPicking(false);
      setActive(pickup ? "pickup" : "destination");
      setQuery("");
      setPlaces([]);
      setError("");
    }
  }, [visible, pickup]);
  useEffect(() => {
    if (!visible || mapPicking) return;
    const timer = setTimeout(() => {
      (active === "pickup" && routeMode
        ? pickupInput
        : destinationInput
      ).current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [visible, mapPicking, active, routeMode]);
  useEffect(() => {
    const version = ++requestVersion.current;
    setResolveNotice("");
    setResolving(false);
    if (!visible || mapPicking) return;
    let disposed = false;
    const timer = setTimeout(async () => {
      if (version !== requestVersion.current) return;
      setLoading(true);
      setError("");
      try {
        let result: Place[];
        if (query.trim().length < 2) {
          const known = PLACES.filter((p) => p.city === app.settings.city);
          const fix = location.fix;
          if (fix && haversine(fix, CITIES[app.settings.city].center) <= 60) {
            const nearby = (await reverseMapPlace(fix, app.settings.city).catch(
              () => null,
            )) as ReferencedPlace | null;
            const seen = new Set<string>();
            result = [
              ...(nearby?.references || []),
              ...known.sort((a, b) => haversine(fix, a) - haversine(fix, b)),
            ].filter((p) => {
              if (seen.has(p.id)) return false;
              seen.add(p.id);
              return true;
            });
          } else result = known;
        } else result = await app.search(query.trim());
        if (!disposed && version === requestVersion.current) setPlaces(result);
      } catch (e) {
        if (!disposed && version === requestVersion.current)
          setError((e as Error).message);
      } finally {
        if (!disposed && version === requestVersion.current) setLoading(false);
      }
    }, 300);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [query, visible, mapPicking, active, app.settings.city]);
  const understand = async () => {
    const version = ++requestVersion.current;
    setResolving(true);
    setLoading(false);
    setError("");
    setResolveNotice("");
    try {
      const result = await resolveMapRequest(
        query,
        app.settings.city,
        app.settings.language,
        true,
      );
      if (version !== requestVersion.current) return;
      setPlaces(result.places);
      setResolveNotice(
        app.t(
          result.source === "fallback"
            ? "smartSearchFallback"
            : "smartSearchConfirm",
        ),
      );
    } catch {
      if (version === requestVersion.current)
        setResolveNotice(app.t("smartSearchFallback"));
    } finally {
      if (version === requestVersion.current) setResolving(false);
    }
  };
  const activate = (target: Target) => {
    if (active === target) return;
    setActive(target);
    setQuery("");
    setPlaces([]);
    setError("");
  };
  const choose = (p: Place) => {
    Keyboard.dismiss();
    if (routeMode && selectingPickup) {
      onPickupSelect?.(p);
      setMapPicking(false);
      setActive("destination");
      setQuery("");
      setPlaces([]);
      setError("");
      return;
    }
    if (routeMode) onDestinationSelect?.(p);
    else onSelect(p);
    onClose();
  };
  const pickOnMap = (target: Target) => {
    activate(target);
    Keyboard.dismiss();
    setMapPicking(true);
  };
  const useCurrentLocation = async () => {
    setLoading(true);
    setError("");
    try {
      const current = await location.enable();
      const point = {
        latitude: current.latitude,
        longitude: current.longitude,
      };
      if (haversine(point, CITIES[app.settings.city].center) > 60)
        throw new Error(
          "Votre position est en dehors de la ville choisie. Choisissez votre ville dans Compte, ou utilisez la carte.",
        );
      choose({
        id: "gps-" + Date.now(),
        name: "Ma position",
        address: CITIES[app.settings.city].name,
        city: app.settings.city,
        ...point,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const onVoice = (text: string) => {
    const intent = parseVoice(text, app.settings.language);
    if (intent.kind === "destination") setQuery(intent.query);
    else if (intent.kind === "command") {
      if (intent.action === "recenter") void useCurrentLocation();
      else if (intent.action === "back") onClose();
      else if (
        ["home", "account", "activity", "help"].includes(intent.action)
      ) {
        onClose();
        router.push(
          intent.action === "home"
            ? "/(tabs)"
            : intent.action === "account"
              ? "/account"
              : intent.action === "activity"
                ? "/activity"
                : "/help",
        );
      } else setError(app.t("statusUnavailable"));
    } else setError(app.t("voiceNotUnderstood"));
  };
  const inputRow = (target: Target) => {
    const isActive = !routeMode || active === target;
    const place = target === "pickup" ? routePickup : routeDestination;
    const label = app.t(
      target === "pickup" ? "routePickup" : "routeDestination",
    );
    const mapLabel = app.t(
      routeMode
        ? target === "pickup"
          ? "pickupOnMap"
          : "destinationOnMap"
        : "placeOnMap",
    );
    return (
      <View
        key={target}
        style={[styles.inputRow, isActive && styles.activeRow]}
      >
        <View style={{ width: 20, alignItems: "center" }}>
          {isActive ? (
            <Search size={18} color={C.ink} />
          ) : (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: target === "pickup" ? 5 : 2,
                backgroundColor: target === "pickup" ? C.ink : C.yellow,
              }}
            />
          )}
        </View>
        <TextInput
          ref={
            target === "pickup" && routeMode ? pickupInput : destinationInput
          }
          accessibilityLabel={routeMode ? label : app.t("searchPlace")}
          placeholder={routeMode ? place?.name || label : app.t("searchPlace")}
          placeholderTextColor={C.muted}
          value={isActive ? query : place?.name || ""}
          onFocus={() => activate(target)}
          onChangeText={(value) => {
            setQuery(value);
            setPlaces([]);
          }}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
          selectionColor={C.ink}
        />
        {isActive && loading && (
          <ActivityIndicator size="small" color={C.ink} />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mapLabel}
          onPress={() => pickOnMap(target)}
          style={({ pressed }) => [
            styles.mapButton,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <MapPin size={20} color={C.ink} />
        </Pressable>
      </View>
    );
  };
  return (
    <Modal
      visible={visible}
      statusBarTranslucent
      animationType="slide"
      onRequestClose={() => (mapPicking ? setMapPicking(false) : onClose())}
    >
      {mapPicking ? (
        <MapPickerContent
          pickup={selectingPickup}
          initialPlace={selectedPlace || initialPlace || routePickup}
          onClose={() => setMapPicking(false)}
          onSelect={choose}
        />
      ) : (
        <Screen>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View style={[s.header, { paddingVertical: 12 }]}>
              <Txt variant="h3">
                {routeMode
                  ? app.t("routeSearchTitle")
                  : pickup
                    ? app.t("pickup")
                    : app.t("destination")}
              </Txt>
              <IconButton icon={X} label={app.t("close")} onPress={onClose} />
            </View>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {routeMode && inputRow("pickup")}
              {inputRow("destination")}
              <View
                style={[
                  s.rowBetween,
                  { alignItems: "flex-start", paddingVertical: 5 },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={app.t("useLocation")}
                  disabled={loading}
                  onPress={() => void useCurrentLocation()}
                  style={[
                    s.row,
                    { minHeight: 44, flex: 1, gap: 7, paddingRight: 8 },
                  ]}
                >
                  <Navigation size={18} color={C.muted} />
                  <Txt variant="small" style={{ flexShrink: 1 }}>
                    {app.t("useLocation")}
                  </Txt>
                </Pressable>
                <VoiceButton key={active} onResult={onVoice} />
              </View>
              {LIVE && !app.demo && query.trim().length >= 2 && (
                <View style={{ gap: 4 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={app.t("smartSearchAction")}
                    disabled={resolving}
                    onPress={() => void understand()}
                    style={[s.row, { minHeight: 44 }]}
                  >
                    {resolving ? (
                      <ActivityIndicator size="small" color={C.ink} />
                    ) : (
                      <Search size={16} color={C.ink} />
                    )}
                    <Txt variant="small">{app.t("smartSearchAction")}</Txt>
                  </Pressable>
                  <Txt variant="small" color={C.muted}>
                    {resolveNotice || app.t("smartSearchPrivacy")}
                  </Txt>
                </View>
              )}
              <Txt variant="micro" color={C.muted}>
                {query
                  ? "RÉSULTATS"
                  : location.fix
                    ? "LIEUX ET RÉFÉRENCES"
                    : "LIEUX CONNUS"}
              </Txt>
              {!!error && <Txt color={C.red}>{error}</Txt>}
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 30,
                marginTop: 8,
              }}
            >
              {places.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => choose(p)}
                  style={[
                    s.row,
                    {
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: C.line,
                    },
                  ]}
                >
                  <View
                    style={{
                      padding: 11,
                      backgroundColor: C.background,
                      borderRadius: 14,
                    }}
                  >
                    <MapPin size={18} color={C.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="label" translate={false}>
                      {p.name}
                    </Txt>
                    <Txt variant="small" color={C.muted} translate={false}>
                      {humanAddress(p.address)}
                    </Txt>
                  </View>
                  <ArrowUpRight color={C.muted} size={17} />
                </Pressable>
              ))}
              {!loading && !places.length && !query && (
                <ActivityIndicator style={{ marginTop: 20 }} color={C.muted} />
              )}
              {!loading && !places.length && !!query && (
                <Txt color={C.muted} style={{ paddingTop: 22 }}>
                  Aucun lieu trouvé. Essayez un quartier ou une autre adresse.
                </Txt>
              )}
              {places.some((p) => p.googleAttribution) && (
                <Txt variant="small" color={C.muted} style={{ paddingTop: 20 }}>
                  Google Maps
                </Txt>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Screen>
      )}
    </Modal>
  );
}
const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingLeft: 13,
    paddingRight: 4,
    borderRadius: 14,
    minHeight: 54,
    backgroundColor: C.background,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  activeRow: { backgroundColor: C.paper, borderColor: C.yellow },
  input: {
    flex: 1,
    minWidth: 0,
    outlineWidth: 0,
    minHeight: 50,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "DMSans_400Regular",
    color: C.ink,
  },
  mapButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.background,
    borderRadius: 11,
  },
});
