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
export default function BudgetDetailScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { id, initialBudget, initialCategory, initialSpent } = useLocalSearchParams<{ id: string; initialBudget?: string; initialCategory?: string; initialSpent?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();

  const [budget, setBudget] = useState<Budget | null>(initialBudget ? JSON.parse(initialBudget as string) : null);
  const [category, setCategory] = useState<Category | null>(initialCategory ? JSON.parse(initialCategory as string) : null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  
  // Edit limit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [limitAmt, setLimitAmt] = useState("");

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    const [budgets, cats, allTxs] = await Promise.all([getBudgets(), getCategories(), getTransactions()]);
    const b = budgets.find(x => x.id === id);
    if (b) {
      setBudget(b);
      setLimitAmt(String(b.limit));
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
    await upsertBudget({ categoryId: category.id, month: budget.month, limit: limitNum });
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

  const pct = Math.min(100, (spent / budget.limit) * 100);
  const over = spent > budget.limit;

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
              <Text style={s.cardValSub}>{formatMoney(budget.limit, currency)}</Text>
            </View>
          </View>
          
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: over ? colors.error : category.color || colors.brand }]} />
          </View>
          
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={[s.pctText, { color: over ? colors.error : category.color || colors.brand }]}>{pct.toFixed(0)}%</Text>
            <Text style={s.periodText}>
              {over ? `Over by ${formatMoney(spent - budget.limit, currency)}` : `${formatMoney(budget.limit - spent, currency)} left`}
            </Text>
          </View>
        </View>

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
          <BlurView intensity={60} tint="default" style={StyleSheet.absoluteFill}><Pressable style={{ flex: 1 }} onPress={() => setShowEdit(false)} /></BlurView>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24 }}>
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
            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <Pressable style={[s.btn, s.btnG]} onPress={() => setShowEdit(false)}><Text style={s.btnGT}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.btnP, { opacity: !limitAmt ? 0.5 : 1 }]} onPress={submitEdit} disabled={!limitAmt}><Text style={s.btnPT}>Save</Text></Pressable>
            </View>
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
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 32, marginBottom: 12, paddingHorizontal: 4 },
  listCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  historyTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  historyDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  historyAmt: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, marginTop: 32, borderRadius: radius.md, backgroundColor: colors.error + "08" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  btnG: { backgroundColor: colors.surfaceTertiary },
  btnGT: { color: colors.onSurface, fontWeight: "700" },
  btnP: { backgroundColor: colors.brand },
  btnPT: { color: "#fff", fontWeight: "700" },
});
