import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowBendUpLeft,
  CaretLeft,
  Copy,
  DotsThreeVertical,
  PencilSimple,
  Phone,
  PushPin,
  Trash,
  VideoCamera,
  WarningCircle,
} from "phosphor-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Avatar } from "@/src/components/ui";
import { Composer } from "@/src/components/chat/Composer";
import { MessageBubble } from "@/src/components/chat/MessageBubble";
import { useRealtime } from "@/src/realtime";
import { useToast } from "@/src/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { daySeparator, lastSeen } from "@/src/utils/format";

const CHAT_BG = "https://images.unsplash.com/photo-1656055450481-e47bc720e687?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwxfHxzdWJ0bGUlMjBhYnN0cmFjdCUyMHdhcm0lMjB0ZXh0dXJlJTIwYmFja2dyb3VuZCUyMHNhbmQlMjBnb2xkfGVufDB8fHx8MTc5MDQzNDg1NHww&ixlib=rb-4.1.0&q=85";
const REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🙏"];

export default function ChatScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string; image?: string; type?: string }>();
  const conversationId = params.id;
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { subscribe, sendTyping, presence } = useRealtime();
  const toast = useToast();
  const qc = useQueryClient();

  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reply, setReply] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const { data: conv } = useQuery({ queryKey: ["conversation", conversationId], queryFn: () => api.get(`/conversations/${conversationId}`) });
  const isGroup = conv?.type === "group" || params.type === "group";
  const title = conv?.title || params.title || "Chat";
  const otherMember = useMemo(() => conv?.members?.find((m: any) => m.id !== user?.id), [conv, user]);

  const memberMap = useMemo(() => {
    const map: Record<string, any> = {};
    conv?.members?.forEach((m: any) => (map[m.id] = m));
    return map;
  }, [conv]);
  const msgById = useMemo(() => {
    const map: Record<string, any> = {};
    messages.forEach((m) => (map[m.id] = m));
    return map;
  }, [messages]);

  const addMessages = useCallback((incoming: any[], prepend = false) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      incoming.forEach((m) => map.set(m.id, m));
      return Array.from(map.values()).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    });
  }, []);

  const loadInitial = useCallback(async () => {
    const res = await api.get(`/conversations/${conversationId}/messages?limit=30`);
    setMessages(res.messages);
    setHasMore(res.has_more);
  }, [conversationId]);

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0].created_at;
      const res = await api.get(`/conversations/${conversationId}/messages?limit=30&before=${encodeURIComponent(oldest)}`);
      addMessages(res.messages);
      setHasMore(res.has_more);
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMore, loadingOlder, messages, conversationId, addMessages]);

  const markRead = useCallback(async () => {
    try {
      await api.post(`/conversations/${conversationId}/read`);
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch {}
  }, [conversationId, qc]);

  useEffect(() => {
    loadInitial().then(markRead);
  }, [loadInitial, markRead]);

  useEffect(() => {
    const unsub = subscribe((e) => {
      if (e.conversation_id !== conversationId) return;
      if (e.type === "message:new") {
        addMessages([e.message]);
        if (e.message.sender_id !== user?.id) markRead();
      } else if (e.type === "message:update") {
        setMessages((prev) => prev.map((m) => (m.id === e.message_id ? { ...m, text: e.text, is_edited: true } : m)));
      } else if (e.type === "message:delete") {
        setMessages((prev) => prev.map((m) => (m.id === e.message_id ? { ...m, type: "deleted", text: "", attachment: null } : m)));
      } else if (e.type === "message:react") {
        setMessages((prev) => prev.map((m) => (m.id === e.message_id ? { ...m, reactions: e.reactions } : m)));
      } else if (e.type === "message:read" && e.user_id !== user?.id) {
        setMessages((prev) => prev.map((m) => (m.sender_id === user?.id && !m.read_by?.includes(e.user_id) ? { ...m, read_by: [...(m.read_by || []), e.user_id] } : m)));
      } else if (e.type === "typing") {
        setTypingUsers((prev) => {
          if (e.is_typing) return prev.includes(e.user_id) ? prev : [...prev, e.user_id];
          return prev.filter((u) => u !== e.user_id);
        });
      } else if (e.type === "conversation:update") {
        qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      }
    });
    return unsub;
  }, [subscribe, conversationId, addMessages, markRead, user, qc]);

  const handleSend = async (payload: any) => {
    try {
      if (payload.__edit) {
        await api.patch(`/messages/${payload.__edit}`, { text: payload.text });
        setMessages((prev) => prev.map((m) => (m.id === payload.__edit ? { ...m, text: payload.text, is_edited: true } : m)));
        return;
      }
      const res = await api.post(`/conversations/${conversationId}/messages`, payload);
      addMessages([res]);
    } catch {
      toast.show("Message failed to send", "error");
    }
  };

  // Header status text
  const statusText = useMemo(() => {
    if (typingUsers.length > 0) return isGroup ? `${memberMap[typingUsers[0]]?.display_name || "Someone"} is typing…` : "typing…";
    if (isGroup) return `${conv?.members?.length || 0} members`;
    if (!otherMember) return "";
    const online = presence[otherMember.id] ?? otherMember.is_online;
    return online ? "online" : lastSeen(otherMember.last_seen);
  }, [typingUsers, isGroup, memberMap, conv, otherMember, presence]);

  const startCall = async (type: string) => {
    try {
      const res = await api.post("/calls", { conversation_id: conversationId, type });
      router.push({ pathname: "/call/[id]", params: { id: res.call.id, type, peerName: title, peerAvatar: (conv?.image_url || otherMember?.avatar_url) || "", peerId: otherMember?.id || "", outgoing: "1" } });
    } catch {
      toast.show("Could not start call", "error");
    }
  };

  // Build list with date separators (data newest first for inverted list)
  const listData = useMemo(() => {
    const items: any[] = [];
    let lastDay = "";
    messages.forEach((m) => {
      const day = daySeparator(m.created_at);
      if (day !== lastDay) {
        items.push({ __sep: true, id: `sep-${day}-${m.id}`, day });
        lastDay = day;
      }
      items.push(m);
    });
    return items.reverse();
  }, [messages]);

  const pinned = useMemo(() => (conv?.pinned_message_ids || []).map((id: string) => msgById[id]).filter(Boolean), [conv, msgById]);

  const openMenu = (m: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelected(m);
  };

  const react = async (emoji: string) => {
    const m = selected;
    setSelected(null);
    try {
      const res = await api.post(`/messages/${m.id}/react`, { emoji });
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reactions: res.reactions } : x)));
    } catch {}
  };

  const doDelete = async () => {
    const m = selected;
    setSelected(null);
    try {
      await api.del(`/messages/${m.id}`);
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, type: "deleted", text: "", attachment: null } : x)));
    } catch {}
  };

  const doPin = async () => {
    const m = selected;
    setSelected(null);
    try {
      if (m.is_pinned) await api.del(`/messages/${m.id}/pin`);
      else await api.post(`/messages/${m.id}/pin`);
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    } catch {}
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.__sep) {
      return (
        <View style={styles.sepWrap}>
          <Text style={styles.sepText}>{item.day}</Text>
        </View>
      );
    }
    const isMine = item.sender_id === user?.id;
    const sender = memberMap[item.sender_id];
    const rp = item.reply_to && msgById[item.reply_to] ? { name: memberMap[msgById[item.reply_to].sender_id]?.display_name || "You", text: msgById[item.reply_to].text || "Attachment" } : null;
    const isRead = isMine && (item.read_by || []).some((u: string) => u !== user?.id);
    return (
      <MessageBubble
        message={item}
        isMine={isMine}
        showSender={isGroup}
        senderName={sender?.display_name}
        isRead={isRead}
        onLongPress={() => openMenu(item)}
        replyPreview={rp}
        canTranslate={!!user?.is_vip}
        targetLang={user?.preferred_language || "en"}
        sourceLang={sender?.preferred_language}
      />
    );
  };

  return (
    <View style={styles.root}>
      <Image source={{ uri: CHAT_BG }} style={StyleAbsolute} contentFit="cover" />
      <View style={[StyleAbsolute, { backgroundColor: colors.chatOverlay }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable testID="chat-back-btn" onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <CaretLeft size={26} color={colors.onSurface} />
        </Pressable>
        <Pressable
          testID="chat-header-info"
          onPress={() => (isGroup ? router.push({ pathname: "/group/[id]", params: { id: conversationId } }) : otherMember && router.push({ pathname: "/user/[id]", params: { id: otherMember.id } }))}
          style={styles.headerCenter}
        >
          <Avatar name={title} uri={conv?.image_url || otherMember?.avatar_url} id={conversationId} size={40} online={!isGroup ? (otherMember ? presence[otherMember.id] ?? otherMember.is_online : undefined) : undefined} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
            <Text style={[styles.headerStatus, statusText === "typing…" && { color: colors.brandPrimary }]} numberOfLines={1}>{statusText}</Text>
          </View>
        </Pressable>
        {!isGroup && (
          <>
            <Pressable testID="chat-voice-call-btn" onPress={() => startCall("voice")} hitSlop={6} style={styles.headerIcon}>
              <Phone size={22} color={colors.brand} weight="fill" />
            </Pressable>
            <Pressable testID="chat-video-call-btn" onPress={() => startCall("video")} hitSlop={6} style={styles.headerIcon}>
              <VideoCamera size={22} color={colors.brand} weight="fill" />
            </Pressable>
          </>
        )}
        {isGroup && (
          <Pressable testID="chat-group-info-btn" onPress={() => router.push({ pathname: "/group/[id]", params: { id: conversationId } })} hitSlop={6} style={styles.headerIcon}>
            <DotsThreeVertical size={24} color={colors.onSurface} weight="bold" />
          </Pressable>
        )}
      </View>

      {pinned.length > 0 && (
        <Pressable style={styles.pinnedBar} testID="pinned-banner">
          <PushPin size={16} color={colors.gold} weight="fill" />
          <Text style={styles.pinnedText} numberOfLines={1}>{pinned[pinned.length - 1].text || "Pinned message"}</Text>
        </Pressable>
      )}

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          data={listData}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          keyboardShouldPersistTaps="handled"
        />
        <View style={{ paddingBottom: insets.bottom }}>
          <Composer
            onSend={handleSend}
            onTyping={(t) => sendTyping(conversationId, t)}
            reply={reply}
            onClearReply={() => setReply(null)}
            editing={editing}
            onClearEditing={() => setEditing(null)}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Action menu */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)} testID="action-menu-overlay">
          <View style={styles.reactionBar}>
            {REACTIONS.map((e) => (
              <Pressable key={e} testID={`react-${e}`} onPress={() => react(e)} style={styles.reactBtn}>
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actionSheet}>
            <Action icon={<ArrowBendUpLeft size={22} color={colors.onSurface} />} label="Reply" testID="action-reply" onPress={() => { setReply({ id: selected.id, name: selected.sender_id === user?.id ? "yourself" : memberMap[selected.sender_id]?.display_name || "user", text: selected.text || "Attachment" }); setSelected(null); }} />
            {!!selected?.text && <Action icon={<Copy size={22} color={colors.onSurface} />} label="Copy" testID="action-copy" onPress={async () => { await Clipboard.setStringAsync(selected.text); setSelected(null); toast.show("Copied", "success"); }} />}
            <Action icon={<PushPin size={22} color={colors.onSurface} />} label={selected?.is_pinned ? "Unpin" : "Pin"} testID="action-pin" onPress={doPin} />
            {selected?.sender_id === user?.id && !!selected?.text && <Action icon={<PencilSimple size={22} color={colors.onSurface} />} label="Edit" testID="action-edit" onPress={() => { setEditing({ id: selected.id, text: selected.text }); setSelected(null); }} />}
            {selected?.sender_id === user?.id && <Action icon={<Trash size={22} color={colors.error} />} label="Delete" danger testID="action-delete" onPress={doDelete} />}
            {selected?.sender_id !== user?.id && <Action icon={<WarningCircle size={22} color={colors.error} />} label="Report" danger testID="action-report" onPress={async () => { await api.post("/reports", { target_type: "message", target_id: selected.id, reason: "inappropriate" }); setSelected(null); toast.show("Reported to moderators", "success"); }} />}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Action({ icon, label, onPress, danger, testID }: any) {
  const styles = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
      {icon}
      <Text style={[styles.actionLabel, danger && styles.actionDanger]}>{label}</Text>
    </Pressable>
  );
}

const StyleAbsolute = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { fontSize: 17, fontWeight: "800", color: c.onSurface },
  headerStatus: { fontSize: 12.5, color: c.muted, marginTop: 1 },
  headerIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pinnedBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  pinnedText: { flex: 1, fontSize: 13, color: c.onSurfaceSecondary },
  sepWrap: { alignItems: "center", marginVertical: spacing.sm },
  sepText: { fontSize: 12, fontWeight: "700", color: c.onSurfaceTertiary, backgroundColor: c.chatOverlay, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: spacing.xl, gap: spacing.md },
  reactionBar: { flexDirection: "row", backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  reactBtn: { padding: 2 },
  actionSheet: { backgroundColor: c.surface, borderRadius: radius.lg, width: "72%", overflow: "hidden" },
  action: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  actionLabel: { fontSize: 16, fontWeight: "600", color: c.onSurface },
  actionDanger: { color: c.error },
}));
