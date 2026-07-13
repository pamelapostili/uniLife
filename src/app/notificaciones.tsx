import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

type RequestItem = {
  id: string;
  sender_id: string;
  sender_name: string;
};

export default function NotificacionesScreen() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  async function loadRequests() {
    if (!user) return;

    const { data, error } = await supabase
      .from("message_requests")
      .select("id, sender_id")
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[message_requests.select] ", error.message);
      setFetching(false);
      return;
    }

    const senderIds = (data ?? []).map((r: any) => r.sender_id);
    let names: Record<string, string> = {};

    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);

      names = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.full_name ?? "Usuario"]));
    }

    setItems(
      (data ?? []).map((r: any) => ({
        id: r.id,
        sender_id: r.sender_id,
        sender_name: names[r.sender_id] ?? "Usuario",
      }))
    );
    setFetching(false);
  }

  useEffect(() => {
    if (!user) return;

    loadRequests();

    const channel = supabase
      .channel(`message_requests:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_requests",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => loadRequests()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  async function acceptRequest(item: RequestItem) {
    if (!user) return;
    setBusyId(item.id);

    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .insert({ updated_at: new Date().toISOString() })
      .select("id")
      .single();

    if (chatError || !chat) {
      console.warn("[chats.insert] ", chatError?.message);
      setBusyId(null);
      return;
    }

    const { error: participantsError } = await supabase.from("chat_participants").insert([
      { chat_id: chat.id, user_id: user.id },
      { chat_id: chat.id, user_id: item.sender_id },
    ]);

    if (participantsError) {
      console.warn("[chat_participants.insert] ", participantsError.message);
      setBusyId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("message_requests")
      .update({ status: "accepted", chat_id: chat.id, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    if (updateError) {
      console.warn("[message_requests.update] ", updateError.message);
    }

    setItems((prev) => prev.filter((r) => r.id !== item.id));
    setBusyId(null);
    router.push(`/chat/${chat.id}`);
  }

  async function rejectRequest(item: RequestItem) {
    setBusyId(item.id);

    const { error } = await supabase
      .from("message_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", item.id);

    if (error) {
      console.warn("[message_requests.reject] ", error.message);
    }

    setItems((prev) => prev.filter((r) => r.id !== item.id));
    setBusyId(null);
  }

  if (loading || fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notificaciones</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No tienes solicitudes pendientes.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.sender_name.substring(0, 1).toUpperCase()}</Text>
            </View>

            <View style={styles.info}>
              <Text style={styles.name}>{item.sender_name}</Text>
              <Text style={styles.subtitle}>Quiere iniciar un chat contigo</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => rejectRequest(item)}
                disabled={busyId === item.id}
              >
                <Text style={styles.rejectText}>Rechazar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => acceptRequest(item)}
                disabled={busyId === item.id}
              >
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.acceptText}>Aceptar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
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
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1B4079",
    marginBottom: 16,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1B4079",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1B4079",
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: "#6f7e49",
  },
  rejectButton: {
    backgroundColor: "#e5e7eb",
  },
  acceptText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  rejectText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
