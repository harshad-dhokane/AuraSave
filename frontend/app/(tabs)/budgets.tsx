import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatMoney, currentMonthKey, monthLabel } from "@/src/utils/format";
import {
  getTransactions,
  getCategories,
  getBudgets,
  upsertBudget,
  deleteBudget,
  getGoals,
  Transaction,
  Category,
  Budget,
  Goal,
} from "@/src/store";
import { CategoryIcon, EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const [tab, setTab] = useState<"budgets" | "goals">("budgets");
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [modal, setModal] = useState<{ visible: boolean; categoryId?: string; limit?: string }>({ visible: false });

  const mk = currentMonthKey();

  const load = useCallback(async () => {
    const [t, c, b, g] = await Promise.all([getTransactions(), getCategories(), getBudgets(), getGoals()]);
    setTxs(t);
    setCats(c);
    setBudgets(b);
    setGoals(g);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const expenseCats = useMemo(() => cats.filter((c) => c.type === "expense"), [cats]);

  const monthBudgets = useMemo(() => budgets.filter((b) => b.month === mk), [budgets, mk]);

  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs) {
      if (t.type !== "expense") continue;
      if (t.date.slice(0, 7) !== mk) continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
    return map;
  }, [txs, mk]);

  const totalBudget = monthBudgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = monthBudgets.reduce((s, b) => s + (spentByCat.get(b.categoryId) || 0), 0);

  const openAdd = (categoryId?: string) => {
    const existing = monthBudgets.find((b) => b.categoryId === categoryId);
    setModal({ visible: true, categoryId, limit: existing ? String(existing.limit) : "" });
  };

  const submitBudget = async () => {
    if (!modal.categoryId || !modal.limit) return;
    const lim = Number(modal.limit);
    if (!lim || lim <= 0) return;
    await upsertBudget({ categoryId: modal.categoryId, limit: lim, month: mk });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModal({ visible: false });
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Budgets & Goals</Text>
            <Text style={styles.subtitle}>{monthLabel(mk)}</Text>
          </View>
        </View>

        {/* Segmented control */}
        <View style={styles.segment}>
          <Pressable
            testID="seg-budgets"
            style={[styles.segmentBtn, tab === "budgets" && styles.segmentBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setTab("budgets");
            }}
          >
            <Text style={[styles.segmentText, tab === "budgets" && styles.segmentTextActive]}>Budgets</Text>
          </Pressable>
          <Pressable
            testID="seg-goals"
            style={[styles.segmentBtn, tab === "goals" && styles.segmentBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setTab("goals");
            }}
          >
            <Text style={[styles.segmentText, tab === "goals" && styles.segmentTextActive]}>Goals</Text>
          </Pressable>
        </View>

        {tab === "budgets" ? (
          <>
            {/* Overall progress card */}
            <View style={styles.overallCard}>
              <Text style={styles.overallLabel}>MONTHLY LIMIT</Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={styles.overallSpent}>{formatMoney(totalSpent, currency)}</Text>
                <Text style={styles.overallOf}>of {formatMoney(totalBudget, currency)}</Text>
              </View>
              <BudgetBar spent={totalSpent} limit={totalBudget || 1} large />
              <Text style={styles.overallSub}>
                {totalBudget === 0
                  ? "Set your first budget below"
                  : totalSpent > totalBudget
                  ? `Over by ${formatMoney(totalSpent - totalBudget, currency)}`
                  : `${formatMoney(Math.max(0, totalBudget - totalSpent), currency)} remaining this month`}
              </Text>
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Category budgets</Text>
              <Pressable testID="add-budget-btn" onPress={() => openAdd(expenseCats[0]?.id)} style={styles.addBtn}>
                <Ionicons name="add" size={16} color={colors.brand} />
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>

            {monthBudgets.length === 0 ? (
              <EmptyState icon="wallet-outline" title="No budgets yet" subtitle="Tap Add to set a category limit" />
            ) : (
              <View style={{ marginHorizontal: spacing.lg, gap: 10 }}>
                {monthBudgets.map((b) => {
                  const c = catMap.get(b.categoryId);
                  const spent = spentByCat.get(b.categoryId) || 0;
                  const over = spent > b.limit;
                  return (
                    <Pressable
                      key={b.id}
                      testID={`budget-item-${b.id}`}
                      onPress={() => openAdd(b.categoryId)}
                      onLongPress={async () => {
                        await deleteBudget(b.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        load();
                      }}
                      style={styles.budgetCard}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                        <CategoryIcon name={c?.icon || "ellipsis-horizontal"} color={c?.color || colors.muted} size={38} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.budgetName}>{c?.name || "Uncategorized"}</Text>
                          <Text style={styles.budgetMeta}>
                            {formatMoney(spent, currency)} <Text style={{ color: colors.muted }}>of {formatMoney(b.limit, currency)}</Text>
                          </Text>
                        </View>
                        <Text style={[styles.budgetPct, { color: over ? colors.error : colors.brand }]}>
                          {Math.min(999, Math.round((spent / b.limit) * 100))}%
                        </Text>
                      </View>
                      <BudgetBar spent={spent} limit={b.limit} color={c?.color} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Goals */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Savings goals</Text>
              <Pressable testID="add-goal-btn" onPress={() => router.push("/goals")} style={styles.addBtn}>
                <Ionicons name="add" size={16} color={colors.brand} />
                <Text style={styles.addBtnText}>New</Text>
              </Pressable>
            </View>
            {goals.length === 0 ? (
              <EmptyState icon="flag-outline" title="No goals yet" subtitle="Set a savings target and track progress" />
            ) : (
              <View style={{ marginHorizontal: spacing.lg, gap: 10 }}>
                {goals.map((g) => {
                  const pct = Math.min(100, (g.saved / g.target) * 100);
                  return (
                    <View key={g.id} style={styles.goalCard}>
                      <Pressable
                        testID={`goal-item-${g.id}`}
                        onPress={() => router.push({ pathname: "/goals", params: { edit: g.id } })}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.goalTitle}>{g.title}</Text>
                            <Text style={styles.goalSub}>
                              {formatMoney(g.saved, currency)} <Text style={{ color: colors.muted }}>saved of {formatMoney(g.target, currency)}</Text>
                            </Text>
                          </View>
                          <View style={styles.goalPctBadge}>
                            <Text style={styles.goalPctText}>{Math.round(pct)}%</Text>
                          </View>
                        </View>
                        <BudgetBar spent={g.saved} limit={g.target} color={colors.brandPrimary} />
                      </Pressable>
                      <Pressable
                        testID={`goal-add-funds-${g.id}`}
                        onPress={() => router.push({ pathname: "/goals", params: { add: g.id } })}
                        style={styles.goalAddFundsBtn}
                      >
                        <Ionicons name="add-circle" size={14} color={colors.brand} />
                        <Text style={styles.goalAddFundsText}>Add funds</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Budget modal */}
      <Modal transparent visible={modal.visible} animationType="fade" onRequestClose={() => setModal({ visible: false })}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setModal({ visible: false })} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Set monthly budget</Text>

            <Text style={styles.formLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {expenseCats.map((c) => {
                const active = modal.categoryId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setModal({ ...modal, categoryId: c.id })}
                    style={[styles.catChip, active && { backgroundColor: c.color + "22", borderColor: c.color }]}
                  >
                    <Ionicons name={c.icon as any} size={14} color={active ? c.color : colors.onSurface} />
                    <Text style={[styles.catChipText, active && { color: c.color, fontWeight: "700" }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={[styles.formLabel, { marginTop: 12 }]}>Monthly limit (₹)</Text>
            <TextInput
              testID="budget-limit-input"
              keyboardType="numeric"
              value={modal.limit}
              onChangeText={(v) => setModal({ ...modal, limit: v.replace(/[^0-9]/g, "") })}
              placeholder="10000"
              placeholderTextColor={colors.muted}
              style={styles.formInput}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable style={[styles.formBtn, styles.formBtnGhost]} onPress={() => setModal({ visible: false })}>
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </Pressable>
              <Pressable testID="budget-save-btn" style={[styles.formBtn, styles.formBtnPrimary]} onPress={submitBudget}>
                <Text style={styles.formBtnPrimaryText}>Save budget</Text>
              </Pressable>
            </View>
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function BudgetBar({
  spent,
  limit,
  color = colors.brandPrimary,
  large = false,
}: {
  spent: number;
  limit: number;
  color?: string;
  large?: boolean;
}) {
  const pct = Math.min(100, (spent / limit) * 100);
  const over = spent > limit;
  const barColor = over ? colors.error : color;
  return (
    <View style={{ height: large ? 10 : 8, backgroundColor: colors.surfaceTertiary, borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: barColor, borderRadius: 999 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingHorizontal: spacing.lg, paddingTop: 8 },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: colors.surfaceSecondary,
    ...shadow.card,
  },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segmentTextActive: { color: colors.onSurface, fontWeight: "800" },
  overallCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: 18,
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    ...shadow.card,
  },
  overallLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  overallSpent: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  overallOf: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  overallSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 8,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addBtnText: { fontSize: 12, color: colors.brand, fontWeight: "700" },
  budgetCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  budgetName: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  budgetMeta: { fontSize: 12, color: colors.onSurface, marginTop: 2, fontWeight: "600" },
  budgetPct: { fontSize: 15, fontWeight: "800" },
  goalCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    gap: 8,
  },
  goalTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  goalSub: { fontSize: 12, color: colors.onSurface, marginTop: 2, fontWeight: "600" },
  goalPctBadge: {
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  goalPctText: { fontSize: 12, color: colors.brand, fontWeight: "800" },
  goalAddFundsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: 10,
  },
  goalAddFundsText: { fontSize: 11, color: colors.brand, fontWeight: "800" },
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
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    flexShrink: 0,
  },
  catChipText: { fontSize: 12, color: colors.onSurface, fontWeight: "600" },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.onSurface,
    backgroundColor: colors.surface,
    fontWeight: "700",
  },
  formBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  formBtnGhost: { backgroundColor: colors.surfaceTertiary },
  formBtnGhostText: { color: colors.onSurface, fontWeight: "700" },
  formBtnPrimary: { backgroundColor: colors.brand },
  formBtnPrimaryText: { color: "#fff", fontWeight: "800" },
});
