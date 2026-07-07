import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "react-native-calendars";
import { BlurView } from "expo-blur";
import { colors, radius, spacing, shadow } from "@/src/theme";

const { height: SCREEN_H } = Dimensions.get("window");
const MAX_SHEET = Math.round(SCREEN_H * 0.75);

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const calTheme = {
  backgroundColor: colors.surfaceSecondary,
  calendarBackground: colors.surfaceSecondary,
  textSectionTitleColor: colors.muted,
  dayTextColor: colors.onSurface,
  monthTextColor: colors.onSurface,
  todayTextColor: colors.brand,
  selectedDayBackgroundColor: colors.brand,
  selectedDayTextColor: "#ffffff",
  arrowColor: colors.brand,
  textDisabledColor: colors.borderStrong,
  textDayFontWeight: "600" as const,
  textMonthFontWeight: "800" as const,
  textDayHeaderFontWeight: "700" as const,
  textDayFontSize: 14,
  textMonthFontSize: 15,
  textDayHeaderFontSize: 11,
};

// ── Single date picker ──────────────────────────────────────────────────────
export function DatePickerModal({
  visible,
  value,
  onClose,
  onChange,
  maxDate,
  minDate,
  title = "Pick a date",
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onChange: (d: Date) => void;
  maxDate?: Date;
  minDate?: Date;
  title?: string;
}) {
  const selected = ymd(value);
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurView intensity={60} tint="default" style={StyleSheet.absoluteFill}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </BlurView>
        <View style={[styles.sheet, { maxHeight: MAX_SHEET, paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable testID="datepicker-close" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.onSurface} />
            </Pressable>
          </View>
          <Calendar
            current={selected}
            onDayPress={(d: any) => {
              const nd = new Date(d.year, d.month - 1, d.day);
              onChange(nd);
              onClose();
            }}
            markedDates={{ [selected]: { selected: true, disableTouchEvent: false } }}
            maxDate={maxDate ? ymd(maxDate) : undefined}
            minDate={minDate ? ymd(minDate) : undefined}
            theme={calTheme}
            enableSwipeMonths
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Range picker ────────────────────────────────────────────────────────────
export function RangePickerModal({
  visible,
  from,
  to,
  onClose,
  onChange,
  maxDate,
  title = "Choose date range",
}: {
  visible: boolean;
  from: Date;
  to: Date;
  onClose: () => void;
  onChange: (from: Date, to: Date) => void;
  maxDate?: Date;
  title?: string;
}) {
  const [tempFrom, setTempFrom] = useState(ymd(from));
  const [tempTo, setTempTo] = useState(ymd(to));
  const [selectingEnd, setSelectingEnd] = useState(false);

  // Reset when reopened
  React.useEffect(() => {
    if (visible) {
      setTempFrom(ymd(from));
      setTempTo(ymd(to));
      setSelectingEnd(false);
    }
  }, [visible, from, to]);

  const marked = useMemo(() => {
    const dates: Record<string, any> = {};
    // Iterate day by day (bounded to 400 days to avoid pathological ranges)
    const start = new Date(tempFrom);
    const end = new Date(tempTo);
    if (end < start) return dates;
    for (let i = 0; i < 400; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = ymd(d);
      dates[key] = {
        color: colors.brandTertiary,
        textColor: colors.brand,
      };
      if (key === tempFrom)
        dates[key] = { startingDay: true, color: colors.brand, textColor: "#fff" };
      if (key === tempTo)
        dates[key] = { ...(dates[key] || {}), endingDay: true, color: colors.brand, textColor: "#fff" };
      if (key === ymd(end)) break;
    }
    return dates;
  }, [tempFrom, tempTo]);

  const apply = () => {
    onChange(new Date(tempFrom), new Date(tempTo));
    onClose();
  };

  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurView intensity={60} tint="default" style={StyleSheet.absoluteFill}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </BlurView>
        <View style={[styles.sheet, { maxHeight: MAX_SHEET, paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable testID="rangepicker-close" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.onSurface} />
            </Pressable>
          </View>

          <View style={styles.rangeInfo}>
            <View style={styles.rangeChip}>
              <Text style={styles.rangeLabel}>From</Text>
              <Text style={styles.rangeValue}>{new Date(tempFrom).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.muted} />
            <View style={styles.rangeChip}>
              <Text style={styles.rangeLabel}>To</Text>
              <Text style={styles.rangeValue}>{new Date(tempTo).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</Text>
            </View>
          </View>

          <Text style={styles.helpText}>
            {selectingEnd ? "Tap a date to set the END of the range" : "Tap a date to set the START of the range"}
          </Text>

          <Calendar
            current={selectingEnd ? tempTo : tempFrom}
            onDayPress={(d: any) => {
              const picked = ymd(new Date(d.year, d.month - 1, d.day));
              if (!selectingEnd) {
                setTempFrom(picked);
                setTempTo(picked);
                setSelectingEnd(true);
              } else {
                if (picked < tempFrom) {
                  setTempFrom(picked);
                } else {
                  setTempTo(picked);
                }
                setSelectingEnd(false);
              }
            }}
            markingType="period"
            markedDates={marked}
            maxDate={maxDate ? ymd(maxDate) : undefined}
            theme={calTheme}
            enableSwipeMonths
          />

          <View style={styles.actionRow}>
            <Pressable testID="range-cancel" style={[styles.actionBtn, styles.actionGhost]} onPress={onClose}>
              <Text style={styles.actionGhostText}>Cancel</Text>
            </Pressable>
            <Pressable testID="range-apply" style={[styles.actionBtn, styles.actionPrimary]} onPress={apply}>
              <Text style={styles.actionPrimaryText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    ...shadow.card,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  rangeChip: {
    flex: 1,
    padding: 10,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
  },
  rangeLabel: {
    fontSize: 10,
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "700",
  },
  rangeValue: { fontSize: 13, color: colors.onSurface, fontWeight: "800", marginTop: 2 },
  helpText: { fontSize: 11, color: colors.muted, textAlign: "center", marginBottom: 4 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionGhost: { backgroundColor: colors.surfaceTertiary },
  actionGhostText: { color: colors.onSurface, fontWeight: "700" },
  actionPrimary: { backgroundColor: colors.brand },
  actionPrimaryText: { color: "#fff", fontWeight: "800" },
});
