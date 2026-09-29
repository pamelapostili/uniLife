import { Ionicons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Header from "../components/Header";
import { UserProvider, useUser } from "../lib/user-context";

// Rutas que se navegan "hacia adentro" (no son raíz de un tab) y por lo
// tanto muestran flecha de regreso en el encabezado global en vez del logo.
const BACK_ROUTES = new Set(["usuario/[id]", "nuevo-chat"]);
// Rutas que ya traen su propio encabezado a medida (banner de grupo, barra
// de chat con avatar): se les apaga el encabezado global para no duplicarlo.
const OWN_HEADER_ROUTES = new Set(["chat/[id]", "grupo/[categoria]"]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const onLoginScreen = pathname === "/login";
  const onAuthCallback = pathname === "/auth/callback";

  useEffect(() => {
    if (loading || onAuthCallback) return;
    if (!user && !onLoginScreen) {
      router.replace("/login");
    } else if (user && onLoginScreen) {
      router.replace("/");
    }
  }, [user, loading, onLoginScreen, onAuthCallback]);

  // Mientras se resuelve la sesión, o justo antes de redirigir, no mostramos
  // contenido para evitar el parpadeo de pantallas protegidas sin sesión.
  // /auth/callback se deja pasar siempre: esa pantalla procesa el token del
  // login social y se redirige a sí misma cuando termina.
  const shouldBlock = !onAuthCallback && (loading || (!user && !onLoginScreen) || (user && onLoginScreen));

  if (shouldBlock) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  return <>{children}</>;
}

function AppTabs() {
  const { user } = useUser();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: !OWN_HEADER_ROUTES.has(route.name),
        header: () => <Header back={BACK_ROUTES.has(route.name)} />,
        tabBarActiveTintColor: "#6f7e49",
      })}
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
        name="auth/callback"
        options={{
          href: null,
          headerShown: false,
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
          headerShown: false,
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
      <AuthGate>
        <AppTabs />
      </AuthGate>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f8fa",
  },
});