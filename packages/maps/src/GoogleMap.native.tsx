import { GOOGLE_MAP_URL } from "@pepo/api-client/maps";
import { C } from "@pepo/config/tokens";
import { Button,Txt } from "@pepo/ui/UI";
import { validPoint } from "@pepo/utils/mapGeometry";
import { useEffect,useMemo,useRef,useState } from "react";
import { Linking,StyleSheet,View } from "react-native";
import { WebView } from "react-native-webview";
import type { MapProps } from "./MapTypes";
import { useMapMotion } from "./useMapMotion";

export default function GoogleMap(props: MapProps) {
  const motionEnabled = useMapMotion();
  const source = useMemo(() => ({ uri: GOOGLE_MAP_URL }), []);
  const ref = useRef<WebView>(null),
    latest = useRef(props);
  latest.current = { ...props, motionEnabled };
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const update = () => {
    const json = JSON.stringify(latest.current).replace(/</g, "\\u003c");
    ref.current?.injectJavaScript(
      `window.pepoUpdate && window.pepoUpdate(${json});true;`,
    );
  };
  useEffect(() => {
    if (ready) update();
  }, [props, ready, motionEnabled]);
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { bottom: props.bottomInset || 0, backgroundColor: C.map },
      ]}
    >
      <WebView
        key={revision}
        ref={ref}
        source={source}
        style={{ flex: 1, backgroundColor: C.map }}
        javaScriptEnabled
        cacheEnabled={false}
        renderError={() => <View style={{ flex: 1, backgroundColor: C.map }} />}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        originWhitelist={["http://*", "https://*"]}
        geolocationEnabled={false}
        onShouldStartLoadWithRequest={(r) => {
          if (r.url === GOOGLE_MAP_URL || r.url === "about:blank") return true;
          if (r.isTopFrame && /^https:\/\//.test(r.url))
            void Linking.openURL(r.url).catch(() => {});
          return !r.isTopFrame;
        }}
        onError={(event) => {
          setReady(false);
          setError(
            `Carte inaccessible (${event.nativeEvent.code}). Vérifiez l’adresse ci-dessous et l’accès au réseau local d’Expo Go.`,
          );
          latest.current.onError?.("Carte indisponible");
        }}
        onHttpError={(event) => {
          if (event.nativeEvent.url !== GOOGLE_MAP_URL) return;
          setError("Google Maps n’est pas configuré sur le serveur.");
          latest.current.onError?.("Carte indisponible");
        }}
        onMessage={(event) => {
          try {
            const m = JSON.parse(event.nativeEvent.data);
            if (!m.pepoMap) return;
            if (m.type === "ready") {
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
        }}
      />

      {error ? (
        <View style={g.error}>
          <Txt variant="small">{error}</Txt>
          <Txt variant="small" selectable>
            {GOOGLE_MAP_URL}
          </Txt>
          <Button
            compact
            kind="secondary"
            title="Vérifier dans Safari"
            onPress={() => Linking.openURL(GOOGLE_MAP_URL)}
          />
          <Button
            compact
            title="Réessayer la carte"
            onPress={() => {
              setError("");
              setReady(false);
              setRevision((value) => value + 1);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
const g = StyleSheet.create({
  error: {
    position: "absolute",
    top: 135,
    left: 20,
    right: 20,
    padding: 15,
    gap: 12,
    backgroundColor: C.paper,
    borderRadius: 16,
  },
});
