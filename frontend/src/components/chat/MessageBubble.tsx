import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { ArrowBendUpLeft, Checks, File as FileIcon, Pause, Play, UserCircle } from "phosphor-react-native";
import React, { memo, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api, mediaUrlToken } from "@/src/api";
import { AuthedImage } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { duration as fmtDuration, messageTime } from "@/src/utils/format";

const WAVE = [8, 14, 20, 12, 24, 10, 18, 26, 14, 20, 9, 16, 22, 12, 18, 10];

function VoiceNote({ url, dur, mine }: { url: string; dur?: number; mine: boolean }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(mediaUrlToken(url));
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const tint = mine ? colors.onBubbleOut : colors.brandPrimary;

  const toggle = () => {
    if (playing) player.pause();
    else {
      if (status.currentTime >= (status.duration || 0) - 0.1) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 180 }}>
      <Pressable testID="voice-play-btn" onPress={toggle}>
        {playing ? <Pause size={28} color={tint} weight="fill" /> : <Play size={28} color={tint} weight="fill" />}
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flex: 1 }}>
        {WAVE.map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: tint, opacity: 0.4 + (i / WAVE.length) * 0.6 }} />
        ))}
      </View>
      <Text style={{ color: tint, fontSize: 12, fontWeight: "600" }}>{fmtDuration(dur)}</Text>
    </View>
  );
}

function VideoBubble({ url }: { url: string }) {
  const player = useVideoPlayer(mediaUrlToken(url) || "", (p) => { p.loop = false; });
  return <VideoView player={player} style={{ width: 240, height: 240, borderRadius: 8, marginBottom: 4 }} nativeControls contentFit="cover" testID="video-bubble" />;
}

