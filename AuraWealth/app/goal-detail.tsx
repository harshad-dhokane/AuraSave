import React, { useEffect, useState , useMemo} from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Modal, TextInput } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { radius, spacing } from "@/src/theme";
import { formatMoney, formatDate } from "@/src/utils/format";
import { getGoals, getGoalContributions, Goal, GoalContribution, addGoalContribution, updateGoal, deleteGoal, deleteGoalContribution, updateGoalContribution } from "@/src/store";
import { useCurrency } from "@/src/currency";
import { EmptyState } from "@/src/components/CategoryIcon";
import { ConfirmModal } from "@/src/components/ConfirmModal";
import { ActionModal } from "@/src/components/ActionModal";
import { useTheme } from "@/src/theme/ThemeContext";

function monthsLeft(deadline?: string) {
  if (!deadline) return 0;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 30)));
}

function monthlyNeeded(goal: Goal) {
  if (!goal.deadline) return 0;
  return Math.max(0, goal.target - goal.saved) / monthsLeft(goal.deadline);
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

export default function GoalDetailScreen() {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { id, initialGoal } = useLocalSearchParams<{ id: string; initialGoal?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();

  const [goal, setGoal] = useState<Goal | null>(initialGoal ? JSON.parse(initialGoal as string) : null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  
  // Add funds modal state
  const [showAdd, setShowAdd] = useState(false);
  const [contributionAmt, setContributionAmt] = useState("");
  const [actionContrib, setActionContrib] = useState<GoalContribution | null>(null);
  const [deleteContrib, setDeleteContrib] = useState<GoalContribution | null>(null);
  const [editContribId, setEditContribId] = useState<string | null>(null);
  const [editContribAmt, setEditContribAmt] = useState("");
  const [showDeleteGoal, setShowDeleteGoal] = useState(false);
  const blurTint = isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight";

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    const goals = await getGoals();
    const g = goals.find(x => x.id === id);
    if (g) {
      setGoal(g);
      const c = await getGoalContributions(id);
      setContributions(c);
    }
  };

  const removeGoal = () => {
    if (!goal) return;
    setShowDeleteGoal(true);
  };

  const confirmDeleteGoal = async () => {
    if (!goal) return;
    await deleteGoal(goal.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setShowDeleteGoal(false);
    router.back();
  };

  const confirmDeleteContrib = async () => {
    if (!deleteContrib || !goal) return;
    await deleteGoalContribution(deleteContrib.id, goal.id, deleteContrib.amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDeleteContrib(null);
    load();
  };

  const submitFunds = async () => {
    if (!goal) return;
    if (goal.isPaused || goal.isArchived) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const amt = Number(contributionAmt);
    if (!amt || amt <= 0) { 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); 
      return; 
    }
    const newSaved = goal.saved + amt;
    const newStatus = newSaved >= goal.target ? "completed" : "pending";
    await addGoalContribution(goal.id, amt);
    await updateGoal(goal.id, { saved: newSaved, status: newStatus });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
    setShowAdd(false);
    setContributionAmt("");
    load();
  };

  const submitEditContrib = async () => {
    if (!editContribId || !goal) return;
    const oldContrib = contributions.find(c => c.id === editContribId);
    if (!oldContrib) return;
    const newAmt = Number(editContribAmt);
    if (!newAmt || newAmt <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await updateGoalContribution(editContribId, goal.id, oldContrib.amount, newAmt);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditContribId(null);
    setEditContribAmt("");
    load();
  };

  const togglePaused = async () => {
    if (!goal || goal.status === "completed") return;
    await updateGoal(goal.id, { isPaused: !goal.isPaused });
    Haptics.selectionAsync();
    load();
  };

  const toggleArchived = async () => {
    if (!goal) return;
    await updateGoal(goal.id, { isArchived: !goal.isArchived, isPaused: false });
    Haptics.selectionAsync();
    load();
  };

  if (!goal) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const p = Math.min(100, (goal.saved / goal.target) * 100);
  const done = goal.status === "completed";
  const needed = monthlyNeeded(goal);
  const health = healthLabel(goal);
  const priorityColor = goal.priority === "high" ? colors.warning : goal.priority === "low" ? colors.info : colors.brand;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen 
        options={{ 
          headerShown: false
        }} 
      />

      {/* Header */}
      <View style={[s.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={s.title} numberOfLines={1}>{goal.title}</Text>
        {!done && !goal.isPaused && !goal.isArchived ? (
          <Pressable onPress={() => setShowAdd(true)} hitSlop={10} style={{ padding: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 12 }}>
            <Ionicons name="add" size={20} color={colors.onSurface} />
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100 }}>
        {/* Progress Card */}
        <View style={s.progressCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
            <View>
              <Text style={s.cardLabel}>SAVED</Text>
              <Text style={s.cardVal}>{formatMoney(goal.saved, currency)}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.cardLabel}>TARGET</Text>
              <Text style={s.cardValSub}>{formatMoney(goal.target, currency)}</Text>
            </View>
          </View>
          
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${p}%`, backgroundColor: done ? colors.success : colors.brand }]} />
          </View>
          
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={[s.pctText, { color: done ? colors.success : colors.brand }]}>{p.toFixed(1)}%</Text>
            <Text style={s.periodText}>{goal.period || "No deadline"}</Text>
          </View>
        </View>

        <View style={s.metricGrid}>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>HEALTH</Text>
            <Text style={[s.metricValue, { color: health === "Behind" || health === "Overdue" ? colors.error : health === "Close" ? colors.warning : colors.onSurface }]}>{health}</Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>NEEDED</Text>
            <Text style={s.metricValue}>{needed > 0 ? `${formatMoney(needed, currency)}/mo` : "Not set"}</Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>AUTO PLAN</Text>
            <Text style={s.metricValue}>{goal.autoContributionAmount ? `${formatMoney(goal.autoContributionAmount, currency)} on ${goal.autoContributionDay || 1}` : "Off"}</Text>
          </View>
          <View style={s.metricBox}>
            <Text style={s.metricLabel}>PRIORITY</Text>
            <Text style={[s.metricValue, { color: priorityColor }]}>{goal.priority || "medium"}</Text>
          </View>
        </View>

        {goal.deadline && (
          <View style={s.deadlineCard}>
            <Ionicons name="calendar-outline" size={16} color={colors.brand} />
            <Text style={s.deadlineText}>Deadline {formatDate(goal.deadline)} · {monthsLeft(goal.deadline)} month{monthsLeft(goal.deadline) > 1 ? "s" : ""} left</Text>
          </View>
        )}

        {!done && (
          <View style={s.actionRow}>
            <Pressable onPress={togglePaused} style={s.secondaryAction}>
              <Ionicons name={goal.isPaused ? "play-outline" : "pause-outline"} size={16} color={colors.onSurface} />
              <Text style={s.secondaryActionText}>{goal.isPaused ? "Resume" : "Pause"}</Text>
            </Pressable>
            <Pressable onPress={toggleArchived} style={s.secondaryAction}>
              <Ionicons name={goal.isArchived ? "archive-outline" : "file-tray-full-outline"} size={16} color={colors.onSurface} />
              <Text style={s.secondaryActionText}>{goal.isArchived ? "Restore" : "Archive"}</Text>
            </Pressable>
          </View>
        )}

        <Text style={s.sectionTitle}>Contribution History</Text>
        <View style={s.listCard}>
          {contributions.length === 0 ? (
            <View style={{ padding: 20 }}>
              <EmptyState icon="time-outline" title="No contributions" subtitle="Add funds to see history" />
            </View>
          ) : (
            contributions.map((c, i) => (
              <Pressable 
                key={c.id} 
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setActionContrib(c); }}
                delayLongPress={350}
                style={[s.historyRow, i === contributions.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={s.historyIcon}>
                  <Ionicons name="arrow-up" size={14} color={colors.brand} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.historyTitle}>Contribution</Text>
                  <Text style={s.historyDate}>{formatDate(c.createdAt)}</Text>
                </View>
                <Text style={s.historyAmt}>+{formatMoney(c.amount, currency)}</Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable onPress={removeGoal} style={s.deleteRow}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <Text style={{ fontSize: 13, color: colors.error, fontWeight: "700", marginLeft: 6 }}>Delete goal</Text>
        </Pressable>
      </ScrollView>

      {/* Add Funds Modal */}
      <Modal visible={showAdd} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <BlurView intensity={45} tint={blurTint} blurReductionFactor={2} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill}><Pressable style={{ flex: 1 }} onPress={() => setShowAdd(false)} /></BlurView>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface, marginBottom: 16 }}>Add Funds</Text>
            <Text style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", fontWeight: "700", marginBottom: 6 }}>Amount ({currency.symbol})</Text>
            <TextInput 
              value={contributionAmt} 
              onChangeText={(v) => setContributionAmt(v.replace(/[^0-9]/g, ""))} 
              placeholder="5000" 
              placeholderTextColor={colors.muted} 
              keyboardType="numeric" 
              style={s.input} 
              autoFocus 
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <Pressable style={[s.btn, s.btnG]} onPress={() => setShowAdd(false)}><Text style={s.btnGT}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.btnP, { opacity: !contributionAmt ? 0.5 : 1 }]} onPress={submitFunds} disabled={!contributionAmt}><Text style={s.btnPT}>Add</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Contribution Modal */}
      <Modal visible={!!editContribId} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <BlurView intensity={45} tint={blurTint} blurReductionFactor={2} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill}><Pressable style={{ flex: 1 }} onPress={() => setEditContribId(null)} /></BlurView>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface, marginBottom: 16 }}>Edit Contribution</Text>
            <Text style={{ fontSize: 11, color: colors.muted, textTransform: "uppercase", fontWeight: "700", marginBottom: 6 }}>Amount ({currency.symbol})</Text>
            <TextInput 
              value={editContribAmt} 
              onChangeText={(v) => setEditContribAmt(v.replace(/[^0-9]/g, ""))} 
              placeholder="5000" 
              placeholderTextColor={colors.muted} 
              keyboardType="numeric" 
              style={s.input} 
              autoFocus 
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <Pressable style={[s.btn, s.btnG]} onPress={() => setEditContribId(null)}><Text style={s.btnGT}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, s.btnP, { opacity: !editContribAmt ? 0.5 : 1 }]} onPress={submitEditContrib} disabled={!editContribAmt}><Text style={s.btnPT}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ActionModal
        visible={!!actionContrib}
        title="Contribution"
        subtitle={actionContrib ? `+${formatMoney(actionContrib.amount, currency)}` : ""}
        onClose={() => setActionContrib(null)}
        actions={[
          {
            label: "Edit contribution",
            icon: "create-outline",
            color: colors.brand,
            onPress: () => {
              if (actionContrib) {
                setEditContribId(actionContrib.id);
                setEditContribAmt(String(actionContrib.amount));
                setActionContrib(null);
              }
            },
          },
          {
            label: "Remove contribution",
            icon: "trash-outline",
            isDestructive: true,
            onPress: () => {
              if (actionContrib) {
                setDeleteContrib(actionContrib);
                setActionContrib(null);
              }
            },
          },
        ]}
      />

      <ConfirmModal
        visible={showDeleteGoal}
        title="Delete goal?"
        subtitle={`Are you sure you want to delete "${goal.title}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
        onCancel={() => setShowDeleteGoal(false)}
        onConfirm={confirmDeleteGoal}
      />

      <ConfirmModal
        visible={!!deleteContrib}
        title="Remove contribution?"
        subtitle={`Remove ${deleteContrib ? formatMoney(deleteContrib.amount, currency) : ""} from "${goal.title}"? This will subtract the amount from your saved total.`}
        confirmText="Remove"
        isDestructive={true}
        onCancel={() => setDeleteContrib(null)}
        onConfirm={confirmDeleteContrib}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.onSurface, flex: 1, textAlign: "center", marginHorizontal: 12 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.onSurface, paddingHorizontal: 12, height: 32, borderRadius: 16 },
  addBtnText: { color: colors.surface, fontSize: 12, fontWeight: "700" },
  progressCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 0.6 },
  cardVal: { fontSize: 24, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  cardValSub: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  barBg: { height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 4, overflow: "hidden", marginTop: 12 },
  barFill: { height: "100%", borderRadius: 4 },
  pctText: { fontSize: 13, fontWeight: "800" },
  periodText: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  metricBox: { width: "48%", padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  metricLabel: { fontSize: 10, color: colors.muted, fontWeight: "800", letterSpacing: 0.4 },
  metricValue: { fontSize: 13, color: colors.onSurface, fontWeight: "800", marginTop: 4, textTransform: "capitalize" },
  deadlineCard: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.brandTertiary },
  deadlineText: { flex: 1, fontSize: 12, color: colors.onSurface, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  secondaryAction: { flex: 1, height: 42, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  secondaryActionText: { fontSize: 13, color: colors.onSurface, fontWeight: "800" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 32, marginBottom: 12, paddingHorizontal: 4 },
  listCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  historyIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  historyTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  historyDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  historyAmt: { fontSize: 14, fontWeight: "800", color: colors.brand },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, marginTop: 32, borderRadius: radius.md, backgroundColor: colors.error + "08" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, fontSize: 15, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  btn: { flex: 1, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  btnG: { backgroundColor: colors.surfaceTertiary },
  btnGT: { color: colors.onSurface, fontWeight: "700" },
  btnP: { backgroundColor: colors.brand },
  btnPT: { color: "#fff", fontWeight: "700" },
});
