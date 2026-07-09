import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useRef } from "react";
import { LogBox, View, ActivityIndicator, AppState, StyleSheet, Pressable, Text, Image } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

import { PinPad } from "@/src/components/PinPad";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { seedIfNeeded } from "@/src/store";
import { CurrencyProvider } from "@/src/currency";
import { AuthProvider, useAuth } from "@/src/context/AuthContext";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeContext";

// Disable logbox errors etc so that users can see the app
LogBox.ignoreAllLogs(true)

try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.warn("[AuraWealth] SplashScreen.preventAutoHideAsync failed:", e);
}

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
      SplashScreen.hideAsync().catch(() => {});
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

function AppLockGate({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useTheme();
  const [isLocked, setIsLocked] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinError, setPinError] = useState("");
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Check initial status only on cold start
    AsyncStorage.getItem("appLockEnabled").then((val) => {
      const enabled = val === "true";
      if (enabled) {
        setIsLocked(true);
        authenticate();
      }
    });
  }, []);

  const authenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    // Always attempt biometrics first if available
    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Aura Wealth",
        fallbackLabel: "Use App PIN",
        disableDeviceFallback: true,
      });

      if (result.success) {
        setIsLocked(false);
        return;
      }
    }
    
    // If biometrics fail or aren't enrolled, fallback to custom PIN pad
    setShowPinPad(true);
  };

  const handleCustomPin = async (enteredPin: string) => {
    const savedPin = await SecureStore.getItemAsync("appCustomPin");
    if (enteredPin === savedPin) {
      setIsLocked(false);
      setShowPinPad(false);
      setPinError("");
    } else {
      setPinError("Incorrect PIN");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {children}
      {isLocked && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}>
          {showPinPad ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, justifyContent: "center", alignItems: "center" }]}>
              <Image source={require("../assets/images/icon.png")} style={{ width: 100, height: 100, borderRadius: 24, marginBottom: 16 }} resizeMode="contain" />
              <Text style={{ fontSize: 24, fontWeight: "800", color: colors.onSurface }}>Aura Wealth</Text>
            </View>
          )}
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 }}>
            {showPinPad ? (
              <PinPad
                title="Enter PIN"
                subtitle="Use your 4-digit App PIN"
                error={pinError}
                onPinComplete={handleCustomPin}
              />
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Global Error Boundary ──────────────────────────────────────────────────
// Catches any unhandled JS errors and shows a recovery screen instead of
// crashing the app.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AuraWealth] Uncaught error:", error, info.componentStack);
  }

  handleRestart = () => {
    // Clear the error state so the tree re-mounts
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <StatusBar style="light" />
          <Ionicons name="warning" size={56} color="#E77977" style={{ marginBottom: 16 }} />
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || "An unexpected error occurred."}
          </Text>
          <Pressable style={errorStyles.btn} onPress={this.handleRestart}>
            <Text style={errorStyles.btnText}>Restart App</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121413",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  btn: {
    backgroundColor: "#498E6C",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  // Splash screen is now hidden in AuthGate once authentication state is resolved

  if (!loaded && !error) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <CurrencyProvider>
                <AppLockGate>
                  <AppContent />
                </AppLockGate>
              </CurrencyProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
