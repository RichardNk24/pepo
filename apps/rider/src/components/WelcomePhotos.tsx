import { C } from "@pepo/config/tokens";
import { Txt } from "@pepo/ui/UI";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const photos = [
  require("../../assets/welcome/pepo-moto.jpeg"),
  require("../../assets/welcome/pepo-voiture.jpeg"),
];

export function WelcomePhotos() {
  const [selected, setSelected] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [loaded, setLoaded] = useState([false, false]);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduceMotion(value);
    });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    const state = AppState.addEventListener("change", (value) =>
      setActive(value === "active"),
    );
    return () => {
      alive = false;
      motion.remove();
      state.remove();
    };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: selected,
      duration: reduceMotion ? 0 : 800,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, reduceMotion, opacity]);
  useEffect(() => {
    if (reduceMotion || !active || !loaded.every(Boolean)) return;
    const timer = setTimeout(() => setSelected((value) => 1 - value), 5500);
    return () => clearTimeout(timer);
  }, [selected, reduceMotion, active, loaded]);
  return (
    <View style={{ gap: 14 }}>
      <View
        style={styles.frame}
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          selected === 0
            ? "Une passagère avec un motard Pepo"
            : "Une passagère à bord d’un taxi Pepo"
        }
      >
        <Image
          source={photos[0]}
          resizeMode="cover"
          accessible={false}
          style={styles.photo}
          onLoad={() => setLoaded((value) => [true, value[1]])}
        />
        <Animated.Image
          source={photos[1]}
          resizeMode="cover"
          accessible={false}
          style={[styles.photo, { opacity }]}
          onLoad={() => setLoaded((value) => [value[0], true])}
        />
      </View>
      <View style={styles.choices}>
        {["Moto", "Voiture"].map((label, index) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`Voir la photo ${label.toLowerCase()}`}
            accessibilityState={{ selected: selected === index }}
            onPress={() => setSelected(index)}
            style={styles.choice}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: selected === index ? C.ink : C.line },
              ]}
            />
            <Txt variant="small" color={selected === index ? C.ink : C.muted}>
              {label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  photo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  frame: {
    width: "100%",
    aspectRatio: 1.2,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: C.yellowSoft,
  },
  choices: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
