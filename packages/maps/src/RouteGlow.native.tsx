import type { Point } from "@pepo/types/model";
import { createRoutePulse } from "@pepo/utils/routePulse";
import { useEffect,useMemo,useState } from "react";
import { Polyline } from "react-native-maps";
import { useMapMotion } from "./useMapMotion";
export function RouteGlow({
  points,
  visible,
}: {
  points: Point[];
  visible: boolean;
}) {
  const enabled = useMapMotion();
  const pulse = useMemo(() => createRoutePulse(points), [points]);
  const [layers, setLayers] = useState<ReturnType<typeof pulse.frame>>([]);
  useEffect(() => {
    setLayers([]);
    if (!enabled || !visible || points.length < 2) return;
    let frame = 0,
      previous = 0;
    const start = Date.now();
    const tick = () => {
      const now = Date.now();
      if (now - previous >= 33) {
        previous = now;
        setLayers(pulse.frame(now - start));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pulse, enabled, visible]);
  if (!enabled || !visible) return null;
  const halo = layers.slice(18).flatMap((layer) => layer.points);
  return (
    <>
      {halo.length >= 2 && (
        <Polyline
          coordinates={halo}
          strokeColor="#C8B10926"
          strokeWidth={12}
          zIndex={3}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {layers.map(
        (layer, index) =>
          layer.points.length >= 2 && (
            <Polyline
              key={index}
              coordinates={layer.points}
              strokeColor={layer.color}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              zIndex={4}
            />
          ),
      )}
    </>
  );
}
