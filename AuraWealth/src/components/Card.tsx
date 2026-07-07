import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, shadow } from "@/src/theme";

export function Card({
  children,
  style,
  padded = true,
  testID,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={[styles.card, padded && styles.padded, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  padded: {
    padding: 16,
  },
});
