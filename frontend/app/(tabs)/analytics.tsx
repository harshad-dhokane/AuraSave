import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { PieChart, BarChart } from "react-native-gifted-charts";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatMoney } from "@/src/utils/format";
import { getTransactions, getCategories, Transaction, Category } from "@/src/store";
import { EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";
import { RangePickerModal } from "@/src/components/DatePicker";

const { width: SCREEN_W } = Dimensions.get("window");

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
  // Same month
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

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [from, setFrom] = useState<Date>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));
  const [picking, setPicking] = useState(false);
  const [viewType, setViewType] = useState<"expense" | "income" | "investment">("expense");

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([getTransactions(), getCategories()]);
    setTxs(t);
    setCats(c);
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

  const totals = useMemo(() => {
    let income = 0,
      expense = 0,
      invest = 0;
    for (const t of rangedTxs) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
      else invest += t.amount;
    }
    return { income, expense, invest };
  }, [rangedTxs]);

  const currentTotal =
    viewType === "expense" ? totals.expense : viewType === "income" ? totals.income : totals.invest;

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
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
          catName: c?.name || "Other",
          catIcon: c?.icon || "ellipsis-horizontal",
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [rangedTxs, viewType, catMap]);

  // Trend: last 6 months (independent of selected range)
  const trendData = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString(undefined, { month: "short" }),
      });
    }
    const barData: any[] = [];
    let maxVal = 0;
    for (const mo of months) {
      let inc = 0,
        exp = 0;
      for (const t of txs) {
        if (t.date.slice(0, 7) !== mo.key) continue;
        if (t.type === "income") inc += t.amount;
        else if (t.type === "expense") exp += t.amount;
      }
      maxVal = Math.max(maxVal, inc, exp);
      barData.push({
        value: Math.round(inc / 1000),
        label: mo.label,
        frontColor: colors.brandPrimary,
        spacing: 3,
        labelWidth: 34,
        labelTextStyle: { color: colors.muted, fontSize: 10 },
      });
      barData.push({ value: Math.round(exp / 1000), frontColor: colors.cat.terracotta });
    }
    return { data: barData, max: Math.ceil(maxVal / 1000) };
  }, [txs]);

  const chartWidth = Math.max(220, SCREEN_W - 32 - 32 - 30);
  const currentLabel = rangeLabel(from, to);

  return (
    <ScrollView
      testID="analytics-scroll"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>Understand your money flow</Text>
        </View>
      </View>

      {/* Range card — tap to open calendar */}
      <Pressable
        testID="range-picker-btn"
        onPress={() => {
          Haptics.selectionAsync();
          setPicking(true);
        }}
        style={styles.rangeCard}
      >
        <View style={styles.rangeIcon}>
          <Ionicons name="calendar" size={16} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rangeSub}>Showing data for</Text>
          <Text style={styles.rangeLabel} numberOfLines={1}>
            {currentLabel}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>

      {/* Summary tiles */}
      <View style={styles.tilesRow}>
        <SummaryTile
          label="Income"
          value={totals.income}
          color={colors.success}
          icon="arrow-down"
          formatter={(v) => formatMoney(v, currency, { compact: true })}
        />
        <SummaryTile
          label="Spent"
          value={totals.expense}
          color={colors.error}
          icon="arrow-up"
          formatter={(v) => formatMoney(v, currency, { compact: true })}
        />
        <SummaryTile
          label="Invested"
          value={totals.invest}
          color={colors.brandPrimary}
          icon="trending-up"
          formatter={(v) => formatMoney(v, currency, { compact: true })}
        />
      </View>

      {/* View type toggle */}
      <View style={styles.viewSwitch}>
        {(["expense", "income", "investment"] as const).map((v) => {
          const active = viewType === v;
          return (
            <Pressable
              key={v}
              testID={`view-${v}`}
              onPress={() => {
                Haptics.selectionAsync();
                setViewType(v);
              }}
              style={[styles.switchChip, active && styles.switchChipActive]}
            >
              <Text style={[styles.switchText, active && styles.switchTextActive]}>
                {v === "expense" ? "Expenses" : v === "income" ? "Income" : "Investments"}
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
                data={pieData}
                donut
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
                  <View key={i} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: p.color }]} />
                    <Text style={styles.legendName}>{p.catName}</Text>
                    <Text style={styles.legendPct}>{pct.toFixed(0)}%</Text>
                    <Text style={styles.legendAmount}>{formatMoney(p.value, currency)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Trend chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>6-month trend</Text>
        <View style={styles.legendCompact}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.legendDot, { backgroundColor: colors.brandPrimary }]} />
            <Text style={styles.legendCompactText}>Income</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={[styles.legendDot, { backgroundColor: colors.cat.terracotta }]} />
            <Text style={styles.legendCompactText}>Expense</Text>
          </View>
          <Text style={[styles.legendCompactText, { marginLeft: "auto" }]}>values in {currency.symbol}K</Text>
        </View>
        <View style={{ marginTop: 8, alignItems: "flex-start" }}>
          <BarChart
            data={trendData.data}
            barWidth={10}
            spacing={12}
            initialSpacing={6}
            endSpacing={6}
            noOfSections={4}
            maxValue={Math.max(trendData.max + 5, 20)}
            yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
            xAxisColor={colors.border}
            yAxisColor={colors.border}
            rulesColor={colors.divider}
            rulesType="dashed"
            hideRules={false}
            barBorderRadius={3}
            width={chartWidth}
            disableScroll
            adjustToWidth
            yAxisLabelWidth={26}
          />
        </View>
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
  );
}

function SummaryTile({
  label,
  value,
  color,
  icon,
  formatter,
}: {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  formatter: (v: number) => string;
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

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  rangeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: spacing.lg,
    marginTop: 16,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    ...shadow.card,
  },
  rangeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeSub: {
    fontSize: 10,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "700",
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
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
    height: 36,
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
