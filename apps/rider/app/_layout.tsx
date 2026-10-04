import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { C } from "@pepo/config/tokens";
import { AppProvider } from "@pepo/session/AppProvider";
import { LocationProvider } from "@pepo/session/LocationProvider";
import { BrandSplash } from "@pepo/ui/BrandSplash";
import { Button, Txt, UIProvider } from "@pepo/ui/UI";
import { useFonts } from "expo-font";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

void SplashScreen.preventAutoHideAsync().catch(() => {});
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View
      style={{
        flex: 1,
        padding: 28,
        gap: 20,
        justifyContent: "center",
        backgroundColor: C.paper,
      }}
    >
      <Txt variant="h1">Un petit détour.</Txt>
      <Txt>Impossible d’afficher cet écran. Réessayez.</Txt>
      <Button title="Réessayer" onPress={retry} />
    </View>
  );
}
export default function Layout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error) return <BrandSplash />;
  return (
    <SafeAreaProvider>
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          <LocationProvider>
            <AppProvider>
              <UIProvider>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: C.paper },
                    animation: "slide_from_right",
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="ride" />
                  <Stack.Screen name="messages" />
                  <Stack.Screen name="documents" />
                  <Stack.Screen
                    name="account-safety"
                    options={{ presentation: "modal" }}
                  />
                  <Stack.Screen
                    name="help"
                    options={{ presentation: "modal" }}
                  />
                </Stack>
              </UIProvider>
            </AppProvider>
          </LocationProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#E8EBE2", alignItems: "center" },
  frame: { flex: 1, width: "100%", maxWidth: 460, backgroundColor: C.paper },
});
