import React, { createContext, useContext, useRef, useCallback } from "react";
import { Animated, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

interface TabBarScrollCtx {
  translateY: Animated.Value;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const TabBarScrollContext = createContext<TabBarScrollCtx>({
  translateY: new Animated.Value(0),
  onScroll: () => {},
});

export function TabBarScrollProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  const currentY = useRef(0);

  // The tab bar + FAB is approximately 100px tall.
  const BAR_HEIGHT = 100;

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      
      // Ignore bounce at top/bottom
      if (y < 0) return;

      const delta = y - lastOffset.current;
      lastOffset.current = y;

      // Near the top — always show the bar
      if (y <= 10) {
        if (currentY.current !== 0) {
          currentY.current = 0;
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 16,
          }).start();
        }
        return;
      }

      // Smoothly track finger delta
      const nextY = Math.max(0, Math.min(BAR_HEIGHT, currentY.current + delta));
      
      if (nextY !== currentY.current) {
        currentY.current = nextY;
        translateY.setValue(nextY);
      }
    },
    [translateY],
  );

  return (
    <TabBarScrollContext.Provider value={{ translateY, onScroll }}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

export function useTabBarScroll() {
  return useContext(TabBarScrollContext);
}
