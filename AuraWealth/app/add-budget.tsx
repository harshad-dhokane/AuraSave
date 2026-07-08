import React, { useState, useEffect , useMemo} from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Modal, Dimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { radius, spacing, shadow } from "@/src/theme";
import { useCurrency } from "@/src/currency";
import { upsertBudget, getCategories, Category, addCategory, getTransactions, Transaction } from "@/src/store";
import { currentMonthKey } from "@/src/utils/format";
import { useTheme } from "@/src/theme/ThemeContext";

const { height: SCREEN_H } = Dimensions.get("window");
const CATEGORY_ICONS = ["wallet", "cart", "car", "fast-food", "cafe", "home", "airplane", "medical", "fitness", "game-controller", "gift", "school", "briefcase", "cash"];
const ALERT_OPTIONS = [70, 80, 90, 100];

function shiftMonthKey(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function suggestedBudgetFor(txs: Transaction[], categoryId: string, monthKey: string) {
  if (!categoryId) return 0;
  const totals = [-1, -2, -3].map((offset) => {
    const key = shiftMonthKey(monthKey, offset);
    return txs
      .filter((t) => t.type === "expense" && t.categoryId === categoryId && t.date.startsWith(key))
      .reduce((sum, t) => sum + t.amount, 0);
  });
  const activeMonths = totals.filter((v) => v > 0);
  const average = (activeMonths.length ? activeMonths : totals).reduce((sum, v) => sum + v, 0) / 3;
  return Math.ceil((average * 1.1) / 100) * 100;
}

export default function AddBudgetScreen() {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string; categoryId?: string; limit?: string }>();
  const { currency } = useCurrency();

  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [limit, setLimit] = useState(params.limit || "");
  const [kind, setKind] = useState<"fixed" | "flexible">("flexible");
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [alertPercent, setAlertPercent] = useState(80);
  const [recurringDay, setRecurringDay] = useState("");
  const [notes, setNotes] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("wallet");
  const [newCatColor, setNewCatColor] = useState(colors.brand);
  const [savingCat, setSavingCat] = useState(false);
  const month = params.month || currentMonthKey();
  const blurTint = isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight";

  useEffect(() => {
    Promise.all([getCategories(), getTransactions()]).then(([cats, allTxs]) => {
      const expenseCats = cats.filter(c => c.type === "expense");
      setCategories(expenseCats);
      setTxs(allTxs);
      const initialCategory = expenseCats.find((c) => c.id === params.categoryId)?.id || expenseCats[0]?.id;
      if (initialCategory) setSelectedCat(initialCategory);
    });
  }, [params.categoryId]);

  const isValid = selectedCat !== "" && Number(limit) > 0;
  const suggestedLimit = useMemo(() => suggestedBudgetFor(txs, selectedCat, month), [txs, selectedCat, month]);

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
      type: "expense",
    });
    setCategories((prev) => [...prev, created]);
    setSelectedCat(created.id);
    setShowNewCat(false);
    setNewCatName("");
    setSavingCat(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = async () => {
    if (!isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    await upsertBudget({
      categoryId: selectedCat,
      month,
      limit: Number(limit),
      kind,
      rolloverEnabled,
      alertPercent,
      recurringDay: recurringDay ? Math.min(31, Math.max(1, Number(recurringDay))) : undefined,
      notes: notes.trim() || undefined,
    });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Text style={s.headerTitle}>Set Budget</Text>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <Text style={s.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
            {categories.map((c) => {
              const active = selectedCat === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCat(c.id)}
                  style={[s.catChip, active && { backgroundColor: c.color + "22", borderColor: c.color }]}
                >
                  <View style={[s.catIcon, { backgroundColor: c.color + "22" }]}>
                    <Ionicons name={c.icon as any} size={14} color={c.color} />
                  </View>
                  <Text style={[s.catText, active && { color: c.color, fontWeight: "800" }]} numberOfLines={1}>{c.name}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowNewCat(true);
              }}
              style={s.catChip}
            >
              <View style={[s.catIcon, { backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name="add" size={16} color={colors.muted} />
              </View>
              <Text style={s.catText}>New</Text>
            </Pressable>
          </ScrollView>

          {suggestedLimit > 0 && (
            <View style={s.suggestCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.suggestLabel}>Suggested limit</Text>
                <Text style={s.suggestText}>Based on the last 3 months plus a small buffer</Text>
              </View>
              <Pressable onPress={() => setLimit(String(suggestedLimit))} style={s.suggestBtn}>
                <Text style={s.suggestBtnText}>{currency.symbol}{suggestedLimit}</Text>
              </Pressable>
            </View>
          )}

          <Text style={[s.label, { marginTop: 24 }]}>Monthly limit ({currency.symbol})</Text>
          <TextInput
            value={limit}
            onChangeText={(v) => setLimit(v.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 5000"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            style={[s.input, { fontSize: 24, fontWeight: "800", paddingVertical: 16 }]}
            autoFocus
          />

          <Text style={[s.label, { marginTop: 24 }]}>Budget type</Text>
          <View style={s.typeToggle}>
            <Pressable
              onPress={() => setKind("flexible")}
              style={[s.typeBtn, kind === "flexible" && s.typeBtnActive]}
            >
              <Ionicons name="resize-outline" size={16} color={kind === "flexible" ? colors.brand : colors.muted} />
              <Text style={[s.typeText, kind === "flexible" && s.typeTextActive]}>Flexible</Text>
            </Pressable>
            <Pressable
              onPress={() => setKind("fixed")}
              style={[s.typeBtn, kind === "fixed" && s.typeBtnActive]}
            >
              <Ionicons name="lock-closed-outline" size={16} color={kind === "fixed" ? colors.brand : colors.muted} />
              <Text style={[s.typeText, kind === "fixed" && s.typeTextActive]}>Fixed</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => setRolloverEnabled((v) => !v)} style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>Rollover unused money</Text>
              <Text style={s.toggleSub}>Show unused money from the previous month</Text>
            </View>
            <View style={[s.toggle, rolloverEnabled && s.toggleOn]}>
              <View style={[s.toggleKnob, rolloverEnabled && s.toggleKnobOn]} />
            </View>
          </Pressable>

          <Text style={[s.label, { marginTop: 24 }]}>Alert me at</Text>
          <View style={s.alertRow}>
            {ALERT_OPTIONS.map((pct) => (
              <Pressable
                key={pct}
                onPress={() => setAlertPercent(pct)}
                style={[s.alertChip, alertPercent === pct && s.alertChipActive]}
              >
                <Text style={[s.alertText, alertPercent === pct && s.alertTextActive]}>{pct}%</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Recurring day</Text>
              <TextInput
                value={recurringDay}
                onChangeText={(v) => setRecurringDay(v.replace(/[^0-9]/g, "").slice(0, 2))}
                placeholder="Optional"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={s.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Bills, rent..."
                placeholderTextColor={colors.muted}
                style={s.input}
              />
            </View>
          </View>
          
        </ScrollView>
        
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={handleSave}
            disabled={!isValid}
            style={({ pressed }) => [
              s.saveBtn,
              { opacity: !isValid ? 0.5 : pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={s.saveBtnText}>Save budget</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showNewCat} transparent animationType="fade" onRequestClose={() => setShowNewCat(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalRoot}>
          <BlurView
            intensity={45}
            tint={blurTint}
            blurReductionFactor={2}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setShowNewCat(false)} />
          </BlurView>
          <View style={[s.sheet, { maxHeight: Math.round(SCREEN_H * 0.75), paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>New Category</Text>
              <Pressable onPress={() => setShowNewCat(false)} style={s.closeBtn}>
                <Ionicons name="close" size={20} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={s.label}>Name</Text>
              <TextInput
                value={newCatName}
                onChangeText={setNewCatName}
                placeholder="e.g. Groceries"
                placeholderTextColor={colors.muted}
                style={s.input}
              />

              <Text style={[s.label, { marginTop: 20 }]}>Color</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatchRow}>
                {Object.values(colors.cat).map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setNewCatColor(color)}
                    style={[s.swatch, { backgroundColor: color }, newCatColor === color && s.swatchActive]}
                  />
                ))}
              </ScrollView>

              <Text style={[s.label, { marginTop: 20 }]}>Icon</Text>
              <View style={s.iconGrid}>
                {CATEGORY_ICONS.map((icon) => (
                  <Pressable
                    key={icon}
                    onPress={() => setNewCatIcon(icon)}
                    style={[s.iconChoice, newCatIcon === icon && { backgroundColor: newCatColor + "33" }]}
                  >
                    <Ionicons name={icon as any} size={18} color={newCatIcon === icon ? newCatColor : colors.muted} />
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={handleCreateCategory}
                disabled={savingCat}
                style={[s.createBtn, { backgroundColor: newCatColor }, savingCat && { opacity: 0.6 }]}
              >
                <Text style={s.createBtnText}>{savingCat ? "Saving..." : "Create category"}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  
  label: { fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, fontSize: 16, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  
  catRow: { gap: 8, paddingRight: spacing.lg },
  catChip: {
    width: 92,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  catText: { fontSize: 11, fontWeight: "700", color: colors.muted, maxWidth: "100%" },

  suggestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brand + "33",
  },
  suggestLabel: { fontSize: 12, color: colors.brand, fontWeight: "800" },
  suggestText: { fontSize: 11, color: colors.muted, marginTop: 2, fontWeight: "600" },
  suggestBtn: { paddingHorizontal: 12, height: 34, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  suggestBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  typeToggle: { flexDirection: "row", gap: 8, padding: 4, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary },
  typeBtn: { flex: 1, height: 42, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  typeBtnActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  typeText: { fontSize: 13, color: colors.muted, fontWeight: "700" },
  typeTextActive: { color: colors.brand, fontWeight: "800" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleTitle: { fontSize: 14, color: colors.onSurface, fontWeight: "800" },
  toggleSub: { fontSize: 11, color: colors.muted, marginTop: 2, fontWeight: "600" },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.borderStrong, padding: 2, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.brand },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", ...shadow.card },
  toggleKnobOn: { transform: [{ translateX: 20 }] },
  alertRow: { flexDirection: "row", gap: 8 },
  alertChip: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  alertChipActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  alertText: { fontSize: 13, color: colors.muted, fontWeight: "700" },
  alertTextActive: { color: colors.brand, fontWeight: "800" },

  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "transparent" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
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
    marginBottom: 8,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  swatchRow: { gap: 10, paddingVertical: 4 },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  swatchActive: { borderWidth: 3, borderColor: colors.surface, ...shadow.card },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconChoice: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  createBtn: {
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  createBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand, height: 56, borderRadius: radius.pill },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
