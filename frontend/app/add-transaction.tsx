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

const TYPE_OPTIONS: { key: TxType; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "expense", label: "Expense", color: colors.error, icon: "arrow-up-circle" },
  { key: "income", label: "Income", color: colors.success, icon: "arrow-down-circle" },
  { key: "investment", label: "Investment", color: colors.brandPrimary, icon: "trending-up" },
];

export default function AddTransaction() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = (params.type as TxType) || "expense";

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
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
    // Reset category when type changes
    const first = cats.find((c) => c.type === type);
    setCategoryId(first ? first.id : null);
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

        {/* Amount input */}
        <View style={styles.amountWrap}>
          <Text style={styles.amountCurrency}>₹</Text>
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

        {/* Categories */}
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
                  <Ionicons name={c.icon as any} size={20} color={c.color} />
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

        {/* Date shortcuts */}
        <Text style={styles.sectionLabel}>Date</Text>
        <View style={styles.dateRow}>
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
        </View>

        {/* Note */}
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
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  typeText: {
    fontSize: 12,
  },
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 20,
  },
  amountCurrency: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.muted,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 56,
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
    marginTop: 24,
    marginBottom: 10,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg - 4,
    gap: 8,
  },
  catCell: {
    width: "31%",
    marginHorizontal: 4,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    gap: 6,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurface,
    textAlign: "center",
  },
  dateRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
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
  },
  noteInput: {
    marginHorizontal: spacing.lg,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    fontSize: 15,
    color: colors.onSurface,
    minHeight: 70,
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
