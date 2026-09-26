import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { MagnifyingGlass, UserPlus, Users } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Avatar, EmptyState, Skeleton, TextField } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { useToast } from "@/src/toast";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;

  const { data: contacts, isLoading } = useQuery({ queryKey: ["contacts"], queryFn: () => api.get("/contacts") });

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const addContact = async (id: string) => {
    try {
      await api.post("/contacts", { contact_id: id });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.show("Contact added", "success");
    } catch {
      toast.show("Could not add contact", "error");
    }
  };

  const list = results ?? contacts ?? [];

  const renderRow = ({ item }: { item: any }) => (
    <Pressable
      testID={`contact-row-${item.id}`}
      onPress={() => router.push({ pathname: "/user/[id]", params: { id: item.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceSecondary }]}
    >
      <Avatar name={item.display_name} uri={item.avatar_url} id={item.id} size={48} online={item.is_online} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.display_name}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      {results && (
        <Pressable testID={`add-contact-${item.id}`} onPress={() => addContact(item.id)} style={styles.addBtn} hitSlop={8}>
          <UserPlus size={20} color={colors.brandPrimary} weight="fill" />
        </Pressable>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Contacts</Text>
      </View>
      <View style={styles.searchWrap}>
        <TextField
          testID="contacts-search-input"
          placeholder="Search by name or @username"
          autoCapitalize="none"
          value={query}
          onChangeText={setQuery}
          style={{ paddingLeft: 44, height: 46 }}
        />
        <MagnifyingGlass size={20} color={colors.muted} style={styles.searchIcon} />
      </View>

      {query.trim() && searching ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : isLoading && !results ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.md }}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
              <Skeleton width={48} height={48} radius={24} />
              <View style={{ gap: spacing.sm, flex: 1 }}>
                <Skeleton width="50%" height={14} />
                <Skeleton width="35%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => u.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: bottomChrome + 24, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon={<Users size={64} color={colors.brandPrimary} weight="duotone" />}
              title={query.trim() ? "No users found" : "No contacts yet"}
              subtitle={query.trim() ? "Try another name or username." : "Search above to find friends on Ditsala."}
            />
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  brand: { fontSize: 28, fontWeight: "900", color: c.brand, letterSpacing: -0.5 },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, justifyContent: "center" },
  searchIcon: { position: "absolute", left: spacing.lg + spacing.md },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  name: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  username: { fontSize: 13, color: c.muted, marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  sep: { height: 1, backgroundColor: c.divider, marginLeft: 78 },
}));
