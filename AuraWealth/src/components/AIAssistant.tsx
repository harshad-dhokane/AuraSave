import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Modal, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";
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
    stopDirectRecording: () => processAudio(),
  }));


  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isStopping = useRef(false);
  const recordingStartTime = useRef(0);
  const isRecordingRef = useRef(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
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
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (perm.status !== "granted") {
        setMessage("Mic access denied");
        setStatus("error");
        return;
      }
      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      recordingStartTime.current = Date.now();
      audioRecorder.record();
      
      if (isStopping.current) {
        await audioRecorder.stop();
        return;
      }
      isRecordingRef.current = true;
      setStatus("recording");
      setMessage("Listening...");
    } catch (err) {
      console.warn("[AuraWealth] Recording start failed:", err);
      setStatus("error");
      setMessage("Try again");
    }
  };

  const processAudio = async () => {
    isStopping.current = true;
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setStatus("processing");
    setMessage("Processing...");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await audioRecorder.stop();
      await AudioModule.setAudioModeAsync({ allowsRecording: false });
      
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error("Could not capture audio. Hold the button and speak clearly.");
      }

      setMessage("Transcribing your voice...");
      const text = await transcribeAudio(uri);
      
      setMessage("Understanding your command...");
      const cats = await getCategories();
      const parsed = await parseIntent(text, cats);

      if (parsed.action === "add_transaction") {
        // Map payload fields to search params
        const txParams: Record<string, string> = { mode: "manual" };
        if (parsed.payload.type) txParams.type = parsed.payload.type;
        if (parsed.payload.amount) txParams.amount = String(parsed.payload.amount);
        if (parsed.payload.categoryId) txParams.categoryId = parsed.payload.categoryId;
        if (parsed.payload.note) txParams.note = parsed.payload.note;
        if (parsed.payload.date) txParams.date = parsed.payload.date;

        router.push({
          pathname: "/add-transaction",
          params: txParams,
        });
      } else if (parsed.action === "add_goal") {
        const goalParams: Record<string, string> = {};
        if (parsed.payload.title) goalParams.title = parsed.payload.title;
        if (parsed.payload.target) goalParams.target = String(parsed.payload.target);
        if (parsed.payload.saved) goalParams.saved = String(parsed.payload.saved);
        if (parsed.payload.goalYears !== undefined) goalParams.goalYears = String(parsed.payload.goalYears);
        if (parsed.payload.goalMonths !== undefined) goalParams.goalMonths = String(parsed.payload.goalMonths);
        if (parsed.payload.goalDays !== undefined) goalParams.goalDays = String(parsed.payload.goalDays);

        router.push({
          pathname: "/add-goal",
          params: goalParams,
        });
      } else if (parsed.action === "add_budget") {
        const budgetParams: Record<string, string> = {};
        if (parsed.payload.categoryId) budgetParams.categoryId = parsed.payload.categoryId;
        if (parsed.payload.limit) budgetParams.limit = String(parsed.payload.limit);
        if (parsed.payload.month) budgetParams.month = parsed.payload.month;

        router.push({
          pathname: "/add-budget",
          params: budgetParams,
        });
      } else if (parsed.action === "add_loan") {
        // Map loan payload to the exact params that add-loan.tsx expects
        const loanParams: Record<string, string> = {};
        if (parsed.payload.type) loanParams.type = parsed.payload.type;
        if (parsed.payload.person) loanParams.person = parsed.payload.person;
        if (parsed.payload.amount) loanParams.amount = String(parsed.payload.amount);
        if (parsed.payload.repaymentExpected !== undefined) {
          loanParams.repaymentExpected = String(parsed.payload.repaymentExpected);
        }
        // Note: add-loan.tsx uses internal state for `notes`, not a search param.
        // We pass it as `note` and handle it in add-loan.
        if (parsed.payload.notes) loanParams.note = parsed.payload.notes;
        if (parsed.payload.date) loanParams.date = parsed.payload.date;
        if (parsed.payload.dueDate) loanParams.dueDate = parsed.payload.dueDate;
        if (parsed.payload.interestRate) loanParams.interestRate = String(parsed.payload.interestRate);

        router.push({
          pathname: "/add-loan",
          params: loanParams,
        });
      } else {
        setStatus("error");
        setMessage("Try again");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setTimeout(() => setStatus("idle"), 4000);
        return;
      }

      setStatus("success");
      setMessage("Done! ✓");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setStatus("idle");
        if (visible) onClose();
      }, 600);

    } catch (err) {
      console.warn("[AuraWealth] Voice processing error:", err);
      setStatus("error");
      setMessage("Try again");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => {
        setStatus("idle");
        setMessage("How can I help?");
      }, 2000);
    }
  };

  const handlePressIn = async () => {
    if (isRecordingRef.current) {
      // Tap-to-toggle: User tapped again while recording to stop
      await processAudio();
      return;
    }
    if (status === "idle" || status === "error") {
      await startRecording();
    }
  };

  const handlePressOut = async () => {
    if (isRecordingRef.current) {
      const duration = Date.now() - recordingStartTime.current;
      if (duration > 400) {
        // Hold-to-speak: User released after a long press
        await processAudio();
      }
      // If < 400ms, it was a quick tap. We leave it recording!
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <BlurView 
        intensity={45} 
        tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} 
        blurReductionFactor={2} experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} disabled={status === "recording" || status === "processing"} />
      </BlurView>
      <View style={styles.container}>
        <View style={[styles.card, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 24) }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          {/* Status icon */}
          {status === "success" && (
            <View style={[styles.statusIcon, { backgroundColor: colors.success + "1A" }]}>
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            </View>
          )}
          {status === "error" && (
            <View style={[styles.statusIcon, { backgroundColor: colors.error + "1A" }]}>
              <Ionicons name="alert-circle" size={28} color={colors.error} />
            </View>
          )}
          
          <Text style={[
            styles.message, 
            { color: status === "error" ? colors.error : colors.onSurface }
          ]}>
            {message}
          </Text>
          
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={status === "processing"}
              style={[
                styles.micBtn,
                { backgroundColor: status === "recording" ? colors.success : colors.brand },
                status === "processing" && { opacity: 0.5 }
              ]}
            >
              <Ionicons name={status === "processing" ? "hourglass" : "mic"} size={32} color="#fff" />
            </Pressable>
          </Animated.View>
          <Text style={[styles.hint, { color: colors.muted }]}>
            {status === "idle" ? "Hold to speak" : status === "recording" ? "Release to send" : status === "processing" ? "Analyzing..." : ""}
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
  },
  sheetHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 24,
  },
  card: {
    width: "100%",
    padding: spacing.xl,
    paddingTop: 12,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    alignItems: "center",
    ...shadow.card,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 28,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
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
    marginTop: 20,
    fontSize: 13,
    fontWeight: "600",
  },
});
