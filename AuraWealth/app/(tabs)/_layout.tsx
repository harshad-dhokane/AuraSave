import React, { useMemo } from "react";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, shadow } from "@/src/theme";
import { TabBarScrollProvider } from "@/src/context/TabBarScrollContext";
import { useTheme } from "@/src/theme/ThemeContext";

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

function CustomTabBar({ state, descriptors, navigation, colors, styles }: any) {
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
            <Pressable
              key={route.key}
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
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TabBarScrollProvider>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surface } }}
        tabBar={(props) => <CustomTabBar {...props} colors={colors} styles={styles} />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="analytics" />
        <Tabs.Screen name="budgets" />
        <Tabs.Screen name="goals" />
      </Tabs>
    </TabBarScrollProvider>
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
    top: -28,
    alignSelf: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.fab,
    zIndex: 20,
  },
});
