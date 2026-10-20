import { Image } from "react-native";
import { useThemeColors } from "./Theme";

const logos = {
  purple: require("../assets/brand/pepo-original-purple.jpeg"),
  mono: require("../assets/brand/pepo-original-mono.png"),
  classic: require("../assets/brand/pepo-original-classic.png"),
};

export function PepoLogo({ size = 42 }: { size?: number }) {
  const C = useThemeColors();
  const source = C.yellow === "#8000FF"
    ? logos.purple
    : C.yellow === "#20221F" ? logos.mono : logos.classic;

  return (
    <Image
      source={source}
      accessibilityLabel="Pepo"
      accessible
      resizeMode="contain"
      style={{ width: size, height: size, borderRadius: size * 0.24 }}
    />
  );
}
