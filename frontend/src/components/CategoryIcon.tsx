import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/src/theme";

export function CategoryIcon({
  name,
  color,
  size = 44,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: color + "22",
        },
      ]}
    >
      <Ionicons name={name as any} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

export function EmptyState({
  icon = "sparkles-outline",
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as any} size={28} color={colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
  },
});
