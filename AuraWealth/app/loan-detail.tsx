import React, { useEffect, useState , useMemo} from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Share } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { radius, spacing } from "@/src/theme";
import { formatMoney, formatDate } from "@/src/utils/format";
import { getLoans, getLoanPayments, Loan, LoanPayment, addLoanPayment, updateLoan, deleteLoan, addTransaction, getCategories, addCategory } from "@/src/store";
import { useCurrency } from "@/src/currency";
import { useTheme } from "@/src/theme/ThemeContext";

function totalDue(loan: Loan) {
  return loan.amount + loan.amount * ((loan.interestRate || 0) / 100);
}

function remainingDue(loan: Loan) {
  return Math.max(0, totalDue(loan) - loan.paidAmount);
}

function isOverdue(loan: Loan) {
  return loan.status !== "settled" && !!loan.dueDate && new Date(loan.dueDate).getTime() < Date.now();
}

export default function LoanDetailScreen() {
  const { colors, isDark } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { id, initialLoan } = useLocalSearchParams<{ id: string; initialLoan?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();

  const [loan, setLoan] = useState<Loan | null>(initialLoan ? JSON.parse(initialLoan as string) : null);
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  
  // Repay modal state
  const [repayModalVisible, setRepayModalVisible] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");
  const [repayNote, setRepayNote] = useState("");
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [proofNote, setProofNote] = useState(loan?.proofNote || "");
  const blurTint = isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight";

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    const loans = await getLoans();
    setAllLoans(loans);
    const l = loans.find(x => x.id === id);
    if (l) {
      setLoan(l);
      setProofNote(l.proofNote || "");
      const p = await getLoanPayments(id);
      setPayments(p);
    }
  };

  const removeLoan = () => {
    if (!loan) return;
    Alert.alert("Delete record?", "This removes the loan and all its repayment history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { 
        await deleteLoan(loan.id); 
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); 
        router.back(); 
      } },
    ]);
  };

  const openRepay = () => {
    setRepayAmount("");
    setRepayNote("");
    setRepayModalVisible(true);
  };

  const closeRepay = () => setRepayModalVisible(false);

  const submitRepay = async () => {
    if (!loan) return;
    const amt = Number(repayAmount);
    if (!amt || amt <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const due = totalDue(loan);
    const newPaid = Math.min(due, loan.paidAmount + amt);
    const status = newPaid >= due ? "settled" : "active";
    
    await addLoanPayment(loan.id, amt, new Date().toISOString(), repayNote.trim() || undefined);
    await updateLoan(loan.id, { paidAmount: newPaid, status, settledAt: status === "settled" ? new Date().toISOString() : undefined });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeRepay();
    load();
  };

  const markAsComplete = () => {
    if (!loan) return;
    const remaining = remainingDue(loan);
    if (remaining <= 0) return;

    Alert.alert(
      "Mark as complete?",
      `This will record a final payment of ${formatMoney(remaining, currency)} and settle the record.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", style: "default", onPress: async () => {
            await addLoanPayment(loan.id, remaining, new Date().toISOString());
            await updateLoan(loan.id, { paidAmount: totalDue(loan), status: "settled", settledAt: new Date().toISOString() });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            load();
          }
        },
      ]
    );
  };

  const sendReminder = async () => {
    if (!loan) return;
    const rem = remainingDue(loan);
    const direction = loan.type === "lent" ? "you owe me" : "I owe you";
    await Share.share({
      message: `Hi ${loan.person}, reminder: ${direction} ${formatMoney(rem, currency)}${loan.dueDate ? ` due on ${formatDate(loan.dueDate)}` : ""}.`,
    });
    await updateLoan(loan.id, { reminderAt: new Date().toISOString() });
    load();
  };

  const saveProof = async () => {
    if (!loan) return;
    await updateLoan(loan.id, { proofNote: proofNote.trim() || undefined });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProofModalVisible(false);
    load();
  };

  const convertToGift = () => {
    if (!loan) return;
    const rem = remainingDue(loan);
    Alert.alert(
      "Convert to gift?",
      "This will settle the record and create a matching transaction for the outstanding amount.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Convert",
          style: "default",
          onPress: async () => {
            const cats = await getCategories();
            const targetType = loan.type === "lent" ? "expense" : "income";
            const giftCat = cats.find(c => c.type === targetType && /gift|charity|donation/i.test(c.name));
            let categoryId = "";
            if (giftCat) {
              categoryId = giftCat.id;
            } else {
              const created = await addCategory({
                name: "Gift",
                icon: "gift",
                color: "#E8A0BF",
                type: targetType,
              });
              categoryId = created.id;
            }
            if (rem > 0) {
              await addTransaction({
                amount: rem,
                type: targetType,
                categoryId,
                date: new Date().toISOString(),
                note: `${loan.type === "lent" ? "Gift to" : "Gift from"} ${loan.person}`,
              });
            }
            await updateLoan(loan.id, { paidAmount: totalDue(loan), status: "settled", repaymentExpected: false, settledAt: new Date().toISOString() });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            load();
          },
        },
      ]
    );
  };

  const personSummary = useMemo(() => {
    if (!loan) return null;
    return allLoans.reduce(
      (acc, item) => {
        if (item.person !== loan.person) return acc;
        if (item.type === "lent") acc.lent += remainingDue(item);
        else acc.borrowed += remainingDue(item);
        if (item.status !== "settled") acc.active += 1;
        return acc;
      },
      { lent: 0, borrowed: 0, active: 0 }
    );
  }, [allLoans, loan]);

  if (!loan) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const isSettled = loan.status === "settled";
  const due = totalDue(loan);
  const pct = Math.min(100, (loan.paidAmount / due) * 100);
  const rem = remainingDue(loan);
  const overdue = isOverdue(loan);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen 
        options={{ 
          headerShown: false
        }} 
      />

      {/* Header */}
      <View style={[s.headerWrap, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={s.title} numberOfLines={1}>{loan.person}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 100, paddingHorizontal: spacing.lg }}>
        <View style={s.detailSummary}>
          <View style={{ flex: 1 }}>
            <Text style={s.detailLabel}>TOTAL</Text>
            <Text style={s.detailValue}>{formatMoney(due, currency)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={s.detailLabel}>REPAID</Text>
            <Text style={s.detailValue}>{formatMoney(loan.paidAmount, currency)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={s.detailLabel}>REMAINING</Text>
            <Text style={[s.detailValue, { color: isSettled ? colors.success : (loan.type === "lent" ? colors.success : colors.error) }]}>
              {formatMoney(rem, currency)}
            </Text>
          </View>
        </View>

        <View style={{ height: 10, backgroundColor: colors.surfaceTertiary, borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: isSettled ? colors.success : colors.brand, borderRadius: 999 }} />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Date: {formatDate(loan.date)}</Text>
          {loan.dueDate && <Text style={{ fontSize: 12, color: overdue ? colors.warning : colors.muted, fontWeight: "600" }}>{overdue ? "Overdue" : "Due"}: {formatDate(loan.dueDate)}</Text>}
        </View>

        <View style={s.metaRow}>
          {loan.interestRate ? <View style={s.metaChip}><Text style={s.metaChipText}>{loan.interestRate}% interest</Text></View> : null}
          {loan.groupName ? <View style={s.metaChip}><Text style={s.metaChipText}>{loan.groupName}</Text></View> : null}
          {loan.reminderAt ? <View style={s.metaChip}><Text style={s.metaChipText}>Reminded {formatDate(loan.reminderAt)}</Text></View> : null}
          <View style={[s.metaChip, overdue && { backgroundColor: colors.warning + "18" }]}><Text style={[s.metaChipText, overdue && { color: colors.warning }]}>{isSettled ? "Settled" : overdue ? "Overdue" : "Active"}</Text></View>
        </View>

        {loan.notes && (
          <Text style={{ fontSize: 13, color: colors.onSurface, marginTop: 16, backgroundColor: colors.surfaceTertiary, padding: 12, borderRadius: radius.md }}>
            {loan.notes}
          </Text>
        )}

        {personSummary && (
          <View style={s.personCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.detailLabel}>PERSON PROFILE</Text>
              <Text style={s.personTitle}>{loan.person}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.personSmall}>{personSummary.active} active</Text>
              <Text style={s.personSmall}>Net {formatMoney(Math.abs(personSummary.lent - personSummary.borrowed), currency)}</Text>
            </View>
          </View>
        )}

        <View style={s.utilityRow}>
          {!isSettled && (
            <Pressable onPress={sendReminder} style={s.utilityBtn}>
              <Ionicons name="notifications-outline" size={16} color={colors.brand} />
              <Text style={s.utilityText}>Reminder</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setProofModalVisible(true)} style={s.utilityBtn}>
            <Ionicons name="document-text-outline" size={16} color={colors.brand} />
            <Text style={s.utilityText}>{loan.proofNote ? "Proof" : "Add proof"}</Text>
          </Pressable>
          {!isSettled && (
            <Pressable onPress={convertToGift} style={s.utilityBtn}>
              <Ionicons name="gift-outline" size={16} color={colors.brand} />
              <Text style={s.utilityText}>Gift</Text>
            </Pressable>
          )}
        </View>

        {loan.proofNote && (
          <Text style={s.proofText}>{loan.proofNote}</Text>
        )}

        {!isSettled && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
            <Pressable onPress={markAsComplete} style={[s.btn, s.btnG, { flex: 1 }]}>
              <Text style={s.btnGT}>Settle up</Text>
            </Pressable>
            <Pressable onPress={openRepay} style={[s.btn, s.btnP, { flex: 1 }]}>
              <Text style={s.btnPT}>{loan.type === "lent" ? "Record repayment" : "Record payment"}</Text>
            </Pressable>
          </View>
        )}

        <Text style={[s.formLabel, { marginTop: 32 }]}>Payment History</Text>
        {payments.length === 0 ? (
          <Text style={{ fontSize: 13, color: colors.muted, paddingVertical: 20, textAlign: "center" }}>No payments recorded yet</Text>
        ) : (
          <View style={{ marginTop: 8 }}>
            {payments.map(item => (
              <View key={item.id} style={s.historyRow}>
                <Ionicons name={loan.type === "lent" ? "arrow-down-circle" : "arrow-up-circle"} size={20} color={loan.type === "lent" ? colors.success : colors.error} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.historyAmt}>{formatMoney(item.amount, currency)}</Text>
                  <Text style={s.historyDate}>{formatDate(item.date)}{item.note ? ` · ${item.note}` : ""}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable onPress={removeLoan} style={s.deleteRow}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={{ fontSize: 14, color: colors.error, fontWeight: "700", marginLeft: 8 }}>Delete record</Text>
        </Pressable>
      </ScrollView>

      {/* Repay Modal */}
      <Modal transparent visible={repayModalVisible} animationType="fade" onRequestClose={closeRepay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "transparent", justifyContent: "center", padding: 20 }}>
          <BlurView intensity={45} tint={blurTint} blurReductionFactor={2} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill}><Pressable style={{ flex: 1 }} onPress={closeRepay} /></BlurView>
          <View style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface, marginBottom: 16 }}>
              {loan.type === "lent" ? "Record Repayment" : "Record Payment"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 8, fontWeight: "700" }}>AMOUNT</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: radius.md, fontSize: 24, fontWeight: "800", color: colors.onSurface }}
              keyboardType="decimal-pad"
              autoFocus
              value={repayAmount}
              onChangeText={setRepayAmount}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
            />
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 14, marginBottom: 8, fontWeight: "700" }}>NOTE</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: radius.md, fontSize: 15, fontWeight: "600", color: colors.onSurface }}
              value={repayNote}
              onChangeText={setRepayNote}
              placeholder="UPI ref, cash, bank transfer..."
              placeholderTextColor={colors.muted}
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <Pressable onPress={closeRepay} style={{ flex: 1, padding: 16, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitRepay} style={{ flex: 1, padding: 16, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center" }}>
                <Text style={{ fontWeight: "700", color: "#fff" }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal transparent visible={proofModalVisible} animationType="fade" onRequestClose={() => setProofModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "transparent", justifyContent: "center", padding: 20 }}>
          <BlurView intensity={45} tint={blurTint} blurReductionFactor={2} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill}><Pressable style={{ flex: 1 }} onPress={() => setProofModalVisible(false)} /></BlurView>
          <View style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface, marginBottom: 16 }}>Proof / Reference</Text>
            <TextInput
              style={{ backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: radius.md, fontSize: 15, fontWeight: "600", color: colors.onSurface, minHeight: 92, textAlignVertical: "top" }}
              value={proofNote}
              onChangeText={setProofNote}
              placeholder="Receipt number, UPI ref, screenshot note, message proof..."
              placeholderTextColor={colors.muted}
              multiline
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <Pressable onPress={() => setProofModalVisible(false)} style={{ flex: 1, padding: 16, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
                <Text style={{ fontWeight: "700", color: colors.onSurface }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveProof} style={{ flex: 1, padding: 16, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: "center" }}>
                <Text style={{ fontWeight: "700", color: "#fff" }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  headerWrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backBtn: {
    marginRight: 16,
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -0.5,
  },
  detailSummary: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, padding: 16, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  detailLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 0.5 },
  detailValue: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: 4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  metaChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  metaChipText: { fontSize: 11, color: colors.muted, fontWeight: "800" },
  personCard: { flexDirection: "row", alignItems: "center", marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  personTitle: { fontSize: 15, color: colors.onSurface, fontWeight: "800", marginTop: 2 },
  personSmall: { fontSize: 11, color: colors.muted, fontWeight: "700", marginTop: 2 },
  utilityRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  utilityBtn: { flex: 1, height: 40, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brandTertiary },
  utilityText: { fontSize: 12, color: colors.brand, fontWeight: "800" },
  proofText: { fontSize: 12, color: colors.onSurface, marginTop: 10, backgroundColor: colors.surfaceTertiary, padding: 12, borderRadius: radius.md, fontWeight: "600" },
  formLabel: { fontSize: 12, color: colors.muted, fontWeight: "700", letterSpacing: 0.5 },
  btn: { padding: 16, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  btnP: { backgroundColor: colors.brand },
  btnPT: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnG: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  btnGT: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  historyAmt: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  historyDate: { fontSize: 12, color: colors.muted, marginTop: 2 },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 40, padding: 16, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
});
