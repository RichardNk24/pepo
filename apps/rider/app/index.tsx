import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { BrandSplash } from "@pepo/ui/BrandSplash";
import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated } from "react-native";
export default function Index() {
  const { ready, profile } = useApp();
  const [finished, setFinished] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;
    const timer = setTimeout(() => {
      void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
        if (cancelled) return;
        animation = Animated.timing(opacity, {
          toValue: 0,
          duration: reduce ? 0 : 280,
          useNativeDriver: true,
        });
        animation.start(({ finished }) => {
          if (finished && !cancelled) setFinished(true);
        });
      });
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      animation?.stop();
    };
  }, [ready, opacity]);
  if (finished) return <Redirect href={profile ? "/(tabs)" : "/onboarding"} />;
  return (
    <Animated.View style={{ flex: 1, opacity, backgroundColor: C.yellow }}>
      <BrandSplash fontsReady />
    </Animated.View>
  );
}
