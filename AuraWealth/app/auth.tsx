import React, { useState , useMemo} from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { radius, spacing, shadow } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/theme/ThemeContext";

const HERO_BG =
  "https://images.unsplash.com/photo-1629197520635-16570fbd0bb3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGdyZWVuJTIwYWVzdGhldGljJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODI1NzM3MTl8MA&ixlib=rb-4.1.0&q=85";

export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Please enter email and password");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        setError(err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      const { error: err } = await signUp(email.trim(), password);
      if (err) {
        setError(err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSuccess("Account created! Check your email to confirm, then sign in.");
        setMode("login");
      }
    }

    setLoading(false);
  };

  const toggleMode = () => {
    Haptics.selectionAsync();
    setMode(mode === "login" ? "signup" : "login");
    setError(null);
    setSuccess(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero header */}
          <View style={styles.heroWrap}>
            <Image
              source={HERO_BG}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient
              colors={[
                "rgba(15,17,16,0.25)",
                "rgba(15,17,16,0.6)",
                "rgba(15,17,16,0.92)",
              ]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View
              style={[styles.heroContent, { paddingTop: insets.top + 40 }]}
            >
              <View style={styles.logoBadge}>
                <Ionicons name="leaf" size={18} color={colors.brandSecondary} />
              </View>
              <Text style={styles.heroTitle}>Aura Wealth</Text>
              <Text style={styles.heroSub}>
                Track expenses, investments {"\n"}and grow your wealth
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formWrap}>
            {/* Tab toggle */}
            <View style={styles.tabRow}>
              <Pressable
                testID="auth-tab-login"
                onPress={() => {
                  if (mode !== "login") toggleMode();
                }}
                style={[styles.tab, mode === "login" && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === "login" && styles.tabTextActive,
                  ]}
                >
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                testID="auth-tab-signup"
                onPress={() => {
                  if (mode !== "signup") toggleMode();
                }}
                style={[styles.tab, mode === "signup" && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === "signup" && styles.tabTextActive,
                  ]}
                >
                  Sign Up
                </Text>
              </Pressable>
            </View>

            {/* Error / success banners */}
            {error && (
              <View style={[styles.banner, styles.bannerError]}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.bannerText}>{error}</Text>
              </View>
            )}
            {success && (
              <View style={[styles.banner, styles.bannerSuccess]}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.success}
                />
                <Text style={styles.bannerText}>{success}</Text>
              </View>
            )}

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={colors.muted}
                style={{ marginRight: 10 }}
              />
              <TextInput
                testID="auth-email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.muted}
                style={{ marginRight: 10 }}
              />
              <TextInput
                testID="auth-password"
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                style={styles.input}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
            </View>

            {/* Confirm password (signup only) */}
            {mode === "signup" && (
              <>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color={colors.muted}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    testID="auth-confirm-password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter password"
                    placeholderTextColor={colors.muted}
                    secureTextEntry={!showPassword}
                    style={styles.input}
                  />
                </View>
              </>
            )}

            {/* Submit button */}
            <Pressable
              testID="auth-submit"
              onPress={handleSubmit}
              disabled={loading}
              style={({ pressed }) => [
                styles.submitBtn,
                { opacity: loading ? 0.6 : pressed ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={[colors.brandSecondary, colors.brandPrimary, colors.brand]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={mode === "login" ? "log-in-outline" : "person-add-outline"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.submitText}>
                    {mode === "login" ? "Sign In" : "Create Account"}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Toggle link */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {mode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </Text>
              <Pressable onPress={toggleMode}>
                <Text style={styles.toggleLink}>
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  heroWrap: {
    height: 280,
    overflow: "hidden",
  },
  heroContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 32,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  formWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  tabRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: colors.surfaceSecondary,
    ...shadow.card,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  tabTextActive: {
    color: colors.onSurface,
    fontWeight: "800",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerError: {
    backgroundColor: colors.error + "12",
    borderColor: colors.error + "33",
  },
  bannerSuccess: {
    backgroundColor: colors.success + "12",
    borderColor: colors.success + "33",
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.onSurface,
    fontWeight: "600",
    lineHeight: 17,
  },
  label: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.onSurface,
    fontWeight: "600",
  },
  submitBtn: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
    marginTop: 24,
    ...shadow.fab,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  toggleText: {
    fontSize: 13,
    color: colors.muted,
  },
  toggleLink: {
    fontSize: 13,
    color: colors.brand,
    fontWeight: "800",
  },
});
