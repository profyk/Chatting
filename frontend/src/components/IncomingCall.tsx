import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Phone, PhoneX, VideoCamera } from "phosphor-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useRealtime } from "@/src/realtime";
import { Avatar } from "@/src/components/ui";

export function IncomingCallOverlay() {
  const { incomingCall, clearIncomingCall } = useRealtime();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (!incomingCall) return null;
  const caller = incomingCall.caller || {};
  const isVideo = incomingCall.type === "video";

  const decline = async () => {
    try {
      await api.patch(`/calls/${incomingCall.id}`, { status: "declined" });
    } catch {}
    clearIncomingCall();
  };
  const accept = async () => {
    try {
      await api.patch(`/calls/${incomingCall.id}`, { status: "answered" });
    } catch {}
    const call = incomingCall;
    clearIncomingCall();
    router.push({
      pathname: "/call/[id]",
      params: { id: call.id, type: call.type, peerName: caller.display_name, peerAvatar: caller.avatar_url || "", peerId: caller.id },
    });
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} testID="incoming-call-overlay">
      <LinearGradient colors={["#0B1E5B", "#050B20"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 48 }]}>
        <View style={{ alignItems: "center", gap: 16 }}>
          <Avatar name={caller.display_name} uri={caller.avatar_url} id={caller.id} size={120} />
          <Text style={styles.name}>{caller.display_name || "Ditsala user"}</Text>
          <Text style={styles.sub}>Incoming {isVideo ? "video" : "voice"} call…</Text>
        </View>
        <View style={styles.actions}>
          <Pressable testID="decline-call-btn" onPress={decline} style={[styles.circle, { backgroundColor: "#E63946" }]}>
            <PhoneX size={30} color="#fff" weight="fill" />
          </Pressable>
          <Pressable testID="accept-call-btn" onPress={accept} style={[styles.circle, { backgroundColor: "#5FB325" }]}>
            {isVideo ? <VideoCamera size={30} color="#fff" weight="fill" /> : <Phone size={30} color="#fff" weight="fill" />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 10000, elevation: 20 },
  content: { flex: 1, justifyContent: "space-between", alignItems: "center" },
  name: { color: "#fff", fontSize: 28, fontWeight: "800" },
  sub: { color: "#F5A623", fontSize: 15, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 64 },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
});
