import { Image, HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";

export type PepoRideActivityProps = {
  statusLabel: string;
  vehicleLabel: string;
  compactLabel: string;
  openLabel: string;
};

const PepoRideActivity = (
  props: PepoRideActivityProps,
  environment: import("expo-widgets").LiveActivityEnvironment,
) => {
  "widget";
  const primary = environment.isLuminanceReduced ? "#FFFFFF" : "#20221F";
  const secondary = environment.isLuminanceReduced ? "#D0D0D0" : "#6F756E";
  const yellow = "#F5D54C";
  return {
    banner: (
      <VStack spacing={8} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={8}>
          <Image systemName="car.fill" color={yellow} size={18} />
          <Text modifiers={[font({ weight: "bold", size: 17 }), foregroundStyle(primary)]}>
            Pepo
          </Text>
          <Spacer />
          <Text modifiers={[font({ weight: "semibold", size: 15 }), foregroundStyle(primary)]}>
            {props.vehicleLabel}
          </Text>
        </HStack>
        <Text modifiers={[font({ weight: "semibold", size: 19 }), foregroundStyle(primary)]}>
          {props.statusLabel}
        </Text>
        <Text modifiers={[font({ size: 14 }), foregroundStyle(secondary)]}>
          {props.openLabel}
        </Text>
      </VStack>
    ),
    compactLeading: <Image systemName="car.fill" color={yellow} size={18} />,
    compactTrailing: <Text>{props.compactLabel}</Text>,
    minimal: <Image systemName="car.fill" color={yellow} size={18} />,
    expandedLeading: (
      <VStack spacing={4} modifiers={[padding({ all: 8 })]}>
        <Image systemName="car.fill" color={yellow} size={20} />
        <Text modifiers={[font({ weight: "bold", size: 12 }), foregroundStyle(primary)]}>PEPO</Text>
      </VStack>
    ),
    expandedCenter: (
      <VStack spacing={4}>
        <Text modifiers={[font({ weight: "bold", size: 15 }), foregroundStyle(primary)]}>Pepo</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(secondary)]}>{props.vehicleLabel}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <Text modifiers={[font({ weight: "semibold", size: 13 }), foregroundStyle(primary)]}>
        {props.compactLabel}
      </Text>
    ),
    expandedBottom: (
      <VStack spacing={4} modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ weight: "semibold", size: 15 }), foregroundStyle(primary)]}>
          {props.statusLabel}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(secondary)]}>
          {props.openLabel}
        </Text>
      </VStack>
    ),
  };
};

export default createLiveActivity("PepoRideActivity", PepoRideActivity);
