import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatMoney } from "@/src/utils/format";
import { getTransactions, getCategories, Transaction, Category } from "@/src/store";
import { buildCsv, exportCsv, ExportRange, filterByRange } from "@/src/utils/export";
import { useCurrency } from "@/src/currency";
import { EmptyState } from "@/src/components/CategoryIcon";

type PresetKey = "this_month" | "last_month" | "last_3m" | "last_6m" | "this_year" | "all_time" | "custom";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_3m", label: "Last 3 months" },
  { key: "last_6m", label: "Last 6 months" },
  { key: "this_year", label: "This year" },
  { key: "all_time", label: "All time" },
  { key: "custom", label: "Custom" },
];

function presetRange(key: PresetKey, custom: { from: string; to: string }): ExportRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const som = (yr: number, mo: number) => new Date(yr, mo, 1);
  const eom = (yr: number, mo: number) => new Date(yr, mo + 1, 0);
  const label = (l: string) => l;

  switch (key) {
    case "this_month":
      return { from: som(y, m), to: eom(y, m), label: label(now.toLocaleDateString(undefined, { month: "long", year: "numeric" })) };
    case "last_month": {
      const f = som(y, m - 1);
      return { from: f, to: eom(y, m - 1), label: label(f.toLocaleDateString(undefined, { month: "long", year: "numeric" })) };
    }
    case "last_3m":
      return { from: som(y, m - 2), to: eom(y, m), label: label("Last 3 months") };
    case "last_6m":
      return { from: som(y, m - 5), to: eom(y, m), label: label("Last 6 months") };
    case "this_year":
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31), label: label(`${y}`) };
    case "custom": {
      const f = custom.from ? new Date(custom.from) : new Date(y, m, 1);
      const t = custom.to ? new Date(custom.to) : new Date();
      return { from: f, to: t, label: label(`${f.toLocaleDateString()} → ${t.toLocaleDateString()}`) };
    }
    case "all_time":
    default:
      return { from: new Date(2000, 0, 1), to: new Date(2999, 11, 31), label: label("All time") };
  }
}

export default function Export() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [preset, setPreset] = useState<PresetKey>("this_month");
  const [custom, setCustom] = useState({ from: "", to: "" });
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

  const range = useMemo(() => presetRange(preset, custom), [preset, custom]);
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
    const fromStr = range.from.toISOString().slice(0, 10);
    const toStr = range.to.toISOString().slice(0, 10);
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

        <Text style={styles.formLabel}>Range</Text>
        <View style={styles.presetWrap}>
          {PRESETS.map((p) => {
            const active = preset === p.key;
            return (
              <Pressable
                key={p.key}
                testID={`preset-${p.key}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPreset(p.key);
                }}
                style={[styles.presetChip, active && styles.presetChipActive]}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {preset === "custom" && (
          <View style={styles.customRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>From (YYYY-MM-DD)</Text>
              <TextInput
                testID="custom-from"
                value={custom.from}
                onChangeText={(v) => setCustom({ ...custom, from: v })}
                placeholder="2026-01-01"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>To (YYYY-MM-DD)</Text>
              <TextInput
                testID="custom-to"
                value={custom.to}
                onChangeText={(v) => setCustom({ ...custom, to: v })}
                placeholder="2026-01-31"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          </View>
        )}

        {/* Summary preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>{range.label}</Text>
          <View style={styles.previewRow}>
            <PreviewStat label="Entries" value={String(stats.count)} color={colors.brand} />
            <PreviewStat label="Income" value={formatMoney(stats.income, currency, { compact: true })} color={colors.success} />
            <PreviewStat label="Spent" value={formatMoney(stats.expense, currency, { compact: true })} color={colors.error} />
            <PreviewStat label="Invest" value={formatMoney(stats.invest, currency, { compact: true })} color={colors.brandPrimary} />
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
    </View>
  );
}

function PreviewStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "flex-start" }}>
      <Text style={[styles.previewStatLabel, { color }]}>{label}</Text>
      <Text style={styles.previewStatValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  presetWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  presetChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  presetText: { fontSize: 12, fontWeight: "600", color: colors.onSurface },
  presetTextActive: { color: "#fff", fontWeight: "800" },
  customRow: { flexDirection: "row", gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceSecondary,
  },
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
