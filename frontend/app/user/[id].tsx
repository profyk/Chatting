import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChatCircle, Phone, Prohibit, UserMinus, UserPlus, VideoCamera, WarningCircle } from "phosphor-react-native";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Avatar, Button } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { languageName } from "@/src/constants/languages";
import { useToast } from "@/src/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data: u, isLoading, refetch } = useQuery({ queryKey: ["user", id], queryFn: () => api.get(`/users/${id}`) });

  const openChat = async (call?: string) => {
    const conv = await api.post("/conversations/direct", { user_id: id });
    if (call) {
      const res = await api.post("/calls", { conversation_id: conv.id, type: call });
      router.push({ pathname: "/call/[id]", params: { id: res.call.id, type: call, peerName: u.display_name, peerAvatar: u.avatar_url || "", peerId: u.id, outgoing: "1" } });
    } else {
      router.push({ pathname: "/chat/[id]", params: { id: conv.id, title: u.display_name, image: u.avatar_url || "", type: "direct" } });
    }
  };

  const toggleContact = async () => {
    try {
      if (u.is_contact) await api.del(`/contacts/${id}`);
      else await api.post("/contacts", { contact_id: id });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      refetch();
      toast.show(u.is_contact ? "Removed from contacts" : "Added to contacts", "success");
    } catch { toast.show("Action failed", "error"); }
  };

  const toggleBlock = async () => {
    try {
      if (u.is_blocked) await api.del(`/block/${id}`);
      else await api.post("/block", { user_id: id });
      refetch();
      toast.show(u.is_blocked ? "Unblocked" : "User blocked", "success");
    } catch { toast.show("Action failed", "error"); }
  };

  const report = async () => {
    await api.post("/reports", { target_type: "user", target_id: id, reason: "abuse" });
    toast.show("Reported to moderators", "success");
  };

  if (isLoading || !u) return <View style={styles.root}><Header title="Profile" /><ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} /></View>;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.banner}>
          <LinearGradient colors={[colors.brand, colors.surface]} style={{ flex: 1 }} />
          <View style={[styles.bannerTop, { paddingTop: insets.top }]}>
            <Header title="" onBack={() => router.back()} />
          </View>
        </View>
        <View style={styles.avatarWrap}>
          <Avatar name={u.display_name} uri={u.avatar_url} id={u.id} size={110} online={u.is_online} />
          <Text style={styles.name}>{u.display_name}</Text>
          <Text style={styles.username}>@{u.username}</Text>
          {u.is_vip && <Text style={styles.vip}>⭐ Ditsala VIP</Text>}
          {u.bio ? <Text style={styles.bio}>{u.bio}</Text> : null}
        </View>

        <View style={styles.quickRow}>
          <QuickBtn icon={<ChatCircle size={24} color={colors.brandPrimary} weight="fill" />} label="Message" onPress={() => openChat()} testID="profile-message-btn" />
          <QuickBtn icon={<Phone size={24} color={colors.brandPrimary} weight="fill" />} label="Voice" onPress={() => openChat("voice")} testID="profile-voice-btn" />
          <QuickBtn icon={<VideoCamera size={24} color={colors.brandPrimary} weight="fill" />} label="Video" onPress={() => openChat("video")} testID="profile-video-btn" />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Preferred language</Text>
          <Text style={styles.infoValue}>{languageName(u.preferred_language)}</Text>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.lg }}>
          <Button
            testID="toggle-contact-btn"
            title={u.is_contact ? "Remove contact" : "Add to contacts"}
            variant="secondary"
            icon={u.is_contact ? <UserMinus size={20} color={colors.onSurfaceSecondary} /> : <UserPlus size={20} color={colors.onSurfaceSecondary} />}
            onPress={toggleContact}
          />
          <Button testID="report-user-btn" title="Report" variant="secondary" icon={<WarningCircle size={20} color={colors.error} />} onPress={report} />
          <Button testID="block-user-btn" title={u.is_blocked ? "Unblock user" : "Block user"} variant={u.is_blocked ? "secondary" : "danger"} icon={<Prohibit size={20} color={u.is_blocked ? colors.onSurfaceSecondary : colors.onError} />} onPress={toggleBlock} />
        </View>
      </ScrollView>
    </View>
  );
}

function QuickBtn({ icon, label, onPress, testID }: any) {
  const styles = useStyles();
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <Button testID={testID} title="" onPress={onPress} variant="secondary" style={styles.quickBtn} icon={icon} />
      <Text style={styles.quickLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  banner: { height: 140 },
  bannerTop: { position: "absolute", top: 0, left: 0, right: 0 },
  avatarWrap: { alignItems: "center", marginTop: -55, gap: 4 },
  name: { fontSize: 24, fontWeight: "900", color: c.onSurface, marginTop: spacing.sm },
  username: { fontSize: 15, color: c.muted },
  vip: { fontSize: 13, fontWeight: "700", color: c.gold, marginTop: 2 },
  bio: { fontSize: 15, color: c.onSurfaceSecondary, textAlign: "center", paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  quickRow: { flexDirection: "row", justifyContent: "center", gap: spacing.xl, marginTop: spacing.lg },
  quickBtn: { width: 64, height: 64, borderRadius: 32 },
  quickLabel: { fontSize: 13, fontWeight: "600", color: c.onSurfaceSecondary },
  infoCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg },
  infoLabel: { fontSize: 13, color: c.muted },
  infoValue: { fontSize: 16, fontWeight: "700", color: c.onSurface, marginTop: 2 },
}));
