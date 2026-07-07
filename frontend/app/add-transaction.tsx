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
import { parseSms, SMS_SAMPLES } from "@/src/utils/sms-parser";
import { DatePickerModal } from "@/src/components/DatePicker";

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
    mode?: string;
  }>();

  const [mode, setMode] = useState<"manual" | "sms">(params.mode === "sms" ? "sms" : "manual");
  const [smsText, setSmsText] = useState("");
  const [smsBanner, setSmsBanner] = useState<null | {
    confidence: "high" | "medium" | "low";
    missing: string[];
  }>(null);

  const [type, setType] = useState<TxType>((params.type as TxType) || "expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [date, setDate] = useState(new Date());
  const [pickingDate, setPickingDate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await getCategories();
      setCats(c);
    })();
  }, []);

  useEffect(() => {
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

  const detectSms = () => {
    Keyboard.dismiss();
    if (!smsText.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const parsed = parseSms(smsText, cats);
    if (parsed.type) setType(parsed.type);
    if (parsed.amount) setAmount(String(parsed.amount));
    if (parsed.suggestedCategoryId) setCategoryId(parsed.suggestedCategoryId);
    if (parsed.merchant && !note) setNote(parsed.merchant);
    const missing: string[] = [];
    if (!parsed.amount) missing.push("amount");
    if (!parsed.suggestedCategoryId) missing.push("category");
    setSmsBanner({ confidence: parsed.confidence, missing });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Switch to manual mode with prefilled values so user can review/edit
    setMode("manual");
  };

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

  const dateLabel = useMemo(() => {
    const now = new Date();
    const y = new Date();
    y.setDate(now.getDate() - 1);
    const same = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(date, now)) return "Today";
    if (same(date, y)) return "Yesterday";
    return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  }, [date]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
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
        {/* Mode toggle: Manual | Scan SMS */}
        <View style={styles.modeSwitch}>
          <Pressable
            testID="mode-manual"
            onPress={() => {
              Haptics.selectionAsync();
              setMode("manual");
            }}
            style={[styles.modeBtn, mode === "manual" && styles.modeBtnActive]}
          >
            <Ionicons name="create-outline" size={14} color={mode === "manual" ? "#fff" : colors.muted} />
            <Text style={[styles.modeText, mode === "manual" && styles.modeTextActive]}>Manual</Text>
          </Pressable>
          <Pressable
            testID="mode-sms"
            onPress={() => {
              Haptics.selectionAsync();
              setMode("sms");
            }}
            style={[styles.modeBtn, mode === "sms" && styles.modeBtnActive]}
          >
            <Ionicons name="scan-outline" size={14} color={mode === "sms" ? "#fff" : colors.muted} />
            <Text style={[styles.modeText, mode === "sms" && styles.modeTextActive]}>Scan SMS</Text>
          </Pressable>
        </View>

        {mode === "sms" ? (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.smsHero}>
              <View style={styles.smsHeroIcon}>
                <Ionicons name="scan" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smsTitle}>Paste any bank / UPI SMS</Text>
                <Text style={styles.smsSub}>We&apos;ll auto-detect the type, amount, category and merchant offline.</Text>
              </View>
            </View>

            <TextInput
              testID="sms-textarea"
              value={smsText}
              onChangeText={setSmsText}
              placeholder="Paste your bank message here…"
              placeholderTextColor={colors.muted}
              style={styles.textarea}
              multiline
              autoFocus
            />

            <Pressable
              testID="detect-btn"
              onPress={detectSms}
              disabled={!smsText.trim()}
              style={({ pressed }) => [
                styles.detectBtn,
                { opacity: !smsText.trim() ? 0.5 : pressed ? 0.9 : 1 },
              ]}
            >
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.detectBtnText}>Detect & prefill</Text>
            </Pressable>

            <Text style={styles.samplesLabel}>Try a sample</Text>
            {SMS_SAMPLES.map((s, i) => (
              <Pressable
                key={i}
                testID={`sample-${i}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSmsText(s);
                }}
                style={styles.sampleCard}
              >
                <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.brand} />
                <Text style={styles.sampleText} numberOfLines={2}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            {/* Confidence banner after SMS detection */}
            {smsBanner && (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor:
                      smsBanner.confidence === "high"
                        ? colors.success + "1A"
                        : smsBanner.confidence === "medium"
                        ? colors.warning + "1A"
                        : colors.error + "1A",
                    borderColor:
                      smsBanner.confidence === "high"
                        ? colors.success + "44"
                        : smsBanner.confidence === "medium"
                        ? colors.warning + "44"
                        : colors.error + "44",
                  },
                ]}
              >
                <Ionicons
                  name={smsBanner.confidence === "high" ? "checkmark-circle" : "alert-circle"}
                  size={16}
                  color={
                    smsBanner.confidence === "high"
                      ? colors.success
                      : smsBanner.confidence === "medium"
                      ? colors.warning
                      : colors.error
                  }
                />
                <Text style={styles.bannerText}>
                  {smsBanner.confidence === "high"
                    ? "SMS detected — please confirm the details"
                    : `Partial match — please fill in ${smsBanner.missing.join(" and ")}`}
                </Text>
                <Pressable onPress={() => setSmsBanner(null)} hitSlop={8}>
                  <Ionicons name="close" size={14} color={colors.muted} />
                </Pressable>
              </View>
            )}

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
                autoFocus={!smsBanner}
              />
            </View>

            {/* 2. Date — calendar picker */}
            <Text style={styles.sectionLabel}>Date</Text>
            <Pressable
              testID="date-picker-btn"
              onPress={() => {
                Haptics.selectionAsync();
                setPickingDate(true);
              }}
              style={styles.datePickerBtn}
            >
              <View style={styles.datePickerIcon}>
                <Ionicons name="calendar" size={16} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.datePickerLabel}>{dateLabel}</Text>
                <Text style={styles.datePickerSub}>Tap to change</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>

            {/* 3. Category */}
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
          </>
        )}
      </ScrollView>

      {/* Sticky Save button (only in manual mode) */}
      {mode === "manual" && (
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
      )}

      <DatePickerModal
        visible={pickingDate}
        value={date}
        onClose={() => setPickingDate(false)}
        onChange={setDate}
        maxDate={new Date()}
        title="Transaction date"
      />
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
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  modeSwitch: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: 8,
    marginBottom: 8,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    height: 36,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modeBtnActive: { backgroundColor: colors.brand },
  modeText: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  modeTextActive: { color: "#fff", fontWeight: "800" },
  smsHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  smsHeroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  smsTitle: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  smsSub: { fontSize: 11, color: colors.muted, marginTop: 2, lineHeight: 15 },
  textarea: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    color: colors.onSurface,
    minHeight: 100,
    textAlignVertical: "top",
  },
  detectBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...shadow.fab,
  },
  detectBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  samplesLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
  },
  sampleCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  sampleText: { flex: 1, fontSize: 12, color: colors.onSurface, lineHeight: 17 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 11, color: colors.onSurface, fontWeight: "600", lineHeight: 15 },
  typeRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: 4,
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
  typeText: { fontSize: 12 },
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
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: spacing.lg,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  datePickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerLabel: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  datePickerSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
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
