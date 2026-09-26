import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button, TextField } from "@/src/components/ui";
import { LANGUAGES } from "@/src/constants/languages";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const [form, setForm] = useState({ display_name: "", username: "", email: "", password: "" });
  const [lang, setLang] = useState("en");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters");
    if (!form.display_name || !form.username || !form.email) return setError("Please fill in all fields");
    setLoading(true);
    try {
      await signUp({ ...form, email: form.email.trim().toLowerCase(), username: form.username.trim().toLowerCase(), preferred_language: lang });
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
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bottomOffset={20}>
        <Text style={styles.title}>Join Ditsala</Text>
        <Text style={styles.subtitle}>Create your account and connect with friends</Text>

        <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
          <TextField testID="signup-name-input" label="Display name" placeholder="e.g. Thabo Mokoena" value={form.display_name} onChangeText={set("display_name")} />
          <TextField testID="signup-username-input" label="Username" placeholder="thabo" autoCapitalize="none" value={form.username} onChangeText={set("username")} />
          <TextField testID="signup-email-input" label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={set("email")} />
          <TextField testID="signup-password-input" label="Password" placeholder="At least 8 characters" secureTextEntry value={form.password} onChangeText={set("password")} error={error} />

          <View>
            <Text style={styles.label}>Preferred language</Text>
            <View style={styles.langWrap}>
              {LANGUAGES.map((l) => (
                <Pressable
                  key={l.code}
                  testID={`lang-${l.code}`}
                  onPress={() => setLang(l.code)}
                  style={[styles.langChip, lang === l.code && styles.langChipActive]}
                >
                  <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
                    {l.flag} {l.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Button testID="signup-submit-btn" title="Create account" onPress={submit} loading={loading} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  back: { padding: spacing.md, marginLeft: spacing.sm, width: 50 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing["2xl"], flexGrow: 1 },
  title: { fontSize: 30, fontWeight: "900", color: c.onSurface },
  subtitle: { fontSize: 16, color: c.muted, marginTop: spacing.xs },
  label: { fontSize: 13, fontWeight: "600", color: c.onSurfaceSecondary, marginLeft: spacing.xs, marginBottom: spacing.sm },
  langWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  langChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  langChipActive: { backgroundColor: c.brandPrimary },
  langText: { fontSize: 13, fontWeight: "600", color: c.onSurfaceTertiary },
  langTextActive: { color: c.onBrandPrimary },
}));
