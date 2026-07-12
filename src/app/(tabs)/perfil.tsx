import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useUser } from "../../lib/user-context";

export default function PerfilScreen() {
  const { user, profile, loading, signOut, refreshProfile } = useUser();
  const router = useRouter();

  const [editVisible, setEditVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [nombre, setNombre] = useState("");
  const [bio, setBio] = useState("");
  const [interesesTexto, setInteresesTexto] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user]);

  function openEdit() {
    setNombre(profile?.full_name ?? "");
    setBio(profile?.bio ?? "");
    setInteresesTexto((profile?.interests ?? []).join(", "));
    setAvatarUrl(profile?.avatar_url ?? "");
    setEditVisible(true);
  }

  async function guardarPerfil() {
    if (!user) return;

    setSavingProfile(true);
    const interests = interesesTexto
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: nombre.trim() || null,
        bio: bio.trim() || null,
        interests,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSavingProfile(false);

    if (error) {
      const msg = `No se pudo guardar: ${error.message}`;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
      return;
    }

    await refreshProfile();
    setEditVisible(false);
  }

  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6f7e49" />
      </View>
    );
  }

  const intereses = profile?.interests ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Image
          source={{
            uri:
              profile?.avatar_url ||
              `https://api.dicebear.com/6.x/initials/svg?seed=${encodeURIComponent(
                profile?.full_name ?? user.email ?? "user"
              )}`,
          }}
          style={styles.avatar}
        />

        <View style={styles.headerInfo}>
          <Text style={styles.name}>{profile?.full_name ?? user.email?.split("@")[0]}</Text>
          <Text style={styles.bio}>
            {profile?.bio ?? "Actualiza tu biografía para que otros te conozcan mejor."}
          </Text>

          <TouchableOpacity style={styles.button} onPress={openEdit}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Editar perfil</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Mis intereses</Text>
        {intereses.length > 0 ? (
          <View style={styles.tagsRow}>
            {intereses.map((item) => (
              <View key={item} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Aún no agregas intereses. Toca "Editar perfil" para añadirlos.</Text>
        )}
      </View>

      <Modal visible={editVisible} animationType="fade" transparent onRequestClose={() => setEditVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditVisible(false)}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Editar perfil</Text>

            <TextInput
              placeholder="Nombre completo"
              value={nombre}
              onChangeText={setNombre}
              style={styles.modalInput}
            />

            <TextInput
              placeholder="Biografía"
              value={bio}
              onChangeText={setBio}
              multiline
              style={styles.modalDescription}
            />

            <TextInput
              placeholder="Intereses (separados por coma)"
              value={interesesTexto}
              onChangeText={setInteresesTexto}
              style={styles.modalInput}
            />

            <TextInput
              placeholder="URL de foto de perfil (opcional)"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              autoCapitalize="none"
              style={styles.modalInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => setEditVisible(false)}>
                <Text style={styles.cancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.guardarBtn} onPress={guardarPerfil} disabled={savingProfile}>
                {savingProfile ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="white" />
                    <Text style={styles.guardarTexto}>Guardar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  buttonSecondary: {
    backgroundColor: "#94a3b8",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
    color: "#334155",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalDescription: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    height: 80,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  cancelarBtn: {
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelarTexto: {
    fontWeight: "600",
    color: "#475569",
  },
  guardarBtn: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: "#6f7e49",
    borderRadius: 10,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  guardarTexto: {
    color: "white",
    fontWeight: "700",
    marginLeft: 5,
  },
});
