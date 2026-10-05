import { C } from "@pepo/config/tokens";
import { createContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type ScrollViewProps,
} from "react-native";
import { sheetGeometry } from "../domain/rideLayout";

export const SnapSheetScrollContext = createContext<{
  scrollTo: (y: number, animated?: boolean) => void;
} | null>(null);

// A separate handle always remains draggable, even while the list is scrolled.
export function SnapSheet({
  children,
  enabled = true,
  bottom = 0,
  onHeight,
  onMoving,
  topInset = 160,
  containerHeight,
  ...props
}: ScrollViewProps & {
  enabled?: boolean;
  bottom?: number;
  onHeight?: (height: number) => void;
  onMoving?: (moving: boolean) => void;
  topInset?: number;
  containerHeight?: number;
}) {
  const { height: screen } = useWindowDimensions();
  const availableHeight = containerHeight ?? screen;
  const { maximum, snaps } = useMemo(
    () => sheetGeometry(availableHeight, bottom, topInset),
    [availableHeight, bottom, topInset],
  );
  const [index, setIndex] = useState(1);
  const height = useRef(new Animated.Value(snaps[1])).current;
  const current = useRef(snaps[1]);
  const start = useRef(current.current);
  const offset = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollController = useMemo(
    () => ({
      scrollTo: (y: number, animated = false) =>
        scrollRef.current?.scrollTo({ y: Math.max(0, y), animated }),
    }),
    [],
  );
  const callback = useRef(onHeight);
  callback.current = onHeight;
  const movingCallback = useRef(onMoving);
  movingCallback.current = onMoving;
  const selectedIndex = useRef(index);
  selectedIndex.current = index;
  useEffect(() => {
    const id = height.addListener(({ value }) => {
      current.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);
  const settle = (value: number, velocity = 0) => {
    const projected = value - velocity * 100;
    const next = snaps.reduce(
      (best, n, i) =>
        Math.abs(n - projected) < Math.abs(snaps[best] - projected) ? i : best,
      0,
    );
    setIndex(next);
    movingCallback.current?.(true);
    Animated.spring(height, {
      toValue: snaps[next],
      damping: 24,
      stiffness: 220,
      mass: 1,
      overshootClamping: true,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        callback.current?.(snaps[next]);
        movingCallback.current?.(false);
      }
    });
  };
  useEffect(() => {
    height.stopAnimation();
    const value = snaps[selectedIndex.current];
    height.setValue(value);
    current.current = value;
    callback.current?.(value);
    movingCallback.current?.(false);
  }, [height, snaps]);
  const gesture = (capture: boolean) =>
    PanResponder.create({
      ...(capture
        ? {
            onMoveShouldSetPanResponderCapture: (
              _: unknown,
              g: { dy: number; dx: number },
            ) =>
              offset.current <= 0 &&
              Math.abs(g.dy) > 6 &&
              Math.abs(g.dy) > Math.abs(g.dx) &&
              (g.dy > 0 || current.current < maximum - 1),
          }
        : {
            onMoveShouldSetPanResponder: (
              _: unknown,
              g: { dy: number; dx: number },
            ) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
          }),
      onPanResponderGrant: () => {
        movingCallback.current?.(true);
        height.stopAnimation();
        start.current = current.current;
      },
      onPanResponderMove: (_, g) =>
        height.setValue(
          Math.max(snaps[0], Math.min(maximum, start.current - g.dy)),
        ),
      onPanResponderRelease: (_, g) => settle(current.current, g.vy),
      onPanResponderTerminate: () => settle(current.current),
    });
  const pan = useMemo(
    () => gesture(false),
    [availableHeight, bottom, topInset],
  );
  const contentPan = useMemo(
    () => gesture(true),
    [availableHeight, bottom, topInset],
  );
  useEffect(() => () => height.stopAnimation(), [height]);
  if (!enabled) return <ScrollView {...props}>{children}</ScrollView>;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        height,
        backgroundColor: C.paper,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: "hidden",
      }}
    >
      <View {...pan.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agrandir ou réduire le panneau"
          onPress={() => settle(snaps[(index + 1) % 3])}
          style={{ height: 28, alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 4,
              backgroundColor: C.line,
            }}
          />
        </Pressable>
      </View>
      <View {...contentPan.panHandlers} style={{ flex: 1 }}>
        <SnapSheetScrollContext.Provider value={scrollController}>
          <ScrollView
            {...props}
            ref={scrollRef}
            style={{ flex: 1 }}
            bounces={false}
            nestedScrollEnabled
            scrollEventThrottle={16}
            onScroll={(e) => {
              offset.current = e.nativeEvent.contentOffset.y;
              props.onScroll?.(e);
            }}
          >
            {children}
          </ScrollView>
        </SnapSheetScrollContext.Provider>
      </View>
    </Animated.View>
  );
}
