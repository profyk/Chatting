import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight, Phone, PhoneCall, VideoCamera } from "phosphor-react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Avatar, EmptyState, Skeleton } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, spacing, useTheme } from "@/src/theme";
import { callTime } from "@/src/utils/format";

export default function CallsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const { data, isLoading } = useQuery({ queryKey: ["calls"], queryFn: () => api.get("/calls") });

  const startCall = async (peer: any, type: string) => {
    if (!peer) return;
    try {
      const conv = await api.post("/conversations/direct", { user_id: peer.id });
      const res = await api.post("/calls", { conversation_id: conv.id, type });
      router.push({
        pathname: "/call/[id]",
        params: { id: res.call.id, type, peerName: peer.display_name, peerAvatar: peer.avatar_url || "", peerId: peer.id, outgoing: "1" },
      });
    } catch {}
  };

  const renderRow = ({ item }: { item: any }) => {
    const peer = item.peer || {};
    const missed = item.is_missed;
    return (
      <View style={styles.row}>
        <Avatar name={peer.display_name} uri={peer.avatar_url} id={peer.id} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, missed && { color: colors.error }]}>{peer.display_name || "Ditsala user"}</Text>
          <View style={styles.metaRow}>
            {item.direction === "outgoing" ? (
              <ArrowUpRight size={15} color={colors.brandPrimary} weight="bold" />
            ) : (
              <ArrowDownLeft size={15} color={missed ? colors.error : colors.brandPrimary} weight="bold" />
            )}
            <Text style={styles.meta}>{callTime(item.created_at)}</Text>
          </View>
        </View>
        <Pressable testID={`call-back-${item.id}`} onPress={() => startCall(peer, item.type)} hitSlop={8} style={styles.callBtn}>
          {item.type === "video" ? (
            <VideoCamera size={22} color={colors.brandPrimary} weight="fill" />
          ) : (
            <Phone size={22} color={colors.brandPrimary} weight="fill" />
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Calls</Text>
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.md }}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <Skeleton width={48} height={48} radius={24} />
              <View style={{ gap: spacing.sm, flex: 1 }}>
                <Skeleton width="45%" height={14} />
                <Skeleton width="30%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(c) => c.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: bottomChrome + 24, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <EmptyState
              icon={<PhoneCall size={64} color={colors.brandPrimary} weight="duotone" />}
              title="No recent calls"
              subtitle="Start a voice or video call from any chat or contact."
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  brand: { fontSize: 28, fontWeight: "900", color: c.brand, letterSpacing: -0.5 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  name: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  meta: { fontSize: 13, color: c.muted },
  callBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sep: { height: 1, backgroundColor: c.divider, marginLeft: 78 },
}));
