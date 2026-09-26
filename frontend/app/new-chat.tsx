import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { MagnifyingGlass, UsersThree } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { api } from "@/src/api";
import { Avatar, EmptyState, TextField } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { useToast } from "@/src/toast";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function NewChat() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  const { data: contacts } = useQuery({ queryKey: ["contacts"], queryFn: () => api.get("/contacts") });

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { setResults(await api.get(`/users/search?q=${encodeURIComponent(query.trim())}`)); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const startChat = async (u: any) => {
    try {
      const conv = await api.post("/conversations/direct", { user_id: u.id });
      router.replace({ pathname: "/chat/[id]", params: { id: conv.id, title: u.display_name, image: u.avatar_url || "", type: "direct" } });
    } catch {
      toast.show("Could not start chat", "error");
    }
  };

  const list = results ?? contacts ?? [];

  return (
    <View style={styles.root}>
      <Header title="New chat" />
      <Pressable testID="new-group-entry" onPress={() => router.replace("/new-group")} style={styles.groupEntry}>
        <View style={styles.groupIcon}><UsersThree size={24} color={colors.onBrandPrimary} weight="fill" /></View>
        <Text style={styles.groupText}>New group</Text>
      </Pressable>
      <View style={styles.searchWrap}>
        <TextField testID="new-chat-search" placeholder="Search people" autoCapitalize="none" value={query} onChangeText={setQuery} style={{ paddingLeft: 44, height: 46 }} />
        <MagnifyingGlass size={20} color={colors.muted} style={styles.searchIcon} />
      </View>
      {searching ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable testID={`start-chat-${item.id}`} onPress={() => startChat(item)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSecondary }]}>
              <Avatar name={item.display_name} uri={item.avatar_url} id={item.id} size={48} online={item.is_online} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState title={query ? "No users found" : "No contacts yet"} subtitle={query ? "" : "Search to find friends on Ditsala."} />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  groupEntry: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  groupIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  groupText: { fontSize: 16, fontWeight: "700", color: c.brand },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, justifyContent: "center" },
  searchIcon: { position: "absolute", left: spacing.lg + spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  name: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  username: { fontSize: 13, color: c.muted, marginTop: 2 },
}));
