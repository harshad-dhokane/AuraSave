import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { PieChart } from "react-native-gifted-charts";

import { radius, spacing, shadow } from "@/src/theme";
import { formatMoney } from "@/src/utils/format";
import { getTransactions, getCategories, getGoalContributions, getLoans, getGoals, Transaction, Category, GoalContribution, Loan, Goal } from "@/src/store";
import { EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";
import { RangePickerModal } from "@/src/components/DatePicker";
import { useTabBarScroll } from "@/src/context/TabBarScrollContext";
import { useTheme } from "@/src/theme/ThemeContext";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function rangeLabel(from: Date, to: Date): string {
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    const som = new Date(from.getFullYear(), from.getMonth(), 1);
    const eom = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    if (from.getTime() === som.getTime() && to.toDateString() === eom.toDateString()) {
      return from.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (days <= 31) return `${fmtDay(from)} → ${fmtDay(to)}`;
  return `${fmtDay(from)} — ${fmtDay(to)}`;
}

function daysInclusive(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function inDateRange(iso: string, from: Date, to: Date): boolean {
  const ts = new Date(iso).getTime();
  const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();
  return ts >= fromMs && ts <= toMs;
}

function compactMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short" });
}

function merchantName(note?: string): string {
  const clean = (note || "Unlabeled").trim().replace(/\s+/g, " ");
  const firstPart = clean.split(/[-|,]/)[0]?.trim();
  return (firstPart || clean || "Unlabeled").slice(0, 32);
}

function signedPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();
  const { onScroll } = useTabBarScroll();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [conts, setConts] = useState<GoalContribution[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [from, setFrom] = useState<Date>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));
  const [picking, setPicking] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewType, setViewType] = useState<"expense" | "income" | "investment" | "saved" | "lent">("expense");

  const load = useCallback(async () => {
    const [t, c, gc, l, g] = await Promise.all([getTransactions(), getCategories(), getGoalContributions(), getLoans(), getGoals()]);
    setTxs(t);
    setCats(c);
    setConts(gc);
    setLoans(l);
    setGoals(g);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const rangedTxs = useMemo(() => {
    const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();
    return txs.filter((t) => {
      const ts = new Date(t.date).getTime();
      return ts >= fromMs && ts <= toMs;
    });
  }, [txs, from, to]);

  const rangedConts = useMemo(() => {
    const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();
    return conts.filter((c) => {
      const ts = new Date(c.createdAt).getTime();
      return ts >= fromMs && ts <= toMs;
    });
  }, [conts, from, to]);

  const rangedLoans = useMemo(() => {
    const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime();
    return loans.filter((l) => {
      const ts = new Date(l.date).getTime();
      return ts >= fromMs && ts <= toMs;
    });
  }, [loans, from, to]);

  const totals = useMemo(() => {
    let income = 0, expense = 0, invest = 0, saved = 0, lent = 0;
    for (const t of rangedTxs) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
      else invest += t.amount;
    }
    for (const c of rangedConts) saved += c.amount;
    for (const l of rangedLoans) {
      if (l.type === "lent") lent += l.amount;
    }
    return { income, expense, invest, saved, lent };
  }, [rangedTxs, rangedConts, rangedLoans]);

  const currentTotal =
    viewType === "expense" ? totals.expense : 
    viewType === "income" ? totals.income : 
    viewType === "investment" ? totals.invest :
    viewType === "saved" ? totals.saved : totals.lent;

  const selectedDays = useMemo(() => daysInclusive(from, to), [from, to]);

  const previousTotals = useMemo(() => {
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - selectedDays + 1);

    let income = 0, expense = 0, invest = 0, saved = 0, lent = 0;
    for (const t of txs) {
      if (!inDateRange(t.date, prevFrom, prevTo)) continue;
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
      else invest += t.amount;
    }
    for (const c of conts) if (inDateRange(c.createdAt, prevFrom, prevTo)) saved += c.amount;
    for (const l of loans) if (l.type === "lent" && inDateRange(l.date, prevFrom, prevTo)) lent += l.amount;

    return { income, expense, invest, saved, lent };
  }, [conts, from, loans, selectedDays, txs]);

  const reportSnapshot = useMemo(() => {
    const savings = totals.saved + totals.invest;
    const outflow = totals.expense + totals.invest + totals.saved + totals.lent;
    const savingsRate = totals.income > 0 ? (savings / totals.income) * 100 : 0;
    const previousSavings = previousTotals.saved + previousTotals.invest;
    const previousOutflow = previousTotals.expense + previousTotals.invest + previousTotals.saved + previousTotals.lent;

    return {
      averageDailySpend: totals.expense / selectedDays,
      savingsRate,
      netFlow: totals.income - outflow,
      previousAverageDailySpend: previousTotals.expense / selectedDays,
      previousSavingsRate: previousTotals.income > 0 ? (previousSavings / previousTotals.income) * 100 : 0,
      previousNetFlow: previousTotals.income - previousOutflow,
    };
  }, [previousTotals, selectedDays, totals]);

  const comparisonRows = useMemo(() => ([
    { label: "Income", current: totals.income, previous: previousTotals.income, color: colors.success },
    { label: "Spending", current: totals.expense, previous: previousTotals.expense, color: colors.error },
    { label: "Saved", current: totals.saved + totals.invest, previous: previousTotals.saved + previousTotals.invest, color: colors.brand },
    { label: "Lent", current: totals.lent, previous: previousTotals.lent, color: colors.info },
  ]), [colors.brand, colors.error, colors.info, colors.success, previousTotals, totals]);

  const monthlyTrend = useMemo(() => {
    const rows = [];
    const anchor = startOfMonth(to);
    for (let i = 5; i >= 0; i--) {
      const month = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      let income = 0, expense = 0, savings = 0;

      for (const t of txs) {
        if (!inDateRange(t.date, monthStart, monthEnd)) continue;
        if (t.type === "income") income += t.amount;
        else if (t.type === "expense") expense += t.amount;
        else savings += t.amount;
      }
      for (const c of conts) if (inDateRange(c.createdAt, monthStart, monthEnd)) savings += c.amount;

      rows.push({ key: `${month.getFullYear()}-${month.getMonth()}`, label: compactMonth(month), income, expense, savings });
    }
    const max = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense, r.savings)));
    return { rows, max };
  }, [conts, to, txs]);

  const categoryTrend = useMemo(() => {
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - selectedDays + 1);

    const current = new Map<string, number>();
    const previous = new Map<string, number>();
    for (const t of txs) {
      if (t.type !== "expense") continue;
      if (inDateRange(t.date, from, to)) current.set(t.categoryId, (current.get(t.categoryId) || 0) + t.amount);
      if (inDateRange(t.date, prevFrom, prevTo)) previous.set(t.categoryId, (previous.get(t.categoryId) || 0) + t.amount);
    }

    return Array.from(current.entries())
      .map(([categoryId, value]) => {
        const cat = catMap.get(categoryId);
        const prev = previous.get(categoryId) || 0;
        return {
          categoryId,
          name: cat?.name || "Other",
          icon: cat?.icon || "ellipsis-horizontal",
          color: cat?.color || colors.muted,
          value,
          previous: prev,
          delta: value - prev,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [catMap, colors.muted, from, selectedDays, to, txs]);

  const topMerchants = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const t of rangedTxs) {
      if (t.type !== "expense") continue;
      if (!t.note?.trim()) continue;
      const name = merchantName(t.note);
      const existing = map.get(name) || { total: 0, count: 0 };
      map.set(name, { total: existing.total + t.amount, count: existing.count + 1 });
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [rangedTxs]);

  type PieDataItem = { value: number; color: string; text: string; catId: string; catName: string; catIcon: string; };

  const pieData = useMemo<PieDataItem[]>(() => {
    const map = new Map<string, number>();
    
    if (viewType === "saved") {
      for (const c of rangedConts) {
        map.set(c.goalId, (map.get(c.goalId) || 0) + c.amount);
      }
      return Array.from(map.entries()).map(([gId, val]) => {
        const g = goals.find(x => x.id === gId);
        return {
          value: val,
          color: colors.brand,
          text: "",
          catId: `goal-${gId}`,
          catName: g?.title || "Unknown Goal",
          catIcon: "flag",
        };
      }).sort((a, b) => b.value - a.value);
    }
    
    if (viewType === "lent") {
      for (const l of rangedLoans) {
        if (l.type === "lent") {
          map.set(l.person, (map.get(l.person) || 0) + l.amount);
        }
      }
      return Array.from(map.entries()).map(([person, val]) => {
        return {
          value: val,
          color: colors.info,
          text: "",
          catId: `person-${person}`,
          catName: person,
          catIcon: "person",
        };
      }).sort((a, b) => b.value - a.value);
    }

    for (const t of rangedTxs) {
      if (t.type !== viewType) continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([catId, val]) => {
        const c = catMap.get(catId);
        return {
          value: val,
          color: c?.color || colors.muted,
          text: "",
          catId: catId,
          catName: c?.name || "Other",
          catIcon: c?.icon || "ellipsis-horizontal",
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [rangedTxs, rangedConts, rangedLoans, viewType, catMap, goals, colors.brand, colors.info, colors.muted]);

  const currentLabel = rangeLabel(from, to);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.headerRow, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={styles.title} numberOfLines={1}>Insights</Text>
            <Text style={styles.subtitle} numberOfLines={1}>Understand your money flow</Text>
          </View>
          <Pressable
            testID="range-picker-btn"
            onPress={() => {
              Haptics.selectionAsync();
              setPicking(true);
            }}
            style={[styles.rangeChip, { flexShrink: 1, maxWidth: "55%" }]}
          >
            <Ionicons name="calendar" size={16} color={colors.brand} />
            <Text style={[styles.rangeChipText, { flexShrink: 1 }]} numberOfLines={1}>{currentLabel}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        testID="analytics-scroll"
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >

      {/* Summary tiles - Grid Layout */}
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><SummaryTile label="Income" value={totals.income} color={colors.success} icon="arrow-down" formatter={(v) => formatMoney(v, currency, { compact: true })} styles={styles} /></View>
          <View style={{ flex: 1 }}><SummaryTile label="Spent" value={totals.expense} color={colors.error} icon="arrow-up" formatter={(v) => formatMoney(v, currency, { compact: true })} styles={styles} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><SummaryTile label="Saved" value={totals.saved} color={colors.brand} icon="flag" formatter={(v) => formatMoney(v, currency, { compact: true })} styles={styles} /></View>
          <View style={{ flex: 1 }}><SummaryTile label="Invested" value={totals.invest} color={colors.brandPrimary} icon="trending-up" formatter={(v) => formatMoney(v, currency, { compact: true })} styles={styles} /></View>
          <View style={{ flex: 1 }}><SummaryTile label="Lent" value={totals.lent} color={colors.info} icon="people" formatter={(v) => formatMoney(v, currency, { compact: true })} styles={styles} /></View>
        </View>
      </View>

      {/* View type toggle */}
      <View style={styles.viewSwitch}>
        {(["expense", "income", "investment", "saved", "lent"] as const).map((v) => {
          const active = viewType === v;
          return (
            <Pressable
              key={v}
              testID={`view-${v}`}
              onPress={() => {
                Haptics.selectionAsync();
                setViewType(v);
                setSelectedCategory(null);
              }}
              style={[styles.switchChip, active && styles.switchChipActive]}
            >
              <Text
                style={[styles.switchText, active && styles.switchTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {v === "expense" ? "Expenses" : v === "income" ? "Income" : v === "investment" ? "Invest" : v === "saved" ? "Saved" : "Lent"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Pie chart card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category breakdown</Text>
        {pieData.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="No data" subtitle={`No ${viewType} for ${currentLabel}`} />
        ) : (
          <>
            <View style={styles.donutWrap}>
              <PieChart
                data={pieData.map(p => ({
                  ...p,
                  focused: selectedCategory === p.catId
                }))}
                donut
                focusOnPress
                onPress={(item: any) => {
                  Haptics.selectionAsync();
                  setSelectedCategory(prev => prev === item.catId ? null : item.catId);
                }}
                radius={100}
                innerRadius={64}
                innerCircleColor={colors.surfaceSecondary}
                centerLabelComponent={() => (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Total
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: 2 }}>
                      {formatMoney(currentTotal, currency, { compact: true })}
                    </Text>
                  </View>
                )}
              />
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              {pieData.map((p, i) => {
                const pct = currentTotal > 0 ? (p.value / currentTotal) * 100 : 0;
                return (
                  <Pressable 
                    key={i} 
                    onPress={() => { Haptics.selectionAsync(); setSelectedCategory(prev => prev === p.catId ? null : p.catId); }}
                    style={[styles.legendRow, selectedCategory === p.catId && { backgroundColor: colors.surfaceTertiary, padding: 8, borderRadius: 8, marginHorizontal: -8 }]}
                  >
                    <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                    <Text style={[styles.legendName, selectedCategory === p.catId && { fontWeight: "800", color: colors.onSurface }]}>{p.catName}</Text>
                    <Text style={styles.legendPct}>{pct.toFixed(0)}%</Text>
                    <Text style={[styles.legendAmount, selectedCategory === p.catId && { fontWeight: "800", color: p.color }]}>{formatMoney(p.value, currency)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedCategory && (
              <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.onSurface, marginBottom: 12 }}>
                  Transactions for {pieData.find(p => p.catId === selectedCategory)?.catName}
                </Text>
                <View style={{ gap: 10 }}>
                  {(() => {
                    let matching: any[] = [];
                    if (viewType === "saved") {
                      matching = rangedConts.filter(c => `goal-${c.goalId}` === selectedCategory).map(c => ({ id: c.id, date: c.createdAt, title: "Contribution", amount: c.amount }));
                    } else if (viewType === "lent") {
                      matching = rangedLoans.filter(l => l.type === viewType && `person-${l.person}` === selectedCategory).map(l => ({ id: l.id, date: l.date, title: l.person, amount: l.amount }));
                    } else {
                      matching = rangedTxs.filter(t => t.type === viewType && t.categoryId === selectedCategory).map(t => ({ id: t.id, date: t.date, title: t.note || "Transaction", amount: t.amount }));
                    }
                    matching.sort((a,b) => b.date.localeCompare(a.date));
                    
                    if (matching.length === 0) return <Text style={{ color: colors.muted, fontSize: 12 }}>No transactions found.</Text>;
                    
                    return matching.map(t => (
                      <View key={t.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surfaceTertiary, padding: 12, borderRadius: 8 }}>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onSurface }}>{t.title}</Text>
                          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{new Date(t.date).toLocaleDateString()}</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.onSurface }}>{formatMoney(t.amount, currency)}</Text>
                      </View>
                    ));
                  })()}
                </View>
              </View>
            )}
          </>
        )}
      </View>


      <View style={styles.reportGrid}>
        <ReportMetric
          label="Daily spend"
          value={formatMoney(reportSnapshot.averageDailySpend, currency, { compact: true })}
          sub={`${selectedDays} day average`}
          icon="calendar-outline"
          color={colors.error}
          styles={styles}
        />
        <ReportMetric
          label="Savings rate"
          value={`${Math.round(reportSnapshot.savingsRate)}%`}
          sub={`${formatMoney(totals.saved + totals.invest, currency, { compact: true })} saved`}
          icon="speedometer-outline"
          color={colors.brand}
          styles={styles}
        />
        <ReportMetric
          label="Net flow"
          value={formatMoney(reportSnapshot.netFlow, currency, { compact: true, showSign: true })}
          sub="Income minus outflow"
          icon="swap-vertical-outline"
          color={reportSnapshot.netFlow >= 0 ? colors.success : colors.error}
          styles={styles}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monthly comparison</Text>
        <View style={{ gap: 10 }}>
          {comparisonRows.map((row) => (
            <ComparisonRow
              key={row.label}
              row={row}
              currency={currency}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Income vs expense trend</Text>
        <View style={{ gap: 12 }}>
          {monthlyTrend.rows.map((row) => (
            <View key={row.key} style={styles.monthTrendRow}>
              <Text style={styles.monthLabel}>{row.label}</Text>
              <View style={styles.monthBars}>
                <View style={styles.trendTrack}>
                  <View style={[styles.trendFill, { width: `${(row.income / monthlyTrend.max) * 100}%`, backgroundColor: colors.success }]} />
                </View>
                <View style={styles.trendTrack}>
                  <View style={[styles.trendFill, { width: `${(row.expense / monthlyTrend.max) * 100}%`, backgroundColor: colors.error }]} />
                </View>
              </View>
              <Text style={styles.monthAmount}>{formatMoney(row.income - row.expense, currency, { compact: true, showSign: true })}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legendMini}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={styles.legendCompactText}>Income</Text>
          <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
          <Text style={styles.legendCompactText}>Expense</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category trend</Text>
        {categoryTrend.length === 0 ? (
          <Text style={styles.emptyReportText}>No expense categories in this range.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {categoryTrend.map((item) => (
              <View key={item.categoryId} style={styles.categoryTrendRow}>
                <View style={[styles.categoryTrendIcon, { backgroundColor: item.color + "1A" }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportName}>{item.name}</Text>
                  <Text style={styles.reportSub}>{item.delta >= 0 ? "Up" : "Down"} {formatMoney(Math.abs(item.delta), currency, { compact: true })} vs previous</Text>
                </View>
                <Text style={styles.reportAmount}>{formatMoney(item.value, currency, { compact: true })}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top merchants</Text>
        {topMerchants.length === 0 ? (
          <Text style={styles.emptyReportText}>No merchant notes found in this range.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {topMerchants.map((item) => (
              <View key={item.name} style={styles.merchantRow}>
                <View style={styles.merchantIcon}>
                  <Ionicons name="storefront-outline" size={15} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reportName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.reportSub}>{item.count} transaction{item.count === 1 ? "" : "s"}</Text>
                </View>
                <Text style={styles.reportAmount}>{formatMoney(item.total, currency, { compact: true })}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <RangePickerModal
        visible={picking}
        from={from}
        to={to}
        onClose={() => setPicking(false)}
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
        }}
        maxDate={new Date()}
        title="Analytics range"
      />
    </ScrollView>
    </View>
  );
}

function SummaryTile({
  label,
  value,
  color,
  icon,
  formatter,
  styles,
}: {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  formatter: (v: number) => string;
  styles: any;
}) {
  return (
    <View style={[styles.tile, { borderColor: color + "22" }]}>
      <View style={[styles.tileIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {formatter(value)}
      </Text>
    </View>
  );
}

function ReportMetric({
  label,
  value,
  sub,
  icon,
  color,
  styles,
}: {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  styles: any;
}) {
  return (
    <View style={[styles.reportMetric, { borderColor: color + "22" }]}>
      <View style={[styles.reportMetricIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.reportMetricLabel}>{label}</Text>
      <Text style={styles.reportMetricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.reportMetricSub} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

function ComparisonRow({ row, currency, styles, colors }: any) {
  const pct = signedPct(row.current, row.previous);
  const max = Math.max(1, row.current, row.previous);
  const pctText = pct === null ? "New" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`;

  return (
    <View style={styles.compareRow}>
      <View style={styles.compareHeader}>
        <Text style={styles.reportName}>{row.label}</Text>
        <View style={styles.compareValues}>
          <Text style={[styles.reportAmount, { color: row.color }]}>{formatMoney(row.current, currency, { compact: true })}</Text>
          <Text style={[styles.deltaText, { color: pct === null || pct >= 0 ? colors.success : colors.error }]}>{pctText}</Text>
        </View>
      </View>
      <View style={styles.compareBars}>
        <View style={styles.compareTrack}>
          <View style={[styles.compareFill, { width: `${(row.current / max) * 100}%`, backgroundColor: row.color }]} />
        </View>
        <View style={styles.compareTrack}>
          <View style={[styles.compareFillMuted, { width: `${(row.previous / max) * 100}%` }]} />
        </View>
      </View>
      <Text style={styles.reportSub}>Previous {formatMoney(row.previous, currency, { compact: true })}</Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
  },
  headerRow: {
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  rangeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurface,
  },
  tilesRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
  },
  tileIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tileLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tileValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
  },
  viewSwitch: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  switchChip: {
    flex: 1,
    height: 38,
    minWidth: 0,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  switchChipActive: {
    backgroundColor: colors.brand,
  },
  switchText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
    includeFontPadding: false,
  },
  switchTextActive: {
    color: "#fff",
    fontWeight: "800",
  },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  donutWrap: {
    alignItems: "center",
    paddingVertical: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    flex: 1,
    fontSize: 13,
    color: colors.onSurface,
    fontWeight: "600",
  },
  legendPct: {
    fontSize: 12,
    color: colors.muted,
    width: 40,
    textAlign: "right",
  },
  legendAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
    minWidth: 80,
    textAlign: "right",
  },
  reportGrid: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: spacing.lg,
    marginTop: 12,
  },
  reportMetric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 10,
    borderWidth: 1,
  },
  reportMetricIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  reportMetricLabel: {
    fontSize: 10,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    fontWeight: "700",
  },
  reportMetricValue: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
  },
  reportMetricSub: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  compareRow: {
    paddingVertical: 2,
  },
  compareHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  compareValues: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compareBars: {
    gap: 4,
    marginTop: 8,
  },
  compareTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  compareFill: {
    height: "100%",
    borderRadius: 999,
  },
  compareFillMuted: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "800",
  },
  monthTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  monthLabel: {
    width: 34,
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  monthBars: {
    flex: 1,
    gap: 4,
  },
  trendTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  trendFill: {
    height: "100%",
    borderRadius: 999,
  },
  monthAmount: {
    minWidth: 64,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
    color: colors.onSurface,
  },
  legendMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  categoryTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  categoryTrendIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  merchantIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  reportName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  reportSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  reportAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
    textAlign: "right",
  },
  emptyReportText: {
    fontSize: 12,
    color: colors.muted,
    paddingVertical: 8,
  },
  legendCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 4,
  },
  legendCompactText: {
    fontSize: 11,
    color: colors.muted,
  },
});
