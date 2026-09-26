import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Camera, Microphone, PaperPlaneRight, Plus, Smiley, Trash, X } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { uploadFile } from "@/src/api";
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
              <Pressable testID="attach-btn" onPress={() => pickImage(false)} style={styles.iconBtn}>
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
    </View>
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
}));
