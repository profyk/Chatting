import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui";
import { spacing } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1589483232748-515c025575bc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBkaXZlcnNlJTIwQWZyaWNhbiUyMGZyaWVuZHMlMjBsYXVnaGluZyUyMHBvcnRyYWl0JTIwcHJlbWl1bSUyMHBob3RvZ3JhcGh5fGVufDB8fHx8MTc5MDQzNDg1NHww&ixlib=rb-4.1.0&q=85";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(5,11,32,0.2)", "rgba(5,11,32,0.55)", "rgba(5,11,32,0.96)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.brandRow}>
          <Image source={require("../../assets/images/ditsala-logo.png")} style={styles.logo} contentFit="contain" />
        </View>

        <View style={{ gap: spacing.md }}>
          <Text style={styles.headline}>Ditsala</Text>
          <Text style={styles.tag}>Your Trusted Circle</Text>
          <Text style={styles.sub}>
            Private messaging, group chats, calls and real multilingual conversations — bringing people together.
          </Text>

          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <Button testID="welcome-signup-btn" title="Create account" onPress={() => router.push("/(auth)/signup")} />
            <Button
              testID="welcome-login-btn"
              title="I already have an account"
              variant="secondary"
              onPress={() => router.push("/(auth)/login")}
              style={styles.loginBtn}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050B20" },
  content: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl },
  brandRow: { alignItems: "center", marginTop: spacing.xl },
  logo: { width: 130, height: 130 },
  headline: { color: "#fff", fontSize: 44, fontWeight: "900", letterSpacing: -1 },
  tag: { color: "#F5A623", fontSize: 18, fontWeight: "700", fontStyle: "italic" },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 16, lineHeight: 24 },
  loginBtn: { backgroundColor: "rgba(255,255,255,0.92)" },
});
