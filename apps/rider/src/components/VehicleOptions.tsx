import * as Haptics from "expo-haptics";
import { Clock3, DollarSign, Users } from "lucide-react-native";
import { useContext, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import Animated, { LinearTransition } from "react-native-reanimated";

import { C } from "@pepo/config/tokens";
import { VehicleArt } from "@pepo/maps/VehicleArt";
import type { ActiveVehicleKind } from "@pepo/types/model";
import { Txt } from "@pepo/ui/UI";
import { VEHICLES } from "@pepo/utils/cities";
import { fare, suggestedFare } from "@pepo/utils/rules";
import {
  isVehicleVisible,
  shouldShowVehicleDetails,
  type VehicleOptionsDensity,
} from "../domain/rideLayout";
import { SnapSheetScrollContext } from "./SnapSheet";

type SortMode = "recommended" | "faster" | "price";

export function VehicleOptions({
  value,
  onChange,
  distanceKm,
  priceReady,
  density = "expanded",
  pickupEtaMinutes = {},
}: {
  value: ActiveVehicleKind;
  onChange: (kind: ActiveVehicleKind) => void;
  distanceKm: number;
  priceReady: boolean;
  density?: VehicleOptionsDensity;
  /** Live pickup estimates from dispatch, keyed by vehicle type. */
  pickupEtaMinutes?: Partial<Record<ActiveVehicleKind, number>>;
}) {
  const [sort, setSort] = useState<SortMode>("recommended");
  const sheetScroll = useContext(SnapSheetScrollContext);
  const [sectionY, setSectionY] = useState(0);
  const [selectedRowY, setSelectedRowY] = useState(0);

  /**
   * On conserve originalIndex afin que :
   *
   * - "Recommandés" retrouve toujours l'ordre original.
   * - "Plus rapide" ne crée pas d'ordre arbitraire
   *   si les ETA ne sont pas encore disponibles.
   */
  const sortedVehicles = VEHICLES.map((vehicle, originalIndex) => ({
    ...vehicle,
    originalIndex,
  })).sort((a, b) => {
    /**
     * MOINS CHER
     */
    if (sort === "price") {
      return suggestedFare(distanceKm, a.id) - suggestedFare(distanceKm, b.id);
    }

    /**
     * PLUS RAPIDE
     */
    if (sort === "faster") {
      const aMinutes = pickupEtaMinutes[a.id] ?? null;
      const bMinutes = pickupEtaMinutes[b.id] ?? null;

      if (aMinutes !== null && bMinutes !== null) {
        return aMinutes - bMinutes;
      }

      if (aMinutes !== null) return -1;
      if (bMinutes !== null) return 1;

      return a.originalIndex - b.originalIndex;
    }

    /**
     * RECOMMANDÉS
     */
    return a.originalIndex - b.originalIndex;
  });
  useEffect(() => {
    if (!sheetScroll) return;
    const frame = requestAnimationFrame(() => {
      sheetScroll.scrollTo(
        density === "expanded" ? 0 : sectionY + selectedRowY,
        false,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [density, sectionY, selectedRowY, sheetScroll, value, sort]);

  /**
   * SÉLECTION D'UN VÉHICULE
   *
   * Important :
   * on ne déclenche rien si le véhicule est déjà sélectionné.
   */
  const selectVehicle = (kind: ActiveVehicleKind) => {
    if (kind === value) {
      return;
    }

    void Haptics.selectionAsync();

    onChange(kind);
  };

  /**
   * SÉLECTION D'UN FILTRE
   *
   * Le haptic se déclenche immédiatement.
   * Ensuite Reanimated anime les véhicules vers
   * leurs nouvelles positions.
   */
  const selectSort = (mode: SortMode) => {
    if (mode === sort) {
      return;
    }

    void Haptics.selectionAsync();

    setSort(mode);
  };

  return (
    <View
      onLayout={(event) => setSectionY(event.nativeEvent.layout.y)}
      style={{
        marginTop: 10,
        width: "100%",
      }}
    >
      {/* ======================================================
          FILTRES
      ====================================================== */}

      {density === "expanded" && (
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",

            gap: 8,

            paddingHorizontal: 12,

            marginBottom: 10,
          }}
        >
          <SortButton
            label="Recommandés"
            selected={sort === "recommended"}
            width={124}
            onPress={() => selectSort("recommended")}
          />

          <SortButton
            label="Plus rapide"
            selected={sort === "faster"}
            icon="clock"
            width={118}
            onPress={() => selectSort("faster")}
          />

          <SortButton
            label="Moins cher"
            selected={sort === "price"}
            icon="price"
            width={118}
            onPress={() => selectSort("price")}
          />
        </View>
      )}

      {/* ======================================================
          LISTE DES VÉHICULES
      ====================================================== */}

      <View
        style={{
          width: "100%",
          paddingHorizontal: 4,
        }}
      >
        {sortedVehicles.map((v, index) => {
          const selected = value === v.id;
          const visible = isVehicleVisible(v.id, value, density);
          const showDetails = shouldShowVehicleDetails(v.id, value, density);

          const amount = priceReady
            ? fare(suggestedFare(distanceKm, v.id))
            : "—";

          const pickupMinutes = pickupEtaMinutes[v.id] ?? null;

          const previousSelected =
            index > 0 && value === sortedVehicles[index - 1]?.id;

          return (
            /**
             * IMPORTANT :
             *
             * La key reste v.id.
             *
             * React/Reanimated comprend donc qu'il s'agit
             * du MÊME véhicule qui change de position,
             * et non d'un nouvel élément.
             *
             * LinearTransition anime automatiquement le
             * déplacement vertical vers la nouvelle place.
             */
            <Animated.View
              key={v.id}
              layout={LinearTransition.duration(320)}
              onLayout={
                selected
                  ? (event) => setSelectedRowY(event.nativeEvent.layout.y)
                  : undefined
              }
              style={
                !visible
                  ? { height: 0, opacity: 0, overflow: "hidden" }
                  : undefined
              }
              pointerEvents={visible ? "auto" : "none"}
              accessibilityElementsHidden={!visible}
              importantForAccessibility={
                visible ? "auto" : "no-hide-descendants"
              }
            >
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel={v.name}
                accessibilityState={{
                  selected,
                }}
                onPress={() => selectVehicle(v.id)}
                style={{
                  width: "100%",

                  flexDirection: "row",
                  alignItems: "center",

                  /**
                   * Toujours exactement la même taille.
                   *
                   * Aucun zoom / déplacement lorsque
                   * la sélection change.
                   */
                  minHeight:
                    density === "expanded" ? 118 : showDetails ? 118 : 88,

                  paddingLeft: 5,
                  paddingRight: 8,
                  paddingVertical: showDetails ? 12 : 7,

                  /**
                   * Le border existe constamment.
                   *
                   * Seule sa couleur change.
                   */
                  borderWidth: 2.5,

                  borderColor: selected ? C.yellow : "transparent",

                  /**
                   * Toujours le même radius pour éviter
                   * toute variation géométrique.
                   */
                  borderRadius: 14,

                  backgroundColor: C.paper,
                }}
              >
                {/* =============================================
                    IMAGE DU VÉHICULE
                ============================================== */}

                <View
                  style={{
                    width: 76,
                    minWidth: 76,

                    alignItems: "center",
                    justifyContent: "center",

                    marginRight: 6,
                  }}
                >
                  <VehicleArt kind={v.id} width={72} />
                </View>

                {/* =============================================
                    INFORMATIONS DU VÉHICULE
                ============================================== */}

                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    paddingRight: 5,
                  }}
                >
                  <Txt
                    variant="label"
                    numberOfLines={1}
                    style={{
                      fontSize: 18,
                      lineHeight: 22,
                      fontWeight: "700",
                      marginBottom: 4,
                    }}
                  >
                    {v.name}
                  </Txt>

                  {/* ETA + passagers */}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: showDetails ? 4 : 0,
                    }}
                  >
                    {pickupMinutes !== null && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Clock3 size={15} color={C.muted} strokeWidth={2} />

                        <Txt
                          variant="small"
                          color={C.muted}
                          style={{
                            fontSize: 14,
                          }}
                        >
                          {pickupMinutes} min
                        </Txt>
                      </View>
                    )}

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Users size={16} color={C.muted} strokeWidth={2} />

                      <Txt
                        variant="small"
                        color={C.muted}
                        style={{
                          fontSize: 14,
                        }}
                      >
                        {v.seats}
                      </Txt>
                    </View>
                  </View>

                  {/* Description */}

                  {showDetails && (
                    <Txt
                      variant="small"
                      color={C.muted}
                      numberOfLines={2}
                      style={{
                        fontSize: 14.5,
                        lineHeight: 19,
                      }}
                    >
                      {v.detail}
                    </Txt>
                  )}
                </View>

                {/* =============================================
                    PRIX
                ============================================== */}

                <View
                  style={{
                    minWidth: 86,

                    alignSelf: "flex-start",
                    alignItems: "flex-end",

                    paddingTop: 5,
                  }}
                >
                  <Txt
                    variant="label"
                    numberOfLines={1}
                    style={{
                      fontSize: 17,
                      lineHeight: 21,
                      fontWeight: "800",
                      textAlign: "right",
                    }}
                  >
                    {amount}
                  </Txt>

                  {priceReady && showDetails && (
                    <Txt
                      variant="small"
                      color={C.muted}
                      style={{
                        marginTop: 3,

                        fontSize: 11.5,
                        lineHeight: 15,

                        textAlign: "right",
                      }}
                    >
                      à négocier
                    </Txt>
                  )}
                </View>
              </Pressable>

              {/* =============================================
                  SÉPARATEUR
              ============================================== */}

              {visible &&
                density !== "selected" &&
                index < sortedVehicles.length - 1 && (
                  <View
                    style={{
                      height: 1,

                      marginLeft: 80,
                      marginRight: 6,

                      backgroundColor:
                        selected || previousSelected ? "transparent" : C.line,
                    }}
                  />
                )}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

/* ============================================================
   SORT BUTTON
============================================================ */

function SortButton({
  label,
  selected,
  icon,
  width,
  onPress,
}: {
  label: string;
  selected: boolean;
  icon?: "clock" | "price";
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{
        selected,
      }}
      onPress={onPress}
      style={{
        width,

        minHeight: 42,

        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",

        gap: 5,

        paddingHorizontal: 8,
        paddingVertical: 9,

        borderRadius: 11,

        /**
         * Border toujours présent.
         * Aucun micro déplacement lors du changement de filtre.
         */
        borderWidth: 2,

        borderColor: selected ? C.yellow : "transparent",

        backgroundColor: selected ? C.paper : "#F0F2EF",
      }}
    >
      {icon === "clock" && <Clock3 size={15} color={C.ink} strokeWidth={2.2} />}

      {icon === "price" && (
        <DollarSign size={15} color={C.ink} strokeWidth={2.2} />
      )}

      <Txt
        variant="small"
        color={C.ink}
        numberOfLines={1}
        style={{
          fontSize: 13.5,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
