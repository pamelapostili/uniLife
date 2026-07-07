import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

type ChatItem = {
  id: string;
  name: string;
  last_message: string;
  updated_at: string;
  unread_count: number;
  initials: string;
  online: boolean;
};

const initialChats: ChatItem[] = [
  {
    id: "1",
    name: "Anita",
    last_message: "¿Ya terminaste la tarea de bases de datos?",
    updated_at: "10:42 AM",
    unread_count: 2,
    initials: "A",
    online: true,
  },
  {
    id: "2",
    name: "Carlosss",
    last_message: "Mañana nos vemos para Programación Web 👨‍💻",
    updated_at: "Ayer",
    unread_count: 0,
    initials: "C",
    online: false,
  },
  {
    id: "3",
    name: "Maria",
    last_message: "¿Te unirás al grupo de estudio para cálculo?",
    updated_at: "8:15 PM",
    unread_count: 0,
    initials: "M",
    online: true,
  },
];

export default function ChatsScreen() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>(initialChats);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!user) {
      setFetching(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("id, title, last_message, updated_at, other_user, unread_count")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setChats(
          data.map((item: any) => ({
            id: item.id,
            name: item.other_user ?? item.title ?? "Contacto",
            last_message: item.last_message ?? "",
            updated_at: item.updated_at ? new Date(item.updated_at).toLocaleString() : "",
            unread_count: item.unread_count ?? 0,
            initials: (item.other_user ?? "Usuario").substring(0, 1).toUpperCase(),
            online: true,
          }))
        );
      }

      setFetching(false);
    })();
  }, [loading, user, router]);

  if (loading || fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Mensajes</Text>

      {chats.map((chat) => (
        <TouchableOpacity key={chat.id} onPress={() => router.push(`/chat/${chat.id}`)} activeOpacity={0.8}>
          <View style={styles.chatCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{chat.initials}</Text>
              {chat.online && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.chatInfo}>
              <View style={styles.topRow}>
                <Text style={styles.name}>{chat.name}</Text>
                <Text style={styles.time}>{chat.updated_at}</Text>
              </View>

              <View style={styles.bottomRow}>
                <Text style={styles.message} numberOfLines={1}>
                  {chat.last_message}
                </Text>

                {chat.unread_count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{chat.unread_count}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F1",
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#b9d27b",
    marginBottom: 20,
  },

  chatCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 15,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },

  avatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#1B4079",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },

  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#4CD964",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  chatInfo: {
    flex: 1,
    marginLeft: 15,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1B4079",
  },

  time: {
    fontSize: 12,
    color: "#999",
  },

  message: {
    flex: 1,
    fontSize: 14,
    color: "#666",
  },

  badge: {
    backgroundColor: "#20C997",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
