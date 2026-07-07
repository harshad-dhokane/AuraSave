import React, { useState, useEffect , useMemo} from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { radius, spacing } from "@/src/theme";
import { useCurrency } from "@/src/currency";
import { upsertBudget, getCategories, Category } from "@/src/store";
import { currentMonthKey } from "@/src/utils/format";
import { useTheme } from "@/src/theme/ThemeContext";

export default function AddBudgetScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [limit, setLimit] = useState("");

  useEffect(() => {
    getCategories().then((cats) => {
      const expenseCats = cats.filter(c => c.type === "expense");
      setCategories(expenseCats);
      if (expenseCats.length > 0) setSelectedCat(expenseCats[0].id);
    });
  }, []);

  const isValid = selectedCat !== "" && Number(limit) > 0;

  const handleSave = async () => {
    if (!isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    await upsertBudget({
      categoryId: selectedCat,
      month: currentMonthKey(),
      limit: Number(limit),
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
          <View style={s.catRow}>
            {categories.map((c) => {
              const active = selectedCat === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCat(c.id)}
                  style={[s.catChip, active && { backgroundColor: c.color + "22", borderColor: c.color }]}
                >
                  <Ionicons name={c.icon as any} size={16} color={active ? c.color : colors.onSurface} />
                  <Text style={[s.catText, active && { color: c.color, fontWeight: "800" }]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </View>

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
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  
  label: { fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, fontSize: 16, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: "transparent" },
  catText: { fontSize: 14, fontWeight: "600", color: colors.muted },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand, height: 56, borderRadius: radius.pill },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
