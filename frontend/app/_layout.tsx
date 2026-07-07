import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { seedIfNeeded } from "@/src/store";
import { colors } from "@/src/theme";


// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    // Seed sample data once on first launch for a beautiful first impression
    seedIfNeeded().catch(() => {});
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="add-transaction"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="settings"
              options={{ presentation: "card", animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="goals"
              options={{ presentation: "card", animation: "slide_from_right" }}
            />
          </Stack>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
