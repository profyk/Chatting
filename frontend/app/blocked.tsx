import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Prohibit } from "phosphor-react-native";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Avatar, Button, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { useToast } from "@/src/toast";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Blocked() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["blocked"], queryFn: () => api.get("/block") });

  const unblock = async (id: string) => {
    await api.del(`/block/${id}`);
    qc.invalidateQueries({ queryKey: ["blocked"] });
    toast.show("Unblocked", "success");
  };

  return (
    <View style={styles.root}>
      <Header title="Blocked users" />
      <FlatList
        data={data ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar name={item.display_name} uri={item.avatar_url} id={item.id} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.username}>@{item.username}</Text>
            </View>
            <Button testID={`unblock-${item.id}`} title="Unblock" variant="secondary" onPress={() => unblock(item.id)} style={{ height: 40, paddingHorizontal: spacing.md }} />
          </View>
        )}
        ListEmptyComponent={<EmptyState icon={<Prohibit size={60} color={colors.brandPrimary} weight="duotone" />} title="No blocked users" subtitle="People you block will appear here." />}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  name: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  username: { fontSize: 13, color: c.muted },
}));
