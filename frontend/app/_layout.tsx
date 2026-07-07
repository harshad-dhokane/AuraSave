import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { seedIfNeeded } from "@/src/store";
import { colors } from "@/src/theme";
import { CurrencyProvider } from "@/src/currency";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";


// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthScreen = segments[0] === "auth";

    if (!session && !inAuthScreen) {
      // Not authenticated → redirect to auth
      router.replace("/auth");
    } else if (session && inAuthScreen) {
      // Authenticated → redirect to home
      router.replace("/");
    }
  }, [session, loading, segments]);

  useEffect(() => {
    if (!loading && session) {
      // Seed sample data once on first sign-in
      seedIfNeeded().catch(() => {});
    }
  }, [loading, session]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

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
        <AuthProvider>
          <CurrencyProvider>
            <View style={{ flex: 1, backgroundColor: colors.surface }}>
              <StatusBar style="dark" />
              <AuthGate>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
                  <Stack.Screen name="auth" options={{ animation: "fade" }} />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="add-transaction"
                    options={{
                      presentation: "transparentModal",
                      animation: "slide_from_bottom",
                      contentStyle: { backgroundColor: "transparent" },
                    }}
                  />
                  <Stack.Screen
                    name="settings"
                    options={{ presentation: "card", animation: "slide_from_right" }}
                  />
                  <Stack.Screen
                    name="goals"
                    options={{ presentation: "card", animation: "slide_from_right" }}
                  />
                  <Stack.Screen
                    name="export"
                    options={{ presentation: "card", animation: "slide_from_right" }}
                  />
                </Stack>
              </AuthGate>
            </View>
          </CurrencyProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
