import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, spacing, radius } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastCtx = { show: (message: string, kind?: ToastKind) => void };

const Ctx = createContext<ToastCtx | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);
  const timer = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    setToast({ message, kind });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          entering={FadeInUp}
          exiting={FadeOutUp}
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + spacing.sm }]}
        >
          <View style={[styles.toast, styles[toast.kind]]} testID="app-toast">
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 9999 },
  toast: {
    maxWidth: "90%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  success: { backgroundColor: c.success },
  error: { backgroundColor: c.error },
  info: { backgroundColor: c.surfaceInverse },
  text: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
}));

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
