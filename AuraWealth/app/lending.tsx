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
import { getLoans, Loan, deleteLoan } from "@/src/store";
import { ConfirmModal } from "@/src/components/ConfirmModal";
import { EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";
import { useTheme } from "@/src/theme/ThemeContext";

type LoanFilter = "all" | "active" | "overdue" | "settled";
const FILTERS: { key: LoanFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "settled", label: "Settled" },
];

function totalDue(loan: Loan) {
  return loan.amount + loan.amount * ((loan.interestRate || 0) / 100);
}

function remaining(loan: Loan) {
  return Math.max(0, totalDue(loan) - loan.paidAmount);
}

function isOverdue(loan: Loan) {
  return loan.status !== "settled" && !!loan.dueDate && new Date(loan.dueDate).getTime() < Date.now();
}

export default function LendingScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [tab, setTab] = useState<"lent" | "borrowed">("lent");
  const [filter, setFilter] = useState<LoanFilter>("all");
  const [deleteLoanId, setDeleteLoanId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterDropdownTop, setFilterDropdownTop] = useState(0);

  const confirmDelete = async () => {
    if (!deleteLoanId) return;
    await deleteLoan(deleteLoanId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleteLoanId(null);
    load();
  };

  const load = useCallback(async () => {
    setLoans(await getLoans());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => loans.filter((l) => {
    if (l.type !== tab) return false;
    if (filter === "active") return l.status !== "settled";
    if (filter === "overdue") return isOverdue(l);
    if (filter === "settled") return l.status === "settled";
    return true;
  }), [loans, tab, filter]);

  const totals = useMemo(() => {
    let lent = 0; let borrowed = 0; let overdue = 0;
    let totalLent = 0; let totalBorrowed = 0;
    let settledLent = 0; let settledBorrowed = 0;
    for (const l of loans) {
      const rem = remaining(l);
      const due = totalDue(l);
      if (l.type === "lent") {
        lent += rem;
        totalLent += due;
        if (l.status === "settled") settledLent += due;
      } else {
        borrowed += rem;
        totalBorrowed += due;
        if (l.status === "settled") settledBorrowed += due;
      }
      if (isOverdue(l)) overdue += rem;
    }
    return { lent, borrowed, overdue, totalLent, totalBorrowed, settledLent, settledBorrowed };
  }, [loans]);

  const people = useMemo(() => {
    const map = new Map<string, { person: string; lent: number; borrowed: number; count: number }>();
    for (const loan of loans) {
      const current = map.get(loan.person) || { person: loan.person, lent: 0, borrowed: 0, count: 0 };
      if (loan.type === "lent") current.lent += remaining(loan);
      else current.borrowed += remaining(loan);
      current.count += loan.status === "settled" ? 0 : 1;
      map.set(loan.person, current);
    }
    return Array.from(map.values())
      .filter((p) => p.lent > 0 || p.borrowed > 0)
      .sort((a, b) => Math.abs(b.lent - b.borrowed) - Math.abs(a.lent - a.borrowed))
      .slice(0, 4);
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
            {totals.settledLent > 0 && <Text style={s.settledHint}>✓ {formatMoney(totals.settledLent, currency)} settled</Text>}
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summaryLabel}>I OWE</Text>
            <Text style={[s.summaryAmt, { color: colors.error }]}>{formatMoney(totals.borrowed, currency)}</Text>
            {totals.settledBorrowed > 0 && <Text style={s.settledHint}>✓ {formatMoney(totals.settledBorrowed, currency)} settled</Text>}
          </View>
        </View>

        {totals.overdue > 0 && (
          <View style={s.overdueBanner}>
            <Ionicons name="alert-circle-outline" size={17} color={colors.warning} />
            <Text style={s.overdueText}>{formatMoney(totals.overdue, currency)} overdue across lending records</Text>
          </View>
        )}

        {people.length > 0 && (
          <View style={s.peopleRow}>
            {people.map((p) => {
              const net = p.lent - p.borrowed;
              return (
                <View key={p.person} style={s.personChip}>
                  <Text style={s.personName} numberOfLines={1}>{p.person}</Text>
                  <Text style={[s.personAmt, { color: net >= 0 ? colors.success : colors.error }]}>{formatMoney(Math.abs(net), currency)}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View 
          style={s.controlRow}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            setFilterDropdownTop(y + height + 8);
          }}
        >
          <View style={s.seg}>
            <Pressable style={[s.segBtn, tab === "lent" && s.segAct]} onPress={() => { Haptics.selectionAsync(); setTab("lent"); }}>
              <Text style={[s.segText, tab === "lent" && s.segActText]}>Owed to me</Text>
            </Pressable>
            <Pressable style={[s.segBtn, tab === "borrowed" && s.segAct]} onPress={() => { Haptics.selectionAsync(); setTab("borrowed"); }}>
              <Text style={[s.segText, tab === "borrowed" && s.segActText]}>I owe</Text>
            </Pressable>
          </View>
          
          <Pressable 
            onPress={() => {
              Haptics.selectionAsync();
              setShowFilters(!showFilters);
            }}
            style={[s.filterButton, showFilters && s.filterButtonActive]}
          >
            <Ionicons name="filter" size={20} color={filter !== "all" ? colors.brand : colors.onSurface} />
            {filter !== "all" && (
              <View style={s.filterBadge} />
            )}
          </Pressable>
        </View>

        {showFilters && (
          <View style={[s.filterDropdown, { top: filterDropdownTop || 250 }]}>
            <View style={s.dropdownHeader}>
              <Text style={s.dropdownTitle}>Filter status</Text>
            </View>
            {FILTERS.map((f, index) => {
              const isActive = filter === f.key;
              const count = loans.filter((l) => {
                if (l.type !== tab) return false;
                if (f.key === "active") return l.status !== "settled";
                if (f.key === "overdue") return isOverdue(l);
                if (f.key === "settled") return l.status === "settled";
                return true;
              }).length;
              
              return (
                <Pressable 
                  key={f.key}
                  onPress={() => { Haptics.selectionAsync(); setFilter(f.key as LoanFilter); setShowFilters(false); }}
                  style={[
                    s.dropdownItem,
                    index !== FILTERS.length - 1 && s.dropdownItemBorder,
                    isActive && s.dropdownItemActive,
                  ]}
                >
                  <Text style={[s.dropdownItemText, isActive && s.dropdownItemTextActive]}>
                    {f.label} ({count})
                  </Text>
                  <Ionicons name={isActive ? "checkmark-circle" : "ellipse-outline"} size={20} color={isActive ? colors.brand : colors.muted} />
                </Pressable>
              );
            })}
          </View>
        )}

        {filtered.length === 0 ? (
          <EmptyState icon="people-outline" title={tab === "lent" ? "No one owes you" : "You owe nothing"} subtitle="Tap + New to add a record" />
        ) : (
          <View style={{ marginHorizontal: spacing.lg, gap: 10 }}>
            {filtered.map((l) => {
              const rem = remaining(l);
              const isSettled = l.status === "settled";
              const overdue = isOverdue(l);
              const pct = Math.min(100, (l.paidAmount / totalDue(l)) * 100);
              
              return (
                <Pressable
                  key={l.id}
                  onPress={() => router.push({ pathname: "/loan-detail", params: { id: l.id, initialLoan: JSON.stringify(l) } })}
                  onLongPress={() => setDeleteLoanId(l.id)}
                  style={s.card}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[s.icon, isSettled && { backgroundColor: colors.success + "18" }]}>
                      <Ionicons name={isSettled ? "checkmark-circle" : "person"} size={18} color={isSettled ? colors.success : colors.brand} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={s.cardTitle}>{l.person}</Text>
                      <Text style={s.cardMeta}>
                        Total: {formatMoney(totalDue(l), currency)}
                        {l.groupName ? ` · ${l.groupName}` : ""}
                        {l.interestRate ? ` · ${l.interestRate}%` : ""}
                        {l.dueDate && !isSettled ? ` · Due: ${formatDate(l.dueDate)}` : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      {isSettled ? (
                        <Text style={[s.cardRem, { color: colors.success }]}>Settled</Text>
                      ) : (
                        <Text style={[s.cardRem, { color: overdue ? colors.warning : tab === "lent" ? colors.success : colors.error }]}>
                          {formatMoney(rem, currency)}
                        </Text>
                      )}
                      {!isSettled && <Text style={[s.statusText, { color: overdue ? colors.warning : colors.muted }]}>{overdue ? "Overdue" : "Active"}</Text>}
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
      {showFilters && <Pressable style={s.dropdownDismissLayer} onPress={() => setShowFilters(false)} />}
      
      <ConfirmModal 
        visible={!!deleteLoanId}
        title="Delete loan?"
        subtitle={`Are you sure you want to delete the record for "${loans.find(l => l.id === deleteLoanId)?.person || "this person"}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
        onCancel={() => setDeleteLoanId(null)}
        onConfirm={confirmDelete}
      />
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
  settledHint: { fontSize: 10, color: colors.success, fontWeight: "700", marginTop: 3 },
  overdueBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.lg, marginTop: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.warning + "14", borderWidth: 1, borderColor: colors.warning + "33" },
  overdueText: { flex: 1, fontSize: 12, color: colors.onSurface, fontWeight: "800" },
  peopleRow: { flexDirection: "row", gap: 8, marginHorizontal: spacing.lg, marginTop: 12 },
  personChip: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  personName: { fontSize: 11, color: colors.muted, fontWeight: "800" },
  personAmt: { fontSize: 13, fontWeight: "900", marginTop: 2 },
  
  controlRow: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.lg, marginTop: 20, marginBottom: 16, gap: 12 },
  seg: { flex: 1, flexDirection: "row", padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center" },
  segAct: { backgroundColor: colors.surfaceSecondary, ...shadow.card },
  segText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segActText: { color: colors.onSurface, fontWeight: "800" },
  
  filterButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  filterButtonActive: { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand },
  filterBadge: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  
  filterDropdown: { position: "absolute", right: spacing.lg, width: 220, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card, zIndex: 100 },
  dropdownHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownTitle: { fontSize: 14, fontWeight: "800", color: colors.onSurface },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  dropdownItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownItemActive: { backgroundColor: colors.brand + "0A" },
  dropdownItemText: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  dropdownItemTextActive: { color: colors.brand, fontWeight: "800" },
  dropdownDismissLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 },
  
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: "600" },
  cardRem: { fontSize: 15, fontWeight: "800" },
  statusText: { fontSize: 10, fontWeight: "800", marginTop: 2 },
});
