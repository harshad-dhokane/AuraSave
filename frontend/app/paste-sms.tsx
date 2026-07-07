import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { useCurrency } from "@/src/currency";
import { formatMoney } from "@/src/utils/format";
import {
  addTransaction,
  getCategories,
  Category,
  TxType,
} from "@/src/store";
import { parseSms, SMS_SAMPLES } from "@/src/utils/sms-parser";

const TYPE_META: Record<TxType, { label: string; color: string; icon: keyof typeof import("@expo/vector-icons/build/Ionicons").glyphMap }> = {
  expense: { label: "Expense", color: colors.error, icon: "arrow-up-circle" },
  income: { label: "Income", color: colors.success, icon: "arrow-down-circle" },
  investment: { label: "Investment", color: colors.brandPrimary, icon: "trending-up" },
};

export default function PasteSms() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const [cats, setCats] = useState<Category[]>([]);
  const [text, setText] = useState("");
  const [step, setStep] = useState<"paste" | "review">("paste");

  // Detected values (editable during review)
  const [detType, setDetType] = useState<TxType>("expense");
  const [detAmount, setDetAmount] = useState("");
  const [detCategoryId, setDetCategoryId] = useState<string | null>(null);
  const [detNote, setDetNote] = useState("");
  const [confidence, setConfidence] = useState<"high" | "medium" | "low">("low");

  useFocusEffect(
    React.useCallback(() => {
      (async () => setCats(await getCategories()))();
    }, []),
  );

  const filteredCats = useMemo(() => cats.filter((c) => c.type === detType), [cats, detType]);

  const detect = () => {
    Keyboard.dismiss();
    if (!text.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const parsed = parseSms(text, cats);
    setDetType(parsed.type || "expense");
    setDetAmount(parsed.amount ? String(parsed.amount) : "");
    setDetCategoryId(parsed.suggestedCategoryId);
    setDetNote(parsed.merchant || "");
    setConfidence(parsed.confidence);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep("review");
  };

  const save = async () => {
    const num = Number(detAmount);
    if (!num || num <= 0 || !detCategoryId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await addTransaction({
      type: detType,
      amount: num,
      categoryId: detCategoryId,
      note: detNote.trim() || undefined,
      date: new Date().toISOString(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.surface }}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="paste-close" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{step === "paste" ? "Scan SMS" : "Review & save"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {step === "paste" ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="scan" size={22} color={colors.brand} />
            </View>
            <Text style={styles.heroTitle}>Paste any bank / UPI SMS</Text>
            <Text style={styles.heroSub}>
              We&apos;ll extract the amount, type and merchant automatically. Works fully offline — no data leaves your phone.
            </Text>
          </View>

          <Text style={styles.formLabel}>Message text</Text>
          <TextInput
            testID="sms-textarea"
            value={text}
            onChangeText={setText}
            placeholder="Paste your bank message here…"
            placeholderTextColor={colors.muted}
            style={styles.textarea}
            multiline
            numberOfLines={6}
            autoFocus
          />

          <Pressable
            testID="detect-btn"
            onPress={detect}
            disabled={!text.trim()}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: !text.trim() ? 0.5 : pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Detect transaction</Text>
          </Pressable>

          <Text style={styles.samplesLabel}>Try a sample</Text>
          {SMS_SAMPLES.map((s, i) => (
            <Pressable
              key={i}
              testID={`sample-${i}`}
              onPress={() => {
                Haptics.selectionAsync();
                setText(s);
              }}
              style={styles.sampleCard}
            >
              <Ionicons name="chatbox-ellipses-outline" size={14} color={colors.brand} />
              <Text style={styles.sampleText} numberOfLines={2}>
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.confidenceBadge,
              {
                backgroundColor:
                  confidence === "high"
                    ? colors.success + "1A"
                    : confidence === "medium"
                    ? colors.warning + "1A"
                    : colors.error + "1A",
              },
            ]}
          >
            <Ionicons
              name={confidence === "high" ? "checkmark-circle" : confidence === "medium" ? "alert-circle" : "help-circle"}
              size={14}
              color={confidence === "high" ? colors.success : confidence === "medium" ? colors.warning : colors.error}
            />
            <Text
              style={[
                styles.confidenceText,
                {
                  color:
                    confidence === "high" ? colors.success : confidence === "medium" ? colors.warning : colors.error,
                },
              ]}
            >
              {confidence === "high"
                ? "High-confidence match"
                : confidence === "medium"
                ? "Partial match — please review"
                : "Low confidence — fill in the missing fields"}
            </Text>
          </View>

          {/* Type */}
          <Text style={styles.formLabel}>Type</Text>
          <View style={styles.typeRow}>
            {(Object.keys(TYPE_META) as TxType[]).map((k) => {
              const meta = TYPE_META[k];
              const active = detType === k;
              return (
                <Pressable
                  key={k}
                  testID={`sms-type-${k}`}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDetType(k);
                    setDetCategoryId(null);
                  }}
                  style={[
                    styles.typeBtn,
                    active && { backgroundColor: meta.color + "1A", borderColor: meta.color },
                  ]}
                >
                  <Ionicons name={meta.icon} size={16} color={active ? meta.color : colors.muted} />
                  <Text style={[styles.typeText, { color: active ? meta.color : colors.onSurface, fontWeight: active ? "800" : "600" }]}>
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Amount */}
          <Text style={styles.formLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountSymbol}>{currency.symbol}</Text>
            <TextInput
              testID="sms-amount"
              value={detAmount}
              onChangeText={(v) => setDetAmount(v.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
          {detAmount && (
            <Text style={styles.amountHint}>
              {formatMoney(Number(detAmount) || 0, currency)}
            </Text>
          )}

          {/* Category */}
          <Text style={styles.formLabel}>Category {!detCategoryId ? <Text style={{ color: colors.error }}>*</Text> : null}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {filteredCats.map((c) => {
              const active = detCategoryId === c.id;
              return (
                <Pressable
                  key={c.id}
                  testID={`sms-cat-${c.id}`}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDetCategoryId(c.id);
                  }}
                  style={[
                    styles.catChip,
                    active && { backgroundColor: c.color + "22", borderColor: c.color },
                  ]}
                >
                  <Ionicons name={c.icon as any} size={14} color={active ? c.color : colors.onSurface} />
                  <Text style={[styles.catChipText, active && { color: c.color, fontWeight: "800" }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Note */}
          <Text style={styles.formLabel}>Note</Text>
          <TextInput
            testID="sms-note"
            value={detNote}
            onChangeText={setDetNote}
            placeholder="Merchant or description"
            placeholderTextColor={colors.muted}
            style={styles.noteInput}
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setStep("paste")}>
              <Text style={styles.btnGhostText}>Back</Text>
            </Pressable>
            <Pressable testID="sms-save-btn" style={[styles.btn, styles.btnPrimary]} onPress={save}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.btnPrimaryText}>Save transaction</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  hero: {
    alignItems: "center",
    marginBottom: 20,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
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
    marginTop: 12,
    marginBottom: 8,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: 14,
    fontSize: 14,
    color: colors.onSurface,
    minHeight: 130,
    textAlignVertical: "top",
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    ...shadow.fab,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  samplesLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
    marginTop: 24,
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
  sampleText: {
    flex: 1,
    fontSize: 12,
    color: colors.onSurface,
    lineHeight: 17,
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  confidenceText: { fontSize: 12, fontWeight: "700" },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  typeText: { fontSize: 12 },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 60,
  },
  amountSymbol: { fontSize: 22, fontWeight: "700", color: colors.muted, marginRight: 8 },
  amountInput: { flex: 1, fontSize: 24, fontWeight: "800", color: colors.onSurface, padding: 0 },
  amountHint: { marginTop: 6, marginLeft: 4, fontSize: 12, color: colors.muted },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    flexShrink: 0,
  },
  catChipText: { fontSize: 12, color: colors.onSurface, fontWeight: "600" },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    color: colors.onSurface,
    backgroundColor: colors.surfaceSecondary,
  },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnGhost: { backgroundColor: colors.surfaceTertiary },
  btnGhostText: { color: colors.onSurface, fontWeight: "700" },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
