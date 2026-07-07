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

type EditModal =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; goal: Goal }
  | { kind: "add-funds"; goal: Goal };

export default function Goals() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const params = useLocalSearchParams<{ edit?: string; add?: string }>();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [modal, setModal] = useState<EditModal>({ kind: "none" });
  const [form, setForm] = useState({ title: "", target: "", saved: "" });
  const [contribution, setContribution] = useState("");

  const load = useCallback(async () => {
    const g = await getGoals();
    setGoals(g);
    if (params.edit) {
      const found = g.find((x) => x.id === params.edit);
      if (found) openEdit(found);
    } else if (params.add) {
      const found = g.find((x) => x.id === params.add);
      if (found) openAddFunds(found);
    }
  }, [params.edit, params.add]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setForm({ title: "", target: "", saved: "" });
    setModal({ kind: "new" });
  };
  const openEdit = (g: Goal) => {
    setForm({ title: g.title, target: String(g.target), saved: String(g.saved) });
    setModal({ kind: "edit", goal: g });
  };
  const openAddFunds = (g: Goal) => {
    setContribution("");
    setModal({ kind: "add-funds", goal: g });
  };
  const closeModal = () => setModal({ kind: "none" });

  const submit = async () => {
    const target = Number(form.target);
    const saved = Number(form.saved) || 0;
    if (!form.title.trim() || !target || target <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (modal.kind === "edit") {
      await updateGoal(modal.goal.id, { title: form.title.trim(), target, saved });
    } else {
      await addGoal({ title: form.title.trim(), target, saved });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeModal();
    load();
  };

  const applyContribution = async () => {
    if (modal.kind !== "add-funds") return;
    const amt = Number(contribution);
    if (!amt || amt <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const newSaved = modal.goal.saved + amt;
    await updateGoal(modal.goal.id, { saved: newSaved });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeModal();
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

  const contributionPreview = useMemo(() => {
    if (modal.kind !== "add-funds") return null;
    const amt = Number(contribution) || 0;
    const newSaved = modal.goal.saved + amt;
    const pct = Math.min(100, (newSaved / modal.goal.target) * 100);
    return { newSaved, pct };
  }, [contribution, modal]);

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
          <Bar value={totals.saved} max={totals.target || 1} onDark />
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
                    <Pressable
                      testID={`add-funds-${g.id}`}
                      onPress={() => openAddFunds(g)}
                      style={[styles.goalBtn, styles.goalBtnPrimary]}
                    >
                      <Ionicons name="add-circle" size={14} color="#fff" />
                      <Text style={[styles.goalBtnText, { color: "#fff" }]}>Add funds</Text>
                    </Pressable>
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

      {/* Modal — new / edit / add-funds */}
      <Modal transparent visible={modal.kind !== "none"} animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1 }} onPress={closeModal} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {modal.kind === "add-funds" ? (
              <>
                <Text style={styles.sheetTitle}>Add funds to goal</Text>
                <Text style={styles.sheetSub}>{modal.goal.title}</Text>

                <View style={styles.currentCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.currentLabel}>CURRENT</Text>
                    <Text style={styles.currentValue}>{formatMoney(modal.goal.saved, currency)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.brand} />
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={styles.currentLabel}>AFTER</Text>
                    <Text style={[styles.currentValue, { color: colors.brand }]}>
                      {formatMoney(contributionPreview?.newSaved || modal.goal.saved, currency)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.formLabel}>Amount to add ({currency.symbol})</Text>
                <TextInput
                  testID="contribution-input"
                  value={contribution}
                  onChangeText={(v) => setContribution(v.replace(/[^0-9]/g, ""))}
                  placeholder="5000"
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={styles.input}
                  autoFocus
                />

                <View style={styles.quickAmountRow}>
                  {[500, 1000, 5000, 10000].map((n) => (
                    <Pressable
                      key={n}
                      testID={`quick-add-${n}`}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setContribution(String(n));
                      }}
                      style={styles.quickAmountChip}
                    >
                      <Text style={styles.quickAmountText}>+{formatMoney(n, currency)}</Text>
                    </Pressable>
                  ))}
                </View>

                {contributionPreview && (
                  <View style={{ marginTop: 14 }}>
                    <View style={{ height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 999, overflow: "hidden" }}>
                      <View style={{ width: `${contributionPreview.pct}%`, height: "100%", backgroundColor: colors.brandPrimary, borderRadius: 999 }} />
                    </View>
                    <Text style={styles.progressText}>
                      {contributionPreview.pct.toFixed(0)}% of goal after this contribution
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={closeModal}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    testID="add-funds-save-btn"
                    style={[styles.btn, styles.btnPrimary, { opacity: !contribution ? 0.5 : 1 }]}
                    onPress={applyContribution}
                    disabled={!contribution}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.btnPrimaryText}>Add contribution</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>{modal.kind === "edit" ? "Edit goal" : "New goal"}</Text>

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
                    <Text style={styles.formLabel}>Target ({currency.symbol})</Text>
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
                    <Text style={styles.formLabel}>Saved ({currency.symbol})</Text>
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

                {modal.kind === "edit" && (
                  <Text style={styles.editHint}>
                    Tip: use <Text style={{ fontWeight: "800", color: colors.brand }}>Add funds</Text> from the goal card to add to your saved amount instead of overwriting.
                  </Text>
                )}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={closeModal}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable testID="goal-save-btn" style={[styles.btn, styles.btnPrimary]} onPress={submit}>
                    <Text style={styles.btnPrimaryText}>{modal.kind === "edit" ? "Save changes" : "Create goal"}</Text>
                  </Pressable>
                </View>
              </>
            )}
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Bar({ value, max, onDark = false }: { value: number; max: number; onDark?: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <View
      style={{
        height: 8,
        backgroundColor: onDark ? "rgba(255,255,255,0.18)" : colors.surfaceTertiary,
        borderRadius: 999,
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          backgroundColor: onDark ? "#B7E4C7" : colors.brandPrimary,
          borderRadius: 999,
        }}
      />
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  goalBtnPrimary: { backgroundColor: colors.brand },
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
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sheetSub: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 8 },
  currentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    marginTop: 12,
    marginBottom: 12,
  },
  currentLabel: {
    fontSize: 10,
    color: colors.brand,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  currentValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
  },
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
  quickAmountRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  },
  quickAmountChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brandTertiary,
  },
  quickAmountText: { fontSize: 11, color: colors.brand, fontWeight: "700" },
  progressText: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    fontWeight: "600",
  },
  editHint: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 12,
    lineHeight: 16,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  btnGhost: { backgroundColor: colors.surfaceTertiary },
  btnGhostText: { color: colors.onSurface, fontWeight: "700" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
