// Ditsala design tokens — light + dark. Keys mirror design_guidelines.json.
// Palette: Deep Navy #0B1E5B (brand), Fresh Green #5FB325 (primary actions),
// Warm Gold #F5A623 (VIP). Never write color literals in components — read
// from here via makeStyles() / useTheme().

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#050B20",
  surfaceSecondary: "#F4F6F9",
  onSurfaceSecondary: "#1A2542",
  surfaceTertiary: "#E9EDF5",
  onSurfaceTertiary: "#2E3B5C",
  surfaceInverse: "#0B1E5B",
  onSurfaceInverse: "#FFFFFF",
  muted: "#64748B",

  brand: "#0B1E5B",
  onBrand: "#FFFFFF",
  brandPrimary: "#5FB325",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F5A623",
  onBrandSecondary: "#4A3200",
  brandTertiary: "#EAF5E4",
  onBrandTertiary: "#1E4208",

  success: "#5FB325",
  onSuccess: "#FFFFFF",
  warning: "#F5A623",
  onWarning: "#4A3200",
  error: "#E63946",
  onError: "#FFFFFF",
  info: "#0B1E5B",
  onInfo: "#FFFFFF",

  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",

  // Chat-specific
  bubbleOut: "#5FB325",
  onBubbleOut: "#FFFFFF",
  bubbleIn: "#FFFFFF",
  onBubbleIn: "#1A2542",
  chatOverlay: "rgba(244,246,249,0.72)",
  gold: "#F5A623",
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  surface: "#050B20",
  onSurface: "#F4F6F9",
  surfaceSecondary: "#0F1A38",
  onSurfaceSecondary: "#E2E8F0",
  surfaceTertiary: "#16224A",
  onSurfaceTertiary: "#C7D0E4",
  surfaceInverse: "#F4F6F9",
  onSurfaceInverse: "#050B20",
  muted: "#8A97B8",

  brand: "#0B1E5B",
  onBrand: "#FFFFFF",
  brandPrimary: "#5FB325",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F5A623",
  onBrandSecondary: "#4A3200",
  brandTertiary: "#123318",
  onBrandTertiary: "#B7E59B",

  success: "#5FB325",
  onSuccess: "#FFFFFF",
  warning: "#F5A623",
  onWarning: "#4A3200",
  error: "#F87171",
  onError: "#2A0A0A",
  info: "#7C93E8",
  onInfo: "#050B20",

  border: "#1E2A50",
  borderStrong: "#2C3A64",
  divider: "#16224A",

  bubbleOut: "#5FB325",
  onBubbleOut: "#FFFFFF",
  bubbleIn: "#0F1A38",
  onBubbleIn: "#E2E8F0",
  chatOverlay: "rgba(5,11,32,0.78)",
  gold: "#F5A623",
};

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32, "3xl": 48 };
export const radius = { sm: 8, md: 16, lg: 24, pill: 999 };
