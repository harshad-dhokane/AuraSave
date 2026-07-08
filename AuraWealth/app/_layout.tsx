import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { seedIfNeeded } from "@/src/store";
import { CurrencyProvider } from "@/src/currency";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeContext";

// Disable logbox errors etc so that users can see the app
LogBox.ignoreAllLogs(true)

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;

    const inAuthScreen = segments[0] === "auth";

    if (!session && !inAuthScreen) {
      router.replace("/auth");
    } else if (session && inAuthScreen) {
      router.replace("/");
    }
  }, [session, loading, segments]);

  useEffect(() => {
    if (!loading && session) {
      seedIfNeeded().catch(() => {});
    }
  }, [loading, session]);

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return null;
  }

  return <>{children}</>;
}

function AppContent() {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
          <Stack.Screen name="auth" options={{ animation: "fade" }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-transaction" options={{ presentation: "card", animation: "slide_from_bottom" }} />
          <Stack.Screen name="settings" options={{ presentation: "card", animation: "slide_from_right" }} />
          <Stack.Screen name="export" options={{ presentation: "card", animation: "slide_from_right" }} />
          <Stack.Screen name="lending" options={{ presentation: "card", animation: "slide_from_right" }} />
          <Stack.Screen name="add-loan" options={{ presentation: "card", animation: "slide_from_bottom" }} />
          <Stack.Screen name="add-goal" options={{ presentation: "card", animation: "slide_from_bottom" }} />
          <Stack.Screen name="add-budget" options={{ presentation: "card", animation: "slide_from_bottom" }} />
        </Stack>
      </AuthGate>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  // Splash screen is now hidden in AuthGate once authentication state is resolved

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <CurrencyProvider>
              <AppContent />
            </CurrencyProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
