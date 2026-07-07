import React, { useEffect, useState , useMemo} from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

import { radius, spacing } from "@/src/theme";
import { formatMoney, formatDate } from "@/src/utils/format";
import { getLoans, getLoanPayments, Loan, LoanPayment, addLoanPayment, updateLoan, deleteLoan } from "@/src/store";
import { useCurrency } from "@/src/currency";
import { useTheme } from "@/src/theme/ThemeContext";
export default function LoanDetailScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { id, initialLoan } = useLocalSearchParams<{ id: string; initialLoan?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currency } = useCurrency();

  const [loan, setLoan] = useState<Loan | null>(initialLoan ? JSON.parse(initialLoan as string) : null);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  
  // Repay modal state
  const [repayModalVisible, setRepayModalVisible] = useState(false);
  const [repayAmount, setRepayAmount] = useState("");

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    const loans = await getLoans();
    const l = loans.find(x => x.id === id);
    if (l) {
      setLoan(l);
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
    const newPaid = loan.paidAmount + amt;
    const status = newPaid >= loan.amount ? "settled" : "active";
    
    await addLoanPayment(loan.id, amt, new Date().toISOString());
    await updateLoan(loan.id, { paidAmount: newPaid, status });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeRepay();
    load();
  };

  const markAsComplete = () => {
    if (!loan) return;
    const remaining = loan.amount - loan.paidAmount;
    if (remaining <= 0) return;

    Alert.alert(
      "Mark as complete?",
      `This will record a final payment of ${formatMoney(remaining, currency)} and settle the record.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", style: "default", onPress: async () => {
            await addLoanPayment(loan.id, remaining, new Date().toISOString());
            await updateLoan(loan.id, { paidAmount: loan.amount, status: "settled" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            load();
          }
        },
      ]
    );
  };

  if (!loan) return <View style={{ flex: 1, backgroundColor: colors.surface }} />;

  const isSettled = loan.status === "settled";
  const pct = Math.min(100, (loan.paidAmount / loan.amount) * 100);
  const rem = loan.amount - loan.paidAmount;

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
            <Text style={s.detailValue}>{formatMoney(loan.amount, currency)}</Text>
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
          {loan.dueDate && <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Due: {formatDate(loan.dueDate)}</Text>}
        </View>

        {loan.notes && (
          <Text style={{ fontSize: 13, color: colors.onSurface, marginTop: 16, backgroundColor: colors.surfaceTertiary, padding: 12, borderRadius: radius.md }}>
            {loan.notes}
          </Text>
        )}

        {!isSettled && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
            <Pressable onPress={markAsComplete} style={[s.btn, s.btnG, { flex: 1 }]}>
              <Text style={s.btnGT}>Mark complete</Text>
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
                  <Text style={s.historyDate}>{formatDate(item.date)}</Text>
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
          <BlurView intensity={60} tint="default" style={StyleSheet.absoluteFill}><Pressable style={{ flex: 1 }} onPress={closeRepay} /></BlurView>
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
