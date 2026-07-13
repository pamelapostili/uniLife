import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CATEGORIAS } from "../lib/categorias";
import { supabase } from "../lib/supabase";
import { useUser } from "../lib/user-context";

export default function Inicio() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const [recommended, setRecommended] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

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
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, interests")
        .neq("id", user.id)
        .limit(6);

      if (!error && data) {
        setRecommended(data);
      }
      setFetching(false);
    })();
  }, [user]);

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
      ) : (
        recommended.map((person) => (
          <TouchableOpacity
            key={person.id}
            style={styles.profileCard}
            activeOpacity={0.85}
            onPress={() => router.push(`/usuario/${person.id}`)}
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
              <Text style={styles.name}>
                {person.full_name ?? "Usuario"}
              </Text>

              <Text style={styles.career}>
                {person.interests?.slice(0, 2).join(" · ") ?? "Intereses"}
              </Text>

              <Text style={styles.description}>
                {person.bio ?? "Aún no ha completado su biografía."}
              </Text>

              <View style={styles.tags}>
                {(person.interests ?? ["Conocer gente"]).slice(0, 3).map((tag: string) => (
                  <Text key={tag} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
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

  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  profileImage: {
    width: "100%",
    height: 380,
  },

  overlay: {
    position: "absolute",
    bottom: 0,
    padding: 20,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  name: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },

  career: {
    color: "#fff",
    marginTop: 5,
  },

  description: {
    color: "#fff",
    marginTop: 10,
  },

  tags: {
    flexDirection: "row",
    marginTop: 12,
  },

  tag: {
    backgroundColor: "rgba(255,255,255,0.2)",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 8,
  },
});