import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { PieChart, BarChart } from "react-native-gifted-charts";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatINR, currentMonthKey, monthLabel } from "@/src/utils/format";
import { getTransactions, getCategories, Transaction, Category } from "@/src/store";
import { EmptyState } from "@/src/components/CategoryIcon";

const { width } = Dimensions.get("window");

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [month, setMonth] = useState(currentMonthKey());
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

  const monthTxs = useMemo(() => txs.filter((t) => t.date.slice(0, 7) === month), [txs, month]);

  const totals = useMemo(() => {
    let income = 0,
      expense = 0,
      invest = 0;
    for (const t of monthTxs) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
      else invest += t.amount;
    }
    return { income, expense, invest };
  }, [monthTxs]);

  const currentTotal =
    viewType === "expense" ? totals.expense : viewType === "income" ? totals.income : totals.invest;

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxs) {
      if (t.type !== viewType) continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
    const entries = Array.from(map.entries())
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
    return entries;
  }, [monthTxs, viewType, catMap]);

  // Monthly trend - last 6 months income vs expense
  const trendData = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) months.push(shiftMonth(currentMonthKey(), -i));
    const barData: any[] = [];
    let maxVal = 0;
    for (const mk of months) {
      let inc = 0,
        exp = 0;
      for (const t of txs) {
        if (t.date.slice(0, 7) !== mk) continue;
        if (t.type === "income") inc += t.amount;
        else if (t.type === "expense") exp += t.amount;
      }
      maxVal = Math.max(maxVal, inc, exp);
      const [, m] = mk.split("-");
      const label = new Date(Number(mk.slice(0, 4)), Number(m) - 1, 1).toLocaleDateString("en-IN", {
        month: "short",
      });
      barData.push({
        value: Math.round(inc / 1000),
        label,
        frontColor: colors.brandPrimary,
        spacing: 4,
        labelWidth: 40,
        labelTextStyle: { color: colors.muted, fontSize: 10 },
      });
      barData.push({ value: Math.round(exp / 1000), frontColor: colors.cat.terracotta });
    }
    return { data: barData, max: Math.ceil(maxVal / 1000) };
  }, [txs]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header + month picker */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>Understand your money flow</Text>
        </View>
      </View>

      <View style={styles.monthNav}>
        <Pressable
          testID="prev-month"
          onPress={() => {
            Haptics.selectionAsync();
            setMonth(shiftMonth(month, -1));
          }}
          style={styles.monthBtn}
        >
          <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        <Pressable
          testID="next-month"
          onPress={() => {
            const next = shiftMonth(month, 1);
            if (next <= currentMonthKey()) {
              Haptics.selectionAsync();
              setMonth(next);
            }
          }}
          style={[styles.monthBtn, { opacity: month === currentMonthKey() ? 0.35 : 1 }]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* Summary tiles */}
      <View style={styles.tilesRow}>
        <SummaryTile label="Income" value={totals.income} color={colors.success} icon="arrow-down" />
        <SummaryTile label="Spent" value={totals.expense} color={colors.error} icon="arrow-up" />
        <SummaryTile label="Invested" value={totals.invest} color={colors.brandPrimary} icon="trending-up" />
      </View>

      {/* View type switch */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.viewSwitch}
      >
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
      </ScrollView>

      {/* Pie chart card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category breakdown</Text>
        {pieData.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="No data" subtitle={`No ${viewType} for ${monthLabel(month)}`} />
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
                      {formatINR(currentTotal, { compact: true })}
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
                    <Text style={styles.legendAmount}>{formatINR(p.value)}</Text>
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
          <Text style={[styles.legendCompactText, { marginLeft: "auto" }]}>values in ₹K</Text>
        </View>
        <View style={{ marginTop: 8, alignItems: "flex-start" }}>
          <BarChart
            data={trendData.data}
            barWidth={14}
            spacing={16}
            initialSpacing={12}
            noOfSections={4}
            maxValue={Math.max(trendData.max + 5, 20)}
            yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
            xAxisColor={colors.border}
            yAxisColor={colors.border}
            rulesColor={colors.divider}
            rulesType="dashed"
            hideRules={false}
            barBorderRadius={4}
            width={width - 80}
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
}: {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.tile, { borderColor: color + "22" }]}>
      <View style={[styles.tileIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1}>
        {formatINR(value, { compact: true })}
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
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
  },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
    letterSpacing: -0.2,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: 8,
  },
  switchChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    flexShrink: 0,
  },
  switchChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  switchText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurface,
  },
  switchTextActive: {
    color: "#fff",
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
