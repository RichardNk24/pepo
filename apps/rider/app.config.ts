import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Pepo",
  slug: "pepo",
  scheme: "pepo",
  version: "1.1.1",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "../../packages/ui/assets/brand/pepo-logo.jpg",
  ios: {
    bundleIdentifier: "app.pepo.mobility",
    supportsTablet: false,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Pepo utilise votre position pour trouver votre point de départ et suivre votre course quand l’application est ouverte.",
    },
  },
  android: {
    package: "app.pepo.mobility",
    adaptiveIcon: {
      foregroundImage: "../../packages/ui/assets/brand/pepo-logo.jpg",
      backgroundColor: "#F5D54C",
    },
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "../../packages/ui/assets/brand/pepo-logo.jpg",
    name: "Pepo — On y va.",
  },
  plugins: [
    "expo-router",
    [
      "expo-speech-recognition",
      {
        microphonePermission:
          "Pepo utilise le micro quand vous appuyez sur Parler.",
        speechRecognitionPermission:
          "Pepo utilise la reconnaissance vocale pour comprendre votre demande.",
      },
    ],
    "expo-secure-store",
    "expo-font",
    "expo-status-bar",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F5D54C",
        image: "../../packages/ui/assets/brand/pepo-splash-mark.png",
        imageWidth: 130,
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Autorisez Pepo à trouver votre point de départ et à partager votre position pendant une course.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Choisissez une photo de profil ou vos documents pour demander leur vérification.",
        cameraPermission: "Prenez une photo de profil ou de vos documents.",
      },
    ],
    [
      "react-native-maps",
      {
        iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || "",
        androidGoogleMapsApiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || "",
      },
    ],
  ],
  extra: {
    ...config.extra,
    ...(process.env.EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
      : {}),
    googleMapsConfigured: Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY),
  },
});
