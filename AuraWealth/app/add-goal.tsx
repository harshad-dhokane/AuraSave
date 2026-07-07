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
const PRIORITIES: { value: "low" | "medium" | "high"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "low", label: "Low", icon: "remove-circle-outline" },
  { value: "medium", label: "Medium", icon: "radio-button-on-outline" },
  { value: "high", label: "High", icon: "alert-circle-outline" },
];

function deadlineForPeriod(period: string) {
  const date = new Date();
  if (period === "3 months") date.setMonth(date.getMonth() + 3);
  else if (period === "6 months") date.setMonth(date.getMonth() + 6);
  else if (period === "1 year") date.setFullYear(date.getFullYear() + 1);
  else if (period === "5 years") date.setFullYear(date.getFullYear() + 5);
  else return undefined;
  return date.toISOString();
}

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
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [autoContribution, setAutoContribution] = useState("");
  const [autoDay, setAutoDay] = useState("1");

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
      deadline: deadlineForPeriod(period),
      priority,
      autoContributionAmount: Number(autoContribution) || undefined,
      autoContributionDay: autoContribution ? Math.min(31, Math.max(1, Number(autoDay) || 1)) : undefined,
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
          <View style={s.periodRow}>
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[s.periodChip, period === p && s.periodChipAct]}
              >
                <Text style={[s.periodText, period === p && s.periodTextAct]}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[s.label, { marginTop: 24 }]}>Priority</Text>
          <View style={s.priorityRow}>
            {PRIORITIES.map((p) => {
              const active = priority === p.value;
              return (
                <Pressable key={p.value} onPress={() => setPriority(p.value)} style={[s.priorityChip, active && s.priorityChipAct]}>
                  <Ionicons name={p.icon} size={15} color={active ? colors.brand : colors.muted} />
                  <Text style={[s.priorityText, active && s.priorityTextAct]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[s.label, { marginTop: 24 }]}>Auto contribution plan</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                value={autoContribution}
                onChangeText={(v) => setAutoContribution(v.replace(/[^0-9]/g, ""))}
                placeholder={`Monthly (${currency.symbol})`}
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={s.input}
              />
            </View>
            <View style={{ width: 92 }}>
              <TextInput
                value={autoDay}
                onChangeText={(v) => setAutoDay(v.replace(/[^0-9]/g, "").slice(0, 2))}
                placeholder="Day"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
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
  
  periodRow: { flexDirection: "row", gap: 6 },
  periodChip: {
    flex: 1,
    minWidth: 0,
    height: 32,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  periodChipAct: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  periodText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  periodTextAct: { color: colors.brand, fontWeight: "800" },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityChip: { flex: 1, height: 38, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  priorityChipAct: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  priorityText: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  priorityTextAct: { color: colors.brand, fontWeight: "800" },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand, height: 56, borderRadius: radius.pill },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
