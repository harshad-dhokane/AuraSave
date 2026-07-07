// Aura Wealth Design Tokens
// Premium expense tracker - Deep botanical sage/emerald palette

export type ThemeColors = typeof lightColors;

export const lightColors = {
  surface: "#F8F9F8",
  onSurface: "#111211",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#111211",
  surfaceTertiary: "#F0F1EF",
  onSurfaceTertiary: "#3E403F",
  surfaceInverse: "#181A19",
  onSurfaceInverse: "#FFFFFF",

  brand: "#2A5C43",
  brandPrimary: "#337052",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#498E6C",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#DCE8E1",
  onBrandTertiary: "#2A5C43",

  success: "#287D4D",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#B94A48",
  onError: "#FFFFFF",
  info: "#4A5568",
  onInfo: "#FFFFFF",

  border: "#E5E7E5",
  borderStrong: "#D1D5D1",
  divider: "#E5E7E5",
  muted: "#6B7069",

  cat: {
    sage: "#498E6C",
    olive: "#7A8C4A",
    ochre: "#C9974C",
    terracotta: "#B96A46",
    plum: "#7C5A7A",
    slate: "#5C6B72",
    moss: "#3F6B4F",
    sand: "#B49C6A",
    rust: "#A0553B",
    forest: "#2A5C43",
  },
};

export const darkColors: ThemeColors = {
  surface: "#121413",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1A1C1B",
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#2A2D2C",
  onSurfaceTertiary: "#D1D5D1",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#111211",

  brand: "#498E6C", // Lighter brand for dark mode
  brandPrimary: "#6CB38F",
  onBrandPrimary: "#111211",
  brandSecondary: "#86CCA4",
  onBrandSecondary: "#111211",
  brandTertiary: "#1D3A2B",
  onBrandTertiary: "#6CB38F",

  success: "#45A56F",
  onSuccess: "#111211",
  warning: "#F59E0B",
  onWarning: "#111211",
  error: "#E77977",
  onError: "#111211",
  info: "#9CA3AF",
  onInfo: "#111211",

  border: "#2A2D2C",
  borderStrong: "#3E403F",
  divider: "#2A2D2C",
  muted: "#9CA3AF",

  cat: {
    sage: "#6CB38F",
    olive: "#9DB361",
    ochre: "#E6B765",
    terracotta: "#DE8D68",
    plum: "#A37DA1",
    slate: "#899BA6",
    moss: "#5D9671",
    sand: "#D4B982",
    rust: "#C97355",
    forest: "#498E6C",
  },
};

// Fallback for files that haven't been migrated to useTheme yet
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const typography = {
  displayFont: "PlusJakartaSans_700Bold",
  bodyFont: undefined, // system font (Geist not registered in Expo Go)
  sizes: {
    xs: 11,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    display: 40,
    hero: 48,
  },
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fab: {
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};
