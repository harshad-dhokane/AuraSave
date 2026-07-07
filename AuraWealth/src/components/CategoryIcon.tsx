import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeContext";

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
        {
          alignItems: "center",
          justifyContent: "center",
        },
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
  const { colors } = useTheme();
  
  return (
    <View style={{
      alignItems: "center",
      paddingVertical: 40,
      paddingHorizontal: 24,
    }}>
      <View style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.brandTertiary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
      }}>
        <Ionicons name={icon as any} size={28} color={colors.brandPrimary} />
      </View>
      <Text style={{
        fontSize: 16,
        fontWeight: "700",
        color: colors.onSurface,
        marginBottom: 4,
      }}>{title}</Text>
      {subtitle ? <Text style={{
        fontSize: 13,
        color: colors.muted,
        textAlign: "center",
      }}>{subtitle}</Text> : null}
    </View>
  );
}

