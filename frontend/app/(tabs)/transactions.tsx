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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatINR, formatDayLabel } from "@/src/utils/format";
import {
  getTransactions,
  getCategories,
  deleteTransaction,
  Transaction,
  Category,
  TxType,
} from "@/src/store";
import { CategoryIcon, EmptyState } from "@/src/components/CategoryIcon";

const FILTERS: { key: TxType | "all"; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All", icon: "layers-outline" },
  { key: "expense", label: "Expenses", icon: "arrow-up-circle-outline" },
  { key: "income", label: "Income", icon: "arrow-down-circle-outline" },
  { key: "investment", label: "Invest", icon: "trending-up-outline" },
];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [filter, setFilter] = useState<TxType | "all">("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([getTransactions(), getCategories()]);
    setTxs(t);
    setCats(c);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (q.trim()) {
        const query = q.toLowerCase();
        const c = catMap.get(t.categoryId);
        if (
          !c?.name.toLowerCase().includes(query) &&
          !(t.note || "").toLowerCase().includes(query)
        )
          return false;
      }
      return true;
    });
  }, [txs, filter, q, catMap]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: Transaction[] }[] = [];
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const key = formatDayLabel(t.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const [label, items] of map.entries()) groups.push({ label, items });
    return groups;
  }, [filtered]);

  const handleDelete = (id: string) => {
    Alert.alert("Delete transaction?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTransaction(id);
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
            <Text style={styles.subtitle}>{filtered.length} entries · {formatINR(filtered.reduce((s, t) => s + (t.type === "expense" || t.type === "investment" ? -t.amount : t.amount), 0))}</Text>
          </View>
          <Pressable
            testID="tx-add-btn"
            onPress={() => router.push("/add-transaction")}
            style={styles.headerBtn}
          >
            <Ionicons name="add" size={22} color={colors.brand} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.search}>
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

        {/* Filter chips (single-line horizontal scroll) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={{ marginTop: 4 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(f.key);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Ionicons name={f.icon} size={14} color={active ? "#fff" : colors.onSurface} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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
          renderItem={({ item }) => (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.dayHeader}>{item.label}</Text>
              <View style={styles.card}>
                {item.items.map((t, i) => {
                  const c = catMap.get(t.categoryId);
                  const isCredit = t.type === "income";
                  const color = isCredit
                    ? colors.success
                    : t.type === "expense"
                    ? colors.error
                    : colors.brandPrimary;
                  return (
                    <Pressable
                      key={t.id}
                      testID={`tx-item-${t.id}`}
                      onLongPress={() => handleDelete(t.id)}
                      delayLongPress={350}
                      style={[styles.row, i !== item.items.length - 1 && styles.rowBorder]}
                    >
                      <CategoryIcon name={c?.icon || "ellipsis-horizontal"} color={c?.color || colors.muted} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.rowTitle}>{c?.name || "Uncategorized"}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {t.note || t.type}
                        </Text>
                      </View>
                      <Text style={[styles.rowAmount, { color }]}>
                        {isCredit ? "+" : "-"}
                        {formatINR(t.amount)}
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

const styles = StyleSheet.create({
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
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
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
  },
  rowSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: "800",
  },
});
