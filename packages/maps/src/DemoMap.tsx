import { C } from "@pepo/config/tokens";
import { Txt } from "@pepo/ui/UI";
import { useState } from "react";
import { StyleSheet,View } from "react-native";
import Svg,{ Circle,G,Path,Rect,Text as SvgText } from "react-native-svg";
import type { MapProps } from "./MapTypes";
import { VehicleArt } from "./VehicleArt";

export function DemoMap({
  labels: endpointLabels,
  pickup,
  destination,
  route,
  driver,
  driverVehicleKind,
  vehicles = true,
  bottomInset = 0,
  routeLabels = false,
}: MapProps) {
  const [size, setSize] = useState({ width: 410, height: 620 });
  const scale = 410 / Math.max(1, size.width);
  const canvasHeight = size.height * scale;
  const top = bottomInset ? 100 : 75;
  const usable = Math.max(55, canvasHeight - top - bottomInset * scale - 60);
  const points = route?.points || [pickup];
  const minLat = Math.min(...points.map((p) => p.latitude)),
    maxLat = Math.max(...points.map((p) => p.latitude));
  const minLon = Math.min(...points.map((p) => p.longitude)),
    maxLon = Math.max(...points.map((p) => p.longitude));
  const latSpan = Math.max(maxLat - minLat, 0.014),
    lonSpan = Math.max(maxLon - minLon, 0.014);
  const project = (p: { latitude: number; longitude: number }) => ({
    x: 66 + ((p.longitude - (minLon + maxLon) / 2) / lonSpan + 0.5) * 278,
    y:
      top +
      usable / 2 +
      (((maxLat + minLat) / 2 - p.latitude) / latSpan) * usable * 0.7,
  });
  const start = project(pickup);
  const end = destination && project(destination);
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${project(p).x},${project(p).y}`)
    .join(" ");
  const driverPos = driver ? project(driver) : { x: 263, y: 186 };
  const labels =
    pickup.city === "kinshasa"
      ? ["GOMBE", "KINSHASA", "Av. de la Justice", "Boulevard du 30 Juin"]
      : pickup.city === "kolwezi"
        ? ["DILALA", "KOLWEZI", "Av. du Commerce", "Avenue de la Paix"]
        : ["GOLF", "LUBUMBASHI", "Avenue Kasaï", "Avenue de la Révolution"];
  return (
    <View
      style={m.fill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== size.width || height !== size.height)
          setSize({ width, height });
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 410 ${canvasHeight}`}
        preserveAspectRatio="none"
      >
        <Rect width="410" height={canvasHeight} fill={C.map} />
        <Path d="M0 12 L116 0 L112 134 L32 184 L0 169 Z" fill="#DDE5CC" />
        <Path d="M313 286 L410 266 L410 426 L354 410Z" fill="#E1E8D0" />
        <Path
          d="M357 -20 Q308 50 345 114 Q392 184 351 240 Q334 276 416 343"
          fill="none"
          stroke="#D1E3DF"
          strokeWidth="17"
        />
        {Array.from({ length: 10 }, (_, i) => (
          <Path
            key={`h${i}`}
            d={`M-25 ${65 + i * 57} L440 ${25 + i * 57}`}
            stroke="#FFFFFF"
            strokeWidth={i === 4 ? 12 : 6}
          />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <Path
            key={`v${i}`}
            d={`M${-20 + i * 57} -30 L${80 + i * 57} 670`}
            stroke="#FFFFFF"
            strokeWidth={i === 4 ? 12 : 6}
          />
        ))}
        <Path
          d="M-30 449 L470 143 M-20 574 L469 278"
          stroke="#E4E2D1"
          strokeWidth="16"
        />
        <Path
          d="M-30 449 L470 143 M-20 574 L469 278"
          stroke="#FFFFFF"
          strokeWidth="11"
        />
        <SvgText x="41" y="111" fontSize="10" fill="#8B927F" letterSpacing="3">
          {labels[0]}
        </SvgText>
        <SvgText x="137" y="371" fontSize="12" fill="#929587" letterSpacing="3">
          {labels[1]}
        </SvgText>
        <SvgText
          x="22"
          y="276"
          fontSize="9"
          fill="#A6AA9D"
          transform="rotate(-5 22 276)"
        >
          {labels[2]}
        </SvgText>
        <SvgText
          x="238"
          y="113"
          fontSize="9"
          fill="#A6AA9D"
          transform="rotate(78 238 113)"
        >
          {labels[3]}
        </SvgText>
        {route && (
          <>
            <Path
              d={path}
              stroke="#FFFFFF"
              strokeWidth="9"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={path}
              stroke={C.ink}
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {routeLabels && (
          <G>
            <Rect
              x={start.x - 31}
              y={start.y - 49}
              width="62"
              height="26"
              rx="10"
              fill={C.ink}
            />
            <SvgText
              x={start.x}
              y={start.y - 32}
              fontSize="11"
              textAnchor="middle"
              fill={C.paper}
            >
              {endpointLabels?.pickup || "Départ"}
            </SvgText>
            {end && (
              <G>
                <Rect
                  x={end.x - 31}
                  y={end.y - 49}
                  width="62"
                  height="26"
                  rx="10"
                  fill={C.ink}
                />
                <SvgText
                  x={end.x}
                  y={end.y - 32}
                  fontSize="11"
                  textAnchor="middle"
                  fill={C.yellow}
                >
                  {endpointLabels?.destination || "Arrivée"}
                </SvgText>
              </G>
            )}
          </G>
        )}
        <G>
          <Circle cx={start.x} cy={start.y} r="15" fill="#FFFFFF" />
          <Circle cx={start.x} cy={start.y} r="11" fill={C.ink} />
          <Circle cx={start.x} cy={start.y} r="4" fill="#FFFFFF" />
        </G>
        {end && (
          <G>
            <Circle cx={end.x} cy={end.y} r="16" fill="#FFFFFF" />
            <Circle cx={end.x} cy={end.y} r="12" fill={C.yellow} />
            <Rect
              x={end.x - 4}
              y={end.y - 4}
              width="8"
              height="8"
              rx="2"
              fill={C.ink}
            />
          </G>
        )}
      </Svg>
      {vehicles && (
        <>
          <View
            pointerEvents="none"
            style={[
              m.bike,
              { left: "16%", top: 168, transform: [{ rotate: "18deg" }] },
            ]}
          >
            <VehicleArt top kind="taxi" width={21} />
          </View>
          <View
            pointerEvents="none"
            style={[
              m.bike,
              { right: "16%", top: 285, transform: [{ rotate: "-26deg" }] },
            ]}
          >
            <VehicleArt top width={21} />
          </View>
        </>
      )}
      {driver && (
        <View
          pointerEvents="none"
          style={[
            m.bike,
            {
              left: `${(driverPos.x / 410) * 100}%`,
              top: driverPos.y / scale - 20,
            },
          ]}
        >
          <VehicleArt top kind={driverVehicleKind} width={24} />
        </View>
      )}
      <View style={[m.label, { bottom: Math.max(12, bottomInset + 8) }]}>
        <Txt variant="small" color="#78816F" style={{ fontSize: 9 }}>
          CARTE DÉMO · positions indicatives
        </Txt>
      </View>
    </View>
  );
}
const m = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.map,
    overflow: "hidden",
  },
  bike: { position: "absolute" },
  label: {
    position: "absolute",
    left: 12,
    padding: 3,
    backgroundColor: "#F5F5EFC9",
    borderRadius: 4,
  },
});
