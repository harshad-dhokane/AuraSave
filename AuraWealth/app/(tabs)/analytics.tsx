import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from "react-native";
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
  const { colors, isDark } = useTheme();
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
  }, [rangedTxs, rangedConts, rangedLoans, viewType, catMap, goals]);

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
      <View style={[styles.viewSwitch, { paddingHorizontal: 16 }]}>
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
              <Text style={[styles.switchText, active && styles.switchTextActive]}>
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
