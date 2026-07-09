import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeContext";
import { radius, shadow, spacing } from "@/src/theme";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  subtitle: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  subtitle,
  onCancel,
  onConfirm,
  confirmText = "Confirm",
  isDestructive = false,
}: ConfirmModalProps) {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <BlurView 
        intensity={45} 
        tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} 
        blurReductionFactor={2} experimentalBlurMethod="dimezisBlurView"
       
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={styles.overlay} onPress={onCancel}>
          <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
            
            <View style={styles.buttonRow}>
              <Pressable
                style={[styles.button, { backgroundColor: colors.surfaceTertiary }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onCancel();
                }}
              >
                <Text style={[styles.buttonText, { color: colors.onSurface }]}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[styles.button, { backgroundColor: isDestructive ? colors.error : colors.brand }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onConfirm();
                }}
              >
                <Text style={[styles.buttonText, { color: "#fff" }]}>{confirmText}</Text>
              </Pressable>
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
    padding: spacing.xl,
    ...shadow.card,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 24,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
