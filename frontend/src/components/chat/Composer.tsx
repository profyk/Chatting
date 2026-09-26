import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Camera, FileText, ImageSquare, Microphone, PaperPlaneRight, Plus, Smiley, Trash, UserCircle, VideoCamera, X } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { api, uploadFile } from "@/src/api";
import { Avatar } from "@/src/components/ui";
import { useToast } from "@/src/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const QUICK_EMOJI = ["😀", "😂", "❤️", "🙏", "👍", "🎉", "🔥", "😢", "😮", "🥳", "😍", "👏", "🤝", "💯", "🙌", "✅"];

export function Composer({
  onSend,
  onTyping,
  reply,
  onClearReply,
  editing,
  onClearEditing,
}: {
  onSend: (payload: any) => void;
  onTyping: (t: boolean) => void;
  reply?: { id: string; name: string; text: string } | null;
  onClearReply: () => void;
  editing?: { id: string; text: string } | null;
  onClearEditing: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [showAttach, setShowAttach] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const typingTimeout = useRef<any>(null);
  const secTimer = useRef<any>(null);

  useEffect(() => {
    if (editing) setText(editing.text);
  }, [editing]);

  const handleChange = (v: string) => {
    setText(v);
    onTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 1500);
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (editing) {
      onSend({ __edit: editing.id, text: t });
      onClearEditing();
    } else {
      onSend({ type: "text", text: t, reply_to: reply?.id });
    }
    setText("");
    setShowEmoji(false);
    onTyping(false);
    onClearReply();
  };

  const pickImage = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.show(fromCamera ? "Camera permission needed" : "Photos permission needed", "error");
        return;
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6, mediaTypes: ["images"] })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"] });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      toast.show("Uploading…", "info");
      const up = await uploadFile(asset.uri, asset.fileName || `photo_${Date.now()}.jpg`, asset.mimeType || "image/jpeg");
      onSend({ type: "image", text: "", attachment: { url: up.url, name: up.name, mime: up.mime, size: up.size, width: asset.width, height: asset.height }, reply_to: reply?.id });
      onClearReply();
    } catch {
      toast.show("Upload failed", "error");
    }
  };

  const pickVideo = async () => {
    setShowAttach(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return toast.show("Photos permission needed", "error");
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["videos"] });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      toast.show("Uploading video…", "info");
      const up = await uploadFile(asset.uri, asset.fileName || `video_${Date.now()}.mp4`, asset.mimeType || "video/mp4");
      onSend({ type: "video", text: "", attachment: { url: up.url, name: up.name, mime: up.mime, size: up.size, duration: asset.duration ? asset.duration / 1000 : undefined, width: asset.width, height: asset.height }, reply_to: reply?.id });
      onClearReply();
    } catch {
      toast.show("Video upload failed", "error");
    }
  };

  const pickDocument = async () => {
    setShowAttach(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const doc = res.assets[0];
      toast.show("Uploading document…", "info");
      const up = await uploadFile(doc.uri, doc.name, doc.mimeType || "application/octet-stream");
      onSend({ type: "file", text: "", attachment: { url: up.url, name: up.name, mime: up.mime, size: up.size }, reply_to: reply?.id });
      onClearReply();
    } catch {
      toast.show("Document upload failed", "error");
    }
  };

  const openContacts = async () => {
    setShowAttach(false);
    try {
      const list = await api.get("/contacts");
      setContacts(list);
      setShowContacts(true);
    } catch {
      toast.show("Could not load contacts", "error");
    }
  };

  const sendContact = (u: any) => {
    setShowContacts(false);
    onSend({
      type: "contact",
      text: u.display_name,
      attachment: { url: "", mime: "contact", name: u.username, contact_id: u.id, contact_username: u.username, contact_avatar: u.avatar_url || "" },
      reply_to: reply?.id,
    });
    onClearReply();
  };

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        toast.show("Microphone permission needed", "error");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRecording(true);
      setSeconds(0);
      secTimer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.show("Cannot record audio", "error");
    }
  };

  const stopRecording = async (cancel: boolean) => {
    clearInterval(secTimer.current);
    setRecording(false);
    const dur = seconds;
    try {
      await recorder.stop();
    } catch {}
    const uri = recorder.uri;
    if (cancel || !uri || dur < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      toast.show("Sending voice note…", "info");
      const up = await uploadFile(uri, `voice_${Date.now()}.m4a`, "audio/m4a");
      onSend({ type: "voice", text: "", attachment: { url: up.url, name: up.name, mime: up.mime, size: up.size, duration: dur }, reply_to: reply?.id });
      onClearReply();
    } catch {
      toast.show("Voice note failed", "error");
    }
  };

  return (
    <View style={styles.wrap}>
      {(reply || editing) && (
        <View style={styles.replyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyTitle}>{editing ? "Editing message" : `Reply to ${reply?.name}`}</Text>
            <Text style={styles.replyBody} numberOfLines={1}>{editing ? editing.text : reply?.text}</Text>
          </View>
          <Pressable testID="cancel-reply-btn" onPress={() => { onClearReply(); onClearEditing(); setText(""); }} hitSlop={8}>
            <X size={20} color={colors.muted} />
          </Pressable>
        </View>
      )}

      {showEmoji && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiRow}>
          {QUICK_EMOJI.map((e) => (
            <Pressable key={e} testID={`emoji-${e}`} onPress={() => setText((t) => t + e)} style={styles.emojiBtn}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {recording ? (
        <View style={styles.recordingBar}>
          <Pressable testID="cancel-recording-btn" onPress={() => stopRecording(true)} style={styles.recIcon}>
            <Trash size={22} color={colors.error} weight="fill" />
          </Pressable>
          <View style={styles.recDot} />
          <Text style={styles.recTime}>Recording… {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, "0")}</Text>
          <Pressable testID="send-recording-btn" onPress={() => stopRecording(false)} style={styles.sendBtn}>
            <PaperPlaneRight size={22} color={colors.onBrandPrimary} weight="fill" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <Pressable testID="emoji-btn" onPress={() => setShowEmoji((s) => !s)} style={styles.iconBtn}>
            <Smiley size={26} color={colors.muted} weight={showEmoji ? "fill" : "regular"} />
          </Pressable>
          <TextInput
            testID="composer-input"
            style={styles.input}
            placeholder="Message"
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={handleChange}
            multiline
          />
          {!text.trim() && (
            <>
              <Pressable testID="attach-btn" onPress={() => setShowAttach(true)} style={styles.iconBtn}>
                <Plus size={26} color={colors.muted} />
              </Pressable>
              <Pressable testID="camera-btn" onPress={() => pickImage(true)} style={styles.iconBtn}>
                <Camera size={26} color={colors.muted} />
              </Pressable>
            </>
          )}
          {text.trim() ? (
            <Pressable testID="send-btn" onPress={send} style={styles.sendBtn}>
              <PaperPlaneRight size={22} color={colors.onBrandPrimary} weight="fill" />
            </Pressable>
          ) : (
            <Pressable testID="mic-btn" onPress={startRecording} style={styles.sendBtn}>
              <Microphone size={22} color={colors.onBrandPrimary} weight="fill" />
            </Pressable>
          )}
        </View>
      )}

      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setShowAttach(false)} testID="attach-menu">
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.attachGrid}>
              <AttachOption icon={<ImageSquare size={26} color={colors.onBrandPrimary} weight="fill" />} bg={colors.brandPrimary} label="Photo" onPress={() => { setShowAttach(false); pickImage(false); }} testID="attach-photo" />
              <AttachOption icon={<VideoCamera size={26} color={colors.onBrandSecondary} weight="fill" />} bg={colors.gold} label="Video" onPress={pickVideo} testID="attach-video" />
              <AttachOption icon={<FileText size={26} color={colors.onBrand} weight="fill" />} bg={colors.brand} label="Document" onPress={pickDocument} testID="attach-document" />
              <AttachOption icon={<UserCircle size={26} color={colors.onSurface} weight="fill" />} bg={colors.surfaceTertiary} label="Contact" onPress={openContacts} testID="attach-contact" />
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showContacts} transparent animationType="slide" onRequestClose={() => setShowContacts(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setShowContacts(false)} testID="contact-picker">
          <View style={[styles.sheet, { maxHeight: "70%" }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Share a contact</Text>
            <ScrollView>
              {contacts.length === 0 ? (
                <Text style={styles.sheetEmpty}>No contacts yet</Text>
              ) : (
                contacts.map((u) => (
                  <Pressable key={u.id} testID={`share-contact-${u.id}`} onPress={() => sendContact(u)} style={styles.contactRow}>
                    <Avatar name={u.display_name} uri={u.avatar_url} id={u.id} size={44} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{u.display_name}</Text>
                      <Text style={styles.contactUser}>@{u.username}</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function AttachOption({ icon, bg, label, onPress, testID }: any) {
  const styles = useStyles();
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.attachOption}>
      <View style={[styles.attachIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.attachLabel}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border, paddingBottom: spacing.xs },
  inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: c.surfaceTertiary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: Platform.OS === "ios" ? 12 : 8, paddingBottom: Platform.OS === "ios" ? 12 : 8, fontSize: 16, color: c.onSurface },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: 1 },
  replyBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  replyTitle: { fontSize: 13, fontWeight: "700", color: c.brandPrimary },
  replyBody: { fontSize: 13, color: c.muted },
  emojiRow: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: 2 },
  emojiBtn: { padding: 6 },
  recordingBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  recIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.error },
  recTime: { flex: 1, fontSize: 15, fontWeight: "600", color: c.onSurface },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing["2xl"] },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: spacing.lg },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: c.onSurface, marginBottom: spacing.md },
  sheetEmpty: { color: c.muted, textAlign: "center", padding: spacing.lg },
  attachGrid: { flexDirection: "row", justifyContent: "space-around" },
  attachOption: { alignItems: "center", gap: spacing.sm },
  attachIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  attachLabel: { fontSize: 13, fontWeight: "600", color: c.onSurfaceSecondary },
  contactRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  contactName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  contactUser: { fontSize: 13, color: c.muted },
}));
