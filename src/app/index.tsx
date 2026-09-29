import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CATEGORIAS } from "../lib/categorias";
import { fetchFollowingSet, follow, unfollow } from "../lib/follows";
import { fetchRequestInfoBulk, RequestInfo, sendMessageRequest } from "../lib/messageRequests";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

type SuggestedProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[] | null;
  sharedCount: number;
};

export default function Inicio() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const [recommended, setRecommended] = useState<SuggestedProfile[]>([]);
  const [fetching, setFetching] = useState(true);
  const [requestInfoMap, setRequestInfoMap] = useState<Record<string, RequestInfo>>({});
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    (async () => {
      // Traemos un grupo más grande y elegimos aquí quiénes comparten más
      // intereses con el usuario actual, en vez de mostrar 6 perfiles al azar.
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, interests")
        .neq("id", user.id)
        .limit(40);

      if (!error && data) {
        const misIntereses = profile?.interests ?? [];
        const ranked: SuggestedProfile[] = (data as any[])
          .map((person) => {
            const suyos: string[] = person.interests ?? [];
            const sharedCount = suyos.filter((i) => misIntereses.includes(i)).length;
            return { ...person, sharedCount };
          })
          .sort((a, b) => b.sharedCount - a.sharedCount)
          .slice(0, 8);

        setRecommended(ranked);

        const ids = ranked.map((p) => p.id);
        const [reqMap, followSet] = await Promise.all([
          fetchRequestInfoBulk(user.id, ids),
          fetchFollowingSet(user.id, ids),
        ]);
        setRequestInfoMap(reqMap);
        setFollowingSet(followSet);
      }
      setFetching(false);
    })();
  }, [user, profile?.interests]);

  async function handleMensaje(personId: string) {
    if (!user) return;
    const info = requestInfoMap[personId] ?? {};

    const accepted = info.mine?.status === "accepted" || info.theirs?.status === "accepted";
    if (accepted) {
      const chatId = info.mine?.chat_id ?? info.theirs?.chat_id;
      if (chatId) router.push(`/chat/${chatId}`);
      return;
    }

    if (info.theirs?.status === "pending") {
      router.push("/notificaciones");
      return;
    }

    if (info.mine?.status === "pending") {
      return;
    }

    setPendingAction(`msg-${personId}`);
    const { error } = await sendMessageRequest(user.id, personId);
    if (!error) {
      setRequestInfoMap((prev) => ({
        ...prev,
        [personId]: { ...prev[personId], mine: { status: "pending", chat_id: null } },
      }));
    }
    setPendingAction(null);
  }

  async function handleSeguir(personId: string) {
    if (!user) return;
    const siguiendo = followingSet.has(personId);
    setPendingAction(`follow-${personId}`);

    if (siguiendo) {
      const { error } = await unfollow(user.id, personId);
      if (!error) {
        setFollowingSet((prev) => {
          const next = new Set(prev);
          next.delete(personId);
          return next;
        });
      }
    } else {
      const { error } = await follow(user.id, personId);
      if (!error) {
        setFollowingSet((prev) => new Set(prev).add(personId));
      }
    }
    setPendingAction(null);
  }

  function mensajeLabel(personId: string) {
    const info = requestInfoMap[personId] ?? {};
    if (info.mine?.status === "accepted" || info.theirs?.status === "accepted") return "Chatear";
    if (info.theirs?.status === "pending") return "Responder";
    if (info.mine?.status === "pending") return "Enviado";
    return "Mensaje";
  }

  const misGrupos = profile?.interests ?? [];

  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        Hola {profile?.full_name ?? user.email?.split("@")[0] ?? ""}, ¿qué deseas hacer hoy?
      </Text>

      <View style={styles.grid}>
        {CATEGORIAS.map((item) => {
          const unido = misGrupos.includes(item.titulo);
          return (
            <TouchableOpacity
              key={item.titulo}
              style={[styles.card, unido && styles.cardActive]}
              onPress={() => router.push(`/grupo/${encodeURIComponent(item.titulo)}`)}
            >
              {unido && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#6f7e49" />
                </View>
              )}

              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: item.color },
                ]}
              >
                <Ionicons
                  name={item.icon as any}
                  size={24}
                  color="#fff"
                />
              </View>

              <Text style={styles.cardText}>
                {item.titulo}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.subtitle}>
        Personas que podrían interesarte
      </Text>

      {fetching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6f7e49" />
        </View>
      ) : recommended.length === 0 ? (
        <Text style={styles.emptyText}>Aún no hay más personas para sugerirte.</Text>
      ) : (
        recommended.map((person) => {
          const siguiendo = followingSet.has(person.id);
          return (
            <View key={person.id} style={styles.profileCard}>
              <Pressable
                onPress={() => router.push(`/usuario/${person.id}`)}
                style={({ pressed }) => [styles.imageWrap, pressed && styles.imagePressed]}
              >
                <Image
                  source={{
                    uri:
                      person.avatar_url ||
                      `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(
                        person.full_name ?? person.id
                      )}`,
                  }}
                  style={styles.profileImage}
                />

                <View style={styles.overlay}>
                  <View style={styles.overlayTop}>
                    <Text style={styles.name}>
                      {person.full_name ?? "Usuario"}
                    </Text>
                    {person.sharedCount > 0 && (
                      <View style={styles.sharedBadge}>
                        <Ionicons name="sparkles" size={12} color="#6f7e49" />
                        <Text style={styles.sharedBadgeText}>
                          {person.sharedCount} en común
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.description}>
                    {person.bio ?? "Aún no ha completado su biografía."}
                  </Text>

                  <View style={styles.tags}>
                    {(person.interests ?? []).slice(0, 3).map((tag: string) => (
                      <Text key={tag} style={styles.tag}>
                        {tag}
                      </Text>
                    ))}
                  </View>
                </View>
              </Pressable>

              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => router.push(`/usuario/${person.id}`)}
                >
                  <Ionicons name="person-outline" size={18} color="#334155" />
                  <Text style={styles.quickActionText}>Ver perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => handleMensaje(person.id)}
                  disabled={pendingAction === `msg-${person.id}`}
                >
                  {pendingAction === `msg-${person.id}` ? (
                    <ActivityIndicator size="small" color="#334155" />
                  ) : (
                    <>
                      <Ionicons name="chatbubble-outline" size={18} color="#334155" />
                      <Text style={styles.quickActionText}>{mensajeLabel(person.id)}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickAction, siguiendo && styles.quickActionActive]}
                  onPress={() => handleSeguir(person.id)}
                  disabled={pendingAction === `follow-${person.id}`}
                >
                  {pendingAction === `follow-${person.id}` ? (
                    <ActivityIndicator size="small" color={siguiendo ? "#fff" : "#334155"} />
                  ) : (
                    <>
                      <Ionicons
                        name={siguiendo ? "person-remove-outline" : "person-add-outline"}
                        size={18}
                        color={siguiendo ? "#fff" : "#334155"}
                      />
                      <Text style={[styles.quickActionText, siguiendo && styles.quickActionTextActive]}>
                        {siguiendo ? "Siguiendo" : "Seguir"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef5f3",
    padding: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 20,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    alignItems: "center",
    position: "relative",
  },

  cardActive: {
    borderWidth: 2,
    borderColor: "#6f7e49",
  },

  checkBadge: {
    position: "absolute",
    top: 8,
    right: 8,
  },

  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },

  cardText: {
    fontSize: 15,
    fontWeight: "500",
  },

  subtitle: {
    fontSize: 22,
    fontWeight: "600",
    marginVertical: 20,
  },

  emptyText: {
    color: "#94a3b8",
    marginBottom: 20,
  },

  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  imageWrap: {
    transform: [{ scale: 1 }],
  },

  imagePressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },

  profileImage: {
    width: "100%",
    height: 340,
  },

  overlay: {
    position: "absolute",
    bottom: 0,
    padding: 20,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  overlayTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

  name: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginRight: 10,
  },

  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  sharedBadgeText: {
    color: "#6f7e49",
    fontWeight: "700",
    fontSize: 12,
    marginLeft: 4,
  },

  description: {
    color: "#fff",
    marginTop: 10,
  },

  tags: {
    flexDirection: "row",
    marginTop: 12,
    flexWrap: "wrap",
  },

  tag: {
    backgroundColor: "rgba(255,255,255,0.2)",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },

  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
  },

  quickAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },

  quickActionActive: {
    backgroundColor: "#6f7e49",
  },

  quickActionText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12,
    marginLeft: 6,
  },

  quickActionTextActive: {
    color: "#fff",
  },
});
