import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { UserProvider, useUser } from "../lib/user-context";

function AppTabs() {
  const { user } = useUser();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#6f7e49",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="cercanos"
        options={{
          title: "Cercanos",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="foros"
        options={{
          title: "Foros",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="notificaciones"
        options={{
          title: "Notificaciones",
          href: user ? "/notificaciones" : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="nuevo-chat"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="[id]"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="chat/[id]"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="grupo/[categoria]"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="usuario/[id]"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="login"
        options={{
          title: "Iniciar sesión",
          href: user ? null : "/login",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="log-in-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <UserProvider>
      <AppTabs />
    </UserProvider>
  );
}