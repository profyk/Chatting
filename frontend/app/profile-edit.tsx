import * as ImagePicker from "expo-image-picker";
import { Camera } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, uploadFile } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Avatar, Button, TextField } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { LANGUAGES } from "@/src/constants/languages";
import { useToast } from "@/src/toast";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ProfileEdit() {
  const { user, setUser } = useAuth();
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user?.display_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [lang, setLang] = useState(user?.preferred_language || "en");
  const [avatar, setAvatar] = useState(user?.avatar_url || null);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return toast.show("Photos permission needed", "error");
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      toast.show("Uploading…", "info");
      const up = await uploadFile(res.assets[0].uri, `avatar_${Date.now()}.jpg`, "image/jpeg");
      setAvatar(up.url);
    } catch { toast.show("Upload failed", "error"); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch("/users/me", { display_name: name, bio, preferred_language: lang, avatar_url: avatar });
      setUser(updated);
      toast.show("Profile saved", "success");
    } catch { toast.show("Could not save", "error"); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      <Header title="Edit profile" />
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }} bottomOffset={20}>
        <View style={{ alignItems: "center" }}>
          <Pressable testID="edit-avatar-btn" onPress={pickAvatar}>
            <Avatar name={name} uri={avatar} id={user?.id} size={110} />
            <View style={styles.camBadge}><Camera size={18} color={colors.onBrandPrimary} weight="fill" /></View>
          </Pressable>
          <Text style={styles.username}>@{user?.username}</Text>
        </View>

        <TextField testID="edit-name-input" label="Display name" value={name} onChangeText={setName} />
        <TextField testID="edit-bio-input" label="Bio" value={bio} onChangeText={setBio} placeholder="Tell friends about you" multiline style={{ height: 90, paddingTop: 12 }} />

        <View>
          <Text style={styles.label}>Preferred language</Text>
          <View style={styles.langWrap}>
            {LANGUAGES.map((l) => (
              <Pressable key={l.code} testID={`edit-lang-${l.code}`} onPress={() => setLang(l.code)} style={[styles.chip, lang === l.code && styles.chipOn]}>
                <Text style={[styles.chipText, lang === l.code && styles.chipTextOn]}>{l.flag} {l.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Button testID="save-profile-btn" title="Save changes" onPress={save} loading={saving} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  camBadge: { position: "absolute", right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: c.surface },
  username: { fontSize: 15, color: c.muted, marginTop: spacing.sm },
  label: { fontSize: 13, fontWeight: "600", color: c.onSurfaceSecondary, marginBottom: spacing.sm, marginLeft: spacing.xs },
  langWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary },
  chipOn: { backgroundColor: c.brandPrimary },
  chipText: { fontSize: 13, fontWeight: "600", color: c.onSurfaceTertiary },
  chipTextOn: { color: c.onBrandPrimary },
}));
