import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Modal, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { radius, spacing, shadow } from "@/src/theme";
import { formatMoney } from "@/src/utils/format";
import {
  getGoals, addGoal, updateGoal, deleteGoal,
  addGoalContribution, Goal,
} from "@/src/store";
import { ConfirmModal } from "@/src/components/ConfirmModal";
import { EmptyState } from "@/src/components/CategoryIcon";
import { useCurrency } from "@/src/currency";
import { useTabBarScroll } from "@/src/context/TabBarScrollContext";
import { useTheme } from "@/src/theme/ThemeContext";

const PERIODS = ["3 months", "6 months", "1 year", "2 years", "5 years", "No deadline"];
const GOAL_TABS: { key: "active" | "paused" | "completed" | "archived"; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Done" },
  { key: "archived", label: "Archived" },
];
const PRIORITY_COLORS = {
  low: "info",
  medium: "brand",
  high: "warning",
} as const;

type ModalState =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; goal: Goal }
  | { kind: "add-funds"; goal: Goal }

function deadlineForPeriod(period: string) {
  if (period === "No deadline") return undefined;
  const date = new Date();
  if (period === "3 months") date.setMonth(date.getMonth() + 3);
  else if (period === "6 months") date.setMonth(date.getMonth() + 6);
  else if (period === "1 year") date.setFullYear(date.getFullYear() + 1);
  else if (period === "2 years") date.setFullYear(date.getFullYear() + 2);
  else if (period === "5 years") date.setFullYear(date.getFullYear() + 5);
  return date.toISOString();
}

function monthsLeft(deadline?: string) {
  if (!deadline) return 0;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 30)));
}

function monthlyNeeded(goal: Goal) {
  const remaining = Math.max(0, goal.target - goal.saved);
  if (!goal.deadline) return 0;
  return remaining / monthsLeft(goal.deadline);
}

function healthLabel(goal: Goal) {
  if (goal.status === "completed") return "Completed";
  if (goal.isArchived) return "Archived";
  if (goal.isPaused) return "Paused";
  if (!goal.deadline) return "No deadline";
  if (new Date(goal.deadline).getTime() < Date.now()) return "Overdue";
  const needed = monthlyNeeded(goal);
  const planned = goal.autoContributionAmount || 0;
  if (planned >= needed) return "On track";
  if (planned >= needed * 0.75) return "Close";
  return "Behind";
}

