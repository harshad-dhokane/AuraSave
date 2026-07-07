import React, { useState , useMemo} from "react";
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
import { addGoal } from "@/src/store";
import { useTheme } from "@/src/theme/ThemeContext";

const PERIODS = ["3 months", "6 months", "1 year", "5 years"];

export default function AddGoalScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();

  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [period, setPeriod] = useState(PERIODS[2]);

  const isValid = title.trim().length > 0 && Number(target) > 0;

  const handleSave = async () => {
    if (!isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const t = Number(target);
    const s = Number(saved) || 0;
    await addGoal({
      title: title.trim(),
      target: t,
      saved: s,
      status: s >= t ? "completed" : "pending",
      period,
    });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Text style={s.headerTitle}>New Goal</Text>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <Text style={s.label}>Goal name</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Emergency Fund"
            placeholderTextColor={colors.muted}
            style={s.input}
            autoFocus
          />

          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Target ({currency.symbol})</Text>
              <TextInput
                value={target}
                onChangeText={(v) => setTarget(v.replace(/[^0-9]/g, ""))}
                placeholder="100000"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={s.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Saved ({currency.symbol})</Text>
              <TextInput
                value={saved}
                onChangeText={(v) => setSaved(v.replace(/[^0-9]/g, ""))}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={s.input}
              />
            </View>
          </View>

          <Text style={[s.label, { marginTop: 24 }]}>Target Period</Text>
          <View style={s.chipRow}>
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[s.chip, period === p && s.chipAct]}
              >
                <Text style={[s.chipText, period === p && s.chipTextAct]}>{p}</Text>
              </Pressable>
            ))}
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
            <Text style={s.saveBtnText}>Save goal</Text>
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
  
  label: { fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, fontSize: 16, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: "transparent" },
  chipAct: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.muted },
  chipTextAct: { color: colors.brand, fontWeight: "800" },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand, height: 56, borderRadius: radius.pill },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
