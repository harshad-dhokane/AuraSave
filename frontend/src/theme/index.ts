// Aura Wealth Design Tokens
// Premium expense tracker - Deep botanical sage/emerald palette

export const colors = {
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

  // Muted text
  muted: "#6B7069",

  // Category palette (earthy tones, no neon)
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
