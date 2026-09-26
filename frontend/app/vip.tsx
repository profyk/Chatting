import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CaretLeft, Check, Crown } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Button } from "@/src/components/ui";
import { useToast } from "@/src/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const VIP_HERO = "https://images.unsplash.com/photo-1761437856376-2ce1c483343b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwbHV4dXJ5JTIwZ29sZCUyMGFic3RyYWN0JTIwYmFja2dyb3VuZCUyMGRhcmt8ZW58MHx8fHwxNzkwNDM0ODU1fDA&ixlib=rb-4.1.0&q=85";
const FEATURES = [
  "Real-time translation across 9 languages",
  "Chat naturally — everyone reads in their own language",
  "English, Setswana, isiZulu, Afrikaans, Tshivenda, Xitsonga, French, Spanish, Chinese",
  "Priority message delivery & VIP badge",
];

export default function VIP() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: status } = useQuery({ queryKey: ["vip-status"], queryFn: () => api.get("/vip/status") });
  const isVip = status?.is_vip;

  const subscribe = async () => {
    setLoading(true);
    try {
      await api.post("/vip/subscribe");
      await refresh();
      qc.invalidateQueries({ queryKey: ["vip-status"] });
      toast.show("Welcome to Ditsala VIP! 🎉", "success");
    } catch { toast.show("Subscription failed", "error"); }
    finally { setLoading(false); }
  };

  const cancel = async () => {
    setLoading(true);
    try { await api.post("/vip/cancel"); await refresh(); qc.invalidateQueries({ queryKey: ["vip-status"] }); toast.show("VIP cancelled", "info"); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.root}>
      <Image source={{ uri: VIP_HERO }} style={styles.hero} contentFit="cover" />
      <LinearGradient colors={["rgba(5,11,32,0.3)", "rgba(5,11,32,0.85)", "#050B20"]} style={styles.heroScrim} />
      <Pressable testID="vip-back-btn" onPress={() => router.back()} style={[styles.back, { top: insets.top + 6 }]}>
        <CaretLeft size={26} color="#fff" />
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: 200 }}>
        <View style={styles.crownWrap}>
          <View style={styles.crown}><Crown size={40} color="#4A3200" weight="fill" /></View>
        </View>
        <Text style={styles.title}>Ditsala VIP</Text>
        <Text style={styles.subtitle}>Speak Every Language</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <View style={styles.checkCircle}><Check size={14} color="#050B20" weight="bold" /></View>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {isVip && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeText}>⭐ Your VIP is active</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {isVip ? (
          <Button testID="vip-cancel-btn" title="Cancel VIP" variant="secondary" onPress={cancel} loading={loading} />
        ) : (
          <Button testID="vip-subscribe-btn" title="Upgrade Now" variant="gold" onPress={subscribe} loading={loading} />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: "#050B20" },
  hero: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  heroScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 320 },
  back: { position: "absolute", left: spacing.md, zIndex: 10, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  crownWrap: { alignItems: "center" },
  crown: { width: 80, height: 80, borderRadius: 40, backgroundColor: c.gold, alignItems: "center", justifyContent: "center", shadowColor: c.gold, shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  title: { fontSize: 38, fontWeight: "900", color: "#fff", textAlign: "center", marginTop: spacing.lg },
  subtitle: { fontSize: 18, fontWeight: "700", color: c.gold, textAlign: "center", fontStyle: "italic" },
  features: { paddingHorizontal: spacing.xl, gap: spacing.md, marginTop: spacing["2xl"] },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.gold, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontSize: 15.5, color: "rgba(255,255,255,0.92)", lineHeight: 22 },
  activeBadge: { marginTop: spacing.xl, alignSelf: "center", backgroundColor: "rgba(245,166,35,0.2)", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill },
  activeText: { color: c.gold, fontWeight: "800", fontSize: 15 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.md },
}));
