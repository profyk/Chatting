import { useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Header } from "@/src/components/Header";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

function ToggleRow({ label, hint, value, onChange, testID }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch testID={testID} value={value} onValueChange={onChange} trackColor={{ true: colors.brandPrimary }} />
    </View>
  );
}

export default function Privacy() {
  const { user, refresh } = useAuth();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [p, setP] = useState<any>(user?.privacy || {});

  useEffect(() => { setP(user?.privacy || {}); }, [user]);

  const update = async (key: string, value: any) => {
    const next = { ...p, [key]: value };
    setP(next);
    await api.patch("/users/me/privacy", { [key]: value });
    refresh();
  };

  return (
    <View style={styles.root}>
      <Header title="Privacy" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Text style={styles.section}>Visibility</Text>
        <View style={styles.group}>
          <ToggleRow testID="toggle-read-receipts" label="Read receipts" hint="Let others see when you've read messages" value={!!p.read_receipts} onChange={(v: boolean) => update("read_receipts", v)} />
          <ToggleRow testID="toggle-online-status" label="Online status" hint="Show when you're active" value={!!p.online_status} onChange={(v: boolean) => update("online_status", v)} />
        </View>

        <Text style={styles.section}>Contacts only</Text>
        <View style={styles.group}>
          <ToggleRow testID="toggle-profile-contacts" label="Profile visible to contacts only" value={p.profile === "contacts"} onChange={(v: boolean) => update("profile", v ? "contacts" : "everyone")} />
          <ToggleRow testID="toggle-message-contacts" label="Only contacts can message me" value={p.message === "contacts"} onChange={(v: boolean) => update("message", v ? "contacts" : "everyone")} />
          <ToggleRow testID="toggle-call-contacts" label="Only contacts can call me" value={p.call === "contacts"} onChange={(v: boolean) => update("call", v ? "contacts" : "everyone")} />
        </View>

        <Text style={styles.section}>Translation</Text>
        <View style={styles.group}>
          <ToggleRow testID="toggle-auto-translate" label="Auto-translate incoming (VIP)" hint="Automatically translate messages to your language" value={!!p.auto_translate} onChange={(v: boolean) => update("auto_translate", v)} />
        </View>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  section: { fontSize: 13, fontWeight: "700", color: c.muted, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.lg, textTransform: "uppercase", letterSpacing: 0.5 },
  group: { marginHorizontal: spacing.lg, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  label: { fontSize: 16, fontWeight: "600", color: c.onSurface },
  hint: { fontSize: 13, color: c.muted, marginTop: 2 },
}));
