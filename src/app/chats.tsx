import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  other_user: string;
};

export default function ChatsScreen() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!user?.id) {
      setFetching(false);
      return;
    }

    try {
      setError(null);
      
      const { data, error: supabaseError } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (supabaseError) {
        console.error('❌ Error de Supabase:', supabaseError);
        setError(`Error al cargar: ${supabaseError.message}`);
        setChats([]);
        return;
      }

      if (data && data.length > 0) {
        const formattedChats: ChatItem[] = data.map((item: any) => ({
          id: item.id,
          name: item.other_user || item.title || "Contacto",
          last_message: item.last_message || "Sin mensajes",
          updated_at: item.updated_at 
            ? new Date(item.updated_at).toLocaleString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: 'short'
              })
            : "",
          unread_count: item.unread_count || 0,
          initials: (item.other_user || "U").substring(0, 1).toUpperCase(),
          online: item.online || false,
          other_user: item.other_user || item.title || "Contacto",
        }));
        setChats(formattedChats);
      } else {
        setChats([]);
      }
    } catch (err) {
      console.error('❌ Error inesperado:', err);
      setError('Error al cargar los chats');
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    fetchChats();
  }, [loading, user, router, fetchChats]);

  const onRefresh = () => {
    if (!user) return;
    setRefreshing(true);
    fetchChats();
  };

  // Suscripción en tiempo real
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('chats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chats',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchChats]);

  const openChat = (chat: ChatItem) => {
    router.push(`/[id]?name=${chat.name}&other_user=${chat.other_user}&chatId=${chat.id}`);
  };

  if (loading || fetching) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
        <Text style={styles.loadingText}>Cargando chats...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <Text style={styles.subText}>Tira hacia abajo para recargar</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={["#6f7e49"]}
        />
      }
    >
      <Text style={styles.title}>Mensajes</Text>

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>💬 No tienes chats aún</Text>
          <Text style={styles.emptySubText}>Inicia una conversación con alguien</Text>
        </View>
      ) : (
        chats.map((chat) => (
          <TouchableOpacity 
            key={chat.id} 
            style={styles.chatCard}
            onPress={() => openChat(chat)}
            activeOpacity={0.7}
          >
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
          </TouchableOpacity>
        ))
      )}
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
    shadowOffset: { width: 0, height: 3 },
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
    marginRight: 8,
  },
  badge: {
    backgroundColor: "#20C997",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F4F7F1",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    color: "#E74C3C",
    textAlign: "center",
    marginBottom: 10,
  },
  subText: {
    fontSize: 14,
    color: "#999",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    color: "#666",
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: "#999",
  },
});