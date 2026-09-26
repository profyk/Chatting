import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, spacing, useTheme } from "@/src/theme";

export function Header({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <Pressable testID="header-back-btn" onPress={onBack || (() => router.back())} hitSlop={8} style={styles.back}>
        <CaretLeft size={26} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: "800", color: c.onSurface },
  right: { flexDirection: "row", alignItems: "center" },
}));
