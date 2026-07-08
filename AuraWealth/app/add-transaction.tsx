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
  Dimensions,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";

import { radius, spacing, shadow } from "@/src/theme";
import { getCategories, addTransaction, Category, TxType, addCategory } from "@/src/store";
import { useCurrency } from "@/src/currency";
import { parseSms, SMS_SAMPLES } from "@/src/utils/sms-parser";
import { DatePickerModal } from "@/src/components/DatePicker";
import { useTheme } from "@/src/theme/ThemeContext";

const { height: SCREEN_H } = Dimensions.get("window");



export default function AddTransaction() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const TYPE_OPTIONS: { key: TxType; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = useMemo(() => [
    { key: "expense", label: "Expense", color: colors.error, icon: "arrow-up-circle" },
    { key: "income", label: "Income", color: colors.success, icon: "arrow-down-circle" },
    { key: "investment", label: "Investment", color: colors.brandPrimary, icon: "trending-up" },
  ], [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const params = useLocalSearchParams<{ type?: string; mode?: string }>();

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
  // When true, the type-change effect will NOT auto-pick a category. Set after
  // an SMS parse that failed to detect a category so the user is forced to
  // choose one explicitly.
  const [mustChooseCategory, setMustChooseCategory] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [date, setDate] = useState(new Date());
  const [pickingDate, setPickingDate] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Custom Category State
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("wallet");
  const [newCatColor, setNewCatColor] = useState(colors.brand);
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await getCategories();
      setCats(c);
    })();
  }, []);

  useEffect(() => {
    if (mustChooseCategory) return; // gate auto-fallback while user must choose
    if (categoryId) {
      const found = cats.find((c) => c.id === categoryId);
      if (found && found.type === type) return;
    }
    const first = cats.find((c) => c.type === type);
    setCategoryId(first ? first.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, cats, mustChooseCategory]);

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
    if (parsed.merchant && !note) setNote(parsed.merchant);

    const missing: string[] = [];
    if (!parsed.amount) missing.push("amount");
    if (parsed.suggestedCategoryId) {
      setCategoryId(parsed.suggestedCategoryId);
      setMustChooseCategory(false);
    } else {
      setCategoryId(null);
      setMustChooseCategory(true);
      missing.push("category");
    }
    setSmsBanner({ confidence: parsed.confidence, missing });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode("manual");
  };

  const selectCategory = (id: string) => {
    Haptics.selectionAsync();
    setCategoryId(id);
    setMustChooseCategory(false);
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

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setSavingCat(true);
    const created = await addCategory({
      name: newCatName.trim(),
      icon: newCatIcon,
      color: newCatColor,
      type,
    });
    setCats((prev) => [...prev, created]);
    setCategoryId(created.id);
    setMustChooseCategory(false);
    setShowNewCat(false);
    setSavingCat(false);
    setNewCatName("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const sheetHeight = Math.round(SCREEN_H * 0.80);

  // Banner colour + text: use `missing` for accurate copy
  const bannerText = smsBanner
    ? smsBanner.missing.length === 0
      ? "SMS detected — please confirm the details"
      : `Partial match — please fill in ${smsBanner.missing.join(" and ")}`
    : null;
  const bannerColor = smsBanner
    ? smsBanner.missing.length === 0
      ? colors.success
      : colors.warning
    : colors.info;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>New transaction</Text>
            <Pressable testID="close-btn" onPress={() => router.back()} style={styles.headerBtn}>
              <Ionicons name="close" size={20} color={colors.onSurface} />
            </Pressable>
          </View>

          {/* Mode toggle */}
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

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
          >
            {mode === "sms" ? (
              <View style={{ paddingHorizontal: spacing.lg }}>
                <View style={styles.smsHero}>
                  <View style={styles.smsHeroIcon}>
                    <Ionicons name="scan" size={18} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.smsTitle}>Paste any bank / UPI SMS</Text>
                    <Text style={styles.smsSub}>We&apos;ll auto-detect the type, amount, category and merchant.</Text>
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
                {smsBanner && (
                  <View
                    style={[
                      styles.banner,
                      {
                        backgroundColor: bannerColor + "1A",
                        borderColor: bannerColor + "44",
                      },
                    ]}
                  >
                    <Ionicons
                      name={smsBanner.missing.length === 0 ? "checkmark-circle" : "alert-circle"}
                      size={16}
                      color={bannerColor}
                    />
                    <Text style={styles.bannerText}>{bannerText}</Text>
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
                        <Ionicons name={o.icon} size={16} color={active ? o.color : colors.muted} />
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

                {/* Amount */}
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

                  />
                </View>

                {/* Date */}
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
                    <Ionicons name="calendar" size={14} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.datePickerLabel}>{dateLabel}</Text>
                    <Text style={styles.datePickerSub}>Tap to change</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>

                {/* Category — horizontal scroll */}
                <Text style={styles.sectionLabel}>
                  Category{" "}
                  {mustChooseCategory ? (
                    <Text style={{ color: colors.error, fontSize: 11 }}>· required</Text>
                  ) : null}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.catRow}
                >
                  {filtered.map((c) => {
                    const active = categoryId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        testID={`cat-${c.id}`}
                        onPress={() => selectCategory(c.id)}
                        style={[
                          styles.catChip,
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
                  <Pressable
                    testID="cat-new"
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowNewCat(true);
                    }}
                    style={styles.catChip}
                  >
                    <View style={[styles.catIcon, { backgroundColor: colors.surfaceTertiary }]}>
                      <Ionicons name="add" size={18} color={colors.muted} />
                    </View>
                    <Text style={styles.catLabel}>New</Text>
                  </Pressable>
                </ScrollView>

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
              </>
            )}
          </ScrollView>

          {mode === "manual" && (
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Pressable
                testID="save-tx-btn"
                onPress={handleSave}
                disabled={saving || !amount || !categoryId}
                style={({ pressed }) => [
                  styles.saveBtn,
                  {
                    backgroundColor: typeMeta.color,
                    opacity: !amount || !categoryId ? 0.5 : pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveText}>Save {typeMeta.label.toLowerCase()}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={pickingDate}
        value={date}
        onClose={() => setPickingDate(false)}
        onChange={setDate}
        maxDate={new Date()}
        title="Transaction date"
      />

      {/* New Category Modal */}
      <Modal visible={showNewCat} transparent animationType="fade" onRequestClose={() => setShowNewCat(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "transparent" }}>
          <BlurView 
            intensity={45} 
            tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} 
            blurReductionFactor={2}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setShowNewCat(false)} />
          </BlurView>
          <View style={[styles.sheet, { maxHeight: Math.round(SCREEN_H * 0.75), paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>New Category</Text>
              <Pressable onPress={() => setShowNewCat(false)} style={styles.headerBtn}>
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={styles.sectionLabel}>Name</Text>
              <TextInput
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="E.g. Coffee"
                placeholderTextColor={colors.muted}
                style={[styles.noteInput, { minHeight: 48, paddingVertical: 0 }]}
              />

              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Color</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.lg }}>
                {Object.values(colors.cat).map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setNewCatColor(color)}
                    style={[
                      { width: 40, height: 40, borderRadius: 20, backgroundColor: color },
                      newCatColor === color && { borderWidth: 3, borderColor: colors.surface, ...shadow.card }
                    ]}
                  />
                ))}
              </ScrollView>

              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Icon</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: spacing.lg }}>
                {["wallet", "cart", "car", "fast-food", "cafe", "home", "airplane", "medical", "fitness", "game-controller", "gift", "paw", "school", "briefcase", "cash", "trending-up"].map((icon) => (
                  <Pressable
                    key={icon}
                    onPress={() => setNewCatIcon(icon)}
                    style={[
                      { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
                      newCatIcon === icon && { backgroundColor: newCatColor + "33" }
                    ]}
                  >
                    <Ionicons name={icon as any} size={20} color={newCatIcon === icon ? newCatColor : colors.muted} />
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.saveBtn, { marginTop: 32, marginHorizontal: spacing.lg, backgroundColor: newCatColor }, savingCat && { opacity: 0.6 }]}
                onPress={handleCreateCategory}
                disabled={savingCat}
              >
                <Text style={styles.saveText}>{savingCat ? "Saving..." : "Create Category"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    ...shadow.card,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  modeSwitch: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: 6,
    marginBottom: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    height: 34,
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
    padding: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  smsHeroIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  smsTitle: { fontSize: 13, fontWeight: "800", color: colors.onSurface },
  smsSub: { fontSize: 11, color: colors.muted, marginTop: 2, lineHeight: 15 },
  textarea: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14,
    color: colors.onSurface,
    minHeight: 90,
    textAlignVertical: "top",
  },
  detectBtn: {
    marginTop: 10,
    height: 48,
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
    marginTop: 16,
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
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 11, color: colors.onSurface, fontWeight: "600", lineHeight: 15 },
  typeRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: 8,
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
    gap: 2,
  },
  typeText: { fontSize: 11 },
  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 20,
  },
  amountCurrency: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.muted,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 44,
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
    marginTop: 14,
    marginBottom: 8,
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: spacing.lg,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  datePickerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerLabel: { fontSize: 13, fontWeight: "800", color: colors.onSurface },
  datePickerSub: { fontSize: 10, color: colors.muted, marginTop: 2 },
  catRow: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    paddingRight: spacing.lg + 6,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingRight: 14,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    flexShrink: 0,
  },
  catIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurface,
    maxWidth: 140,
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
    minHeight: 58,
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...shadow.fab,
  },
  saveText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
