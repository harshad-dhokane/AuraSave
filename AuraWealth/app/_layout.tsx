import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState, useRef } from "react";
import { LogBox, View, ActivityIndicator, AppState, StyleSheet, Pressable, Text } from "react-native";
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
          <BlurView
            intensity={90}
            tint={isDark ? "dark" : "light"}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 }}>
            {showPinPad ? (
              <PinPad
                title="Enter PIN"
                subtitle="Use your 4-digit App PIN"
                error={pinError}
                onPinComplete={handleCustomPin}
              />
            ) : (
              <>
                <Ionicons name="lock-closed" size={64} color={colors.brand} style={{ marginBottom: 20 }} />
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.onSurface, marginBottom: 40 }}>
                  Aura Wealth is Locked
                </Text>
                <Pressable
                  onPress={authenticate}
                  style={{
                    backgroundColor: colors.brand,
                    paddingHorizontal: 32,
                    paddingVertical: 14,
                    borderRadius: 24,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Unlock</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
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
              <AppLockGate>
                <AppContent />
              </AppLockGate>
            </CurrencyProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
