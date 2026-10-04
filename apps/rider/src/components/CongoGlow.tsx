import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";
import Svg, { Path } from "react-native-svg";
const AnimatedPath = Animated.createAnimatedComponent(Path);
// Simplified country outline: johan/world.geo.json (Natural Earth, public domain).
const OUTLINE =
  "M221.6 47.5 L221.0 59.2 L225.0 60.5 L221.8 64.1 L217.9 66.7 L214.1 72.0 L212.0 76.6 L211.4 84.6 L209.1 88.5 L209.0 96.0 L206.2 98.8 L205.8 104.7 L204.4 105.5 L203.5 111.0 L206.0 115.5 L206.7 127.6 L208.5 136.8 L207.5 142.0 L209.5 147.8 L215.3 153.4 L220.7 166.0 L216.7 165.0 L203.3 166.7 L200.6 167.9 L197.7 174.3 L200.0 178.7 L198.2 190.5 L197.0 200.6 L199.7 202.4 L206.7 206.2 L209.4 204.4 L210.2 215.2 L202.6 215.1 L198.5 209.6 L194.8 205.4 L187.1 204.0 L184.9 198.7 L178.8 201.9 L170.8 200.5 L167.4 195.9 L161.1 195.0 L156.4 195.3 L155.8 192.2 L152.3 191.9 L147.8 191.3 L141.6 192.8 L137.2 192.6 L134.8 193.5 L135.3 181.6 L132.0 177.9 L131.2 171.7 L132.7 165.7 L130.7 161.8 L130.5 155.5 L118.4 155.6 L119.2 152.0 L114.1 152.0 L113.6 153.8 L107.4 154.2 L104.9 160.0 L103.4 162.5 L97.8 161.1 L94.5 162.5 L87.9 163.3 L84.1 158.1 L81.8 154.8 L78.9 148.8 L76.5 141.4 L46.9 141.3 L43.4 142.5 L40.5 142.3 L36.4 143.6 L35.0 140.5 L37.5 139.5 L37.9 135.1 L39.5 132.5 L43.1 130.4 L45.8 131.4 L49.2 127.6 L54.6 127.7 L55.3 130.5 L59.0 132.3 L64.9 126.0 L70.7 121.2 L73.3 118.0 L72.9 109.7 L77.3 100.0 L81.8 94.8 L88.4 90.0 L89.6 86.8 L89.8 83.2 L91.5 79.7 L90.9 74.0 L92.2 65.2 L94.1 58.9 L97.1 53.6 L97.7 47.5 L98.6 40.5 L102.5 35.5 L107.9 32.2 L116.1 35.6 L122.5 39.3 L129.8 40.3 L137.3 42.3 L140.3 36.2 L141.6 35.5 L146.2 36.5 L157.3 31.5 L161.3 33.6 L164.5 33.3 L166.0 30.9 L169.7 30.0 L177.3 31.1 L183.7 31.3 L187.0 30.2 L193.0 38.5 L197.5 39.7 L200.2 38.0 L204.8 38.7 L210.4 36.6 L212.8 40.8 L221.6 47.5 Z";
const LENGTH = 753.1;
export function CongoGlow() {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduceMotion(v);
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
    if (reduceMotion) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, progress]);
  const offset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -LENGTH],
  });
  return (
    <Svg
      width={230}
      height={230}
      viewBox="0 0 260 260"
      accessibilityLabel="Carte de la République démocratique du Congo"
    >
      <Path
        d={OUTLINE}
        fill="none"
        stroke="#000000"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {!reduceMotion && (
        <>
          <AnimatedPath
            d={OUTLINE}
            fill="none"
            stroke="#FFF8BC"
            strokeOpacity={0.3}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={[32, LENGTH - 32]}
            strokeDashoffset={offset}
          />
          <AnimatedPath
            d={OUTLINE}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={[22, LENGTH - 22]}
            strokeDashoffset={offset}
          />
        </>
      )}
    </Svg>
  );
}