export default function GoalsTab() {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();
  const { onScroll } = useTabBarScroll();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tab, setTab] = useState<"active" | "paused" | "completed" | "archived">("active");
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [form, setForm] = useState({
    title: "",
    target: "",
    saved: "",
    period: "No deadline",
    priority: "medium" as "low" | "medium" | "high",
    autoContribution: "",
    autoDay: "1",
  });
  const [contribution, setContribution] = useState("");
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

  const load = useCallback(async () => { setGoals(await getGoals()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const close = () => setModal({ kind: "none" });

  const openNew = () => {
    router.push("/add-goal");
  };

  const openEdit = (g: Goal) => {
    setForm({
      title: g.title,
      target: String(g.target),
      saved: String(g.saved),
      period: g.period || "No deadline",
      priority: g.priority || "medium",
      autoContribution: g.autoContributionAmount ? String(g.autoContributionAmount) : "",
      autoDay: g.autoContributionDay ? String(g.autoContributionDay) : "1",
    });
    setModal({ kind: "edit", goal: g });
  };

  const openFunds = (g: Goal) => { setContribution(""); setModal({ kind: "add-funds", goal: g }); };

  const openDetail = (g: Goal) => {
    router.push({ pathname: "/goal-detail", params: { id: g.id, initialGoal: JSON.stringify(g) } });
  };

  const submitGoal = async () => {
    const target = Number(form.target); const saved = Number(form.saved) || 0;
    if (!form.title.trim() || !target || target <= 0) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    const status = saved >= target ? "completed" : "pending";
    const period = form.period === "No deadline" ? undefined : form.period;
    const patch = {
      title: form.title.trim(),
      target,
      saved,
      status: status as "pending" | "completed",
      period,
      deadline: deadlineForPeriod(form.period),
      priority: form.priority,
      autoContributionAmount: form.autoContribution ? Number(form.autoContribution) : 0,
      autoContributionDay: form.autoContribution ? Math.min(31, Math.max(1, Number(form.autoDay) || 1)) : 0,
    };
    if (modal.kind === "edit") await updateGoal(modal.goal.id, patch);
    else await addGoal(patch);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); close(); load();
  };

  const submitFunds = async () => {
    if (modal.kind !== "add-funds") return;
    const amt = Number(contribution);
    if (!amt || amt <= 0) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    const newSaved = modal.goal.saved + amt;
    const newStatus = newSaved >= modal.goal.target ? "completed" : "pending";
    await addGoalContribution(modal.goal.id, amt);
    await updateGoal(modal.goal.id, { saved: newSaved, status: newStatus });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); close(); load();
  };

  const removeGoal = (id: string) => {
    setDeleteGoalId(id);
  };
  
  const confirmDelete = async () => {
    if (!deleteGoalId) return;
    await deleteGoal(deleteGoalId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleteGoalId(null);
    close();
    load();
  };

  const filtered = useMemo(() => goals.filter((g) => {
    if (tab === "archived") return g.isArchived === true;
    if (tab === "paused") return g.isPaused === true && !g.isArchived;
    if (tab === "completed") return g.status === "completed" && !g.isArchived;
    return g.status === "pending" && !g.isPaused && !g.isArchived;
  }), [goals, tab]);
  const totals = useMemo(() => ({ target: filtered.reduce((s, g) => s + g.target, 0), saved: filtered.reduce((s, g) => s + g.saved, 0), count: filtered.length }), [filtered]);

  const preview = useMemo(() => {
    if (modal.kind !== "add-funds") return null;
    const amt = Number(contribution) || 0;
    const n = modal.goal.saved + amt;
    return { newSaved: n, pct: Math.min(100, (n / modal.goal.target) * 100) };
  }, [contribution, modal]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[s.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.title}>Goals</Text>
            <Text style={s.subtitle}>Track your savings</Text>
          </View>
          <Pressable onPress={openNew} style={s.addBtn}><Ionicons name="add" size={16} color={colors.brand} /><Text style={s.addBtnText}>New</Text></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 0, paddingBottom: 140 }} showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>

        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>{tab === "active" ? "SAVINGS PROGRESS" : tab.toUpperCase()}</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={s.summaryAmt}>{formatMoney(totals.saved, currency)}</Text>
            <Text style={s.summaryOf}>of {formatMoney(totals.target, currency)}</Text>
          </View>
          <Bar v={totals.saved} m={totals.target || 1} large onDark colors={colors} />
          <Text style={s.summaryHint}>{totals.count === 0 ? (tab === "active" ? "Tap + New to start" : `No ${tab} goals`) : `${totals.count} ${tab} goal${totals.count > 1 ? "s" : ""}`}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {GOAL_TABS.map((item) => (
            <Pressable key={item.key} style={[s.filterChip, tab === item.key && s.filterChipActive]} onPress={() => { Haptics.selectionAsync(); setTab(item.key); }}>
              <Text style={[s.filterText, tab === item.key && s.filterTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState icon="flag-outline" title={`No ${tab} goals`} subtitle={tab === "active" ? "Create a savings target" : "They will appear here"} />
        ) : (
          <View style={{ marginHorizontal: spacing.lg, gap: 8 }}>
            {filtered.map((g) => {
              const done = g.status === "completed";
              const priority = g.priority || "medium";
              const priorityColor = colors[PRIORITY_COLORS[priority] as keyof typeof colors] as string;
              const needed = monthlyNeeded(g);
              const health = healthLabel(g);
              return (
                <Pressable key={g.id} onPress={() => openDetail(g)} onLongPress={() => removeGoal(g.id)} style={s.card}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[s.icon, done && { backgroundColor: colors.success + "18" }]}><Ionicons name={done ? "checkmark-circle" : "flag"} size={18} color={done ? colors.success : colors.brand} /></View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.cardTitle} numberOfLines={1}>{g.title}</Text>
                      <Text style={s.cardMeta}>{formatMoney(g.saved, currency)} <Text style={{ color: colors.muted }}>/ {formatMoney(g.target, currency)}</Text>{g.period ? <Text style={{ color: colors.muted }}> · {g.period}</Text> : null}</Text>
                    </View>
                    {!done && !g.isPaused && !g.isArchived && <Pressable onPress={() => openFunds(g)} style={s.inlineBtn}><Ionicons name="add" size={14} color="#fff" /></Pressable>}
                    {!g.isArchived && <Pressable onPress={() => openEdit(g)} style={s.inlineEdit}><Ionicons name="create-outline" size={14} color={colors.brand} /></Pressable>}
                  </View>
                  <Bar v={g.saved} m={g.target} color={done ? colors.success : undefined} colors={colors} />
                  <View style={s.cardFoot}>
                    <View style={[s.priorityBadge, { backgroundColor: priorityColor + "18" }]}>
                      <Text style={[s.priorityText, { color: priorityColor }]}>{priority}</Text>
                    </View>
                    <Text style={s.healthText}>{health}</Text>
                    {needed > 0 && <Text style={s.needText}>{formatMoney(needed, currency)}/mo needed</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ─── Modals ─── */}
      <Modal transparent visible={modal.kind !== "none"} animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <BlurView 
            intensity={45} 
            tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} 
            blurReductionFactor={2}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          >
            <Pressable style={{ flex: 1 }} onPress={close} />
          </BlurView>
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.handle} />

            {/* ── Add Funds ── */}
            {modal.kind === "add-funds" && (<>
              <View style={s.sheetHeader}><Text style={s.sheetTitle}>Add funds</Text><Pressable onPress={close} style={s.closeBtn}><Ionicons name="close" size={20} color={colors.onSurface} /></Pressable></View>
              <Text style={s.sheetSub}>{modal.goal.title}</Text>
              <View style={s.previewCard}>
                <View style={{ flex: 1 }}><Text style={s.previewLabel}>CURRENT</Text><Text style={s.previewVal}>{formatMoney(modal.goal.saved, currency)}</Text></View>
                <Ionicons name="arrow-forward" size={14} color={colors.brand} />
                <View style={{ flex: 1, alignItems: "flex-end" }}><Text style={s.previewLabel}>AFTER</Text><Text style={[s.previewVal, { color: colors.brand }]}>{formatMoney(preview?.newSaved || modal.goal.saved, currency)}</Text></View>
              </View>
              <Text style={s.formLabel}>Amount ({currency.symbol})</Text>
              <TextInput value={contribution} onChangeText={(v) => setContribution(v.replace(/[^0-9]/g, ""))} placeholder="5000" placeholderTextColor={colors.muted} keyboardType="numeric" style={s.input} autoFocus />
              <View style={s.quickRow}>{[500, 1000, 5000, 10000].map((n) => (<Pressable key={n} onPress={() => { Haptics.selectionAsync(); setContribution(String(n)); }} style={s.quickChip}><Text style={s.quickText}>+{formatMoney(n, currency)}</Text></Pressable>))}</View>
              {preview && <View style={{ marginTop: 12 }}><Bar v={preview.newSaved} m={modal.goal.target} colors={colors} /><Text style={s.hint}>{preview.pct >= 100 ? "Goal will be completed" : `${preview.pct.toFixed(0)}% after this`}</Text></View>}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <Pressable style={[s.btn, s.btnG]} onPress={close}><Text style={s.btnGT}>Cancel</Text></Pressable>
                <Pressable style={[s.btn, s.btnP, { opacity: !contribution ? 0.5 : 1 }]} onPress={submitFunds} disabled={!contribution}><Text style={s.btnPT}>Add contribution</Text></Pressable>
              </View>
            </>)}

            {/* ── New / Edit ── */}
            {(modal.kind === "new" || modal.kind === "edit") && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={s.sheetHeader}><Text style={s.sheetTitle}>{modal.kind === "edit" ? "Edit goal" : "New goal"}</Text><Pressable onPress={close} style={s.closeBtn}><Ionicons name="close" size={20} color={colors.onSurface} /></Pressable></View>
                {modal.kind === "new" && (<><Text style={s.formLabel}>Goal name</Text><TextInput value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} placeholder="Emergency fund" placeholderTextColor={colors.muted} style={s.input} /></>)}
                <View style={{ flexDirection: "row", gap: 10, marginTop: modal.kind === "new" ? 10 : 0 }}>
                  <View style={{ flex: 1 }}><Text style={s.formLabel}>Target ({currency.symbol})</Text><TextInput value={form.target} onChangeText={(v) => setForm({ ...form, target: v.replace(/[^0-9]/g, "") })} placeholder="100000" placeholderTextColor={colors.muted} keyboardType="numeric" style={s.input} /></View>
                  {modal.kind === "new" && <View style={{ flex: 1 }}><Text style={s.formLabel}>Saved ({currency.symbol})</Text><TextInput value={form.saved} onChangeText={(v) => setForm({ ...form, saved: v.replace(/[^0-9]/g, "") })} placeholder="0" placeholderTextColor={colors.muted} keyboardType="numeric" style={s.input} /></View>}
                </View>
                <Text style={[s.formLabel, { marginTop: 14 }]}>Period</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{PERIODS.map((p) => (<Pressable key={p} onPress={() => setForm({ ...form, period: p })} style={[s.pChip, form.period === p && s.pChipAct]}><Text style={[s.pText, form.period === p && s.pTextAct]}>{p}</Text></Pressable>))}</ScrollView>
                <Text style={[s.formLabel, { marginTop: 14 }]}>Priority</Text>
                <View style={s.priorityRow}>
                  {(["low", "medium", "high"] as const).map((p) => (
                    <Pressable key={p} onPress={() => setForm({ ...form, priority: p })} style={[s.pChip, form.priority === p && s.pChipAct]}>
                      <Text style={[s.pText, form.priority === p && s.pTextAct]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.formLabel}>Monthly plan</Text>
                    <TextInput value={form.autoContribution} onChangeText={(v) => setForm({ ...form, autoContribution: v.replace(/[^0-9]/g, "") })} placeholder="0" placeholderTextColor={colors.muted} keyboardType="numeric" style={s.input} />
                  </View>
                  <View style={{ width: 84 }}>
                    <Text style={s.formLabel}>Day</Text>
                    <TextInput value={form.autoDay} onChangeText={(v) => setForm({ ...form, autoDay: v.replace(/[^0-9]/g, "").slice(0, 2) })} placeholder="1" placeholderTextColor={colors.muted} keyboardType="numeric" style={s.input} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <Pressable style={[s.btn, s.btnG]} onPress={close}><Text style={s.btnGT}>Cancel</Text></Pressable>
                  <Pressable style={[s.btn, s.btnP]} onPress={submitGoal}><Text style={s.btnPT}>{modal.kind === "edit" ? "Save" : "Create goal"}</Text></Pressable>
                </View>
              </ScrollView>
            )}
            <View style={{ height: insets.bottom + 8 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmModal 
        visible={!!deleteGoalId}
        title="Delete goal?"
        subtitle={`Are you sure you want to delete "${goals.find(g => g.id === deleteGoalId)?.title || "this goal"}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
        onCancel={() => setDeleteGoalId(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

function Bar({ v, m, color, large = false, onDark = false, colors }: { v: number; m: number; color?: string; large?: boolean; onDark?: boolean; colors: any }) {
  const p = Math.min(100, (v / m) * 100);
  return (<View style={{ height: large ? 10 : 6, backgroundColor: onDark ? "rgba(255,255,255,0.18)" : colors.surfaceTertiary, borderRadius: 999, overflow: "hidden", marginTop: 6 }}><View style={{ width: `${p}%`, height: "100%", backgroundColor: onDark ? "#B7E4C7" : (color || colors.brandPrimary), borderRadius: 999 }} /></View>);
}

const createStyles = (colors: any) => StyleSheet.create({
  headerWrap: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  addBtnText: { fontSize: 12, color: colors.brand, fontWeight: "700" },
  summaryCard: { marginHorizontal: spacing.lg, padding: 16, backgroundColor: colors.brand, borderRadius: radius.lg, ...shadow.card },
  summaryLabel: { fontSize: 10, color: "rgba(255,255,255,0.65)", letterSpacing: 0.6, fontWeight: "700" },
  summaryAmt: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  summaryOf: { fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 4 },
  summaryHint: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 8 },
  seg: { flexDirection: "row", marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md, padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center" },
  segAct: { backgroundColor: colors.surfaceSecondary, ...shadow.card },
  segText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segActText: { color: colors.onSurface, fontWeight: "800" },
  filterRow: { gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  filterChip: { minWidth: 86, paddingHorizontal: 14, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.surfaceSecondary, borderColor: colors.brand, ...shadow.card },
  filterText: { fontSize: 12, color: colors.muted, fontWeight: "700" },
  filterTextActive: { color: colors.brand, fontWeight: "800" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  cardMeta: { fontSize: 11, color: colors.onSurface, marginTop: 1, fontWeight: "600" },
  inlineBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginRight: 6 },
  inlineEdit: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  cardFoot: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  priorityText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  healthText: { fontSize: 11, color: colors.onSurface, fontWeight: "800" },
  needText: { fontSize: 11, color: colors.muted, fontWeight: "700" },
  sheet: { backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, ...shadow.card, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 12 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sheetSub: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  detailSummary: { flexDirection: "row", padding: 14, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, marginTop: 8 },
  detailLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 0.4 },
  detailValue: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyAmt: { fontSize: 14, fontWeight: "700", color: colors.success },
  historyDate: { fontSize: 11, color: colors.muted, marginTop: 1 },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, marginTop: 12, borderRadius: radius.md, backgroundColor: colors.error + "08" },
  previewCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: colors.brandTertiary, borderRadius: radius.md, marginTop: 8, marginBottom: 12 },
  previewLabel: { fontSize: 10, color: colors.brand, fontWeight: "700", letterSpacing: 0.4 },
  previewVal: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  formLabel: { fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  pChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary },
  pChipAct: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  pText: { fontSize: 12, color: colors.onSurface, fontWeight: "600" },
  pTextAct: { color: colors.brand, fontWeight: "700" },
  priorityRow: { flexDirection: "row", gap: 8 },
  quickRow: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  quickChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  quickText: { fontSize: 11, color: colors.brand, fontWeight: "700" },
  hint: { fontSize: 11, color: colors.muted, marginTop: 6, fontWeight: "600" },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  btnG: { backgroundColor: colors.surfaceTertiary },
  btnGT: { color: colors.onSurface, fontWeight: "700" },
  btnP: { backgroundColor: colors.brand },
  btnPT: { color: "#fff", fontWeight: "800" },
});
