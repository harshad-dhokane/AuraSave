import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";

import { radius, spacing, shadow } from "@/src/theme";
import { getProfile, setProfile, clearAllData, getTransactions } from "@/src/store";
import { useCurrency, CURRENCIES, Currency } from "@/src/currency";
import { useAuth } from "@/src/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { PinPad } from "@/src/components/PinPad";

import { useTheme } from "@/src/theme/ThemeContext";

const BLUR_INTENSITY = 45;

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const { user, signOut } = useAuth();
  const { mode, setMode, colors, isDark } = useTheme();
  const blurTint = isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight";
  
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [txCount, setTxCount] = useState(0);
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const [pickingTheme, setPickingTheme] = useState(false);
  const [appLock, setAppLock] = useState(false);

  const [settingPin, setSettingPin] = useState(false);
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");
  const [firstPin, setFirstPin] = useState("");
  const [pinError, setPinError] = useState("");

  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const load = useCallback(async () => {
    const p = await getProfile();
    setName(p.name);
    setTempName(p.name === "there" ? "" : p.name);
    const t = await getTransactions();
    setTxCount(t.length);
    const lock = await AsyncStorage.getItem("appLockEnabled");
    setAppLock(lock === "true");
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveName = async () => {
    const n = tempName.trim() || "there";
    await setProfile({ name: n });
    setName(n);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const doClearAll = () => {
    Alert.alert(
      "Delete everything?",
      "This will remove all transactions, budgets and goals. No sample data will be re-seeded.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete all",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            load();
          },
        },
      ]
    );
  };

  const chooseCurrency = async (c: Currency) => {
    await setCurrency(c);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPickingCurrency(false);
  };

  const chooseTheme = async (newMode: 'light' | 'dark' | 'system') => {
    await setMode(newMode);
    Haptics.selectionAsync();
    setPickingTheme(false);
  };

  const getThemeLabel = () => {
    if (mode === 'light') return 'Light';
    if (mode === 'dark') return 'Dark';
    return 'System Default';
  };

  const toggleAppLock = async () => {
    if (!appLock) {
      setPinStep("enter");
      setFirstPin("");
      setPinError("");
      setSettingPin(true);
    } else {
      await AsyncStorage.setItem("appLockEnabled", "false");
      await SecureStore.deleteItemAsync("appCustomPin");
      setAppLock(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handlePinComplete = async (pin: string) => {
    if (pinStep === "enter") {
      setFirstPin(pin);
      setPinStep("confirm");
      setPinError("");
    } else {
      if (pin === firstPin) {
        // Success
        await SecureStore.setItemAsync("appCustomPin", pin);
        await AsyncStorage.setItem("appLockEnabled", "true");
        setAppLock(true);
        setSettingPin(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setPinError("PINs do not match. Try again.");
        setFirstPin("");
        setPinStep("enter");
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="settings-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(name === "there" ? "A" : name.charAt(0)).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{name === "there" ? "Set your name" : name}</Text>
            <Text style={styles.profileSub}>{user?.email || "Aura Wealth"}</Text>
          </View>
          <Pressable testID="edit-name-btn" style={styles.editBtn} onPress={() => setEditing(true)}>
            <Ionicons name="pencil" size={16} color={colors.brand} />
          </Pressable>
        </View>

        <SectionLabel text="Preferences" colors={colors} styles={styles} />
        <RowGroup styles={styles}>
          <SettingRow
            icon="moon"
            color={colors.brandSecondary}
            title="Appearance"
            value={getThemeLabel()}
            onPress={() => setPickingTheme(true)}
            colors={colors}
            styles={styles}
          />
          <SettingRow
            testID="currency-row"
            icon="cash"
            color={colors.brandPrimary}
            title="Currency"
            value={`${currency.name} (${currency.symbol})`}
            onPress={() => setPickingCurrency(true)}
            colors={colors}
            styles={styles}
          />
          <SettingRow icon="cloud" color={colors.info} title="Data storage" value="Synced securely" colors={colors} styles={styles} />
        </RowGroup>

        <SectionLabel text="Account & Security" colors={colors} styles={styles} />
        <RowGroup styles={styles}>
          <SettingRow
            testID="app-lock-row"
            icon="lock-closed"
            color={colors.success}
            title="App Lock"
            value={appLock ? "Enabled" : "Disabled"}
            onPress={toggleAppLock}
            colors={colors}
            styles={styles}
          />
          <SettingRow
            testID="sign-out-btn"
            icon="log-out-outline"
            color={colors.error}
            title="Sign out"
            value=""
            onPress={signOut}
            colors={colors}
            styles={styles}
          />
        </RowGroup>

        <SectionLabel text="Shortcuts" colors={colors} styles={styles} />
        <RowGroup styles={styles}>
          <SettingRow
            testID="settings-scan-sms"
            icon="scan"
            color={colors.warning}
            title="Scan SMS message"
            value="Auto-add from bank alerts"
            onPress={() => router.push("/add-transaction?mode=sms")}
            colors={colors}
            styles={styles}
          />
          <SettingRow
            testID="settings-goals"
            icon="flag"
            color={colors.brandSecondary}
            title="Savings goals"
            value="Track your targets"
            onPress={() => router.push("/(tabs)/goals")}
            colors={colors}
            styles={styles}
          />
        </RowGroup>

        <SectionLabel text="Data" colors={colors} styles={styles} />
        <RowGroup styles={styles}>
          <SettingRow
            testID="export-btn"
            icon="cloud-download"
            color={colors.brand}
            title="Export to Excel (CSV)"
            value="Choose a date range"
            onPress={() => router.push("/export")}
            colors={colors}
            styles={styles}
          />
          <SettingRow
            testID="clear-all-btn"
            icon="trash"
            color={colors.error}
            title="Delete all data"
            value=""
            onPress={doClearAll}
            colors={colors}
            styles={styles}
          />
        </RowGroup>

        <SectionLabel text="Statistics" colors={colors} styles={styles} />
        <RowGroup styles={styles}>
          <SettingRow icon="receipt" color={colors.brandSecondary} title="Total transactions" value={String(txCount)} colors={colors} styles={styles} />
        </RowGroup>

        <Text style={styles.footer}>Aura Wealth · v1.0 · Built with care</Text>
      </ScrollView>

      {/* Name modal */}
      <Modal statusBarTranslucent navigationBarTranslucent transparent visible={editing} animationType="fade" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "transparent", justifyContent: "center", padding: 24 }}>
          <BlurView
            intensity={BLUR_INTENSITY}
            tint={blurTint}
            blurReductionFactor={2}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setEditing(false)} />
          </BlurView>
          <View style={styles.editCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.editTitle}>Your name</Text>
              <Pressable testID="name-close-btn" onPress={() => setEditing(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </Pressable>
            </View>
            <TextInput
              testID="name-input"
              value={tempName}
              onChangeText={setTempName}
              placeholder="e.g. Aryan"
              placeholderTextColor={colors.muted}
              style={styles.editInput}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable style={[styles.formBtn, styles.formBtnGhost]} onPress={() => setEditing(false)}>
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable testID="name-save-btn" style={[styles.formBtn, styles.formBtnPrimary]} onPress={saveName}>
                <Text style={styles.formBtnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Theme Modal */}
      <Modal statusBarTranslucent navigationBarTranslucent transparent visible={pickingTheme} animationType="fade" onRequestClose={() => setPickingTheme(false)}>
        <View style={{ flex: 1, backgroundColor: "transparent", justifyContent: "flex-end" }}>
          <BlurView
            intensity={BLUR_INTENSITY}
            tint={blurTint}
            blurReductionFactor={2}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setPickingTheme(false)} />
          </BlurView>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Appearance</Text>
                <Text style={styles.sheetSub}>Choose how Aura Wealth looks.</Text>
              </View>
              <Pressable onPress={() => setPickingTheme(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </Pressable>
            </View>
            <View style={{ marginTop: 8 }}>
              {([
                { id: 'system', label: 'System Default', icon: 'settings-outline' },
                { id: 'light', label: 'Light Mode', icon: 'sunny-outline' },
                { id: 'dark', label: 'Dark Mode', icon: 'moon-outline' }
              ] as const).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => chooseTheme(item.id)}
                  style={[styles.curRow, mode === item.id && { backgroundColor: colors.brandTertiary }]}
                >
                  <View style={styles.curSymbol}>
                    <Ionicons name={item.icon as any} size={20} color={colors.onSurface} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.curName}>{item.label}</Text>
                  </View>
                  {mode === item.id && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Modal */}
      <Modal statusBarTranslucent navigationBarTranslucent transparent visible={pickingCurrency} animationType="fade" onRequestClose={() => setPickingCurrency(false)}>
        <View style={{ flex: 1, backgroundColor: "transparent", justifyContent: "flex-end" }}>
          <BlurView
            intensity={BLUR_INTENSITY}
            tint={blurTint}
            blurReductionFactor={2}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setPickingCurrency(false)} />
          </BlurView>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Choose currency</Text>
                <Text style={styles.sheetSub}>All amounts across the app will update instantly.</Text>
              </View>
              <Pressable testID="currency-close-btn" onPress={() => setPickingCurrency(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </Pressable>
            </View>
            <FlatList
              data={CURRENCIES}
              keyExtractor={(c) => c.code}
              style={{ maxHeight: 380, marginTop: 8 }}
              renderItem={({ item }) => {
                const active = item.code === currency.code;
                return (
                  <Pressable
                    testID={`cur-${item.code}`}
                    onPress={() => chooseCurrency(item)}
                    style={[styles.curRow, active && { backgroundColor: colors.brandTertiary }]}
                  >
                    <View style={styles.curSymbol}>
                      <Text style={styles.curSymbolText}>{item.symbol}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.curName}>{item.name}</Text>
                      <Text style={styles.curCode}>{item.code}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* PIN Setup Modal */}
      <Modal statusBarTranslucent navigationBarTranslucent transparent visible={settingPin} animationType="slide" onRequestClose={() => setSettingPin(false)}>
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={[styles.header, { paddingTop: insets.top + 6, paddingBottom: 0 }]}>
            <View style={{ width: 40 }} />
            <View style={{ width: 40 }} />
          </View>
          <PinPad
            title={pinStep === "enter" ? "Create App PIN" : "Confirm PIN"}
            subtitle={pinStep === "enter" ? "Enter a 4-digit PIN for Aura Wealth" : "Enter the PIN again to confirm"}
            error={pinError}
            onPinComplete={handlePinComplete}
            showCancel
            onCancel={() => setSettingPin(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

function SectionLabel({ text, colors, styles }: any) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function RowGroup({ children, styles }: any) {
  return <View style={styles.group}>{children}</View>;
}

function SettingRow({
  icon,
  color,
  title,
  value,
  onPress,
  testID,
  colors,
  styles,
}: any) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
    </Pressable>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadow.card,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  profileName: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  profileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  rowValue: { fontSize: 12, color: colors.muted, marginTop: 2 },
  footer: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 11,
    marginTop: 32,
  },
  editCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: 20,
    ...shadow.card,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  editTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  editInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
  formBtn: {
    flex: 1,
    height: 46,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  formBtnGhost: { backgroundColor: colors.surfaceTertiary },
  formBtnGhostText: { color: colors.onSurface, fontWeight: "700" },
  formBtnPrimary: { backgroundColor: colors.brand },
  formBtnPrimaryText: { color: "#fff", fontWeight: "800" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    ...shadow.card,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sheetSub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  curRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  curSymbol: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  curSymbolText: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  curName: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  curCode: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
