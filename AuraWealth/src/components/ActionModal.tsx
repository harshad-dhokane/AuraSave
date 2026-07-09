import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/theme/ThemeContext";
import { radius, shadow, spacing } from "@/src/theme";

interface ActionModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color?: string;
    isDestructive?: boolean;
    onPress: () => void;
  }[];
}

export function ActionModal({
  visible,
  title,
  subtitle,
  onClose,
  actions,
}: ActionModalProps) {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView 
        intensity={45} 
        tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} 
        blurReductionFactor={2}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
            
            <View style={styles.actionsContainer}>
              {actions.map((action, i) => {
                const actionColor = action.isDestructive ? colors.error : (action.color || colors.onSurface);
                // Simplify labels if they are too long for side-by-side
                const shortLabel = action.label.replace(/ (transaction|contribution)/i, "");
                return (
                  <Pressable 
                    key={i}
                    style={[
                      styles.actionRow,
                      { backgroundColor: action.isDestructive ? colors.error + "08" : colors.surfaceTertiary },
                    ]}
                    onPress={action.onPress}
                  >
                    <View style={styles.iconCircle}>
                      <Ionicons name={action.icon} size={24} color={actionColor} />
                    </View>
                    <Text style={[styles.actionText, { color: actionColor }]} numberOfLines={1}>{shortLabel}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: radius.lg,
    padding: 24,
    ...shadow.card,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  actionRow: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  iconCircle: {
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
