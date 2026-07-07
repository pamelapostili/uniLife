import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useUser } from "../lib/user-context";

export default function PerfilScreen() {
  const { user, profile, loading, signOut } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user]);

  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  const intereses = profile?.interests ?? ["Lectura", "Tecnología", "Café", "Deportes"];

  const estadisticas = [
    { label: "Amigos", value: "128" },
    { label: "Eventos", value: "14" },
    { label: "Reto", value: "3" },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Image
          source={{ uri: "https://i.pravatar.cc/150?img=47" }}
          style={styles.avatar}
        />

        <View style={styles.headerInfo}>
          <Text style={styles.name}>{profile?.full_name ?? user.email?.split("@")[0]}</Text>
          <Text style={styles.role}>{profile?.bio ?? "Sin descripción personal aún."}</Text>
          <Text style={styles.bio}>
            {profile?.bio ?? "Actualiza tu biografía para que otros te conozcan mejor."}
          </Text>

          <TouchableOpacity style={styles.button} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Mis intereses</Text>
        <View style={styles.tagsRow}>
          {intereses.map((item) => (
            <View key={item} style={styles.tag}>
              <Text style={styles.tagText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Resumen</Text>
        <View style={styles.statsRow}>
          {estadisticas.map((item) => (
            <View key={item.label} style={styles.statBox}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Actividad reciente</Text>
        <View style={styles.activityItem}>
          <Ionicons name="calendar-outline" size={18} color="#6f7e49" />
          <Text style={styles.activityText}>Participaste en 2 eventos esta semana</Text>
        </View>
        <View style={styles.activityItem}>
          <Ionicons name="chatbubble-outline" size={18} color="#6f7e49" />
          <Text style={styles.activityText}>Respondiste en 3 foros de comunidad</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignSelf: "center",
    marginBottom: 12,
  },
  headerInfo: {
    alignItems: "center",
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  role: {
    color: "#64748b",
    marginTop: 4,
    fontSize: 14,
  },
  bio: {
    color: "#475569",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 14,
    backgroundColor: "#6f7e49",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
  },
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#111827",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#e7efcc",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  statLabel: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  activityText: {
    marginLeft: 8,
    color: "#334155",
  },
});
