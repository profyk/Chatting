import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Bell,
  CaretRight,
  Crown,
  Info,
  Prohibit,
  ShieldCheck,
  SignOut,
  Translate,
} from "phosphor-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Avatar } from "@/src/components/ui";
import { languageName } from "@/src/constants/languages";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

function Row({ icon, label, value, onPress, tint, testID }: any) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceTertiary }]}>
      <View style={[styles.iconBox, { backgroundColor: tint || colors.brandTertiary }]}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <CaretRight size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const { data: vip } = useQuery({ queryKey: ["vip-status"], queryFn: () => api.get("/vip/status") });
  const isVip = vip?.is_vip ?? user?.is_vip;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomChrome + 32 }} showsVerticalScrollIndicator={false}>
        <Pressable testID="settings-profile-card" onPress={() => router.push("/profile-edit")} style={styles.profileCard}>
          <Avatar name={user?.display_name} uri={user?.avatar_url} id={user?.id} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.display_name}</Text>
            <Text style={styles.profileUser}>@{user?.username}</Text>
            {user?.bio ? <Text style={styles.profileBio} numberOfLines={1}>{user.bio}</Text> : null}
          </View>
          <CaretRight size={20} color={colors.muted} />
        </Pressable>

        <Pressable testID="vip-banner" onPress={() => router.push("/vip")} style={styles.vipCard}>
          <View style={styles.vipIcon}>
            <Crown size={26} color="#4A3200" weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vipTitle}>Ditsala VIP {isVip ? "· Active" : ""}</Text>
            <Text style={styles.vipSub}>{isVip ? "Translate messages across 9 languages" : "Speak every language. Upgrade now."}</Text>
          </View>
          <CaretRight size={20} color="#4A3200" />
        </Pressable>

        <Text style={styles.section}>Preferences</Text>
        <View style={styles.group}>
          <Row testID="settings-privacy" icon={<ShieldCheck size={20} color={colors.brand} weight="fill" />} label="Privacy" onPress={() => router.push("/privacy")} />
          <Row testID="settings-language" icon={<Translate size={20} color={colors.brandPrimary} weight="fill" />} label="Language" value={languageName(user?.preferred_language)} onPress={() => router.push("/profile-edit")} />
          <Row testID="settings-notifications" icon={<Bell size={20} color={colors.gold} weight="fill" />} label="Notifications" onPress={() => router.push("/privacy")} />
        </View>

        <Text style={styles.section}>Safety</Text>
        <View style={styles.group}>
          <Row testID="settings-blocked" icon={<Prohibit size={20} color={colors.error} weight="fill" />} label="Blocked users" tint={colors.surfaceTertiary} onPress={() => router.push("/blocked")} />
          <Row testID="settings-about" icon={<Info size={20} color={colors.muted} weight="fill" />} label="About Ditsala" tint={colors.surfaceTertiary} onPress={() => router.push("/vip")} />
        </View>

        <Pressable testID="sign-out-btn" onPress={signOut} style={styles.signOut}>
          <SignOut size={20} color={colors.error} weight="bold" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Text style={styles.version}>Ditsala · Your Trusted Circle</Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  brand: { fontSize: 28, fontWeight: "900", color: c.brand, letterSpacing: -0.5 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, padding: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg },
  profileName: { fontSize: 19, fontWeight: "800", color: c.onSurface },
  profileUser: { fontSize: 14, color: c.muted, marginTop: 2 },
  profileBio: { fontSize: 13, color: c.onSurfaceTertiary, marginTop: 2 },
  vipCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, backgroundColor: c.gold, borderRadius: radius.lg },
  vipIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.35)", alignItems: "center", justifyContent: "center" },
  vipTitle: { fontSize: 16, fontWeight: "800", color: "#4A3200" },
  vipSub: { fontSize: 13, color: "#5A3E00", marginTop: 2 },
  section: { fontSize: 13, fontWeight: "700", color: c.muted, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.lg, textTransform: "uppercase", letterSpacing: 0.5 },
  group: { marginHorizontal: spacing.lg, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: "600", color: c.onSurface },
  rowValue: { fontSize: 14, color: c.muted, marginRight: spacing.sm },
  signOut: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md },
  signOutText: { fontSize: 16, fontWeight: "700", color: c.error },
  version: { textAlign: "center", color: c.muted, fontSize: 12, marginTop: spacing.md, fontStyle: "italic" },
}));
