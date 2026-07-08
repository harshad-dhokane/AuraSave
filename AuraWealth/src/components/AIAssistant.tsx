import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Modal, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme/ThemeContext";
import { radius, shadow, spacing } from "@/src/theme";
import { getCategories } from "@/src/store";
import { transcribeAudio, parseIntent } from "@/src/lib/groq";

interface AIAssistantProps {
  visible: boolean;
  onClose: () => void;
  onDirectStatusChange?: (status: "idle" | "recording" | "processing" | "success" | "error") => void;
}

export interface AIAssistantRef {
  startDirectRecording: () => void;
  stopDirectRecording: () => void;
}

export const AIAssistant = forwardRef<AIAssistantRef, AIAssistantProps>(({ visible, onClose, onDirectStatusChange }, ref) => {
  useImperativeHandle(ref, () => ({
    startDirectRecording: () => startRecording(),
    stopDirectRecording: () => stopRecording(),
  }));


  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isStopping = useRef(false);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("How can I help?");

  useEffect(() => {
    if (onDirectStatusChange) onDirectStatusChange(status);
  }, [status, onDirectStatusChange]);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setStatus("idle");
      setMessage("How can I help?");
    }
  }, [visible]);

  useEffect(() => {
    if (status === "recording") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      pulseAnim.stopAnimation();
    }
  }, [status]);

  const startRecording = async () => {
    isStopping.current = false;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== "granted") {
        setMessage("Microphone access denied.");
        setStatus("error");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      if (isStopping.current) {
        await recording.stopAndUnloadAsync();
        return;
      }
      setRecording(recording);
      setStatus("recording");
      setMessage("Listening...");
    } catch (err) {
      console.error("Failed to start recording", err);
      setStatus("error");
      setMessage("Failed to start recording.");
    }
  };

  const stopRecording = async () => {
    isStopping.current = true;
    if (!recording) return;
    setStatus("processing");
    setMessage("Processing...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) throw new Error("No recording URI");

      setMessage("Transcribing...");
      const text = await transcribeAudio(uri);
      
      setMessage("Understanding...");
      const cats = await getCategories();
      const parsed = await parseIntent(text, cats);

      if (parsed.action === "add_transaction") {
        router.push({
          pathname: "/add-transaction",
          params: {
            ...parsed.payload,
            mode: "manual", // Default to manual to show the form
          }
        });
      } else if (parsed.action === "add_goal") {
        router.push({
          pathname: "/add-goal",
          params: parsed.payload,
        });
      } else if (parsed.action === "add_budget") {
        router.push({
          pathname: "/add-budget",
          params: parsed.payload,
        });
      } else if (parsed.action === "add_loan") {
        router.push({
          pathname: "/add-loan",
          params: parsed.payload,
        });
      } else {
        setStatus("error");
        setMessage("Could not understand the action.");
        return;
      }

      setStatus("success");
      setMessage("Done!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setStatus("idle");
        if (visible) onClose();
      }, 500);

    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "An error occurred.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <BlurView 
        intensity={45} 
        tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} 
        blurReductionFactor={2}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} disabled={status === "recording" || status === "processing"} />
      </BlurView>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.message, { color: colors.onSurface }]}>{message}</Text>
          
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={status === "processing"}
              style={[
                styles.micBtn,
                { backgroundColor: status === "recording" ? colors.error : colors.brand },
                status === "processing" && { opacity: 0.5 }
              ]}
            >
              <Ionicons name={status === "processing" ? "hourglass" : "mic"} size={32} color="#fff" />
            </Pressable>
          </Animated.View>
          <Text style={[styles.hint, { color: colors.muted }]}>
            {status === "idle" ? "Hold to speak" : status === "recording" ? "Release to send" : ""}
          </Text>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: "100%",
    padding: 32,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.card,
  },
  message: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 32,
    textAlign: "center",
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.fab,
  },
  hint: {
    marginTop: 24,
    fontSize: 13,
    fontWeight: "600",
  }
});
