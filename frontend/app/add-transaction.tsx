import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { getCategories, addTransaction, Category, TxType } from "@/src/store";
import { useCurrency } from "@/src/currency";

const TYPE_OPTIONS: { key: TxType; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "expense", label: "Expense", color: colors.error, icon: "arrow-up-circle" },
  { key: "income", label: "Income", color: colors.success, icon: "arrow-down-circle" },
  { key: "investment", label: "Investment", color: colors.brandPrimary, icon: "trending-up" },
];

export default function AddTransaction() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const params = useLocalSearchParams<{
    type?: string;
    amount?: string;
    note?: string;
    categoryId?: string;
  }>();
  const initialType = (params.type as TxType) || "expense";

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState(params.amount || "");
  const [note, setNote] = useState(params.note || "");
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId || null);
  const [cats, setCats] = useState<Category[]>([]);
  const [date, setDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await getCategories();
      setCats(c);
    })();
  }, []);

  useEffect(() => {
    // If prefilled category matches type, keep it; else reset to first of type.
    if (categoryId) {
      const found = cats.find((c) => c.id === categoryId);
      if (found && found.type === type) return;
    }
    const first = cats.find((c) => c.type === type);
    setCategoryId(first ? first.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, cats]);

  const filtered = useMemo(() => cats.filter((c) => c.type === type), [cats, type]);

  const typeMeta = TYPE_OPTIONS.find((t) => t.key === type)!;

  const handleSave = async () => {
    Keyboard.dismiss();
    const num = Number(amount);
    if (!num || num <= 0 || !categoryId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSaving(true);
    await addTransaction({
      type,
      amount: num,
      categoryId,
      note: note.trim() || undefined,
      date: date.toISOString(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    router.back();
  };

  const dateShortcuts: { label: string; days: number }[] = [
    { label: "Today", days: 0 },
    { label: "Yesterday", days: 1 },
    { label: "2 days ago", days: 2 },
    { label: "3 days ago", days: 3 },
    { label: "1 week ago", days: 7 },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="close-btn" onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>New transaction</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Type toggle */}
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((o) => {
            const active = type === o.key;
            return (
              <Pressable
                key={o.key}
                testID={`type-${o.key}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setType(o.key);
                }}
                style={[
                  styles.typeBtn,
                  active && { backgroundColor: o.color + "1A", borderColor: o.color },
                ]}
              >
                <Ionicons name={o.icon} size={18} color={active ? o.color : colors.muted} />
                <Text
                  style={[
                    styles.typeText,
                    { color: active ? o.color : colors.onSurface, fontWeight: active ? "800" : "600" },
                  ]}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 1. Amount */}
        <View style={styles.amountWrap}>
          <Text style={styles.amountCurrency}>{currency.symbol}</Text>
          <TextInput
            testID="amount-input"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            placeholderTextColor={colors.borderStrong}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { color: typeMeta.color }]}
            autoFocus
          />
        </View>

        {/* 2. Date */}
        <Text style={styles.sectionLabel}>Date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateRow}
        >
          {dateShortcuts.map((d) => {
            const dt = new Date();
            dt.setDate(dt.getDate() - d.days);
            const active = date.toDateString() === dt.toDateString();
            return (
              <Pressable
                key={d.label}
                testID={`date-${d.days}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  const nd = new Date();
                  nd.setDate(nd.getDate() - d.days);
                  setDate(nd);
                }}
                style={[styles.dateChip, active && styles.dateChipActive]}
              >
                <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 3. Category (4-column compact grid) */}
        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.catGrid}>
          {filtered.map((c) => {
            const active = categoryId === c.id;
            return (
              <Pressable
                key={c.id}
                testID={`cat-${c.id}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCategoryId(c.id);
                }}
                style={[
                  styles.catCell,
                  active && { backgroundColor: c.color + "1A", borderColor: c.color },
                ]}
              >
                <View style={[styles.catIcon, { backgroundColor: c.color + "22" }]}>
                  <Ionicons name={c.icon as any} size={16} color={c.color} />
                </View>
                <Text
                  style={[styles.catLabel, active && { color: c.color, fontWeight: "800" }]}
                  numberOfLines={1}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 4. Note */}
        <Text style={styles.sectionLabel}>Note (optional)</Text>
        <TextInput
          testID="note-input"
          value={note}
          onChangeText={setNote}
          placeholder="What was this for?"
          placeholderTextColor={colors.muted}
          style={styles.noteInput}
          multiline
        />
      </ScrollView>

      {/* Sticky Save button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="save-tx-btn"
          onPress={handleSave}
          disabled={saving || !amount || !categoryId}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: typeMeta.color, opacity: !amount || !categoryId ? 0.5 : pressed ? 0.9 : 1 },
          ]}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.saveText}>Save {typeMeta.label.toLowerCase()}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.onSurface,
  },
  typeRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: 8,
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  typeText: {
    fontSize: 12,
  },
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 20,
  },
  amountCurrency: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.muted,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -1.5,
    minWidth: 60,
    textAlign: "center",
    padding: 0,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginHorizontal: spacing.lg,
    marginTop: 18,
    marginBottom: 8,
  },
  dateRow: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    paddingBottom: 2,
  },
  dateChip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  dateChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  dateChipText: {
    fontSize: 12,
    color: colors.onSurface,
    fontWeight: "600",
  },
  dateChipTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  catCell: {
    width: "23%",
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    gap: 4,
  },
  catIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.onSurface,
    textAlign: "center",
  },
  noteInput: {
    marginHorizontal: spacing.lg,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    fontSize: 14,
    color: colors.onSurface,
    minHeight: 64,
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...shadow.fab,
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
