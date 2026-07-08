import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/src/theme/ThemeContext";

interface PinPadProps {
  onPinComplete: (pin: string) => void;
  title?: string;
  subtitle?: string;
  error?: string;
  pinLength?: number;
  onCancel?: () => void;
  showCancel?: boolean;
}

export function PinPad({
  onPinComplete,
  title = "Enter PIN",
  subtitle,
  error,
  pinLength = 4,
  onCancel,
  showCancel = false,
}: PinPadProps) {
  const { colors } = useTheme();
  const [pin, setPin] = useState<string>("");

  useEffect(() => {
    if (error) {
      setPin("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [error]);

  const handlePress = (char: string) => {
    if (pin.length >= pinLength) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPin = pin + char;
    setPin(newPin);
    
    if (newPin.length === pinLength) {
      setTimeout(() => {
        onPinComplete(newPin);
        setPin(""); // Clear after submitting so they can try again if error
      }, 100);
    }
  };

  const handleBackspace = () => {
    if (pin.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin(pin.slice(0, -1));
  };

  const renderDots = () => {
    const dots = [];
    for (let i = 0; i < pinLength; i++) {
      const isFilled = i < pin.length;
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: isFilled ? colors.brand : colors.surfaceTertiary,
              borderColor: isFilled ? colors.brand : colors.borderStrong,
              borderWidth: isFilled ? 0 : 2,
            },
            error && !isFilled ? { borderColor: colors.error } : null,
          ]}
        />
      );
    }
    return <View style={styles.dotsContainer}>{dots}</View>;
  };

  const renderButton = (content: React.ReactNode, value: string, onPress: () => void) => (
    <Pressable
      key={value}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.surfaceTertiary : "transparent" },
      ]}
    >
      {content}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: error ? colors.error : colors.onSurface }]}>
          {error || title}
        </Text>
        {subtitle && !error && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
      </View>

      {renderDots()}

      <View style={styles.pad}>
        <View style={styles.row}>
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>1</Text>, "1", () => handlePress("1"))}
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>2</Text>, "2", () => handlePress("2"))}
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>3</Text>, "3", () => handlePress("3"))}
        </View>
        <View style={styles.row}>
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>4</Text>, "4", () => handlePress("4"))}
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>5</Text>, "5", () => handlePress("5"))}
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>6</Text>, "6", () => handlePress("6"))}
        </View>
        <View style={styles.row}>
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>7</Text>, "7", () => handlePress("7"))}
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>8</Text>, "8", () => handlePress("8"))}
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>9</Text>, "9", () => handlePress("9"))}
        </View>
        <View style={styles.row}>
          {showCancel ? (
             renderButton(<Text style={[styles.cancelText, { color: colors.onSurface }]}>Cancel</Text>, "cancel", () => onCancel?.())
          ) : (
            <View style={styles.emptyButton} />
          )}
          {renderButton(<Text style={[styles.numText, { color: colors.onSurface }]}>0</Text>, "0", () => handlePress("0"))}
          {renderButton(<Ionicons name="backspace" size={28} color={colors.onSurface} />, "backspace", handleBackspace)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    width: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
    minHeight: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 60,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  pad: {
    width: "100%",
    maxWidth: 320,
    gap: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButton: {
    width: 80,
    height: 80,
  },
  numText: {
    fontSize: 32,
    fontWeight: "500",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
