import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Check, MagnifyingGlass } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Avatar, Button, TextField } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { useToast } from "@/src/toast";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function NewGroup() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [creating, setCreating] = useState(false);

  const { data: contacts } = useQuery({ queryKey: ["contacts"], queryFn: () => api.get("/contacts") });

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const t = setTimeout(async () => {
      try { setResults(await api.get(`/users/search?q=${encodeURIComponent(query.trim())}`)); } catch { setResults([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const list = results ?? contacts ?? [];
  const selectedArr = useMemo(() => Object.values(selected), [selected]);

  const toggle = (u: any) => setSelected((s) => { const n = { ...s }; if (n[u.id]) delete n[u.id]; else n[u.id] = u; return n; });

  const create = async () => {
    if (!name.trim()) return toast.show("Enter a group name", "error");
    if (selectedArr.length < 1) return toast.show("Add at least one member", "error");
    setCreating(true);
    try {
      const conv = await api.post("/conversations/group", { name: name.trim(), member_ids: Object.keys(selected) });
      router.replace({ pathname: "/chat/[id]", params: { id: conv.id, title: conv.title, type: "group" } });
    } catch {
      toast.show("Could not create group", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      <Header title="New group" />
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <TextField testID="group-name-input" label="Group name" placeholder="e.g. Weekend Crew" value={name} onChangeText={setName} />
      </View>
      {selectedArr.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {selectedArr.map((u: any) => (
            <Pressable key={u.id} onPress={() => toggle(u)} style={styles.chip}>
              <Avatar name={u.display_name} uri={u.avatar_url} id={u.id} size={34} />
              <Text style={styles.chipText}>{u.display_name.split(" ")[0]}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.searchWrap}>
        <TextField testID="group-member-search" placeholder="Add people" autoCapitalize="none" value={query} onChangeText={setQuery} style={{ paddingLeft: 44, height: 46 }} />
        <MagnifyingGlass size={20} color={colors.muted} style={styles.searchIcon} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const on = !!selected[item.id];
          return (
            <Pressable testID={`group-select-${item.id}`} onPress={() => toggle(item)} style={styles.row}>
              <Avatar name={item.display_name} uri={item.avatar_url} id={item.id} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
              <View style={[styles.checkbox, on && styles.checkboxOn]}>{on && <Check size={16} color={colors.onBrandPrimary} weight="bold" />}</View>
            </Pressable>
          );
        }}
      />
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button testID="create-group-btn" title={`Create group${selectedArr.length ? ` (${selectedArr.length})` : ""}`} onPress={create} loading={creating} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.sm },
  chip: { alignItems: "center", gap: 2 },
  chipText: { fontSize: 11, color: c.onSurfaceTertiary },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, justifyContent: "center" },
  searchIcon: { position: "absolute", left: spacing.lg + spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  name: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  username: { fontSize: 12, color: c.muted },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: c.borderStrong, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
}));
