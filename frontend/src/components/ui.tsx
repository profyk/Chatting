import { Image } from "expo-image";
import { Eye, EyeSlash } from "phosphor-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { mediaHeaders, mediaUrl } from "@/src/api";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const AVATAR_COLORS = ["#0B1E5B", "#5FB325", "#F5A623", "#8B5CF6", "#0EA5E9", "#EC4899", "#14B8A6"];

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
}

export function Avatar({
  name,
  uri,
  size = 48,
  online,
  id,
}: {
  name?: string;
  uri?: string | null;
  size?: number;
  online?: boolean;
  id?: string;
}) {
  const { colors } = useTheme();
  const bg = AVATAR_COLORS[(id ? id.charCodeAt(0) + (id.charCodeAt(id.length - 1) || 0) : 0) % AVATAR_COLORS.length];
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri: mediaUrl(uri), headers: mediaHeaders() }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceTertiary }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: size * 0.4 }}>
            {initials(name).toUpperCase()}
          </Text>
        </View>
      )}
      {online != null && (
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size,
            backgroundColor: online ? colors.brandPrimary : colors.muted,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      )}
    </View>
  );
}

export function AuthedImage({ uri, style, contentFit = "cover" }: { uri?: string | null; style: any; contentFit?: any }) {
  return <Image source={{ uri: mediaUrl(uri), headers: mediaHeaders() }} style={style} contentFit={contentFit} transition={150} />;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  style,
  testID,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "gold" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  icon?: React.ReactNode;
}) {
  const styles = useBtnStyles();
  const { colors } = useTheme();
  const bgKey = {
    primary: styles.primary,
    secondary: styles.secondary,
    gold: styles.gold,
    ghost: styles.ghost,
    danger: styles.danger,
  }[variant];
  const txtColor = {
    primary: colors.onBrandPrimary,
    secondary: colors.onSurfaceSecondary,
    gold: colors.onBrandSecondary,
    ghost: colors.brandPrimary,
    danger: colors.onError,
  }[variant];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.base, bgKey, (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={txtColor} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon}
          <Text style={[styles.text, { color: txtColor }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useBtnStyles = makeStyles((c) => ({
  base: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  primary: { backgroundColor: c.brandPrimary },
  secondary: { backgroundColor: c.surfaceTertiary },
  gold: { backgroundColor: c.brandSecondary },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: c.error },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  text: { fontSize: 16, fontWeight: "700" },
}));

export function TextField({
  label,
  error,
  style,
  secureTextEntry,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const styles = useFieldStyles();
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(!!secureTextEntry);
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={colors.muted}
          secureTextEntry={secureTextEntry ? hidden : false}
          style={[styles.input, secureTextEntry ? styles.inputWithIcon : null, error ? styles.inputError : null, style]}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable testID="password-visibility-toggle" onPress={() => setHidden((h) => !h)} hitSlop={10} style={styles.eyeBtn}>
            {hidden ? <Eye size={22} color={colors.muted} /> : <EyeSlash size={22} color={colors.muted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useFieldStyles = makeStyles((c) => ({
  label: { fontSize: 13, fontWeight: "600", color: c.onSurfaceSecondary, marginLeft: spacing.xs },
  inputWrap: { justifyContent: "center" },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: c.surfaceTertiary,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: c.onSurface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inputWithIcon: { paddingRight: 52 },
  inputError: { borderColor: c.error },
  eyeBtn: { position: "absolute", right: spacing.md, height: 44, width: 32, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 12, color: c.error, marginLeft: spacing.xs },
}));

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const styles = useEmptyStyles();
  return (
    <View style={styles.wrap} testID="empty-state">
      {icon}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: spacing.lg, width: "70%" }}>{action}</View> : null}
    </View>
  );
}

const useEmptyStyles = makeStyles((c) => ({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: "700", color: c.onSurface, marginTop: spacing.md, textAlign: "center" },
  subtitle: { fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 20 },
}));

export function Skeleton({ width, height, radius: r = 8, style }: { width: number | string; height: number; radius?: number; style?: any }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);
  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: width as any, height, borderRadius: r, backgroundColor: colors.surfaceTertiary }, animStyle, style]} />;
}
