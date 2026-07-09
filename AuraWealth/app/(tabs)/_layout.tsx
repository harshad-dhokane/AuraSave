import React, { useMemo, useRef, useState, useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, Animated, Easing } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, shadow } from "@/src/theme";
import { TabBarScrollProvider } from "@/src/context/TabBarScrollContext";
import { useTheme } from "@/src/theme/ThemeContext";
import { AIAssistant, AIAssistantRef } from "@/src/components/AIAssistant";

const TABS: {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}[] = [
    { name: "index", label: "Home", icon: "home", route: "/(tabs)" },
    { name: "transactions", label: "Ledger", icon: "list", route: "/(tabs)/transactions" },
    { name: "analytics", label: "Insights", icon: "pie-chart", route: "/(tabs)/analytics" },
    { name: "budgets", label: "Budgets", icon: "wallet", route: "/(tabs)/budgets" },
    { name: "goals", label: "Goals", icon: "flag", route: "/(tabs)/goals" },
  ];

function CustomTabBar({ state, descriptors, navigation, colors, styles, onAiPress }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 },
      ]}
    >
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          const meta = TABS.find((t) => t.name === route.name);
          if (!meta) return null;
          const focused = state.index === index;
          
          return (
            <React.Fragment key={route.key}>
              <Pressable
                testID={`tab-${meta.name}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  if (!focused) navigation.navigate(route.name);
                }}
                style={styles.tabItem}
              >
                <Ionicons
                  name={(focused ? meta.icon : (meta.icon + "-outline")) as any}
                  size={22}
                  color={focused ? colors.brand : colors.muted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: focused ? colors.brand : colors.muted, fontWeight: focused ? "700" : "500" },
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>
      
      <Pressable
        onPress={onAiPress}
        style={[styles.fab, { backgroundColor: colors.brand }]}
      >
        <Ionicons name="sparkles" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [aiVisible, setAiVisible] = useState(false);
  const aiRef = useRef<AIAssistantRef>(null);
  const [directStatus, setDirectStatus] = useState<"idle" | "recording" | "processing" | "success" | "error">("idle");
  const isLongPressing = useRef(false);
  const longPressEndTime = useRef(0);

  return (
    <TabBarScrollProvider>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }}
        tabBar={(props) => (
          <CustomTabBar 
            {...props} 
            colors={colors} 
            styles={styles}
            onAiPress={() => {
              setAiVisible(true);
            }}
          />
        )}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="analytics" />
        <Tabs.Screen name="budgets" />
        <Tabs.Screen name="goals" />
      </Tabs>
      <AIAssistant 
        ref={aiRef} 
        visible={aiVisible} 
        onClose={() => setAiVisible(false)} 
        onDirectStatusChange={setDirectStatus} 
      />
    </TabBarScrollProvider>
  );
}

function DirectRecordingOverlay({ visible, colors, isDark }: { visible: boolean; colors: any; isDark: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.8,
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
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 10, justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
      <BlurView
        intensity={45}
        tint={isDark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"}
        blurReductionFactor={2} experimentalBlurMethod="dimezisBlurView"
       
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={{ 
         width: 120, 
         height: 120, 
         borderRadius: 60, 
         backgroundColor: colors.error + '33', 
         transform: [{ scale: pulseAnim }],
         position: 'absolute'
      }} />
      <Animated.View style={{ 
         width: 80, 
         height: 80, 
         borderRadius: 40, 
         backgroundColor: colors.error + '66', 
         transform: [{ scale: pulseAnim }],
         position: 'absolute'
      }} />
      <Ionicons name="mic" size={40} color={colors.error} style={{ position: 'absolute' }} />
      <Text style={{ position: 'absolute', top: '65%', fontSize: 16, fontWeight: '700', color: colors.onSurface }}>Listening...</Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 16,
    width: "100%",
    justifyContent: "space-around",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  fab: {
    position: "absolute",
    top: -76,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.fab,
    zIndex: 20,
  },
});
