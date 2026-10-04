import { Image } from "react-native";
export function PepoLogo({ size = 42 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/brand/pepo-logo.jpg")}
      accessibilityLabel="Pepo"
      resizeMode="contain"
      style={{ width: size, height: size, borderRadius: size * 0.24 }}
    />
  );
}
