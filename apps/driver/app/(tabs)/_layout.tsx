import { C } from "@pepo/config/tokens";
import { useApp } from "@pepo/session/AppProvider";
import { Redirect, Tabs } from "expo-router";
import { Clock3, Compass, ShieldCheck, UserRound } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function TabsLayout() {
  const { ready, profile, t } = useApp();
  const insets = useSafeAreaInsets();
  if (!ready) return null;
  if (!profile) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.ink,
        tabBarInactiveTintColor: "#9CA296",
        tabBarStyle: {
          borderTopColor: C.line,
          height: 64 + Math.max(12, insets.bottom),
          paddingTop: 10,
          paddingBottom: Math.max(12, insets.bottom),
          backgroundColor: C.paper,
        },
        tabBarLabelStyle: {
          fontFamily: "DMSans_600SemiBold",
          fontSize: 10,
          marginTop: 4,
        },
        sceneStyle: { backgroundColor: C.paper },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("requests"),
          tabBarIcon: ({ color, focused }) => (
            <Compass
              size={23}
              color={color}
              fill={focused ? C.yellowSoft : "transparent"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t("earnings"),
          tabBarIcon: ({ color }) => <Clock3 size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          title: t("safety"),
          href: null,
          tabBarIcon: ({ color }) => <ShieldCheck size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t("account"),
          tabBarIcon: ({ color }) => <UserRound size={23} color={color} />,
        }}
      />
    </Tabs>
  );
}
