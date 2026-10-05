import { GOOGLE_MAP_URL, GOOGLE_WEB_KEY } from "@pepo/api-client/maps";
import { C } from "@pepo/config/tokens";
import { useI18n } from "@pepo/i18n/Context";
import { Button, Txt } from "@pepo/ui/UI";
import { validPoint } from "@pepo/utils/mapGeometry";
import { Asset } from "expo-asset";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ActiveVehicleKind } from "@pepo/types/model";
import { DemoMap } from "./DemoMap";
import type { MapProps } from "./MapTypes";
import { googleMapDocument } from "./googleDocument";
import type { VehicleImageUrls } from "./vehicleMetrics";
import { MAP_VEHICLE_IMAGES } from "./mapVehicleCatalog.generated";
import { useMapMotion } from "./useMapMotion";

export default function MapBoard(props: MapProps) {
  const { t } = useI18n();
  props = {
    ...props,
    labels: { pickup: t("departLabel"), destination: t("arriveLabel") },
  };
  const motionEnabled = useMapMotion();
  const ref = useRef<HTMLIFrameElement>(null),
    latest = useRef(props),
    readyRef = useRef(false);
  latest.current = { ...props, motionEnabled };
  const [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [ready, setReady] = useState(false);
  const localVehicleImages = useMemo(() => {
    const uri = (kind: ActiveVehicleKind) => {
      const source = MAP_VEHICLE_IMAGES[kind] || MAP_VEHICLE_IMAGES.moto;
      return Asset.fromModule(source as number).uri;
    };
    return {
      moto: uri("moto"),
      motoSend: uri("motoSend"),
      taxi: uri("taxi"),
      suv: uri("suv"),
      minibus: uri("minibus"),
      tricycle: uri("tricycle"),
      truck: uri("truck"),
      pickupTruck: uri("pickupTruck"),
      comfort: uri("moto"),
      fourByFour: uri("suv"),
    } satisfies VehicleImageUrls;
  }, []);
  const html = useMemo(
    () =>
      !GOOGLE_MAP_URL && GOOGLE_WEB_KEY
        ? googleMapDocument(GOOGLE_WEB_KEY, "", localVehicleImages)
        : undefined,
    [localVehicleImages],
  );
  const update = () =>
    ref.current?.contentWindow?.postMessage(
      {
        pepoMapCommand: "update",
        data: JSON.parse(JSON.stringify(latest.current)),
      },
      GOOGLE_MAP_URL && !html ? new URL(GOOGLE_MAP_URL).origin : "*",
    );
  useEffect(() => {
    if (!html && !GOOGLE_MAP_URL) {
      latest.current.onReady?.(false);
      return;
    }
    const receive = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow) return;
      try {
        const m =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (!m?.pepoMap) return;
        if (m.type === "ready") {
          readyRef.current = true;
          setReady(true);
          setError("");
          update();
          latest.current.onReady?.(true);
        } else if (m.type === "idle" && validPoint(m.data))
          latest.current.onIdle?.(m.data);
        else if (m.type === "pan") latest.current.onPan?.();
        else if (m.type === "move") latest.current.onMove?.();
        else if (m.type === "error") {
          setError(String(m.data));
          latest.current.onError?.(String(m.data));
        }
      } catch {}
    };
    window.addEventListener("message", receive);
    const timer = setTimeout(() => {
      if (!readyRef.current) {
        setError("La carte ne répond pas. Vérifiez le serveur et Internet.");
        latest.current.onError?.("Carte indisponible");
      }
    }, 20000);
    return () => {
      window.removeEventListener("message", receive);
      clearTimeout(timer);
    };
  }, [revision]);
  useEffect(() => {
    if (ready) update();
  }, [props, ready, motionEnabled]);
  if (!html && !GOOGLE_MAP_URL) return <DemoMap {...props} />;
  return (
    <View style={[StyleSheet.absoluteFill, { bottom: props.bottomInset || 0 }]}>
      <iframe
        key={revision}
        ref={ref}
        title="Carte Google Maps"
        src={html ? undefined : GOOGLE_MAP_URL}
        srcDoc={html}
        style={{ border: 0, width: "100%", height: "100%" }}
      />

      {error ? (
        <View
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            top: 90,
            padding: 16,
            borderRadius: 16,
            backgroundColor: C.paper,
            gap: 12,
          }}
        >
          <Txt variant="small">{error}</Txt>
          <Button
            title="Réessayer la carte"
            compact
            onPress={() => {
              setError("");
              setReady(false);
              readyRef.current = false;
              setRevision((n) => n + 1);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
