import { Image } from "expo-image";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/src/auth";
import { spacing } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <Image source={require("../assets/images/ditsala-logo.png")} style={styles.logo} contentFit="contain" />
        <Text style={styles.tag}>Your Trusted Circle</Text>
        <ActivityIndicator color="#5FB325" style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  return <Redirect href={user ? "/(tabs)" : "/(auth)/welcome"} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050B20", alignItems: "center", justifyContent: "center" },
  logo: { width: 200, height: 200 },
  tag: { color: "#F5A623", fontSize: 15, fontWeight: "600", fontStyle: "italic", marginTop: spacing.sm },
});
