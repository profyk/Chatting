import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Microphone, MicrophoneSlash, PhoneX, SpeakerHigh, SpeakerSimpleSlash, VideoCamera, VideoCameraSlash } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Avatar } from "@/src/components/ui";
import { useRealtime } from "@/src/realtime";
import { duration as fmtDuration } from "@/src/utils/format";

export default function CallScreen() {
  const params = useLocalSearchParams<{ id: string; type?: string; peerName?: string; peerAvatar?: string; peerId?: string; outgoing?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { subscribe } = useRealtime();
  const isVideo = params.type === "video";
  const outgoing = params.outgoing === "1";

  const [state, setState] = useState<"ringing" | "connected" | "ended">(outgoing ? "ringing" : "connected");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [camOn, setCamOn] = useState(isVideo);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (state === "connected") {
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timer.current);
  }, [state]);

  useEffect(() => {
    const unsub = subscribe((e) => {
      if (e.type === "call:update" && e.call_id === params.id) {
        if (e.status === "answered") setState("connected");
        if (["declined", "ended", "missed"].includes(e.status)) endLocal(false);
      }
    });
    // demo: auto-connect outgoing after a short ring (no real signaling provider yet)
    const t = outgoing ? setTimeout(() => setState("connected"), 2500) : null;
    return () => { unsub(); if (t) clearTimeout(t); };
  }, [subscribe, params.id, outgoing]);

  const endLocal = async (notify: boolean) => {
    clearInterval(timer.current);
    if (notify) {
      try { await api.patch(`/calls/${params.id}`, { status: "ended", duration: seconds }); } catch {}
    }
    setState("ended");
    router.back();
  };

  const statusLine = state === "ringing" ? "Ringing…" : state === "connected" ? fmtDuration(seconds) || "00:00" : "Call ended";

  return (
    <View style={styles.root} testID="active-call-screen">
      <LinearGradient colors={["#0B1E5B", "#050B20"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.top, { paddingTop: insets.top + 60 }]}>
        <Avatar name={params.peerName} uri={params.peerAvatar || null} id={params.peerId} size={140} />
        <Text style={styles.name}>{params.peerName || "Ditsala user"}</Text>
        <Text style={styles.status}>{statusLine}</Text>
        <Text style={styles.hint}>{isVideo ? "Video" : "Voice"} call · end-to-end secured</Text>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 40 }]}>
        <Control on={muted} icon={muted ? <MicrophoneSlash size={26} color="#fff" weight="fill" /> : <Microphone size={26} color="#fff" weight="fill" />} label="Mute" onPress={() => setMuted((m) => !m)} testID="call-mute-btn" />
        <Control on={speaker} icon={speaker ? <SpeakerHigh size={26} color="#fff" weight="fill" /> : <SpeakerSimpleSlash size={26} color="#fff" weight="fill" />} label="Speaker" onPress={() => setSpeaker((s) => !s)} testID="call-speaker-btn" />
        {isVideo && <Control on={camOn} icon={camOn ? <VideoCamera size={26} color="#fff" weight="fill" /> : <VideoCameraSlash size={26} color="#fff" weight="fill" />} label="Camera" onPress={() => setCamOn((c) => !c)} testID="call-camera-btn" />}
        <Pressable testID="call-end-btn" onPress={() => endLocal(true)} style={[styles.circle, styles.endBtn]}>
          <PhoneX size={30} color="#fff" weight="fill" />
        </Pressable>
      </View>
    </View>
  );
}

function Control({ icon, label, onPress, on, testID }: any) {
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <Pressable testID={testID} onPress={onPress} style={[styles.circle, { backgroundColor: on ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.3)" }]}>
        {icon}
      </Pressable>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between" },
  top: { alignItems: "center", gap: 12 },
  name: { color: "#fff", fontSize: 30, fontWeight: "900", marginTop: 12 },
  status: { color: "#F5A623", fontSize: 18, fontWeight: "700" },
  hint: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  controls: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 28, flexWrap: "wrap" },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  endBtn: { backgroundColor: "#E63946", width: 68, height: 68, borderRadius: 34 },
  ctrlLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600" },
});
