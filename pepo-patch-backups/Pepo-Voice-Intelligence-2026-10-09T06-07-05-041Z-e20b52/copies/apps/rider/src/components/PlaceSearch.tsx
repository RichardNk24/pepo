import { LIVE } from "@pepo/api-client/api";
import {
  deleteSavedPlace,
  getPersonalPlaceSuggestions,
  resolveMapRequest,
  reverseMapPlace,
  savePlace,
  setPlacePersonalizationPreferences,
} from "@pepo/api-client/maps";
import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { useLocation } from "@pepo/session/LocationProvider";
import type {
  Place,
  SavedPlaceCategory,
  SavedPlace,
  PersonalPlaceSuggestions,
} from "@pepo/types/model";
import { IconButton, Screen, Txt, s } from "@pepo/ui/UI";
import { CITIES, PLACES } from "@pepo/utils/cities";
import {
  humanAddress,
  type ReferencedPlace,
} from "@pepo/utils/placeReferences";
import { haversine } from "@pepo/utils/rules";
import type { CapturePhase } from "./voiceCapture";
import { DestinationVoiceButton } from "./DestinationVoiceButton";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  MapPin,
  Navigation,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
    location = useLocation();
  const routeMode = !!routePickup && !!onPickupSelect && !!onDestinationSelect;
  const [active, setActive] = useState<Target>(
    pickup ? "pickup" : "destination",
  );
  const [mapPicking, setMapPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState({
    phase: "idle" as CapturePhase,
    level: 0,
    seconds: 0,
    message: "",
  });
  const [places, setPlaces] = useState<Place[]>([]);
  const [personalPlaces, setPersonalPlaces] =
    useState<PersonalPlaceSuggestions | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState(false);
  const [saveCandidate, setSaveCandidate] = useState<Place | null>(null);
  const [savingPlace, setSavingPlace] = useState(false);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const requestVersion = useRef(0);
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
      setVoiceFeedback({ phase: "idle", level: 0, seconds: 0, message: "" });
      setMapPicking(false);
      setActive(pickup ? "pickup" : "destination");
      setQuery("");
      setPlaces([]);
      setError("");
      setPersonalPlaces(null);
      setPersonalError(false);
      setSaveCandidate(null);
    }
  }, [visible, pickup]);
  const canUsePersonalPlaces =
    LIVE && !app.demo && app.profile?.role === "passenger";
  const destinationIsActive = !routeMode || active === "destination";
  useEffect(() => {
    if (
      !visible ||
      mapPicking ||
      query.trim() ||
      !destinationIsActive ||
      !canUsePersonalPlaces
    ) return;
    let disposed = false;
    setPersonalLoading(true);
    setPersonalError(false);
    getPersonalPlaceSuggestions(app.settings.city)
      .then((data) => {
        if (!disposed) setPersonalPlaces(data);
      })
      .catch(() => {
        if (!disposed) setPersonalError(true);
      })
      .finally(() => {
        if (!disposed) setPersonalLoading(false);
      });
    return () => { disposed = true; };
  }, [visible, mapPicking, query, destinationIsActive, canUsePersonalPlaces, app.settings.city]);
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
    setLoading(false);
    if (!visible || mapPicking || voiceBusy) return;
    let disposed = false;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        if (version !== requestVersion.current) return;
        setLoading(true);
        setError("");
        try {
          let result: Place[];
          if (query.trim().length < 2) {
            const known = PLACES.filter((p) => p.city === app.settings.city);
            const fix = location.fix;
            if (fix && haversine(fix, CITIES[app.settings.city].center) <= 60) {
              const nearby = (await reverseMapPlace(
                fix,
                app.settings.city,
              ).catch(() => null)) as ReferencedPlace | null;
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
          } else if (LIVE && !app.demo) {
            const resolved = await resolveMapRequest(
              query.trim(),
              app.settings.city,
              app.settings.language,
              query.trim().split(/\s+/).length >= 2,
              controller.signal,
            );
            result = resolved.places;
            if (!disposed && version === requestVersion.current)
              setResolveNotice(
                result.length ? app.t("smartSearchConfirm") : "",
              );
          } else result = await app.search(query.trim());
          if (!disposed && version === requestVersion.current)
            setPlaces(result);
        } catch (e) {
          if (!disposed && version === requestVersion.current)
            setError((e as Error).message);
        } finally {
          if (!disposed && version === requestVersion.current)
            setLoading(false);
        }
      },
      query.trim().length >= 2 ? 700 : 100,
    );
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    query,
    visible,
    mapPicking,
    active,
    app.settings.city,
    app.settings.language,
    voiceBusy,
  ]);
  const activate = (target: Target) => {
    if (active === target) return;
    requestVersion.current++;
    setVoiceFeedback({ phase: "idle", level: 0, seconds: 0, message: "" });
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
    // This microphone only searches places; it never runs navigation commands.
    requestVersion.current++;
    setQuery(text.slice(0, 300));
    setPlaces([]);
    setError("");
  };
  const savePlaceInCategory = async (category: SavedPlaceCategory) => {
    if (!saveCandidate) return;
    setSavingPlace(true);
    try {
      const saved = await savePlace({
        id: `saved-${Crypto.randomUUID()}`,
        category,
        label: saveCandidate.name.slice(0, 60),
        place: saveCandidate,
      });
      setPersonalPlaces((current) => current ? {
        ...current,
        savedPlaces: [saved, ...current.savedPlaces.filter((item) => item.id !== saved.id)],
      } : current);
      setSaveCandidate(null);
    } catch (e) {
      setError((e as Error).message);
      setSaveCandidate(null);
    } finally {
      setSavingPlace(false);
    }
  };
  const removeSavedPlace = (saved: SavedPlace) => {
    void deleteSavedPlace(saved.id).then(() => {
      setPersonalPlaces((current) => current ? {
        ...current,
        savedPlaces: current.savedPlaces.filter((item) => item.id !== saved.id),
      } : current);
    }).catch((e) => setError((e as Error).message));
  };
  const togglePersonalization = async () => {
    if (!personalPlaces) return;
    const enabled = !personalPlaces.personalizationEnabled;
    try {
      const preferences = await setPlacePersonalizationPreferences({
        personalizedSuggestions: enabled,
      });
      setPersonalPlaces((current) => current ? {
        ...current,
        personalizationEnabled: preferences.personalizedSuggestions,
        suggestions: preferences.personalizedSuggestions ? current.suggestions : [],
        recent: preferences.personalizedSuggestions ? current.recent : [],
        completedTripsAnalyzed: preferences.personalizedSuggestions ? current.completedTripsAnalyzed : 0,
      } : current);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const savedForPlace = (place: Place) =>
    personalPlaces?.savedPlaces.find((saved) => saved.place.id === place.id);
  const categoryOptions: SavedPlaceCategory[] = [
    "home", "work", "school", "hospital", "favorite",
  ];
  const personalPlaceIds = new Set([
    ...(personalPlaces?.savedPlaces.map((saved) => saved.place.id) || []),
    ...(personalPlaces?.suggestions.map((item) => item.place.id) || []),
    ...(personalPlaces?.recent.map((item) => item.place.id) || []),
  ]);
  const visiblePlaces = !query.trim() && destinationIsActive
    ? places.filter((place) => !personalPlaceIds.has(place.id))
    : places;
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
          placeholder={
            isActive && voiceBusy
              ? app.t(
                  voiceFeedback.phase === "recording"
                    ? "voiceListening"
                    : voiceFeedback.phase === "transcribing"
                      ? "voiceTranscribing"
                      : "voicePreparing",
                )
              : routeMode
                ? place?.name || label
                : app.t("searchPlace")
          }
          placeholderTextColor={C.muted}
          value={isActive ? query : place?.name || ""}
          onFocus={() => activate(target)}
          onChangeText={(value) => {
            requestVersion.current++;
            setQuery(value);
            setPlaces([]);
          }}
          style={styles.input}
          editable={!voiceBusy}
          maxLength={300}
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
    <>
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
              {(voiceBusy || voiceFeedback.message) && (
                <View
                  accessibilityLiveRegion="polite"
                  style={{
                    minHeight: 28,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {voiceFeedback.phase === "recording" && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        height: 24,
                      }}
                    >
                      {[0.6, 1, 0.8, 1, 0.6].map((weight, index) => (
                        <View
                          key={index}
                          style={{
                            width: 4,
                            borderRadius: 2,
                            backgroundColor: C.yellow,
                            height: 4 + voiceFeedback.level * weight * 20,
                          }}
                        />
                      ))}
                    </View>
                  )}
                  <Txt variant="small" color={C.muted} style={{ flex: 1 }}>
                    {voiceFeedback.message ||
                      app.t(
                        voiceFeedback.phase === "recording"
                          ? "voiceListening"
                          : voiceFeedback.phase === "transcribing"
                            ? "voiceTranscribing"
                            : "voicePreparing",
                      )}
                  </Txt>
                  {voiceFeedback.phase === "recording" && (
                    <Txt variant="small" color={C.muted}>
                      {voiceFeedback.seconds}s
                    </Txt>
                  )}
                </View>
              )}
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
                {visible && (
                  <DestinationVoiceButton
                    key={`${active}-${app.settings.city}-${app.settings.language}`}
                    onResult={onVoice}
                    onBusyChange={setVoiceBusy}
                    onFeedback={setVoiceFeedback}
                  />
                )}
              </View>
              {!!resolveNotice && (
                <Txt variant="small" color={C.muted}>
                  {resolveNotice}
                </Txt>
              )}
              <Txt variant="micro" color={C.muted}>
                {query
                  ? app.t("placeResults")
                  : location.fix
                    ? app.t("placeLandmarks")
                    : app.t("placeLandmarks")}
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
              {!query.trim() && destinationIsActive && canUsePersonalPlaces && (
                <View style={{ paddingBottom: 10 }}>
                  {personalLoading && !personalPlaces && (
                    <ActivityIndicator style={{ marginVertical: 16 }} color={C.muted} />
                  )}
                  {personalError && !personalPlaces && (
                    <Txt variant="small" color={C.muted} style={{ paddingVertical: 10 }}>
                      {app.t("personalizationLoadError")}
                    </Txt>
                  )}
                  {!!personalPlaces?.savedPlaces.length && (
                    <>
                      <Txt variant="micro" color={C.muted} style={{ paddingTop: 8, paddingBottom: 4 }}>
                        {app.t("placesSaved")}
                      </Txt>
                      {personalPlaces.savedPlaces.map((saved) => (
                        <View key={`saved-${saved.id}`} style={styles.placeItem}>
                          <Pressable onPress={() => choose(saved.place)} style={[s.row, { flex: 1, minWidth: 0 }]}>
                            <View style={styles.placeIcon}><BookmarkCheck size={18} color={C.ink} /></View>
                            <View style={{ flex: 1 }}>
                              <Txt variant="label" translate={false}>{saved.label}</Txt>
                              <Txt variant="small" color={C.muted} translate={false}>{humanAddress(saved.place.address)}</Txt>
                            </View>
                            <ArrowUpRight color={C.muted} size={17} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${app.t("placeRemove")}: ${saved.label}`}
                            hitSlop={8}
                            style={styles.trailingAction}
                            onPress={() => Alert.alert(app.t("placeRemove"), saved.label, [
                              { text: app.t("cancel"), style: "cancel" },
                              { text: app.t("placeRemove"), style: "destructive", onPress: () => removeSavedPlace(saved) },
                            ])}
                          >
                            <Trash2 size={17} color={C.muted} />
                          </Pressable>
                        </View>
                      ))}
                    </>
                  )}
                  {!!personalPlaces?.personalizationEnabled && !!personalPlaces.suggestions.length && (
                    <>
                      <Txt variant="micro" color={C.muted} style={{ paddingTop: 12, paddingBottom: 4 }}>
                        {app.t("placesForYou")}
                      </Txt>
                      {personalPlaces.suggestions.map(({ place }) => (
                        <Pressable key={`suggestion-${place.id}`} onPress={() => choose(place)} style={styles.placeItem}>
                          <View style={styles.placeIcon}><MapPin size={18} color={C.ink} /></View>
                          <View style={{ flex: 1 }}>
                            <Txt variant="label" translate={false}>{place.name}</Txt>
                            <Txt variant="small" color={C.muted} translate={false}>{humanAddress(place.address)}</Txt>
                          </View>
                          <ArrowUpRight color={C.muted} size={17} />
                        </Pressable>
                      ))}
                    </>
                  )}
                  {!!personalPlaces?.personalizationEnabled && !!personalPlaces.recent.length && (
                    <>
                      <Txt variant="micro" color={C.muted} style={{ paddingTop: 12, paddingBottom: 4 }}>
                        {app.t("placesRecent")}
                      </Txt>
                      {personalPlaces.recent
                        .filter((recent) => !personalPlaces.suggestions.some((item) => item.place.id === recent.place.id))
                        .map(({ place }) => (
                          <Pressable key={`recent-${place.id}`} onPress={() => choose(place)} style={styles.placeItem}>
                            <View style={styles.placeIcon}><MapPin size={18} color={C.ink} /></View>
                            <View style={{ flex: 1 }}>
                              <Txt variant="label" translate={false}>{place.name}</Txt>
                              <Txt variant="small" color={C.muted} translate={false}>{humanAddress(place.address)}</Txt>
                            </View>
                            <ArrowUpRight color={C.muted} size={17} />
                          </Pressable>
                        ))}
                    </>
                  )}
                  {!!personalPlaces && (
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: personalPlaces.personalizationEnabled }}
                      onPress={() => void togglePersonalization()}
                      style={styles.preferenceRow}
                    >
                      <Txt variant="small" style={{ flex: 1 }}>{app.t("personalizationOn")}</Txt>
                      <View style={[styles.preferencePill, personalPlaces.personalizationEnabled && styles.preferencePillOn]}>
                        <Txt variant="micro" color={personalPlaces.personalizationEnabled ? C.ink : C.muted}>
                          {personalPlaces.personalizationEnabled ? app.t("personalizationEnabled") : app.t("personalizationOff")}
                        </Txt>
                      </View>
                    </Pressable>
                  )}
                </View>
              )}
              {visiblePlaces.map((p) => (
                <View
                  key={p.id}
                  style={styles.placeItem}
                >
                  <Pressable onPress={() => choose(p)} style={[s.row, { flex: 1, minWidth: 0 }]}>
                    <View style={styles.placeIcon}><MapPin size={18} color={C.ink} /></View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="label" translate={false}>{p.name}</Txt>
                      <Txt variant="small" color={C.muted} translate={false}>{humanAddress(p.address)}</Txt>
                    </View>
                    <ArrowUpRight color={C.muted} size={17} />
                  </Pressable>
                  {canUsePersonalPlaces && !savedForPlace(p) && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={app.t("placeSave")}
                      hitSlop={8}
                      style={styles.trailingAction}
                      onPress={() => setSaveCandidate(p)}
                    >
                      <Bookmark size={18} color={C.muted} />
                    </Pressable>
                  )}
                </View>
              ))}
              {!loading && !places.length && !query && (
                <ActivityIndicator style={{ marginTop: 20 }} color={C.muted} />
              )}
              {!loading && !places.length && !!query && (
                <Txt color={C.muted} style={{ paddingTop: 22 }}>
                  Aucun lieu trouvé. Essayez un quartier ou une autre adresse.
                </Txt>
              )}
              {visiblePlaces.some((p) => p.googleAttribution) && (
                <Txt variant="small" color={C.muted} style={{ paddingTop: 20 }}>
                  Google Maps
                </Txt>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Screen>
      )}
    </Modal>
    <Modal
      visible={!!saveCandidate}
      transparent
      animationType="fade"
      onRequestClose={() => !savingPlace && setSaveCandidate(null)}
    >
      <View style={styles.saveOverlay}>
        <View style={styles.saveSheet}>
          <View style={[s.rowBetween, { alignItems: "center" }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Txt variant="h3">{app.t("placeSaveAs")}</Txt>
              {!!saveCandidate && <Txt variant="small" color={C.muted} translate={false}>{saveCandidate.name}</Txt>}
            </View>
            <IconButton icon={X} label={app.t("close")} onPress={() => setSaveCandidate(null)} />
          </View>
          {categoryOptions.map((category) => (
            <Pressable
              key={category}
              disabled={savingPlace}
              onPress={() => void savePlaceInCategory(category)}
              style={styles.categoryOption}
            >
              {savingPlace ? <ActivityIndicator color={C.ink} /> : <Bookmark size={18} color={C.ink} />}
              <Txt variant="label">{app.t(category === "home" ? "placeHome" : category === "work" ? "placeWork" : category === "school" ? "placeSchool" : category === "hospital" ? "placeHospital" : "placeFavorite")}</Txt>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  placeItem: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingVertical: 12,
  },
  placeIcon: { padding: 11, backgroundColor: C.background, borderRadius: 14 },
  trailingAction: { width: 42, minHeight: 44, alignItems: "center", justifyContent: "center" },
  preferenceRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  preferencePill: { minHeight: 30, paddingHorizontal: 10, justifyContent: "center", borderRadius: 15, backgroundColor: C.background },
  preferencePillOn: { backgroundColor: C.yellow },
  saveOverlay: { flex: 1, backgroundColor: "rgba(18, 20, 18, 0.38)", justifyContent: "flex-end" },
  saveSheet: { backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 32, gap: 6 },
  categoryOption: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: 1, borderBottomColor: C.line },
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
