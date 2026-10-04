import { C } from "@pepo/config/tokens";
import { Text,View } from "react-native";
import Svg,{ Path } from "react-native-svg";
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
      <Svg width={88} height={88} viewBox="0 0 540 540" accessible={false}>
        <Path
          fill="#000"
          d="M160 82 Q165 20 238 20 H351 C455 20 510 86 510 159 C510 241 458 286 365 286 H267 L234 399 Q220 460 158 460 H122 L146 322 H24 Q0 322 9 301 Q27 248 78 248 H349 Q429 248 429 158 Q429 93 358 93 H160 Z M104 148 H346 Q353 148 350 160 Q330 209 282 209 H66 Q51 209 56 196 Q72 148 104 148 Z"
        />
      </Svg>
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
