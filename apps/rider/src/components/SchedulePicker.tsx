import { C } from "@pepo/config/tokens";
import type { CityId } from "@pepo/types/model";
import { Button, IconButton, s, Txt } from "@pepo/ui/UI";
import {
  cityTimeZone,
  scheduledLabel,
  scheduleSlots,
} from "@pepo/utils/scheduling";
import { CalendarClock, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export function SchedulePicker({
  visible,
  city,
  value,
  onClose,
  onChange,
}: {
  visible: boolean;
  city: CityId;
  value?: number;
  onClose: () => void;
  onChange: (value?: number) => void;
}) {
  const [day, setDay] = useState(0),
    [selected, setSelected] = useState<number>(),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (visible) {
      const current = Date.now();
      const offset = (city === "kinshasa" ? 1 : 2) * 3600000;
      setNow(current);
      setDay(
        value
          ? Math.max(
              0,
              Math.min(
                30,
                Math.floor((value + offset) / 86400000) -
                  Math.floor((current + offset) / 86400000),
              ),
            )
          : 0,
      );
      setSelected(value);
    }
  }, [visible, value, city]);
  const slots = scheduleSlots(now, city, day);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
        <View style={[s.rowBetween, { padding: 20 }]}>
          <CalendarClock size={26} color={C.ink} />
          <Txt variant="h3">Programmer un départ</Txt>
          <IconButton icon={X} label="Fermer" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 20 }}>
          <Txt variant="h2">Quand partez-vous ?</Txt>
          <Txt color={C.muted}>
            Heure locale de{" "}
            {city === "kinshasa"
              ? "Kinshasa"
              : city === "kolwezi"
                ? "Kolwezi"
                : "Lubumbashi"}
            . De 30 minutes à 30 jours à l’avance.
          </Txt>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {Array.from({ length: 31 }, (_, d) => {
              const first = scheduleSlots(now, city, d)[0];
              if (!first) return null;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: day === d }}
                  onPress={() => {
                    setDay(d);
                    setSelected(undefined);
                  }}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    backgroundColor: day === d ? C.yellow : C.background,
                  }}
                >
                  <Txt variant="label">
                    {d === 0
                      ? "Aujourd’hui"
                      : d === 1
                        ? "Demain"
                        : new Date(first).toLocaleDateString("fr-FR", {
                            timeZone: cityTimeZone(city),
                            day: "numeric",
                            month: "short",
                          })}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {slots.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === t }}
                onPress={() => setSelected(t)}
                style={{
                  minWidth: 72,
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: selected === t ? C.ink : C.background,
                }}
              >
                <Txt color={selected === t ? "#fff" : C.ink}>
                  {new Date(t).toLocaleTimeString("fr-FR", {
                    timeZone: cityTimeZone(city),
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Txt>
              </Pressable>
            ))}
          </View>
          {!slots.length && (
            <Txt color={C.muted}>
              Plus de créneau aujourd’hui. Choisissez demain.
            </Txt>
          )}
          <View style={[s.card, { backgroundColor: C.yellowSoft, gap: 8 }]}>
            <Txt variant="label">Un départ prévu, en toute clarté</Txt>
            <Txt variant="small">
              La recherche commence 15 minutes avant. Rouvrez Pepo à ce moment
              pour choisir une offre. La disponibilité d’un conducteur et le
              prix restent à confirmer.
            </Txt>
          </View>
        </ScrollView>
        <View style={{ padding: 20, gap: 10 }}>
          <Button
            title={
              selected
                ? `Choisir le ${scheduledLabel(selected, city)}`
                : "Choisissez une heure"
            }
            disabled={!selected || selected < Date.now() + 30 * 60000}
            onPress={() => {
              onChange(selected);
              onClose();
            }}
          />
          <Button
            title="Partir maintenant"
            kind="secondary"
            onPress={() => {
              onChange(undefined);
              onClose();
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