function MessageBubbleBase({
  message,
  isMine,
  showSender,
  senderName,
  isRead,
  onLongPress,
  replyPreview,
  canTranslate,
  targetLang,
  sourceLang,
  autoTranslate,
}: {
  message: any;
  isMine: boolean;
  showSender: boolean;
  senderName?: string;
  isRead: boolean;
  onLongPress: () => void;
  replyPreview?: { name: string; text: string } | null;
  canTranslate: boolean;
  targetLang: string;
  sourceLang?: string;
  autoTranslate?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!autoTranslate || isMine || !message.text || message.type !== "text") return;
    if (sourceLang && sourceLang === targetLang) return;
    let active = true;
    (async () => {
      try {
        const r = await api.post("/vip/translate", { text: message.text, target_lang: targetLang, source_lang: sourceLang, message_id: message.id });
        if (active) setTranslated(r.text);
      } catch {
        /* ignore */
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate, isMine, message.id]);

  if (message.type === "system") {
    return (
      <View style={styles.systemWrap}>
        <Text style={styles.systemText}>{message.text}</Text>
      </View>
    );
  }
  if (message.type === "deleted" || message.deleted_at) {
    return (
      <View style={[styles.bubbleWrap, isMine ? styles.mineWrap : styles.otherWrap]}>
        <View style={[styles.bubble, isMine ? styles.mine : styles.other, styles.deleted]}>
          <Text style={[styles.deletedText, { color: isMine ? colors.onBubbleOut : colors.muted }]}>🚫 This message was deleted</Text>
        </View>
      </View>
    );
  }

  const txtColor = isMine ? colors.onBubbleOut : colors.onBubbleIn;
  const att = message.attachment;

  const doTranslate = async () => {
    if (translated) {
      setTranslated(null);
      return;
    }
    setTranslating(true);
    try {
      const r = await api.post("/vip/translate", { text: message.text, target_lang: targetLang, source_lang: sourceLang, message_id: message.id });
      setTranslated(r.text);
    } catch {
      setTranslated("(translation unavailable)");
    } finally {
      setTranslating(false);
    }
  };

  return (
    <Pressable testID={`message-${message.id}`} onLongPress={onLongPress} delayLongPress={250} style={[styles.bubbleWrap, isMine ? styles.mineWrap : styles.otherWrap]}>
      <View style={[styles.bubble, isMine ? styles.mine : styles.other]}>
        {showSender && !isMine && <Text style={styles.sender}>{senderName}</Text>}
        {message.is_forwarded && <Text style={[styles.forwarded, { color: isMine ? "rgba(255,255,255,0.8)" : colors.muted }]}>↪ Forwarded</Text>}

        {replyPreview && (
          <View style={[styles.reply, { borderLeftColor: isMine ? colors.onBubbleOut : colors.brandPrimary }]}>
            <Text style={[styles.replyName, { color: isMine ? colors.onBubbleOut : colors.brandPrimary }]} numberOfLines={1}>{replyPreview.name}</Text>
            <Text style={[styles.replyText, { color: txtColor }]} numberOfLines={1}>{replyPreview.text}</Text>
          </View>
        )}

        {att && (message.type === "image") && (
          <AuthedImage uri={att.url} style={styles.image} />
        )}
        {att && message.type === "video" && <VideoBubble url={att.url} />}
        {att && message.type === "voice" && <VoiceNote url={att.url} dur={att.duration} mine={isMine} />}
        {att && message.type === "file" && (
          <View style={styles.fileRow}>
            <View style={styles.fileIcon}><FileIcon size={22} color={colors.brandPrimary} weight="fill" /></View>
            <Text style={[styles.fileName, { color: txtColor }]} numberOfLines={1}>{att.name || "Document"}</Text>
          </View>
        )}
        {att && message.type === "contact" && (
          <Pressable
            testID={`contact-card-${att.contact_id}`}
            onPress={() => att.contact_id && router.push({ pathname: "/user/[id]", params: { id: att.contact_id } })}
            style={styles.contactCard}
          >
            {att.contact_avatar ? (
              <AuthedImage uri={att.contact_avatar} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <UserCircle size={44} color={isMine ? colors.onBubbleOut : colors.brandPrimary} weight="fill" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactCardName, { color: txtColor }]} numberOfLines={1}>{message.text}</Text>
              <Text style={[styles.contactCardUser, { color: isMine ? "rgba(255,255,255,0.8)" : colors.muted }]}>@{att.contact_username}</Text>
            </View>
          </Pressable>
        )}

        {!!message.text && message.type !== "contact" && <Text style={[styles.text, { color: txtColor }]}>{message.text}</Text>}
        {translated && (
          <View style={styles.translatedBox}>
            <Text style={styles.translatedLabel}>Translated</Text>
            <Text style={[styles.text, { color: txtColor }]}>{translated}</Text>
          </View>
        )}

        <View style={styles.metaRow}>
          {message.is_edited && <Text style={[styles.edited, { color: isMine ? "rgba(255,255,255,0.7)" : colors.muted }]}>edited</Text>}
          <Text style={[styles.time, { color: isMine ? "rgba(255,255,255,0.75)" : colors.muted }]}>{messageTime(message.created_at)}</Text>
          {isMine && <Checks size={15} color={isRead ? "#7CC4FF" : "rgba(255,255,255,0.75)"} weight="bold" />}
        </View>

        {canTranslate && !isMine && !!message.text && (
          <Pressable testID={`translate-${message.id}`} onPress={doTranslate} style={styles.translateChip} hitSlop={6}>
            <Text style={styles.translateChipText}>{translating ? "…" : translated ? "Show original" : "Translate"}</Text>
          </Pressable>
        )}
      </View>

      {message.reactions?.length > 0 && (
        <View style={[styles.reactions, isMine ? { right: spacing.sm } : { left: spacing.sm }]}>
          {[...new Set(message.reactions.map((r: any) => r.emoji))].slice(0, 4).map((e: any) => (
            <Text key={e} style={styles.reactionEmoji}>{e}</Text>
          ))}
          {message.reactions.length > 1 && <Text style={styles.reactionCount}>{message.reactions.length}</Text>}
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  bubbleWrap: { paddingHorizontal: spacing.md, marginVertical: 3, maxWidth: "82%" },
  mineWrap: { alignSelf: "flex-end", alignItems: "flex-end", marginBottom: 10 },
  otherWrap: { alignSelf: "flex-start", alignItems: "flex-start", marginBottom: 10 },
  bubble: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 70 },
  mine: { backgroundColor: c.bubbleOut, borderBottomRightRadius: 4 },
  other: { backgroundColor: c.bubbleIn, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.border },
  deleted: { opacity: 0.7 },
  deletedText: { fontSize: 14, fontStyle: "italic" },
  sender: { fontSize: 13, fontWeight: "700", color: c.brandPrimary, marginBottom: 2 },
  forwarded: { fontSize: 12, fontStyle: "italic", marginBottom: 2 },
  text: { fontSize: 15.5, lineHeight: 21 },
  image: { width: 220, height: 220, borderRadius: radius.sm, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 3 },
  time: { fontSize: 11 },
  edited: { fontSize: 11 },
  reply: { borderLeftWidth: 3, paddingLeft: spacing.sm, marginBottom: spacing.xs, opacity: 0.9 },
  replyName: { fontSize: 12, fontWeight: "700" },
  replyText: { fontSize: 12 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4, minWidth: 160 },
  fileIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  fileName: { fontSize: 14, fontWeight: "600", flex: 1 },
  contactCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4, minWidth: 200 },
  contactCardName: { fontSize: 15, fontWeight: "700" },
  contactCardUser: { fontSize: 12 },
  systemWrap: { alignItems: "center", marginVertical: spacing.sm },
  systemText: { fontSize: 12, color: c.muted, backgroundColor: c.chatOverlay, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden" },
  reactions: { position: "absolute", bottom: -12, flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: c.border, gap: 2 },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, color: c.muted, fontWeight: "700" },
  translatedBox: { marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.08)" },
  translatedLabel: { fontSize: 10, fontWeight: "700", color: c.gold, marginBottom: 2, textTransform: "uppercase" },
  translateChip: { marginTop: spacing.xs, alignSelf: "flex-start" },
  translateChipText: { fontSize: 12, fontWeight: "700", color: c.gold },
}));

export const MessageBubble = memo(MessageBubbleBase);
