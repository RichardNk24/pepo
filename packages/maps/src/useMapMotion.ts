import { useFocusEffect } from "expo-router";
import { useCallback,useEffect,useState } from "react";
import { AccessibilityInfo,AppState } from "react-native";
export function useMapMotion() {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState !== "background");
  const [reduced, setReduced] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(v);
      })
      .catch(() => {
        if (alive) setReduced(false);
      });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const state = AppState.addEventListener("change", (v) =>
      setActive(v === "active"),
    );
    return () => {
      alive = false;
      motion.remove();
      state.remove();
    };
  }, []);
  return focused && active && !reduced;
}
