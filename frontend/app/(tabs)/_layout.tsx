import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { ChatCircleDots, GearSix, Phone, Users } from "phosphor-react-native";
import { Platform } from "react-native";

import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" />
          <NativeTabs.Trigger.Label>Chats</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="calls">
          <NativeTabs.Trigger.Icon sf="phone.fill" />
          <NativeTabs.Trigger.Label>Calls</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="contacts">
          <NativeTabs.Trigger.Icon sf="person.2.fill" />
          <NativeTabs.Trigger.Label>Contacts</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf="gearshape.fill" />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Chats", tabBarIcon: ({ color, size }) => <ChatCircleDots color={color} size={size} weight="fill" /> }}
      />
      <Tabs.Screen
        name="calls"
        options={{ title: "Calls", tabBarIcon: ({ color, size }) => <Phone color={color} size={size} weight="fill" /> }}
      />
      <Tabs.Screen
        name="contacts"
        options={{ title: "Contacts", tabBarIcon: ({ color, size }) => <Users color={color} size={size} weight="fill" /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color, size }) => <GearSix color={color} size={size} weight="fill" /> }}
      />
    </Tabs>
  );
}
