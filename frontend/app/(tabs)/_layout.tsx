import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, shadow } from "@/src/theme";

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
];

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
      {/* Floating FAB */}
      <Pressable
        testID="fab-add-transaction"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/add-transaction");
        }}
        style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.94 }] }]}
      >
        <LinearGradient
          colors={[colors.brandSecondary, colors.brandPrimary, colors.brand]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>

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
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="budgets" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: "center",
  },
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 8,
    width: "100%",
    justifyContent: "space-around",
    ...shadow.fab,
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
