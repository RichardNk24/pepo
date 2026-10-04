export type MapRenderer =
  | "google-web"
  | "google-native"
  | "demo"
  | "unconfigured";

export function isExpoGoEnvironment(
  executionEnvironment?: string | null,
  appOwnership?: string | null,
) {
  return executionEnvironment === "storeClient" || appOwnership === "expo";
}

/** A missing Google configuration must never silently select Apple Maps. */
export function selectMapRenderer(config: {
  mode?: string;
  expoGo: boolean;
  googleMapUrl?: string;
  nativeKey?: string;
}): MapRenderer {
  if (config.mode === "demo") return "demo";
  const nativeAvailable = !config.expoGo && !!config.nativeKey?.trim();
  if (config.mode === "native" && nativeAvailable) return "google-native";
  if (config.googleMapUrl?.trim()) return "google-web";
  if (nativeAvailable) return "google-native";
  return "unconfigured";
}
