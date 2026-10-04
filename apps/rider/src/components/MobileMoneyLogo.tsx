import type { SupportedMoneyProvider } from "@pepo/utils/mobileMoney";
import { Txt } from "@pepo/ui/UI";
import { Image, View } from "react-native";
import { useState } from "react";
const logos = {
  airtel: require("../../assets/payments/airtel-money-logo.png"),
  mpesa: require("../../assets/payments/m-pesa-logo.png"),
  orange: require("../../assets/payments/orange-money-logo.png"),
};
export function MobileMoneyLogo({
  provider,
}: {
  provider: SupportedMoneyProvider;
}) {
  const [failed, setFailed] = useState(false);
  const asset =
    typeof Image.resolveAssetSource === "function"
      ? Image.resolveAssetSource(logos[provider])
      : logos[provider];
  const placeholder = asset?.width === 1;
  const label = { airtel: "Airtel", mpesa: "M-Pesa", orange: "Orange" }[
    provider
  ];
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 12,
        borderWidth: provider === "orange" ? 0 : 1,
        borderColor: "#E7E9EB",
        backgroundColor: provider === "orange" ? "#000" : "#FFF",
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
      }}
    >
      {failed || placeholder ? (
        <Txt
          translate={false}
          style={{
            fontSize: 11,
            fontWeight: "700",
            color:
              provider === "orange"
                ? "#FF7900"
                : provider === "mpesa"
                  ? "#287B3F"
                  : "#BA202C",
          }}
        >
          {label}
        </Txt>
      ) : (
        <Image
          source={logos[provider]}
          resizeMode="contain"
          style={{ width: "100%", height: "100%" }}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      )}
    </View>
  );
}
