import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CATEGORIAS } from "../../lib/categorias";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../lib/user-context";

type Miembro = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function GrupoScreen() {
  const { user, profile, loading, refreshProfile } = useUser();
  const router = useRouter();
  const params = useLocalSearchParams();
  const categoria = decodeURIComponent(params.categoria as string);
  const info = CATEGORIAS.find((c) => c.titulo === categoria);

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [fetching, setFetching] = useState(true);
  const [joining, setJoining] = useState(false);

  const soyMiembro = (profile?.interests ?? []).includes(categoria);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  async function loadMiembros() {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .contains("interests", [categoria])
      .neq("id", user.id);

    if (error) {
      console.warn("[profiles.select grupo] ", error.message);
    } else {
      setMiembros((data as Miembro[]) ?? []);
    }
    setFetching(false);
  }

  useEffect(() => {
    if (!user) return;
    loadMiembros();
  }, [user, categoria]);

  async function toggleGrupo() {
    if (!user) return;
    setJoining(true);

    const actuales = profile?.interests ?? [];
    const nuevos = soyMiembro ? actuales.filter((i) => i !== categoria) : [...actuales, categoria];

    const { error } = await supabase
      .from("profiles")
      .update({ interests: nuevos, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      console.warn("[profiles.update grupo] ", error.message);
    } else {
      await refreshProfile();
      await loadMiembros();
    }
    setJoining(false);
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
      <View style={[styles.header, { backgroundColor: info?.color ?? "#6f7e49" }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerIconWrap}>
          <Ionicons name={(info?.icon as any) ?? "people-outline"} size={40} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>{categoria}</Text>
        <Text style={styles.headerSubtitle}>
          {miembros.length} {miembros.length === 1 ? "persona interesada" : "personas interesadas"}
        </Text>

        <TouchableOpacity
          style={[styles.joinButton, soyMiembro && styles.joinButtonActive]}
          onPress={toggleGrupo}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator size="small" color={soyMiembro ? "#1B4079" : "#fff"} />
          ) : (
            <Text style={[styles.joinButtonText, soyMiembro && styles.joinButtonTextActive]}>
              {soyMiembro ? "✓ Ya eres parte de este grupo" : "Unirme al grupo"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={miembros}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>Aún no hay nadie interesado en este grupo.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.memberCard} onPress={() => router.push(`/usuario/${item.id}`)}>
            <Image
              source={{
                uri:
                  item.avatar_url ||
                  `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(item.full_name ?? item.id)}`,
              }}
              style={styles.memberAvatar}
            />
            <Text style={styles.memberName} numberOfLines={1}>
              {item.full_name ?? "Usuario"}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7F1" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  backButton: { position: "absolute", top: 50, left: 16 },
  headerIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
  headerSubtitle: { color: "rgba(255,255,255,0.85)", marginTop: 4, marginBottom: 16 },
  joinButton: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  joinButtonActive: { backgroundColor: "#fff" },
  joinButtonText: { color: "#fff", fontWeight: "700" },
  joinButtonTextActive: { color: "#1B4079" },
  list: { padding: 18 },
  emptyText: { textAlign: "center", color: "#999", marginTop: 30 },
  memberCard: {
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
  memberAvatar: { width: 46, height: 46, borderRadius: 23 },
  memberName: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: "600", color: "#1B4079" },
});
