import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Crown, PencilSimple, SignOut, UserMinus, WarningCircle } from "phosphor-react-native";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Avatar, Button, TextField } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { useToast } from "@/src/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function GroupInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [memberModal, setMemberModal] = useState<any>(null);

  const { data: conv, isLoading, refetch } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => { const c = await api.get(`/conversations/${id}`); setMuted(c.muted); return c; },
  });

  const isAdmin = conv?.admins?.includes(user?.id);

  const toggleMute = async (v: boolean) => { setMuted(v); await api.patch(`/conversations/${id}/settings`, { muted: v }); qc.invalidateQueries({ queryKey: ["conversations"] }); };

  const saveEdit = async () => {
    await api.patch(`/conversations/${id}`, { name: editName, description: editDesc });
    setEditOpen(false);
    refetch();
    qc.invalidateQueries({ queryKey: ["conversations"] });
    toast.show("Group updated", "success");
  };

  const leave = async () => {
    await api.del(`/conversations/${id}/members/${user?.id}`);
    qc.invalidateQueries({ queryKey: ["conversations"] });
    router.replace("/(tabs)");
  };

  const promote = async () => { await api.post(`/conversations/${id}/admins/${memberModal.id}`); setMemberModal(null); refetch(); toast.show("Promoted to admin", "success"); };
  const removeMember = async () => { await api.del(`/conversations/${id}/members/${memberModal.id}`); setMemberModal(null); refetch(); qc.invalidateQueries({ queryKey: ["conversations"] }); };

  if (isLoading || !conv) return <View style={styles.root}><Header title="Group info" /><ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} /></View>;

  return (
    <View style={styles.root}>
      <Header
        title="Group info"
        right={isAdmin ? (
          <Pressable testID="edit-group-btn" onPress={() => { setEditName(conv.title); setEditDesc(conv.description || ""); setEditOpen(true); }} style={{ padding: 10 }}>
            <PencilSimple size={22} color={colors.brand} />
          </Pressable>
        ) : undefined}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.top}>
          <Avatar name={conv.title} uri={conv.image_url} id={conv.id} size={100} />
          <Text style={styles.name}>{conv.title}</Text>
          <Text style={styles.count}>{conv.members.length} members</Text>
          {conv.description ? <Text style={styles.desc}>{conv.description}</Text> : null}
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Mute notifications</Text>
          <Switch testID="group-mute-switch" value={muted} onValueChange={toggleMute} trackColor={{ true: colors.brandPrimary }} />
        </View>

        <Text style={styles.section}>Members</Text>
        {conv.members.map((m: any) => (
          <Pressable key={m.id} testID={`group-member-${m.id}`} onPress={() => isAdmin && m.id !== user?.id ? setMemberModal(m) : router.push({ pathname: "/user/[id]", params: { id: m.id } })} style={styles.memberRow}>
            <Avatar name={m.display_name} uri={m.avatar_url} id={m.id} size={44} online={m.is_online} />
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{m.display_name}{m.id === user?.id ? " (You)" : ""}</Text>
              <Text style={styles.memberUser}>@{m.username}</Text>
            </View>
            {conv.admins.includes(m.id) && <View style={styles.adminBadge}><Crown size={12} color={colors.gold} weight="fill" /><Text style={styles.adminText}>Admin</Text></View>}
          </Pressable>
        ))}

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.xl }}>
          <Button testID="report-group-btn" title="Report group" variant="secondary" icon={<WarningCircle size={20} color={colors.error} />} onPress={async () => { await api.post("/reports", { target_type: "group", target_id: id, reason: "abuse" }); toast.show("Reported", "success"); }} />
          <Button testID="leave-group-btn" title="Leave group" variant="danger" icon={<SignOut size={20} color={colors.onError} />} onPress={leave} />
        </View>
      </ScrollView>

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit group</Text>
            <TextField label="Name" value={editName} onChangeText={setEditName} testID="edit-group-name" />
            <TextField label="Description" value={editDesc} onChangeText={setEditDesc} multiline testID="edit-group-desc" style={{ height: 90, paddingTop: 12 }} />
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
              <Button title="Cancel" variant="secondary" onPress={() => setEditOpen(false)} style={{ flex: 1 }} />
              <Button title="Save" onPress={saveEdit} style={{ flex: 1 }} testID="save-group-btn" />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!memberModal} transparent animationType="fade" onRequestClose={() => setMemberModal(null)}>
        <Pressable style={styles.actionOverlay} onPress={() => setMemberModal(null)}>
          <View style={styles.actionCard}>
            <Text style={styles.modalTitle}>{memberModal?.display_name}</Text>
            {!conv.admins.includes(memberModal?.id) && <Button title="Make admin" variant="secondary" icon={<Crown size={20} color={colors.gold} />} onPress={promote} testID="make-admin-btn" />}
            <Button title="Remove from group" variant="danger" icon={<UserMinus size={20} color={colors.onError} />} onPress={removeMember} testID="remove-member-btn" />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  top: { alignItems: "center", paddingVertical: spacing.lg, gap: 4 },
  name: { fontSize: 23, fontWeight: "900", color: c.onSurface, marginTop: spacing.sm },
  count: { fontSize: 14, color: c.muted },
  desc: { fontSize: 15, color: c.onSurfaceSecondary, textAlign: "center", paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: c.surfaceSecondary, marginHorizontal: spacing.lg, borderRadius: radius.md },
  settingLabel: { fontSize: 16, fontWeight: "600", color: c.onSurface },
  section: { fontSize: 13, fontWeight: "700", color: c.muted, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.lg, textTransform: "uppercase" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  memberName: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  memberUser: { fontSize: 13, color: c.muted },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  adminText: { fontSize: 11, fontWeight: "700", color: c.gold },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: "800", color: c.onSurface, marginBottom: spacing.sm },
  actionOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: spacing.xl },
  actionCard: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, width: "100%" },
}));
