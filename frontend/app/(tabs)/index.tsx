import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChatCircleDots, MagnifyingGlass, PencilSimpleLine, PushPin, SpeakerSimpleX } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Avatar, Button, EmptyState, Skeleton, TextField } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { useRealtime } from "@/src/realtime";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { listTime } from "@/src/utils/format";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { presence } = useRealtime();
  const [search, setSearch] = useState("");
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get("/conversations"),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!search.trim()) return list;
    return list.filter((c: any) => c.title?.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  const renderRow = ({ item }: { item: any }) => {
    const other = item.type === "direct" ? item.members.find((m: any) => m.id !== user?.id) : null;
    const online = other ? presence[other.id] ?? other.is_online : undefined;
    const lm = item.last_message;
    const pinned = item.pinned_message_ids?.length > 0;
    return (
      <Pressable
        testID={`conversation-row-${item.id}`}
        onPress={() =>
          router.push({ pathname: "/chat/[id]", params: { id: item.id, title: item.title, image: item.image_url || "", type: item.type } })
        }
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSecondary }]}
      >
        <Avatar name={item.title} uri={item.image_url} id={item.id} size={54} online={item.type === "direct" ? online : undefined} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.time, item.unread_count > 0 && { color: colors.brandPrimary, fontWeight: "700" }]}>
              {listTime(lm?.created_at || item.updated_at)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <Text style={styles.preview} numberOfLines={1}>
              {lm ? (lm.sender_id === user?.id ? "You: " : "") + (lm.text || "") : "Tap to start chatting"}
            </Text>
            <View style={styles.rowIcons}>
              {pinned && <PushPin size={14} color={colors.muted} weight="fill" />}
              {item.muted && <SpeakerSimpleX size={14} color={colors.muted} />}
              {item.unread_count > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Ditsala</Text>
        <Pressable testID="chats-new-group-btn" onPress={() => router.push("/new-group")} style={styles.headerIcon}>
          <PencilSimpleLine size={22} color={colors.onSurface} />
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <TextField
          testID="chats-search-input"
          placeholder="Search chats"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
        <MagnifyingGlass size={20} color={colors.muted} style={styles.searchIcon} />
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.md }}>
          {[...Array(7)].map((_, i) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <Skeleton width={54} height={54} radius={27} />
              <View style={{ gap: spacing.sm, flex: 1 }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: bottomChrome + 120, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            <EmptyState
              icon={<ChatCircleDots size={64} color={colors.brandPrimary} weight="duotone" />}
              title="No conversations yet"
              subtitle="Start a chat with a friend and bring people together."
              action={<Button testID="empty-start-chat-btn" title="Start a chat" onPress={() => router.push("/new-chat")} />}
            />
          }
        />
      )}

      <Pressable
        testID="new-chat-fab"
        onPress={() => router.push("/new-chat")}
        style={[styles.fab, { bottom: bottomChrome + spacing.lg }]}
      >
        <ChatCircleDots size={26} color={colors.onBrandPrimary} weight="fill" />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  brand: { fontSize: 28, fontWeight: "900", color: c.brand, letterSpacing: -0.5 },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, justifyContent: "center" },
  search: { paddingLeft: 44, height: 46 },
  searchIcon: { position: "absolute", left: spacing.lg + spacing.md },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowTitle: { fontSize: 16, fontWeight: "700", color: c.onSurface, flex: 1, marginRight: spacing.sm },
  time: { fontSize: 12, color: c.muted },
  rowBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  preview: { fontSize: 14, color: c.muted, flex: 1, marginRight: spacing.sm },
  rowIcons: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeText: { color: c.onBrandPrimary, fontSize: 12, fontWeight: "700" },
  sep: { height: 1, backgroundColor: c.divider, marginLeft: 84 },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
}));
