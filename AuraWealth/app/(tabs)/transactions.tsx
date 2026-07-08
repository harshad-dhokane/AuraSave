import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { radius, spacing, shadow } from "@/src/theme";
import { formatDayLabel, formatMoney } from "@/src/utils/format";
import { ConfirmModal } from "@/src/components/ConfirmModal";
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
  const [filterDropdownTop, setFilterDropdownTop] = useState(0);
  const [conts, setConts] = useState<GoalContribution[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [q, setQ] = useState("");
  const [deleteItem, setDeleteItem] = useState<UnifiedRecord | null>(null);
  const [infoItem, setInfoItem] = useState<UnifiedRecord | null>(null);

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
      setInfoItem(item);
      return;
    }
    setDeleteItem(item);
  };
  
  const confirmDelete = async () => {
    if (!deleteItem) return;
    await deleteTransaction(deleteItem.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleteItem(null);
    load();
  };

  const toggleFilter = (key: string) => {
    Haptics.selectionAsync();
    if (key === "all") {
      setFilters(new Set());
      return;
    }

    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
        <View
          style={styles.searchRow}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;
            setFilterDropdownTop(y + height + 8);
          }}
        >
          <View style={[styles.search, { flex: 1 }]}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              testID="tx-search-input"
              value={q}
              onChangeText={setQ}
              placeholder="Search category or note"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              onFocus={() => setShowFilters(false)}
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <Pressable 
            onPress={() => {
              Haptics.selectionAsync();
              setShowFilters((visible) => !visible);
            }}
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          >
            <Ionicons name="filter" size={20} color={filters.size > 0 ? colors.brand : colors.onSurface} />
            {filters.size > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{filters.size}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {showFilters && (
          <View style={[styles.filterDropdown, { top: filterDropdownTop || 50 }]}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Filter by type</Text>
              {filters.size > 0 && (
                <Pressable onPress={() => toggleFilter("all")} hitSlop={8}>
                  <Text style={styles.dropdownClear}>Clear</Text>
                </Pressable>
              )}
            </View>

            {FILTERS.map((f, index) => {
              const isActive = f.key === "all" ? filters.size === 0 : filters.has(f.key);
              return (
                <Pressable 
                  key={f.key}
                  onPress={() => toggleFilter(f.key)}
                  style={[
                    styles.dropdownItem,
                    index !== FILTERS.length - 1 && styles.dropdownItemBorder,
                    isActive && styles.dropdownItemActive,
                  ]}
                >
                  <View style={styles.dropdownItemLeft}>
                    <View style={[styles.dropdownIcon, isActive && styles.dropdownIconActive]}>
                      <Ionicons name={f.icon as any} size={18} color={isActive ? colors.brand : colors.muted} />
                    </View>
                    <Text style={[styles.dropdownItemText, isActive && styles.dropdownItemTextActive]}>{f.label}</Text>
                  </View>
                  <Ionicons name={isActive ? "checkmark-circle" : "ellipse-outline"} size={20} color={isActive ? colors.brand : colors.muted} />
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setShowFilters(false)}
              style={styles.dropdownDone}
            >
              <Text style={styles.dropdownDoneText}>Done</Text>
            </Pressable>
          </View>
        )}

      </View>

      {showFilters && <Pressable style={styles.dropdownDismissLayer} onPress={() => setShowFilters(false)} />}

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
          onScrollBeginDrag={() => setShowFilters(false)}
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

      {showFilters && <Pressable style={styles.dropdownDismissLayer} onPress={() => setShowFilters(false)} />}
      
      <ConfirmModal 
        visible={!!deleteItem}
        title="Delete transaction?"
        subtitle={`Are you sure you want to delete "${(deleteItem?.subtitle && deleteItem.subtitle !== "Transaction" ? deleteItem.subtitle : deleteItem?.title) || "this transaction"}"? This cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
        onCancel={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
      />
      
      <ConfirmModal 
        visible={!!infoItem}
        title="Cannot delete from Ledger"
        subtitle="Please go to the Goals or Lending page to manage this record to ensure balances are properly calculated."
        confirmText="OK"
        onCancel={() => setInfoItem(null)}
        onConfirm={() => setInfoItem(null)}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: 4,
    position: "relative",
    zIndex: 3,
    elevation: 3,
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 0,
    gap: 12,
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
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTertiary,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.brand,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  filterBadgeText: {
    color: colors.onBrandPrimary,
    fontSize: 9,
    fontWeight: "800",
  },
  filterDropdown: {
    position: "absolute",
    right: spacing.lg,
    width: 200,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 5,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.onSurface,
  },
  dropdownClear: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
  dropdownItem: {
    minHeight: 42,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownItemActive: {
    backgroundColor: colors.brandTertiary,
  },
  dropdownItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  dropdownItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dropdownIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownIconActive: {
    backgroundColor: colors.surfaceSecondary,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.muted,
  },
  dropdownItemTextActive: {
    color: colors.onSurface,
  },
  dropdownDone: {
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  dropdownDoneText: {
    color: colors.onBrandPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  dropdownDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
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
