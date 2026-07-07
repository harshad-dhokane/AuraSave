import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { radius, spacing } from "@/src/theme";
import { formatMoney, formatDate, monthLabel } from "@/src/utils/format";
import { getBudgets, getCategories, getTransactions, Budget, Category, Transaction, upsertBudget, deleteBudget } from "@/src/store";
import { useCurrency } from "@/src/currency";
import { CategoryIcon, EmptyState } from "@/src/components/CategoryIcon";
import { useTheme } from "@/src/theme/ThemeContext";

const ALERT_OPTIONS = [70, 80, 90, 100];

function shiftMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function elapsedDays(monthKey: string) {
  const current = currentMonthKey();
  if (monthKey < current) return daysInMonth(monthKey);
  if (monthKey > current) return 0;
  return new Date().getDate();
}

function monthProgress(monthKey: string) {
  return Math.min(1, Math.max(0, elapsedDays(monthKey) / daysInMonth(monthKey)));
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

export default function BudgetDetailScreen() {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { id, initialBudget, initialCategory, initialSpent } = useLocalSearchParams<{ id: string; initialBudget?: string; initialCategory?: string; initialSpent?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();

  const [budget, setBudget] = useState<Budget | null>(initialBudget ? JSON.parse(initialBudget as string) : null);
  const [category, setCategory] = useState<Category | null>(initialCategory ? JSON.parse(initialCategory as string) : null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [allTxs, setAllTxs] = useState<Transaction[]>([]);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  
  // Edit limit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [limitAmt, setLimitAmt] = useState("");
  const [budgetKind, setBudgetKind] = useState<"fixed" | "flexible">("flexible");
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [alertPercent, setAlertPercent] = useState(80);
  const [recurringDay, setRecurringDay] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");
  const blurTint = isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight";

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    const [budgets, cats, allTxs] = await Promise.all([getBudgets(), getCategories(), getTransactions()]);
    setAllBudgets(budgets);
    setAllTxs(allTxs);
    const b = budgets.find(x => x.id === id);
    if (b) {
      setBudget(b);
      setLimitAmt(String(b.limit));
      setBudgetKind(b.kind || "flexible");
      setRolloverEnabled(b.rolloverEnabled === true);
      setAlertPercent(b.alertPercent || 80);
      setRecurringDay(b.recurringDay ? String(b.recurringDay) : "");
      setBudgetNotes(b.notes || "");
      const c = cats.find(x => x.id === b.categoryId);
      if (c) setCategory(c);
      
      const filtered = allTxs.filter(t => t.categoryId === b.categoryId && t.date.startsWith(b.month)).sort((x, y) => y.date.localeCompare(x.date));
      setTxs(filtered);
    }
  };

  const submitEdit = async () => {
    if (!budget || !category) return;
    const limitNum = Number(limitAmt);
    if (!limitNum || limitNum <= 0) { 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); 
      return; 
    }
    await upsertBudget({
      categoryId: category.id,
      month: budget.month,
      limit: limitNum,
      kind: budgetKind,
      rolloverEnabled,
      alertPercent,
      recurringDay: recurringDay ? Math.min(31, Math.max(1, Number(recurringDay))) : undefined,
      notes: budgetNotes.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
    setShowEdit(false);
    load();
  };
  
  const removeBudget = async () => {
    if (!budget) return;
    await deleteBudget(budget.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.back();
  };

  const spent = useMemo(() => txs.length > 0 ? txs.reduce((s, t) => s + t.amount, 0) : (initialSpent ? Number(initialSpent) : 0), [txs, initialSpent]);

  if (!budget || !category) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const previousMonth = shiftMonthKey(budget.month, -1);
  const previousBudget = allBudgets.find((b) => b.categoryId === budget.categoryId && b.month === previousMonth);
  const rollover = budget.rolloverEnabled && previousBudget ? Math.max(0, previousBudget.limit - spentFor(allTxs, budget.categoryId, previousMonth)) : 0;
  const effectiveLimit = budget.limit + rollover;
  const pct = Math.min(100, (spent / effectiveLimit) * 100);
  const over = spent > effectiveLimit;
  const projected = projectedSpend(spent, budget.month);
  const paceDelta = spent - effectiveLimit * monthProgress(budget.month);
  const alerting = !over && spent >= effectiveLimit * ((budget.alertPercent || 80) / 100);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen 
        options={{ 
          headerShown: false
        }} 
      />

      {/* Header */}
      <View style={[s.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={s.title} numberOfLines={1}>{category.name} Budget</Text>
        <Pressable onPress={() => setShowEdit(true)} style={s.addBtn}>
          <Ionicons name="create-outline" size={16} color={colors.surface} />
          <Text style={s.addBtnText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}>
        <Text style={s.monthLabel}>{monthLabel(budget.month)}</Text>
        
        {/* Progress Card */}
        <View style={s.progressCard}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <CategoryIcon name={category.icon as any} color={category.color} size={40} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.cardLabel}>SPENT</Text>
              <Text style={s.cardVal}>{formatMoney(spent, currency)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.cardLabel}>LIMIT</Text>
              <Text style={s.cardValSub}>{formatMoney(effectiveLimit, currency)}</Text>
            </View>
          </View>
          
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: over ? colors.error : category.color || colors.brand }]} />
          </View>
          
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={[s.pctText, { color: over ? colors.error : category.color || colors.brand }]}>{pct.toFixed(0)}%</Text>
            <Text style={s.periodText}>
              {over ? `Over by ${formatMoney(spent - effectiveLimit, currency)}` : `${formatMoney(effectiveLimit - spent, currency)} left`}
            </Text>
          </View>
        </View>

        <View style={s.metricGrid}>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>PACE</Text>
            <Text style={[s.metricValue, { color: paceDelta > 0 ? colors.warning : colors.success }]}>
              {paceDelta > 0 ? `${formatMoney(paceDelta, currency)} ahead` : `${formatMoney(Math.abs(paceDelta), currency)} under`}
            </Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>PROJECTED</Text>
            <Text style={[s.metricValue, { color: projected > effectiveLimit ? colors.error : colors.onSurface }]}>
              {formatMoney(projected, currency)}
            </Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>TYPE</Text>
            <Text style={s.metricValue}>{budget.kind === "fixed" ? "Fixed" : "Flexible"}</Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>ALERT</Text>
            <Text style={[s.metricValue, { color: alerting ? colors.warning : colors.onSurface }]}>{budget.alertPercent || 80}%</Text>
          </View>
        </View>

        {(rollover > 0 || budget.recurringDay || budget.notes) && (
          <View style={s.infoCard}>
            {rollover > 0 && <Text style={s.infoText}>Rollover cushion: {formatMoney(rollover, currency)}</Text>}
            {budget.recurringDay && <Text style={s.infoText}>Recurring day: {budget.recurringDay}</Text>}
            {budget.notes && <Text style={s.infoText}>{budget.notes}</Text>}
          </View>
        )}

        <Text style={s.sectionTitle}>Transactions</Text>
        <View style={s.listCard}>
          {txs.length === 0 ? (
            <View style={{ padding: 20 }}>
              <EmptyState icon="receipt-outline" title="No spending" subtitle="You haven't spent anything here yet" />
            </View>
          ) : (
            txs.map((t, i) => (
              <View key={t.id} style={[s.historyRow, i === txs.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={s.historyTitle} numberOfLines={1}>{t.note || "Expense"}</Text>
                  <Text style={s.historyDate}>{formatDate(t.date)}</Text>
                </View>
                <Text style={s.historyAmt}>-{formatMoney(t.amount, currency)}</Text>
              </View>
            ))
          )}
        </View>
        
        <Pressable onPress={removeBudget} style={s.deleteRow}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={{ fontSize: 13, color: colors.error, fontWeight: "700", marginLeft: 6 }}>Remove budget limit</Text>
        </Pressable>
      </ScrollView>

      {/* Edit Limit Modal */}
      <Modal visible={showEdit} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <BlurView
            intensity={45}
            tint={blurTint}
            blurReductionFactor={2}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setShowEdit(false)} />
          </BlurView>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24, maxHeight: "88%" }}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface, marginBottom: 16 }}>Edit Budget Limit</Text>
            <Text style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", fontWeight: "700", marginBottom: 6 }}>Amount ({currency.symbol})</Text>
            <TextInput 
              value={limitAmt} 
              onChangeText={(v) => setLimitAmt(v.replace(/[^0-9]/g, ""))} 
              placeholder="1000" 
              placeholderTextColor={colors.muted} 
              keyboardType="numeric" 
              style={s.input} 
              autoFocus 
            />
            <Text style={[s.modalLabel, { marginTop: 18 }]}>Budget type</Text>
            <View style={s.typeToggle}>
              <Pressable onPress={() => setBudgetKind("flexible")} style={[s.typeBtn, budgetKind === "flexible" && s.typeBtnActive]}>
                <Text style={[s.typeText, budgetKind === "flexible" && s.typeTextActive]}>Flexible</Text>
              </Pressable>
              <Pressable onPress={() => setBudgetKind("fixed")} style={[s.typeBtn, budgetKind === "fixed" && s.typeBtnActive]}>
                <Text style={[s.typeText, budgetKind === "fixed" && s.typeTextActive]}>Fixed</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setRolloverEnabled((v) => !v)} style={s.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleTitle}>Rollover unused money</Text>
                <Text style={s.toggleSub}>Carry unused money from the previous month</Text>
              </View>
              <View style={[s.toggle, rolloverEnabled && s.toggleOn]}>
                <View style={[s.toggleKnob, rolloverEnabled && s.toggleKnobOn]} />
              </View>
            </Pressable>

            <Text style={[s.modalLabel, { marginTop: 18 }]}>Alert at</Text>
            <View style={s.alertRow}>
              {ALERT_OPTIONS.map((pct) => (
                <Pressable key={pct} onPress={() => setAlertPercent(pct)} style={[s.alertChip, alertPercent === pct && s.alertChipActive]}>
                  <Text style={[s.alertText, alertPercent === pct && s.alertTextActive]}>{pct}%</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalLabel}>Recurring day</Text>
                <TextInput value={recurringDay} onChangeText={(v) => setRecurringDay(v.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="Optional" placeholderTextColor={colors.muted} keyboardType="numeric" style={s.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalLabel}>Notes</Text>
                <TextInput value={budgetNotes} onChangeText={setBudgetNotes} placeholder="Optional" placeholderTextColor={colors.muted} style={s.input} />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <Pressable style={[s.btn, s.btnG]} onPress={() => setShowEdit(false)}><Text style={s.btnGT}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.btnP, { opacity: !limitAmt ? 0.5 : 1 }]} onPress={submitEdit} disabled={!limitAmt}><Text style={s.btnPT}>Save</Text></Pressable>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface, flex: 1, textAlign: "center", marginHorizontal: 12 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.onSurface, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  addBtnText: { color: colors.surface, fontSize: 12, fontWeight: "700" },
  monthLabel: { fontSize: 14, fontWeight: "700", color: colors.muted, marginBottom: 12, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 },
  progressCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 0.6 },
  cardVal: { fontSize: 24, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  cardValSub: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  barBg: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  barFill: { height: "100%", borderRadius: 4 },
  pctText: { fontSize: 13, fontWeight: "800" },
  periodText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  metricBox: { width: "48%", padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  metricLabel: { fontSize: 10, color: colors.muted, fontWeight: "800", letterSpacing: 0.4 },
  metricValue: { fontSize: 13, color: colors.onSurface, fontWeight: "800", marginTop: 4 },
  infoCard: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, gap: 4 },
  infoText: { fontSize: 12, color: colors.onSurface, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 32, marginBottom: 12, paddingHorizontal: 4 },
  listCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  historyTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  historyDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  historyAmt: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, marginTop: 32, borderRadius: radius.md, backgroundColor: colors.error + "08" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  modalLabel: { fontSize: 11, color: colors.muted, textTransform: "uppercase", fontWeight: "700", marginBottom: 6 },
  typeToggle: { flexDirection: "row", gap: 8, padding: 4, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary },
  typeBtn: { flex: 1, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  typeBtnActive: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  typeText: { fontSize: 13, color: colors.muted, fontWeight: "700" },
  typeTextActive: { color: colors.brand, fontWeight: "800" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  toggleTitle: { fontSize: 13, color: colors.onSurface, fontWeight: "800" },
  toggleSub: { fontSize: 11, color: colors.muted, marginTop: 2, fontWeight: "600" },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.borderStrong, padding: 2, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.brand },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  toggleKnobOn: { transform: [{ translateX: 20 }] },
  alertRow: { flexDirection: "row", gap: 8 },
  alertChip: { flex: 1, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  alertChipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  alertText: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  alertTextActive: { color: colors.brand, fontWeight: "800" },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  btnG: { backgroundColor: colors.surfaceTertiary },
  btnGT: { color: colors.onSurface, fontWeight: "700" },
  btnP: { backgroundColor: colors.brand },
  btnPT: { color: "#fff", fontWeight: "700" },
});
