import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  FlatList,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { radius, spacing, shadow } from "@/src/theme";
import { formatDayLabel, formatMoney } from "@/src/utils/format";
import {
  getTransactions,
  getCategories,
  getGoalContributions,
  getLoans,
  getGoals,
  deleteTransaction,
  Transaction,
  Category,
  GoalContribution,
  Loan,
  Goal,
  TxType,
} from "@/src/store";
import { buildUnifiedFeed, UnifiedRecord } from "@/src/utils/unifiedFeed";
import { CategoryIcon, EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";
import { useTabBarScroll } from "@/src/context/TabBarScrollContext";
import { useTheme } from "@/src/theme/ThemeContext";

const FILTERS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All", icon: "layers-outline" },
  { key: "expense", label: "Expenses", icon: "arrow-up-circle-outline" },
  { key: "income", label: "Income", icon: "arrow-down-circle-outline" },
  { key: "investment", label: "Invest", icon: "trending-up-outline" },
  { key: "saved", label: "Goals", icon: "flag-outline" },
  { key: "lent", label: "Lent", icon: "arrow-up-outline" },
  { key: "borrowed", label: "Borrowed", icon: "arrow-down-outline" },
];

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const { onScroll } = useTabBarScroll();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [conts, setConts] = useState<GoalContribution[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [t, c, gc, l, g] = await Promise.all([getTransactions(), getCategories(), getGoalContributions(), getLoans(), getGoals()]);
    setTxs(t);
    setCats(c);
    setConts(gc);
    setLoans(l);
    setGoals(g);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const unifiedFeed = useMemo(() => buildUnifiedFeed(txs, conts, loans, cats, goals), [txs, conts, loans, cats, goals]);

  const filtered = useMemo(() => {
    return unifiedFeed.filter((item) => {
      if (filters.size > 0 && !filters.has(item.type)) return false;
      if (q.trim()) {
        const query = q.toLowerCase();
        if (
          !item.title.toLowerCase().includes(query) &&
          !item.subtitle.toLowerCase().includes(query)
        )
          return false;
      }
      return true;
    });
  }, [unifiedFeed, filters, q]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: UnifiedRecord[] }[] = [];
    const map = new Map<string, UnifiedRecord[]>();
    for (const t of filtered) {
      const key = formatDayLabel(t.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const [label, items] of map.entries()) groups.push({ label, items });
    return groups;
  }, [filtered]);

  const handleDelete = (item: UnifiedRecord) => {
    if (item.type === "saved" || item.type === "lent" || item.type === "borrowed") {
      Alert.alert("Cannot delete from Ledger", "Please go to the Goals or Lending page to manage this record to ensure balances are properly calculated.");
      return;
    }
    Alert.alert("Delete transaction?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTransaction(item.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          load();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Sticky header */}
      <View style={[styles.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Transactions</Text>
            <Text style={styles.subtitle}>{filtered.length} entries · {formatMoney(filtered.reduce((s, t) => s + (t.type === "expense" || t.type === "investment" || t.type === "saved" || t.type === "lent" ? -t.amount : t.amount), 0), currency)}</Text>
          </View>
          <Pressable
            testID="tx-add-btn"
            onPress={() => router.push("/add-transaction")}
            style={styles.headerBtn}
          >
            <Ionicons name="add" size={22} color={colors.brand} />
          </Pressable>
        </View>

        {/* Search & Filter */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 0, gap: 12 }}>
          <View style={[styles.search, { flex: 1 }]}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              testID="tx-search-input"
              value={q}
              onChangeText={setQ}
              placeholder="Search category or note"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <Pressable 
            onPress={() => setShowFilters(true)} 
            style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="filter" size={20} color={filters.size > 0 ? colors.brand : colors.onSurface} />
            {filters.size > 0 && (
              <View style={{ position: "absolute", top: -4, right: -4, backgroundColor: colors.brand, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface }}>
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>{filters.size}</Text>
              </View>
            )}
          </Pressable>
        </View>

      </View>

      {/* Filter Modal */}
      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <BlurView intensity={60} tint="default" style={StyleSheet.absoluteFill}><Pressable style={{ flex: 1 }} onPress={() => setShowFilters(false)} /></BlurView>
          <Pressable style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface }}>Filters</Text>
              <Pressable onPress={() => { setFilters(new Set()); Haptics.selectionAsync(); }}>
                <Text style={{ color: colors.brand, fontWeight: "600" }}>Clear All</Text>
              </Pressable>
            </View>
            {FILTERS.filter(f => f.key !== "all").map(f => {
              const isActive = filters.has(f.key);
              return (
                <Pressable 
                  key={f.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFilters(prev => {
                      const n = new Set(prev);
                      if (n.has(f.key)) n.delete(f.key);
                      else n.add(f.key);
                      return n;
                    });
                  }}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={f.icon as any} size={18} color={isActive ? colors.brand : colors.muted} />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: isActive ? colors.onSurface : colors.muted }}>{f.label}</Text>
                  </View>
                  <Ionicons name={isActive ? "checkbox" : "square-outline"} size={24} color={isActive ? colors.brand : colors.muted} />
                </Pressable>
              );
            })}
            <Pressable 
              onPress={() => setShowFilters(false)}
              style={{ marginTop: 24, backgroundColor: colors.onSurface, padding: 16, borderRadius: 12, alignItems: "center" }}
            >
              <Text style={{ color: colors.surface, fontWeight: "700", fontSize: 16 }}>Apply Filters</Text>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      {grouped.length === 0 ? (
        <View style={{ marginTop: 60 }}>
          <EmptyState
            icon="reader-outline"
            title="No transactions"
            subtitle="Add your first transaction with the + button below"
          />
        </View>
      ) : (
        <FlatList
          testID="tx-list"
          data={grouped}
          keyExtractor={(g) => g.label}
          contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: spacing.lg }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View>
              <Text style={styles.dayHeader}>{item.label}</Text>
              <View style={styles.card}>
                {item.items.map((t, i) => {
                  const isNegative = t.type === "expense" || t.type === "investment" || t.type === "saved" || t.type === "lent";
                  const color = isNegative
                    ? colors.onSurface
                    : t.type === "income"
                    ? colors.success
                    : t.type === "borrowed"
                    ? colors.error
                    : colors.brandPrimary;
                    
                  return (
                    <Pressable
                      key={t.id}
                      testID={`tx-item-${t.id}`}
                      onLongPress={() => handleDelete(t)}
                      delayLongPress={350}
                      style={[styles.row, i !== item.items.length - 1 && styles.rowBorder]}
                    >
                      <CategoryIcon name={t.icon as any} color={t.color} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.rowTitle}>{t.title}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {t.subtitle}
                        </Text>
                      </View>
                      <Text style={[styles.rowAmount, { color }]}>
                        {isNegative ? "-" : "+"}
                        {formatMoney(t.amount, currency)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.onSurface,
  },
  filterRow: {
    gap: 8,
    paddingVertical: 12,
    paddingRight: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 13,
    color: colors.onSurface,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  dayHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },
  rowSub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: "800",
  },
});
