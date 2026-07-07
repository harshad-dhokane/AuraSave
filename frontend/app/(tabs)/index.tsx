import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { colors, radius, spacing, shadow } from "@/src/theme";
import { formatDayLabel, currentMonthKey, formatMoney } from "@/src/utils/format";
import {
  getTransactions,
  getCategories,
  Transaction,
  Category,
  getProfile,
  Profile,
} from "@/src/store";
import { CategoryIcon } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";

const HERO_BG =
  "https://images.unsplash.com/photo-1629197520635-16570fbd0bb3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNzl8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGdyZWVuJTIwYWVzdGhldGljJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODI1NzM3MTl8MA&ixlib=rb-4.1.0&q=85";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [profile, setProfileState] = useState<Profile>({ name: "there" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [t, c, p] = await Promise.all([getTransactions(), getCategories(), getProfile()]);
    setTxs(t);
    setCats(c);
    setProfileState(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const monthKey = currentMonthKey();

  const monthly = useMemo(() => {
    let income = 0,
      expense = 0,
      invest = 0;
    for (const t of txs) {
      const k = t.date.slice(0, 7);
      if (k !== monthKey) continue;
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
      else invest += t.amount;
    }
    return { income, expense, invest, net: income - expense - invest };
  }, [txs, monthKey]);

  const totalBalance = useMemo(() => {
    let net = 0;
    for (const t of txs) {
      if (t.type === "income") net += t.amount;
      else if (t.type === "expense") net -= t.amount;
      else net -= t.amount; // investments leave cash
    }
    return net;
  }, [txs]);

  const totalInvested = useMemo(
    () => txs.filter((t) => t.type === "investment").reduce((s, t) => s + t.amount, 0),
    [txs],
  );

  const recent = txs.slice(0, 5);

  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    cats.forEach((c) => m.set(c.id, c));
    return m;
  }, [cats]);

  return (
    <ScrollView
      testID="home-scroll"
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Good {greetingHour()},</Text>
          <Text style={styles.name}>{profile.name === "there" ? "Welcome back" : profile.name}</Text>
        </View>
        <Pressable
          testID="header-settings-btn"
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/settings");
          }}
          style={styles.iconBtn}
        >
          <Ionicons name="settings-outline" size={20} color={colors.onSurface} />
        </Pressable>
      </View>

      {/* Hero Balance Card */}
      <View style={styles.heroWrap}>
        <Image source={HERO_BG} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        <LinearGradient
          colors={["rgba(15,17,16,0.35)", "rgba(15,17,16,0.72)", "rgba(15,17,16,0.94)"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <View style={styles.heroDot} />
            <Text style={styles.heroBadgeText}>Total Balance</Text>
          </View>
          <Text testID="home-total-balance" style={styles.heroAmount}>
            {formatMoney(totalBalance, currency)}
          </Text>
          <Text style={styles.heroSub}>as of {new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" })}</Text>

          <View style={styles.heroStatsRow}>
            <HeroStat label="Income" value={monthly.income} tint="#B7E4C7" icon="arrow-down" currencyCode={currency.code} formatter={(v) => formatMoney(v, currency, { compact: true })} />
            <View style={styles.heroDivider} />
            <HeroStat label="Spent" value={monthly.expense} tint="#F5C0BE" icon="arrow-up" currencyCode={currency.code} formatter={(v) => formatMoney(v, currency, { compact: true })} />
            <View style={styles.heroDivider} />
            <HeroStat label="Invested" value={monthly.invest} tint="#F4D9A0" icon="trending-up" currencyCode={currency.code} formatter={(v) => formatMoney(v, currency, { compact: true })} />
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        <QuickAction
          testID="qa-add-expense"
          icon="remove-circle"
          label="Expense"
          color={colors.error}
          onPress={() => router.push("/add-transaction?type=expense")}
        />
        <QuickAction
          testID="qa-add-income"
          icon="add-circle"
          label="Income"
          color={colors.success}
          onPress={() => router.push("/add-transaction?type=income")}
        />
        <QuickAction
          testID="qa-add-invest"
          icon="trending-up"
          label="Invest"
          color={colors.brandPrimary}
          onPress={() => router.push("/add-transaction?type=investment")}
        />
        <QuickAction
          testID="qa-scan-sms"
          icon="scan"
          label="Scan SMS"
          color={colors.warning}
          onPress={() => router.push("/paste-sms")}
        />
      </View>

      {/* Investments snapshot */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Portfolio</Text>
        <Pressable onPress={() => router.push("/(tabs)/analytics")}>
          <Text style={styles.sectionLink}>Analytics →</Text>
        </Pressable>
      </View>
      <View style={styles.portfolioCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.portfolioLabel}>Total Invested</Text>
          <Text style={styles.portfolioValue}>{formatMoney(totalInvested, currency)}</Text>
          <View style={styles.portfolioMeta}>
            <Ionicons name="trending-up" size={13} color={colors.success} />
            <Text style={styles.portfolioMetaText}>Consistent monthly SIPs help beat inflation.</Text>
          </View>
        </View>
        <LinearGradient
          colors={[colors.brandTertiary, "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.portfolioBadge}
        >
          <Ionicons name="pie-chart" size={22} color={colors.brand} />
        </LinearGradient>
      </View>

      {/* Recent transactions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        <Pressable onPress={() => router.push("/(tabs)/transactions")} testID="see-all-txs">
          <Text style={styles.sectionLink}>See all →</Text>
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="sparkles" size={22} color={colors.brand} />
          </View>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptySub}>Tap the + button to add your first entry</Text>
        </View>
      ) : (
        <View style={styles.txListCard}>
          {recent.map((t, i) => {
            const c = catMap.get(t.categoryId);
            const isCredit = t.type === "income";
            return (
              <View
                key={t.id}
                style={[styles.txRow, i !== recent.length - 1 && styles.txRowBorder]}
              >
                <CategoryIcon
                  name={c?.icon || "ellipsis-horizontal"}
                  color={c?.color || colors.muted}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.txTitle}>{c?.name || "Uncategorized"}</Text>
                  <Text style={styles.txSub} numberOfLines={1}>
                    {t.note || formatDayLabel(t.date)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: isCredit ? colors.success : t.type === "expense" ? colors.error : colors.brandPrimary },
                    ]}
                  >
                    {isCredit ? "+" : "-"}{formatMoney(t.amount, currency)}
                  </Text>
                  <Text style={styles.txDate}>{formatDayLabel(t.date)}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function greetingHour() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function HeroStat({
  label,
  value,
  tint,
  icon,
  currencyCode: _cc,
  formatter,
}: {
  label: string;
  value: number;
  tint: string;
  icon: keyof typeof Ionicons.glyphMap;
  currencyCode: string;
  formatter: (v: number) => string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "flex-start" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={icon} size={11} color={tint} />
        <Text style={styles.heroStatLabel}>{label}</Text>
      </View>
      <Text style={styles.heroStatValue} numberOfLines={1}>
        {formatter(value)}
      </Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.qa, pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] }]}
    >
      <View style={[styles.qaIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: 13,
    color: colors.muted,
    letterSpacing: 0.2,
  },
  name: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroWrap: {
    marginHorizontal: spacing.lg,
    height: 220,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.card,
  },
  heroContent: {
    flex: 1,
    padding: 20,
    justifyContent: "space-between",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#B7E4C7",
  },
  heroBadgeText: {
    color: "#F0F1EF",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroAmount: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: -12,
  },
  heroSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: -6,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 8,
  },
  quickRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: 10,
  },
  qa: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    gap: 6,
  },
  qaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  qaLabel: {
    fontSize: 12,
    color: colors.onSurface,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.2,
  },
  sectionLink: {
    fontSize: 13,
    color: colors.brandPrimary,
    fontWeight: "600",
  },
  portfolioCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  portfolioLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  portfolioValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  portfolioMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingRight: 20,
  },
  portfolioMetaText: {
    fontSize: 11,
    color: colors.muted,
    flex: 1,
  },
  portfolioBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  txListCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  txRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
  },
  txSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "800",
  },
  txDate: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
    alignItems: "center",
    padding: 32,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },
  emptySub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
});
