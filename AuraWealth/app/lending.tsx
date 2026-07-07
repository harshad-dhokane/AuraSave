import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { radius, spacing, shadow } from "@/src/theme";
import { formatMoney, formatDate } from "@/src/utils/format";
import { getLoans, Loan } from "@/src/store";
import { EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";
import { useTheme } from "@/src/theme/ThemeContext";

export default function LendingScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [tab, setTab] = useState<"lent" | "borrowed">("lent");

  const load = useCallback(async () => {
    setLoans(await getLoans());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => loans.filter((l) => l.type === tab), [loans, tab]);

  const totals = useMemo(() => {
    let lent = 0; let borrowed = 0;
    for (const l of loans) {
      if (l.type === "lent") lent += (l.amount - l.paidAmount);
      else borrowed += (l.amount - l.paidAmount);
    }
    return { lent, borrowed };
  }, [loans]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Lending</Text>
            <Text style={s.subtitle}>Manage your loans</Text>
          </View>
          <Pressable onPress={() => router.push("/add-loan")} style={s.addBtn}>
            <Ionicons name="add" size={16} color={colors.brand} />
            <Text style={s.addBtnText}>New</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 0, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        <View style={s.summaryCard}>
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>OWED TO ME</Text>
            <Text style={[s.summaryAmt, { color: colors.success }]}>{formatMoney(totals.lent, currency)}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>I OWE</Text>
            <Text style={[s.summaryAmt, { color: colors.error }]}>{formatMoney(totals.borrowed, currency)}</Text>
          </View>
        </View>

        <View style={s.seg}>
          <Pressable style={[s.segBtn, tab === "lent" && s.segAct]} onPress={() => { Haptics.selectionAsync(); setTab("lent"); }}>
            <Text style={[s.segText, tab === "lent" && s.segActText]}>Owed to me</Text>
          </Pressable>
          <Pressable style={[s.segBtn, tab === "borrowed" && s.segAct]} onPress={() => { Haptics.selectionAsync(); setTab("borrowed"); }}>
            <Text style={[s.segText, tab === "borrowed" && s.segActText]}>I owe</Text>
          </Pressable>
        </View>

        {filtered.length === 0 ? (
          <EmptyState icon="people-outline" title={tab === "lent" ? "No one owes you" : "You owe nothing"} subtitle="Tap + New to add a record" />
        ) : (
          <View style={{ marginHorizontal: spacing.lg, gap: 10 }}>
            {filtered.map((l) => {
              const rem = l.amount - l.paidAmount;
              const isSettled = l.status === "settled";
              const pct = Math.min(100, (l.paidAmount / l.amount) * 100);
              
              return (
                <Pressable
                  key={l.id}
                  onPress={() => router.push({ pathname: "/loan-detail", params: { id: l.id, initialLoan: JSON.stringify(l) } })}
                  style={s.card}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[s.icon, isSettled && { backgroundColor: colors.success + "18" }]}>
                      <Ionicons name={isSettled ? "checkmark-circle" : "person"} size={18} color={isSettled ? colors.success : colors.brand} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.cardTitle}>{l.person}</Text>
                      <Text style={s.cardMeta}>
                        Total: {formatMoney(l.amount, currency)}
                        {l.dueDate && !isSettled ? ` · Due: ${formatDate(l.dueDate)}` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {isSettled ? (
                        <Text style={[s.cardRem, { color: colors.success }]}>Settled</Text>
                      ) : (
                        <Text style={[s.cardRem, { color: tab === "lent" ? colors.success : colors.error }]}>
                          {formatMoney(rem, currency)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 999, overflow: "hidden", marginTop: 12 }}>
                    <View style={{ width: `${pct}%`, height: "100%", backgroundColor: isSettled ? colors.success : colors.brand, borderRadius: 999 }} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  headerWrap: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  backBtn: { marginRight: 16 },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  addBtnText: { fontSize: 12, color: colors.brand, fontWeight: "700" },
  
  summaryCard: { marginHorizontal: spacing.lg, padding: 16, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center" },
  summaryCol: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, height: 40, backgroundColor: colors.border },
  summaryLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 0.5 },
  summaryAmt: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  
  seg: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: 20, marginBottom: 16, padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center" },
  segAct: { backgroundColor: colors.surfaceSecondary, ...shadow.card },
  segText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segActText: { color: colors.onSurface, fontWeight: "800" },
  
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: "600" },
  cardRem: { fontSize: 15, fontWeight: "800" },
});
