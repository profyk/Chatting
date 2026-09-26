import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, TextField } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Pressable testID="back-btn" onPress={() => router.back()} style={styles.back}>
        <CaretLeft size={26} color={colors.onSurface} />
      </Pressable>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your Ditsala circle</Text>

        <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
          <TextField
            testID="login-email-input"
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            testID="login-password-input"
            label="Password"
            placeholder="Your password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={error}
          />
          <Button testID="login-submit-btn" title="Log in" onPress={submit} loading={loading} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  back: { padding: spacing.md, marginLeft: spacing.sm, width: 50 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, flexGrow: 1 },
  title: { fontSize: 30, fontWeight: "900", color: c.onSurface },
  subtitle: { fontSize: 16, color: c.muted, marginTop: spacing.xs },
}));
