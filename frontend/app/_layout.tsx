import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { IncomingCallOverlay } from "@/src/components/IncomingCall";
import { queryClient } from "@/src/query-client";
import { AuthProvider } from "@/src/auth";
import { RealtimeProvider } from "@/src/realtime";
import { ToastProvider } from "@/src/toast";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <BottomSheetModalProvider>
                <AuthProvider>
                  <RealtimeProvider>
                    <ToastProvider>
                      <ThemedStatusBar />
                      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
                        <Stack.Screen name="call/[id]" options={{ animation: "fade", presentation: "fullScreenModal" }} />
                      </Stack>
                      <IncomingCallOverlay />
                    </ToastProvider>
                  </RealtimeProvider>
                </AuthProvider>
              </BottomSheetModalProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
