import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { radius, spacing, shadow } from "@/src/theme";
import { formatMoney } from "@/src/utils/format";
import { getTransactions, getCategories, Transaction, Category } from "@/src/store";
import { buildCsv, exportCsv, filterByRange } from "@/src/utils/export";
import { useCurrency } from "@/src/currency";
import { EmptyState } from "@/src/components/CategoryIcon";
import { RangePickerModal } from "@/src/components/DatePicker";
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
function rangeLabel(from: Date, to: Date) {
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    const som = startOfMonth(from);
    const eom = endOfMonth(from);
    if (from.getTime() === som.getTime() && to.toDateString() === eom.toDateString()) {
      return from.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
  }
  return `${fmtDay(from)} → ${fmtDay(to)}`;
}

export default function Export() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [from, setFrom] = useState<Date>(startOfMonth(new Date()));
  const [to, setTo] = useState<Date>(endOfMonth(new Date()));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [t, c] = await Promise.all([getTransactions(), getCategories()]);
        setTxs(t);
        setCats(c);
      })();
    }, []),
  );

  const range = useMemo(
    () => ({ from, to, label: rangeLabel(from, to) }),
    [from, to],
  );
  const filtered = useMemo(() => filterByRange(txs, range), [txs, range]);

  const stats = useMemo(() => {
    let income = 0,
      expense = 0,
      invest = 0;
    for (const t of filtered) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
      else invest += t.amount;
    }
    return { income, expense, invest, count: filtered.length };
  }, [filtered]);

  const handleExport = async () => {
    if (filtered.length === 0) {
      setResult("No transactions in the selected range.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setBusy(true);
    setResult(null);
    const csv = buildCsv(filtered, cats, currency);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const filename = `aura-transactions-${fromStr}-to-${toStr}.csv`;
    const res = await exportCsv(csv, filename);
    setBusy(false);
    if (res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult(Platform.OS === "web" ? `Downloaded ${filename}` : `Exported ${filename}`);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult(res.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="export-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Export data</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="cloud-download" size={22} color={colors.brand} />
          </View>
          <Text style={styles.heroTitle}>Excel-compatible CSV</Text>
          <Text style={styles.heroSub}>
            Choose a date range and share the file to Excel, Google Sheets, or any cloud drive.
          </Text>
        </View>

        <Text style={styles.formLabel}>Date range</Text>
        <Pressable
          testID="range-picker-btn"
          onPress={() => {
            Haptics.selectionAsync();
            setPicking(true);
          }}
          style={styles.rangeCard}
        >
          <View style={styles.rangeCardIcon}>
            <Ionicons name="calendar" size={16} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rangeCardLabel}>{range.label}</Text>
            <Text style={styles.rangeCardSub}>Tap to change</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>

        {/* Summary preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Preview</Text>
          <View style={styles.previewRow}>
            <PreviewStat label="Entries" value={String(stats.count)} color={colors.brand} styles={styles} />
            <PreviewStat label="Income" value={formatMoney(stats.income, currency, { compact: true })} color={colors.success} styles={styles} />
            <PreviewStat label="Spent" value={formatMoney(stats.expense, currency, { compact: true })} color={colors.error} styles={styles} />
            <PreviewStat label="Invest" value={formatMoney(stats.invest, currency, { compact: true })} color={colors.brandPrimary} styles={styles} />
          </View>
        </View>

        {filtered.length === 0 && (
          <EmptyState icon="folder-open-outline" title="No transactions" subtitle="Try a wider date range" />
        )}

        <Pressable
          testID="do-export-btn"
          onPress={handleExport}
          disabled={busy}
          style={({ pressed }) => [
            styles.exportBtn,
            { opacity: busy ? 0.6 : pressed ? 0.9 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download" size={18} color="#fff" />
              <Text style={styles.exportBtnText}>
                {Platform.OS === "web" ? "Download CSV" : "Export & share"}
              </Text>
            </>
          )}
        </Pressable>

        {result && <Text style={styles.result}>{result}</Text>}
      </ScrollView>

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
        title="Export range"
      />
    </View>
  );
}

function PreviewStat({ label, value, color, styles }: { label: string; value: string; color: string; styles: any }) {
  return (
    <View style={{ flex: 1, alignItems: "flex-start" }}>
      <Text style={[styles.previewStatLabel, { color }]}>{label}</Text>
      <Text style={styles.previewStatValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
  hero: { alignItems: "center", marginBottom: 8 },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  heroSub: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  formLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },
  rangeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    ...shadow.card,
  },
  rangeCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeCardLabel: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  rangeCardSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  previewCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  previewLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    gap: 8,
  },
  previewStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  previewStatValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
  },
  exportBtn: {
    marginTop: 20,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...shadow.fab,
  },
  exportBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  result: {
    marginTop: 14,
    textAlign: "center",
    color: colors.brand,
    fontSize: 12,
    fontWeight: "700",
  },
});
