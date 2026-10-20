import { C } from "@pepo/config/tokens";
import { Image,Text,View } from "react-native";
export function BrandSplash({ fontsReady = false }: { fontsReady?: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.yellow,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityLabel="Pepo"
    >
      <Image
        source={require("../assets/brand/pepo-original-classic.png")}
        resizeMode="contain"
        style={{ width: 120, height: 120, borderRadius: 24 }}
      />
      <Text
        style={{
          color: "#000",
          fontSize: 56,
          letterSpacing: -3,
          marginTop: 8,
          ...(fontsReady
            ? { fontFamily: "DMSans_700Bold" }
            : { fontWeight: "700" }),
        }}
      >
        pepo
      </Text>
    </View>
  );
}
