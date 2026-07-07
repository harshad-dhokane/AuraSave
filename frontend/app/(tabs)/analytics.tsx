import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { PieChart, BarChart } from "react-native-gifted-charts";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatMoney, currentMonthKey, monthLabel } from "@/src/utils/format";
import { getTransactions, getCategories, Transaction, Category } from "@/src/store";
import { EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";

const { width: SCREEN_W } = Dimensions.get("window");

type RangeKey =
  | "this_month"
  | "last_month"
  | "last_3m"
  | "last_6m"
  | "this_year"
  | "all_time";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_3m", label: "Last 3 months" },
  { key: "last_6m", label: "Last 6 months" },
  { key: "this_year", label: "This year" },
  { key: "all_time", label: "All time" },
];

function rangeBounds(key: RangeKey): { from: Date; to: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const startOfMonth = (dy: number, dm: number) => new Date(dy, dm, 1);
  const endOfMonth = (dy: number, dm: number) => new Date(dy, dm + 1, 0, 23, 59, 59, 999);

  switch (key) {
    case "this_month":
      return { from: startOfMonth(y, m), to: endOfMonth(y, m), label: monthLabel(currentMonthKey()) };
    case "last_month": {
      const from = startOfMonth(y, m - 1);
      return { from, to: endOfMonth(y, m - 1), label: from.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
    }
    case "last_3m":
      return { from: startOfMonth(y, m - 2), to: endOfMonth(y, m), label: "Last 3 months" };
    case "last_6m":
      return { from: startOfMonth(y, m - 5), to: endOfMonth(y, m), label: "Last 6 months" };
    case "this_year":
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59, 999), label: `${y}` };
    case "all_time":
    default:
      return { from: new Date(2000, 0, 1), to: new Date(2999, 11, 31), label: "All time" };
  }
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [rangeKey, setRangeKey] = useState<RangeKey>("this_month");
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

  const range = useMemo(() => rangeBounds(rangeKey), [rangeKey]);

  const rangedTxs = useMemo(() => {
    const fromMs = range.from.getTime();
    const toMs = range.to.getTime();
    return txs.filter((t) => {
      const ts = new Date(t.date).getTime();
      return ts >= fromMs && ts <= toMs;
    });
  }, [txs, range]);

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

  // Monthly trend: last 6 months income vs expense (independent of the range selector)
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

  // Chart width: fits within card without horizontal scroll.
  // Card horizontal padding = 16 on each side. Screen padding = 16 on each side.
  // Bar area width available ≈ screen - 32 (screen padding) - 32 (card padding) - 30 (y-axis label buffer)
  const chartWidth = Math.max(220, SCREEN_W - 32 - 32 - 30);

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

      {/* Date range chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rangeRow}
      >
        {RANGES.map((r) => {
          const active = rangeKey === r.key;
          return (
            <Pressable
              key={r.key}
              testID={`range-${r.key}`}
              onPress={() => {
                Haptics.selectionAsync();
                setRangeKey(r.key);
              }}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
            >
              <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.rangeCaption}>{range.label}</Text>

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

      {/* View type toggle — full-width row, no horizontal scroll */}
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
          <EmptyState icon="pie-chart-outline" title="No data" subtitle={`No ${viewType} for ${range.label}`} />
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

      {/* Trend chart — 6 month income vs expense, fits screen (no horizontal scroll) */}
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
  rangeRow: {
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  rangeChip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    flexShrink: 0,
  },
  rangeChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurface,
  },
  rangeTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  rangeCaption: {
    marginHorizontal: spacing.lg,
    marginTop: -2,
    marginBottom: 4,
    fontSize: 12,
    color: colors.muted,
    fontWeight: "600",
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
