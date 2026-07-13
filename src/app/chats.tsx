import { Ionicons } from "@expo/vector-icons";
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
  initials: string;
};

export default function ChatsScreen() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [fetching, setFetching] = useState(true);

  async function loadChats() {
    if (!user) return;

    const { data: participantRows, error: participantsError } = await supabase
      .from("chat_participants")
      .select("chat_id")
      .eq("user_id", user.id);

    if (participantsError) {
      console.warn("[chat_participants.select] ", participantsError.message);
      setFetching(false);
      return;
    }

    const chatIds = (participantRows ?? []).map((r: any) => r.chat_id);
    if (chatIds.length === 0) {
      setChats([]);
      setFetching(false);
      return;
    }

    const [{ data: chatRows, error: chatsError }, { data: otherRows, error: otherError }] = await Promise.all([
      supabase.from("chats").select("id, last_message, updated_at").in("id", chatIds),
      supabase.from("chat_participants").select("chat_id, user_id").in("chat_id", chatIds).neq("user_id", user.id),
    ]);

    if (chatsError || otherError) {
      console.warn("[chats.select] ", chatsError?.message ?? otherError?.message);
      setFetching(false);
      return;
    }

    const otherUserByChat = Object.fromEntries((otherRows ?? []).map((r: any) => [r.chat_id, r.user_id]));
    const otherUserIds = Object.values(otherUserByChat) as string[];

    let profileById: Record<string, { full_name: string | null }> = {};
    if (otherUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", otherUserIds);
      profileById = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    }

    const items: ChatItem[] = (chatRows ?? [])
      .map((chat: any) => {
        const otherId = otherUserByChat[chat.id];
        const name = profileById[otherId]?.full_name ?? "Usuario";
        return {
          id: chat.id,
          name,
          last_message: chat.last_message ?? "Aún no hay mensajes",
          updated_at: chat.updated_at ? new Date(chat.updated_at).toLocaleString() : "",
          initials: name.substring(0, 1).toUpperCase(),
        };
      })
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    setChats(items);
    setFetching(false);
  }

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!user) {
      setFetching(false);
      return;
    }

    loadChats();

    const channel = supabase
      .channel(`chat_participants:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_participants",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadChats()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [loading, user, router]);

  if (loading || fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mensajes</Text>
        <TouchableOpacity style={styles.newChatButton} onPress={() => router.push("/nuevo-chat")}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={56} color="#b9d27b" />
          <Text style={styles.emptyTitle}>Aún no tienes chats</Text>
          <Text style={styles.emptySubtitle}>
            Busca a alguien registrado en UniLife y envíale una solicitud para empezar a chatear.
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.push("/nuevo-chat")}>
            <Text style={styles.emptyButtonText}>+ Nuevo chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {chats.map((chat) => (
            <TouchableOpacity key={chat.id} onPress={() => router.push(`/chat/${chat.id}`)} activeOpacity={0.8}>
              <View style={styles.chatCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{chat.initials}</Text>
                </View>

                <View style={styles.chatInfo}>
                  <View style={styles.topRow}>
                    <Text style={styles.name}>{chat.name}</Text>
                    <Text style={styles.time}>{chat.updated_at}</Text>
                  </View>

                  <Text style={styles.message} numberOfLines={1}>
                    {chat.last_message}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F1",
    paddingHorizontal: 18,
    paddingTop: 20,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#b9d27b",
  },

  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6f7e49",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 80,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B4079",
    marginTop: 16,
  },

  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },

  emptyButton: {
    backgroundColor: "#6f7e49",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  emptyButtonText: {
    color: "#fff",
    fontWeight: "700",
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

  chatInfo: {
    flex: 1,
    marginLeft: 15,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
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
    fontSize: 14,
    color: "#666",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
