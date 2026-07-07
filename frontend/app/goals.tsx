import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatMoney } from "@/src/utils/format";
import { getGoals, addGoal, updateGoal, deleteGoal, Goal } from "@/src/store";
import { EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";

export default function Goals() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const params = useLocalSearchParams<{ edit?: string }>();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [modal, setModal] = useState<{ visible: boolean; goal?: Goal }>({ visible: false });
  const [form, setForm] = useState({ title: "", target: "", saved: "" });

  const load = useCallback(async () => {
    const g = await getGoals();
    setGoals(g);
    if (params.edit) {
      const found = g.find((x) => x.id === params.edit);
      if (found) openEdit(found);
    }
  }, [params.edit]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setModal({ visible: true });
    setForm({ title: "", target: "", saved: "" });
  };
  const openEdit = (g: Goal) => {
    setModal({ visible: true, goal: g });
    setForm({ title: g.title, target: String(g.target), saved: String(g.saved) });
  };

  const submit = async () => {
    const target = Number(form.target);
    const saved = Number(form.saved) || 0;
    if (!form.title.trim() || !target || target <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (modal.goal) {
      await updateGoal(modal.goal.id, { title: form.title.trim(), target, saved });
    } else {
      await addGoal({ title: form.title.trim(), target, saved });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModal({ visible: false });
    load();
  };

  const removeGoal = (id: string) => {
    Alert.alert("Delete goal?", "This will remove the goal permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteGoal(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          load();
        },
      },
    ]);
  };

  const totals = useMemo(() => {
    const target = goals.reduce((s, g) => s + g.target, 0);
    const saved = goals.reduce((s, g) => s + g.saved, 0);
    return { target, saved };
  }, [goals]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="goals-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Savings goals</Text>
        <Pressable testID="new-goal-btn" onPress={openNew} style={[styles.iconBtn, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons name="add" size={20} color={colors.brand} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>OVERALL PROGRESS</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 2 }}>
            <Text style={styles.summarySaved}>{formatMoney(totals.saved, currency)}</Text>
            <Text style={styles.summaryOf}>of {formatMoney(totals.target, currency)}</Text>
          </View>
          <Bar value={totals.saved} max={totals.target || 1} />
          <Text style={styles.summaryHint}>
            {goals.length === 0 ? "Tap + to create your first goal" : `${goals.length} active goal${goals.length > 1 ? "s" : ""}`}
          </Text>
        </View>

        {goals.length === 0 ? (
          <EmptyState icon="flag-outline" title="No goals" subtitle="Create a target and start saving" />
        ) : (
          <View style={{ marginTop: 16, gap: 12 }}>
            {goals.map((g) => {
              const pct = Math.min(100, (g.saved / g.target) * 100);
              return (
                <View key={g.id} style={styles.goalCard}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={styles.goalIcon}>
                      <Ionicons name="flag" size={18} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.goalTitle}>{g.title}</Text>
                      <Text style={styles.goalMeta}>
                        {formatMoney(g.saved, currency)} <Text style={{ color: colors.muted }}>of {formatMoney(g.target, currency)}</Text>
                      </Text>
                    </View>
                    <Text style={styles.goalPct}>{Math.round(pct)}%</Text>
                  </View>
                  <Bar value={g.saved} max={g.target} />
                  <View style={styles.goalActions}>
                    <Pressable testID={`edit-goal-${g.id}`} onPress={() => openEdit(g)} style={styles.goalBtn}>
                      <Ionicons name="create-outline" size={14} color={colors.onSurface} />
                      <Text style={styles.goalBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable testID={`del-goal-${g.id}`} onPress={() => removeGoal(g.id)} style={[styles.goalBtn, { backgroundColor: colors.error + "12" }]}>
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                      <Text style={[styles.goalBtnText, { color: colors.error }]}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal transparent visible={modal.visible} animationType="fade" onRequestClose={() => setModal({ visible: false })}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setModal({ visible: false })} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{modal.goal ? "Edit goal" : "New goal"}</Text>

            <Text style={styles.formLabel}>Title</Text>
            <TextInput
              testID="goal-title-input"
              value={form.title}
              onChangeText={(v) => setForm({ ...form, title: v })}
              placeholder="Emergency fund"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Target (₹)</Text>
                <TextInput
                  testID="goal-target-input"
                  value={form.target}
                  onChangeText={(v) => setForm({ ...form, target: v.replace(/[^0-9]/g, "") })}
                  placeholder="100000"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formLabel}>Saved so far (₹)</Text>
                <TextInput
                  testID="goal-saved-input"
                  value={form.saved}
                  onChangeText={(v) => setForm({ ...form, saved: v.replace(/[^0-9]/g, "") })}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setModal({ visible: false })}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable testID="goal-save-btn" style={[styles.btn, styles.btnPrimary]} onPress={submit}>
                <Text style={styles.btnPrimaryText}>{modal.goal ? "Save changes" : "Create goal"}</Text>
              </Pressable>
            </View>
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <View style={{ height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.brandPrimary, borderRadius: 999 }} />
    </View>
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
  summary: {
    padding: 18,
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  summaryLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", letterSpacing: 0.5, fontWeight: "700" },
  summarySaved: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  summaryOf: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  summaryHint: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 8 },
  goalCard: {
    padding: 14,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  goalTitle: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  goalMeta: { fontSize: 12, color: colors.onSurface, marginTop: 2, fontWeight: "600" },
  goalPct: { fontSize: 15, fontWeight: "800", color: colors.brand },
  goalActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  goalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  goalBtnText: { fontSize: 11, color: colors.onSurface, fontWeight: "700" },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginBottom: 12 },
  formLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.surface,
    fontWeight: "600",
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: { backgroundColor: colors.surfaceTertiary },
  btnGhostText: { color: colors.onSurface, fontWeight: "700" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
