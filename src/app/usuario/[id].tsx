import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fetchRequestInfo, RequestInfo, sendMessageRequest } from "../../lib/messageRequests";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../lib/user-context";

type PublicProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[] | null;
};

export default function PerfilPublicoScreen() {
  const { user, loading } = useUser();
  const router = useRouter();
  const params = useLocalSearchParams();
  const otherId = params.id as string;

  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [requestInfo, setRequestInfo] = useState<RequestInfo>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !otherId) return;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, interests")
        .eq("id", otherId)
        .maybeSingle();

      if (error) {
        console.warn("[profiles.select] ", error.message);
      }
      setProfile((data as PublicProfile) ?? null);

      if (data) {
        setRequestInfo(await fetchRequestInfo(user.id, otherId));
      }
    })();
  }, [user, otherId]);

  async function handleSendRequest() {
    if (!user) return;
    setSending(true);
    const { error } = await sendMessageRequest(user.id, otherId);
    if (error) {
      console.warn("[message_requests.upsert] ", error.message);
    } else {
      setRequestInfo((prev) => ({ ...prev, mine: { status: "pending", chat_id: null } }));
    }
    setSending(false);
  }

  function renderAction() {
    const accepted = requestInfo.mine?.status === "accepted" || requestInfo.theirs?.status === "accepted";

    if (accepted) {
      const chatId = requestInfo.mine?.chat_id ?? requestInfo.theirs?.chat_id;
      return (
        <TouchableOpacity style={[styles.actionButton, styles.openButton]} onPress={() => chatId && router.push(`/chat/${chatId}`)}>
          <Ionicons name="chatbubble-outline" size={18} color="#fff" />
          <Text style={styles.actionText}>Abrir chat</Text>
        </TouchableOpacity>
      );
    }

    if (requestInfo.theirs?.status === "pending") {
      return (
        <TouchableOpacity style={[styles.actionButton, styles.respondButton]} onPress={() => router.push("/notificaciones")}>
          <Text style={styles.actionText}>Responder solicitud</Text>
        </TouchableOpacity>
      );
    }

    if (requestInfo.mine?.status === "pending") {
      return (
        <View style={[styles.actionButton, styles.sentButton]}>
          <Text style={styles.sentText}>Solicitud enviada</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity style={[styles.actionButton, styles.sendButton]} onPress={handleSendRequest} disabled={sending}>
        {sending ? <ActivityIndicator size="small" color="#fff" /> : (
          <>
            <Ionicons name="paper-plane-outline" size={16} color="#fff" />
            <Text style={styles.actionText}>Enviar solicitud</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  if (loading || profile === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  if (profile === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.notFoundText}>Usuario no encontrado.</Text>
      </View>
    );
  }

  const intereses = profile.interests ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#1B4079" />
      </TouchableOpacity>

      <View style={styles.headerCard}>
        <Image
          source={{
            uri:
              profile.avatar_url ||
              `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(profile.full_name ?? profile.id)}`,
          }}
          style={styles.avatar}
        />
        <Text style={styles.name}>{profile.full_name ?? "Usuario"}</Text>
        <Text style={styles.bio}>{profile.bio ?? "Aún no ha completado su biografía."}</Text>

        {renderAction()}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Intereses y grupos</Text>
        {intereses.length > 0 ? (
          <View style={styles.tagsRow}>
            {intereses.map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Aún no agregó intereses.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fa" },
  content: { padding: 16, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFoundText: { color: "#64748b", fontSize: 16 },
  backButton: { marginBottom: 12 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  name: { fontSize: 22, fontWeight: "700", color: "#111827" },
  bio: { color: "#475569", marginTop: 8, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  sendButton: { backgroundColor: "#6f7e49" },
  openButton: { backgroundColor: "#1B4079" },
  respondButton: { backgroundColor: "#b9825b" },
  sentButton: { backgroundColor: "#e5e7eb" },
  sentText: { color: "#666", fontWeight: "600" },
  actionText: { color: "#fff", fontWeight: "700", marginLeft: 6 },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: "#111827" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap" },
  tag: {
    backgroundColor: "#e7efcc",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: { color: "#4b5563", fontWeight: "600" },
  emptyText: { color: "#94a3b8", fontSize: 13 },
});
