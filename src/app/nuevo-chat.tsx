import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { fetchRequestInfoBulk, RequestInfo, sendMessageRequest } from "../lib/messageRequests";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

type ProfileResult = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function NuevoChatScreen() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState<Record<string, RequestInfo>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .neq("id", user.id)
        .ilike("full_name", `%${trimmed}%`)
        .limit(20);

      if (!error && data) {
        setResults(data as ProfileResult[]);
        setRequests(await fetchRequestInfoBulk(user.id, data.map((p: any) => p.id)));
      } else if (error) {
        console.warn("[profiles.search] ", error.message);
      }
      setSearching(false);
    }, 350);

    return () => clearTimeout(timeout);
  }, [query, user]);

  async function sendRequest(otherId: string) {
    if (!user) return;
    setSendingId(otherId);

    const { error } = await sendMessageRequest(user.id, otherId);

    if (error) {
      console.warn("[message_requests.upsert] ", error.message);
    } else {
      setRequests((prev) => ({
        ...prev,
        [otherId]: { ...prev[otherId], mine: { status: "pending", chat_id: null } },
      }));
    }
    setSendingId(null);
  }

  function renderAction(item: ProfileResult) {
    const info = requests[item.id];
    const accepted = info?.mine?.status === "accepted" || info?.theirs?.status === "accepted";

    if (accepted) {
      const chatId = info?.mine?.chat_id ?? info?.theirs?.chat_id;
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.openButton]}
          onPress={() => chatId && router.push(`/chat/${chatId}`)}
        >
          <Text style={styles.actionText}>Abrir chat</Text>
        </TouchableOpacity>
      );
    }

    if (info?.theirs?.status === "pending") {
      return (
        <TouchableOpacity
          style={[styles.actionButton, styles.respondButton]}
          onPress={() => router.push("/notificaciones")}
        >
          <Text style={styles.actionText}>Responder solicitud</Text>
        </TouchableOpacity>
      );
    }

    if (info?.mine?.status === "pending") {
      return (
        <View style={[styles.actionButton, styles.sentButton]}>
          <Text style={styles.sentText}>Solicitud enviada</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.actionButton, styles.sendButton]}
        onPress={() => sendRequest(item.id)}
        disabled={sendingId === item.id}
      >
        {sendingId === item.id ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.actionText}>Enviar solicitud</Text>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nuevo chat</Text>
      <Text style={styles.subtitle}>Busca a alguien registrado en UniLife para empezar a chatear.</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color="#6f7e49" />}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          query.trim().length > 0 && !searching ? (
            <Text style={styles.emptyText}>No encontramos a nadie con ese nombre.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.resultCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.full_name ?? "?").substring(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.resultName} numberOfLines={1}>
              {item.full_name ?? "Usuario"}
            </Text>
            {renderAction(item)}
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
  },
  subtitle: {
    color: "#666",
    marginTop: 4,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 15,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 30,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1B4079",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  resultName: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#1B4079",
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  sendButton: {
    backgroundColor: "#6f7e49",
  },
  openButton: {
    backgroundColor: "#1B4079",
  },
  respondButton: {
    backgroundColor: "#b9825b",
  },
  sentButton: {
    backgroundColor: "#e5e7eb",
  },
  sentText: {
    color: "#666",
    fontSize: 12,
    fontWeight: "600",
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
