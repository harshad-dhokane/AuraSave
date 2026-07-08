import React, { useState , useMemo} from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { DatePickerModal } from "@/src/components/DatePicker";
import { radius, spacing, shadow } from "@/src/theme";
import { useCurrency } from "@/src/currency";
import { addLoan, addTransaction, getCategories, addCategory } from "@/src/store";
import { formatDate } from "@/src/utils/format";
import { useTheme } from "@/src/theme/ThemeContext";

export default function AddLoanScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currency } = useCurrency();

  const [type, setType] = useState<"lent" | "borrowed">("lent");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [groupName, setGroupName] = useState("");
  const [repaymentExpected, setRepaymentExpected] = useState(true);
  
  const [date, setDate] = useState(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);

  const isFormValid = person.trim().length > 0 && Number(amount) > 0;

  const handleSave = async () => {
    if (!isFormValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!repaymentExpected) {
      const cats = await getCategories();
      const targetType = type === "lent" ? "expense" : "income";
      // Look for an existing Gift/Charity category first
      const giftCat = cats.find(c => c.type === targetType && /gift|charity|donation/i.test(c.name));
      let categoryId: string;
      if (giftCat) {
        categoryId = giftCat.id;
      } else {
        // Auto-create a "Gift" category so gifts never end up in Rent
        const created = await addCategory({
          name: "Gift",
          icon: "gift",
          color: "#E8A0BF",
          type: targetType,
        });
        categoryId = created.id;
      }
      
      // Create the transaction for expense/income tracking
      await addTransaction({
        amount: Number(amount),
        date: date.toISOString(),
        type: targetType,
        categoryId,
        note: (type === "lent" ? "Gift to " : "Gift from ") + person.trim() + (notes ? ` - ${notes.trim()}` : "") + (groupName ? ` (${groupName.trim()})` : ""),
      });

      // Also create a loan record so it appears on the Lending page
      await addLoan({
        type,
        person: person.trim(),
        amount: Number(amount),
        date: date.toISOString(),
        repaymentExpected: false,
        notes: (notes.trim() ? notes.trim() + " — " : "") + "Gift / No repayment",
        groupName: groupName.trim() || undefined,
      });
    } else {
      await addLoan({
        type,
        person: person.trim(),
        amount: Number(amount),
        date: date.toISOString(),
        dueDate: dueDate ? dueDate.toISOString() : undefined,
        repaymentExpected,
        notes: notes.trim() || undefined,
        interestRate: Number(interestRate) || undefined,
        proofNote: proofNote.trim() || undefined,
        groupName: groupName.trim() || undefined,
      });
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <Text style={s.headerTitle}>New Record</Text>
          <Pressable onPress={() => router.back()} style={s.closeBtn}>
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={s.typeToggle}>
            <Pressable style={[s.typeBtn, type === "lent" && s.typeBtnAct]} onPress={() => { Haptics.selectionAsync(); setType("lent"); }}>
              <Ionicons name="arrow-up" size={16} color={type === "lent" ? colors.success : colors.muted} />
              <Text style={[s.typeBtnText, type === "lent" && { color: colors.success }]}>I gave money</Text>
            </Pressable>
            <Pressable style={[s.typeBtn, type === "borrowed" && s.typeBtnAct]} onPress={() => { Haptics.selectionAsync(); setType("borrowed"); }}>
              <Ionicons name="arrow-down" size={16} color={type === "borrowed" ? colors.error : colors.muted} />
              <Text style={[s.typeBtnText, type === "borrowed" && { color: colors.error }]}>I borrowed money</Text>
            </Pressable>
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>{type === "lent" ? "Who did you give it to?" : "Who did you borrow from?"}</Text>
            <TextInput
              value={person}
              onChangeText={setPerson}
              placeholder="e.g. John Doe"
              placeholderTextColor={colors.muted}
              style={s.input}
              autoCapitalize="words"
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>Amount ({currency.symbol})</Text>
            <TextInput
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={[s.input, { fontSize: 24, fontWeight: "800", paddingVertical: 16 }]}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Date</Text>
              <Pressable onPress={() => setShowDatePicker(true)} style={s.dateBtn}>
                <Ionicons name="calendar-outline" size={18} color={colors.brand} />
                <Text style={s.dateBtnText}>{formatDate(date.toISOString())}</Text>
              </Pressable>
            </View>
            {repaymentExpected && (
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Due Date (Optional)</Text>
                <Pressable onPress={() => setShowDuePicker(true)} style={s.dateBtn}>
                  <Ionicons name="flag-outline" size={18} color={dueDate ? colors.brand : colors.muted} />
                  <Text style={[s.dateBtnText, !dueDate && { color: colors.muted }]}>
                    {dueDate ? formatDate(dueDate.toISOString()) : "Set due date"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {repaymentExpected && (
            <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Interest %</Text>
                <TextInput
                  value={interestRate}
                  onChangeText={(v) => setInterestRate(v.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  style={s.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Group / Split</Text>
                <TextInput
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Trip, rent..."
                  placeholderTextColor={colors.muted}
                  style={s.input}
                />
              </View>
            </View>
          )}

          <Pressable 
            style={[s.inputGroup, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24 }]} 
            onPress={() => setRepaymentExpected(!repaymentExpected)}
          >
            <View>
              <Text style={[s.label, { marginBottom: 4 }]}>Repayment expected?</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>Turn off if this is a gift or charity</Text>
            </View>
            <View style={[s.toggle, repaymentExpected && s.toggleOn]}>
              <View style={[s.toggleKnob, repaymentExpected && s.toggleKnobOn]} />
            </View>
          </Pressable>

          <View style={[s.inputGroup, { marginTop: 24 }]}>
            <Text style={s.label}>Notes (Optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What was this for?"
              placeholderTextColor={colors.muted}
              style={[s.input, { height: 100, textAlignVertical: "top" }]}
              multiline
            />
          </View>

          {repaymentExpected && (
            <View style={[s.inputGroup, { marginTop: 24 }]}>
              <Text style={s.label}>Proof / Reference (Optional)</Text>
              <TextInput
                value={proofNote}
                onChangeText={setProofNote}
                placeholder="UPI ref, receipt number, screenshot note"
                placeholderTextColor={colors.muted}
                style={s.input}
              />
            </View>
          )}

          <DatePickerModal
            visible={showDatePicker}
            value={date}
            onClose={() => setShowDatePicker(false)}
            onChange={(d) => setDate(d)}
            title="Loan date"
          />

          <DatePickerModal
            visible={showDuePicker}
            value={dueDate || date}
            onClose={() => setShowDuePicker(false)}
            onChange={(d) => setDueDate(d)}
            minDate={date}
            title="Due date"
          />
          
        </ScrollView>
        
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={handleSave}
            disabled={!isFormValid}
            style={({ pressed }) => [
              s.saveBtn,
              { opacity: !isFormValid ? 0.5 : pressed ? 0.9 : 1 },
            ]}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={s.saveBtnText}>Save record</Text>
          </Pressable>
        </View>

      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  
  typeToggle: { flexDirection: "row", gap: 8, marginBottom: 24, padding: 4, backgroundColor: colors.surfaceTertiary, borderRadius: radius.lg },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: radius.md },
  typeBtnAct: { backgroundColor: colors.surface, ...shadow.card },
  typeBtnText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  
  inputGroup: { marginTop: 20 },
  label: { fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, fontSize: 16, color: colors.onSurface, backgroundColor: colors.surface, fontWeight: "600" },
  
  dateBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 16, backgroundColor: colors.surface },
  dateBtnText: { fontSize: 15, fontWeight: "600", color: colors.onSurface },

  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.borderStrong, padding: 2, justifyContent: "center" },
  toggleOn: { backgroundColor: colors.success },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", ...shadow.card },
  toggleKnobOn: { transform: [{ translateX: 20 }] },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brand, height: 56, borderRadius: radius.pill },
  saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
