import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { getProfile, setProfile, clearAllData, seedIfNeeded, getTransactions } from "@/src/store";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [txCount, setTxCount] = useState(0);

  const load = useCallback(async () => {
    const p = await getProfile();
    setName(p.name);
    setTempName(p.name === "there" ? "" : p.name);
    const t = await getTransactions();
    setTxCount(t.length);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveName = async () => {
    const n = tempName.trim() || "there";
    await setProfile({ name: n });
    setName(n);
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const doReset = () => {
    Alert.alert(
      "Reset all data?",
      "This will erase every transaction, budget, and goal. Sample data will be seeded again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await clearAllData();
            await seedIfNeeded();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            load();
          },
        },
      ]
    );
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
            <Text style={styles.profileSub}>Aura Wealth · Offline</Text>
          </View>
          <Pressable testID="edit-name-btn" style={styles.editBtn} onPress={() => setEditing(true)}>
            <Ionicons name="pencil" size={16} color={colors.brand} />
          </Pressable>
        </View>

        <SectionLabel text="Preferences" />
        <RowGroup>
          <SettingRow icon="cash" color={colors.brandPrimary} title="Currency" value="Indian Rupee (₹)" chevron={false} />
          <SettingRow icon="cloud-offline" color={colors.info} title="Data storage" value="On-device only" chevron={false} />
        </RowGroup>

        <SectionLabel text="Statistics" />
        <RowGroup>
          <SettingRow icon="receipt" color={colors.brandSecondary} title="Total transactions" value={String(txCount)} chevron={false} />
        </RowGroup>

        <SectionLabel text="Data" />
        <RowGroup>
          <SettingRow
            testID="reset-btn"
            icon="refresh"
            color={colors.warning}
            title="Reset with sample data"
            value=""
            onPress={doReset}
          />
          <SettingRow
            testID="clear-all-btn"
            icon="trash"
            color={colors.error}
            title="Delete all data"
            value=""
            onPress={doClearAll}
          />
        </RowGroup>

        <Text style={styles.footer}>Aura Wealth · v1.0 · Built with care</Text>
      </ScrollView>

      <Modal transparent visible={editing} animationType="fade" onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Your name</Text>
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
    </View>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function SettingRow({
  icon,
  color,
  title,
  value,
  onPress,
  chevron = true,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  value: string;
  onPress?: () => void;
  chevron?: boolean;
  testID?: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {chevron && onPress && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  },
  editTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginBottom: 12 },
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
});
