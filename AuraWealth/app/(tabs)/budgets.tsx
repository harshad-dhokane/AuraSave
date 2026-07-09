import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal,
  TextInput, KeyboardAvoidingView, Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { radius, spacing, shadow } from "@/src/theme";
import { formatMoney, currentMonthKey, monthLabel } from "@/src/utils/format";
import {
  getTransactions, getCategories, getBudgets, upsertBudget, deleteBudget,
  Transaction, Category, Budget
} from "@/src/store";
import { ConfirmModal } from "@/src/components/ConfirmModal";
import { CategoryIcon, EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";
import { useTabBarScroll } from "@/src/context/TabBarScrollContext";
import { useTheme } from "@/src/theme/ThemeContext";

type ModalState =
  | { kind: "none" }
  | { kind: "edit"; categoryId?: string; limit: string }

function shiftMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function elapsedDays(monthKey: string) {
  const current = currentMonthKey();
  if (monthKey < current) return daysInMonth(monthKey);
  if (monthKey > current) return 0;
  return new Date().getDate();
}

function monthProgress(monthKey: string) {
  const days = daysInMonth(monthKey);
  return Math.min(1, Math.max(0, elapsedDays(monthKey) / days));
}

function spentFor(txs: Transaction[], categoryId: string, monthKey: string) {
  return txs
    .filter((t) => t.type === "expense" && t.categoryId === categoryId && t.date.startsWith(monthKey))
    .reduce((sum, t) => sum + t.amount, 0);
}

function projectedSpend(spent: number, monthKey: string) {
  const elapsed = elapsedDays(monthKey);
  if (elapsed <= 0) return 0;
  if (monthKey !== currentMonthKey()) return spent;
  return (spent / elapsed) * daysInMonth(monthKey);
}

export default function BudgetsScreen() {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const { onScroll } = useTabBarScroll();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [deleteBudgetId, setDeleteBudgetId] = useState<string | null>(null);
  const blurTint = isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight";

  const shiftMonth = (offset: number) => {
    Haptics.selectionAsync();
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  const confirmDelete = async () => {
    if (!deleteBudgetId) return;
    await deleteBudget(deleteBudgetId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleteBudgetId(null);
    load();
  };

  const load = useCallback(async () => {
    const [t, c, b] = await Promise.all([getTransactions(), getCategories(), getBudgets()]);
    setTxs(t); setCats(c); setBudgets(b);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const monthBudgets = useMemo(() => budgets.filter((b) => b.month === selectedMonth), [budgets, selectedMonth]);
  const monthTxs = useMemo(() => txs.filter((t) => t.date.startsWith(selectedMonth)), [txs, selectedMonth]);
  const expenseCats = useMemo(() => cats.filter((c) => c.type === "expense"), [cats]);
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxs) {
      if (t.type === "expense" && t.categoryId) {
        map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
      }
    }
    return map;
  }, [monthTxs]);

  const previousMonth = useMemo(() => shiftMonthKey(selectedMonth, -1), [selectedMonth]);
  const rolloverByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of monthBudgets) {
      if (!b.rolloverEnabled) continue;
      const previousBudget = budgets.find((x) => x.categoryId === b.categoryId && x.month === previousMonth);
      if (!previousBudget) continue;
      map.set(b.categoryId, Math.max(0, previousBudget.limit - spentFor(txs, b.categoryId, previousMonth)));
    }
    return map;
  }, [budgets, monthBudgets, previousMonth, txs]);

  const progress = useMemo(() => monthProgress(selectedMonth), [selectedMonth]);
  const totalSpent = useMemo(() => monthBudgets.reduce((sum, b) => sum + (spentByCat.get(b.categoryId) || 0), 0), [monthBudgets, spentByCat]);
  const totalBudget = useMemo(() => monthBudgets.reduce((sum, b) => sum + b.limit, 0), [monthBudgets]);
  const totalRollover = useMemo(() => monthBudgets.reduce((sum, b) => sum + (rolloverByCat.get(b.categoryId) || 0), 0), [monthBudgets, rolloverByCat]);
  const totalEffectiveBudget = totalBudget + totalRollover;
  const totalProjected = useMemo(() => monthBudgets.reduce((sum, b) => sum + projectedSpend(spentByCat.get(b.categoryId) || 0, selectedMonth), 0), [monthBudgets, selectedMonth, spentByCat]);

  const close = () => setModal({ kind: "none" });

  const openAdd = (catId?: string) => {
    const b = monthBudgets.find((x) => x.categoryId === catId);
    setModal({ kind: "edit", categoryId: catId, limit: b ? String(b.limit) : "" });
  };

  const openAddScreen = () => {
    router.push({
      pathname: "/add-budget",
      params: {
        month: selectedMonth,
        categoryId: expenseCats[0]?.id ?? "",
      },
    });
  };

  const openDetail = (b: Budget, c: Category | undefined, spent: number) => {
    router.push({ pathname: "/budget-detail", params: { id: b.id, initialBudget: JSON.stringify(b), initialCategory: JSON.stringify(c), initialSpent: spent.toString() } });
  };

  const submitBudget = async () => {
    if (modal.kind !== "edit") return;
    const limitNum = Number(modal.limit);
    if (!modal.categoryId || !limitNum || limitNum <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await upsertBudget({ categoryId: modal.categoryId, month: selectedMonth, limit: limitNum });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>Budgets</Text>
            <Text style={s.subtitle}>Monitor your spending</Text>
          </View>
          <View style={s.monthSelector}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={s.monthBtn}><Ionicons name="chevron-back" size={16} color={colors.onSurface} /></Pressable>
            <Text style={s.monthText}>{monthLabel(selectedMonth)}</Text>
            <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={s.monthBtn}><Ionicons name="chevron-forward" size={16} color={colors.onSurface} /></Pressable>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 0, paddingBottom: 140 }} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>

        <View style={s.overallCard}>
          <Text style={s.overallLabel}>MONTHLY LIMIT</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={s.overallSpent}>{formatMoney(totalSpent, currency)}</Text>
            <Text style={s.overallOf}>of {formatMoney(totalEffectiveBudget, currency)}</Text>
          </View>
          <BudgetBar spent={totalSpent} limit={totalEffectiveBudget || 1} large colors={colors} />
          <Text style={s.overallSub}>{totalBudget === 0 ? "Set your first budget below" : totalSpent > totalEffectiveBudget ? `Over by ${formatMoney(totalSpent - totalEffectiveBudget, currency)}` : `${formatMoney(Math.max(0, totalEffectiveBudget - totalSpent), currency)} remaining`}</Text>
          {totalBudget > 0 && (
            <View style={s.overallStats}>
              <View style={s.statPill}><Text style={s.statPillText}>Projected {formatMoney(totalProjected, currency)}</Text></View>
              {totalRollover > 0 && <View style={s.statPill}><Text style={s.statPillText}>Rollover {formatMoney(totalRollover, currency)}</Text></View>}
            </View>
          )}
        </View>

        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>Category budgets</Text>
          <Pressable onPress={openAddScreen} hitSlop={10} style={{ padding: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 12 }}>
            <Ionicons name="add" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        {monthBudgets.length === 0 ? (
          <EmptyState icon="wallet-outline" title="No budgets yet" subtitle="Tap Add to set a category limit" />
        ) : (
          <View style={{ marginHorizontal: spacing.lg, gap: 8 }}>
            {monthBudgets.map((b) => {
              const c = catMap.get(b.categoryId);
              const spent = spentByCat.get(b.categoryId) || 0;
              const rollover = rolloverByCat.get(b.categoryId) || 0;
              const effectiveLimit = b.limit + rollover;
              const over = spent > effectiveLimit;
              const pct = Math.min(999, Math.round((spent / effectiveLimit) * 100));
              const paceLimit = effectiveLimit * progress;
              const paceDelta = spent - paceLimit;
              const projected = projectedSpend(spent, selectedMonth);
              const alertPercent = b.alertPercent || 80;
              const alerting = !over && spent >= effectiveLimit * (alertPercent / 100);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => openDetail(b, c, spent)}
                  onLongPress={() => { Haptics.selectionAsync(); setDeleteBudgetId(b.id); }}
                  style={s.budgetCard}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <CategoryIcon name={c?.icon || "ellipsis-horizontal"} color={c?.color || colors.muted} size={34} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.budgetName}>{c?.name || "Uncategorized"}</Text>
                      <Text style={s.budgetMeta}>{formatMoney(spent, currency)} <Text style={{ color: colors.muted }}>/ {formatMoney(effectiveLimit, currency)}</Text></Text>
                    </View>
                    <Pressable onPress={() => openAdd(b.categoryId)} style={s.inlineEdit}><Ionicons name="create-outline" size={14} color={colors.brand} /></Pressable>
                    <Text style={[s.budgetPct, { color: over ? colors.error : colors.brand }]}>{pct}%</Text>
                  </View>
                  <BudgetBar spent={spent} limit={effectiveLimit} color={c?.color} colors={colors} />
                  <View style={s.budgetPaceRow}>
                    <View style={[s.badge, { backgroundColor: (b.kind === "fixed" ? colors.info : colors.brand) + "18" }]}>
                      <Text style={[s.badgeText, { color: b.kind === "fixed" ? colors.info : colors.brand }]}>{b.kind === "fixed" ? "Fixed" : "Flexible"}</Text>
                    </View>
                    <Text style={[s.paceText, { color: over || paceDelta > 0 ? colors.warning : colors.muted }]} numberOfLines={1}>
                      {over ? `Over limit. Projected ${formatMoney(projected, currency)}` : paceDelta > 0 ? `${formatMoney(paceDelta, currency)} ahead of pace` : `${formatMoney(Math.abs(paceDelta), currency)} under pace`}
                    </Text>
                  </View>
                  {(b.recurringDay || rollover > 0 || alerting) && (
                    <View style={s.budgetInfoRow}>
                      {b.recurringDay ? <View style={s.badge}><Text style={s.badgeText}>Due {b.recurringDay}</Text></View> : null}
                      {rollover > 0 ? <View style={s.badge}><Text style={s.badgeText}>+{formatMoney(rollover, currency)}</Text></View> : null}
                      {alerting ? <View style={[s.badge, { backgroundColor: colors.warning + "18" }]}><Text style={[s.badgeText, { color: colors.warning }]}>Alert {alertPercent}%</Text></View> : null}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <Modal transparent visible={modal.kind !== "none"} animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "transparent", justifyContent: "flex-end" }}>
          <BlurView
            intensity={45}
            tint={blurTint}
            blurReductionFactor={2} experimentalBlurMethod="dimezisBlurView"
           
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={{ flex: 1 }} onPress={close} />
          </BlurView>
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.handle} />
            {/* ── Edit/New Modal ── */}
            {modal.kind === "edit" && (<>
              <View style={s.sheetHeader}>
                <Text style={s.sheetTitle}>Set monthly budget</Text>
                <Pressable onPress={close} style={s.closeBtn}><Ionicons name="close" size={20} color={colors.onSurface} /></Pressable>
              </View>
              <Text style={s.formLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {expenseCats.map((c) => {
                  const active = modal.categoryId === c.id;
                  return (
                    <Pressable key={c.id} onPress={() => setModal({ ...modal, categoryId: c.id })} style={[s.catChip, active && { backgroundColor: c.color + "22", borderColor: c.color }]}>
                      <Ionicons name={c.icon as any} size={14} color={active ? c.color : colors.onSurface} />
                      <Text style={[s.catChipText, active && { color: c.color, fontWeight: "700" }]}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={[s.formLabel, { marginTop: 12 }]}>Monthly limit ({currency.symbol})</Text>
              <TextInput keyboardType="numeric" value={modal.limit} onChangeText={(v) => setModal({ ...modal, limit: v.replace(/[^0-9]/g, "") })} placeholder="10000" placeholderTextColor={colors.muted} style={s.input} autoFocus />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <Pressable style={[s.btn, s.btnG]} onPress={close}><Text style={s.btnGT}>Cancel</Text></Pressable>
                <Pressable style={[s.btn, s.btnP]} onPress={submitBudget}><Text style={s.btnPT}>Save budget</Text></Pressable>
              </View>
            </>)}
            
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <ConfirmModal 
        visible={!!deleteBudgetId}
        title="Delete budget?"
        subtitle={`Are you sure you want to delete the budget for "${cats.find(c => c.id === budgets.find(b => b.id === deleteBudgetId)?.categoryId)?.name || "Uncategorized"}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
        onCancel={() => setDeleteBudgetId(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

function BudgetBar({ spent, limit, color, large = false, colors }: { spent: number; limit: number; color?: string; large?: boolean; colors: any }) {
  const over = spent > limit;
  const pct = Math.min(100, (spent / limit) * 100);
  return (
    <View style={{ height: large ? 10 : 6, backgroundColor: colors.surfaceTertiary, borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: over ? colors.error : (color || colors.brand), borderRadius: 999 }} />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  headerWrap: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  monthSelector: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, paddingHorizontal: 4, paddingVertical: 4 },
  monthBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.surface },
  monthText: { fontSize: 13, fontWeight: "700", color: colors.onSurface, paddingHorizontal: 12, minWidth: 90, textAlign: "center" },
  overallCard: { marginHorizontal: spacing.lg, padding: 16, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  overallLabel: { fontSize: 10, color: colors.muted, letterSpacing: 0.6, fontWeight: "700" },
  overallSpent: { fontSize: 28, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  overallOf: { fontSize: 12, color: colors.muted, marginBottom: 4 },
  overallSub: { fontSize: 11, color: colors.muted, marginTop: 8, fontWeight: "600" },
  overallStats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  statPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  statPillText: { fontSize: 11, color: colors.onSurface, fontWeight: "700" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: spacing.lg, marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  addBtnText: { fontSize: 12, color: colors.brand, fontWeight: "700" },
  budgetCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  budgetName: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  budgetMeta: { fontSize: 12, color: colors.onSurface, marginTop: 1, fontWeight: "600" },
  budgetPct: { fontSize: 13, fontWeight: "800", marginLeft: 6 },
  inlineEdit: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginRight: 6 },
  budgetPaceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  budgetInfoRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  badgeText: { fontSize: 10, color: colors.muted, fontWeight: "800" },
  paceText: { flex: 1, fontSize: 11, color: colors.muted, fontWeight: "700", textAlign: "right" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, ...shadow.card, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  formLabel: { fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  catChipText: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  btnG: { backgroundColor: colors.surfaceTertiary },
  btnGT: { color: colors.onSurface, fontWeight: "700" },
  btnP: { backgroundColor: colors.brand },
  btnPT: { color: "#fff", fontWeight: "800" },
  detailSummary: { flexDirection: "row", padding: 14, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, marginTop: 4 },
  detailLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 0.4 },
  detailValue: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  historyAmt: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  historyDate: { fontSize: 11, color: colors.muted, marginTop: 1 },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, marginTop: 12, borderRadius: radius.md, backgroundColor: colors.error + "08" },
});
